/**
 * Anbindung an das PHP-Backend, PHASE_7 Block 3.
 *
 * Setzt `ApiClient` aus INTERFACES Abschnitt 13 um. Der Token liegt in
 * IndexedDB, nicht in localStorage: eine fremde Erweiterung liest den einen
 * leichter als den anderen, und Capacitor hat einen eigenen Origin.
 *
 * Kein Aufruf darf das Spiel blockieren. Jeder Fehler kommt als `ApiError`
 * heraus, nie als abgebrochenes Versprechen ohne Grund.
 */
import { serialize } from '../core/state';
import { checksum, saveSizeOf } from './localStore';
import type { ApiClient, AuthResult, Difficulty, GameState, SaveMeta } from '../core/types';

/** Zeitueberschreitung eines Aufrufs. Danach gilt der Server als weg. */
export const TIMEOUT_MS = 15000;

/** Fehlercodes, die der Server schickt. Der Client wertet sie aus. */
export const API_CODES = {
  unauthorized: 'unauthorized',
  rateLimited: 'rate_limited',
  conflict: 'conflict',
  tooLarge: 'too_large',
  offline: 'offline',
  timeout: 'timeout',
  unprocessable: 'unprocessable',
} as const;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Ablage des Tokens. Die Tests setzen eine Attrappe ein. */
export interface TokenStore {
  read(): Promise<string | null>;
  write(token: string | null): Promise<void>;
}

export type ApiOptions = {
  baseUrl: string;
  tokens: TokenStore;
  fetcher?: typeof fetch;
  /** Wird gerufen, wenn der Server die Sitzung ablehnt. */
  onSignedOut?: () => void;
  timeoutMs?: number;
  /** Loest den Kartennamen auf, wie in localStore. Ohne Inhalte bleibt die Id. */
  mapNameOf?: (mapId: string) => string;
};

type Json = Record<string, unknown>;

/** Packt den Text, wenn der Browser CompressionStream kennt. */
async function gzip(text: string): Promise<{ body: BodyInit; encoding: string | null }> {
  const bytes = new TextEncoder().encode(text);
  const stream = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (stream === undefined) return { body: bytes, encoding: null };

  const packed = new Blob([bytes]).stream().pipeThrough(new stream('gzip'));
  return { body: await new Response(packed).arrayBuffer(), encoding: 'gzip' };
}

export function createApiClient(options: ApiOptions): ApiClient & {
  token(): Promise<string | null>;
  signOutLocally(): Promise<void>;
} {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const base = options.baseUrl.replace(/\/+$/, '');
  const mapNameOf = options.mapNameOf ?? ((mapId: string): string => mapId);

  async function request(path: string, init: RequestInit = {}, auth = true): Promise<Json> {
    const token = auth ? await options.tokens.read() : null;
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (token !== null) headers.set('Authorization', `Bearer ${token}`);

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, { ...init, headers, signal: abort.signal });
    } catch (error) {
      // Abbruch und Netzfehler sehen von aussen gleich aus, sind es aber nicht.
      const aborted = abort.signal.aborted;
      throw new ApiError(
        aborted ? API_CODES.timeout : API_CODES.offline,
        aborted ? 'Der Server hat nicht rechtzeitig geantwortet' : 'Keine Verbindung zum Server'
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    const body = text === '' ? {} : (JSON.parse(text) as Json);

    if (response.ok) return body;

    const error = (body['error'] ?? {}) as { code?: string; message?: string };
    const code = error.code ?? 'server_error';
    if (response.status === 401) {
      await options.tokens.write(null);
      options.onSignedOut?.();
    }
    throw new ApiError(code, error.message ?? 'Der Server hat abgelehnt', response.status);
  }

  async function authenticate(path: string, email: string, password: string): Promise<AuthResult> {
    const body = await request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      false
    );
    const result = body as unknown as AuthResult;
    await options.tokens.write(result.token);
    return result;
  }

  return {
    async register(email: string, password: string): Promise<AuthResult> {
      return authenticate('/auth/register', email, password);
    },

    async login(email: string, password: string): Promise<AuthResult> {
      return authenticate('/auth/login', email, password);
    },

    async logout(): Promise<void> {
      try {
        await request('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
      } finally {
        // Auch wenn der Server nicht erreichbar war: lokal ist die Sitzung weg.
        await options.tokens.write(null);
      }
    },

    async listSaves(): Promise<SaveMeta[]> {
      const body = await request('/saves', { method: 'GET' });
      const saves = body['saves'];
      return Array.isArray(saves) ? (saves as SaveMeta[]) : [];
    },

    /**
     * `ApiClient.pullSave` aus INTERFACES Abschnitt 13 kennt nur den Platz,
     * die Staende liegen aber je Schwierigkeitsgrad getrennt (SPEC 11) und der
     * Endpunkt braucht beides. Der zweite Parameter ist optional und damit mit
     * dem Vertrag vertraeglich; die Luecke ist gemeldet.
     */
    async pullSave(slot: number, difficulty: Difficulty = 'normal'): Promise<{
      meta: SaveMeta;
      state: GameState;
    }> {
      const body = await request(`/saves/${difficulty}/${slot}`, { method: 'GET' });
      return body as unknown as { meta: SaveMeta; state: GameState };
    },

    async pushSave(slot: number, state: GameState): Promise<SaveMeta> {
      const json = serialize(state);
      const size = saveSizeOf(json);
      // Regel aus SPEC Abschnitt 11: zu grosse Staende gehen gar nicht erst raus.
      if (!size.ok) {
        throw new ApiError(API_CODES.tooLarge, `Spielstand ist ${size.bytes} Bytes gross`);
      }

      // Der Stand geht als Text hinaus, nicht als verschachteltes Objekt.
      // Die Pruefsumme deckt genau diese Zeichen ab; wuerde der Server das
      // Objekt neu kodieren, waeren Zahlenformat und Escapes eine Fehlerquelle.
      const payload = JSON.stringify({
        state: json,
        checksum: await checksum(json),
        mapName: mapNameOf(state.currentMapId),
      });
      const packed = await gzip(payload);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (packed.encoding !== null) headers['Content-Encoding'] = packed.encoding;

      const body = await request(`/saves/${state.difficulty}/${slot}`, {
        method: 'PUT',
        headers,
        body: packed.body,
      });
      return body['meta'] as SaveMeta;
    },

    async token(): Promise<string | null> {
      return options.tokens.read();
    },

    async signOutLocally(): Promise<void> {
      await options.tokens.write(null);
    },
  };
}
