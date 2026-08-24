/**
 * ApiClient gegen eine Attrappe von fetch, PHASE_7 Tests 1 bis 3, 8 und 9.
 */
import { describe, expect, it, vi } from 'vitest';
import { API_CODES, ApiError, createApiClient } from '../src/net/apiClient';
import type { TokenStore } from '../src/net/apiClient';
import { checksum } from '../src/net/localStore';
import { serialize } from '../src/core/state';
import { createNewGame } from '../src/core/state';
import { FIRST_MAP_ID, createGameContent } from '../src/app/gameContent';
import type { GameState } from '../src/core/types';

const content = createGameContent();

function memoryTokens(initial: string | null = null): TokenStore {
  let token = initial;
  return {
    read: async () => token,
    write: async (value) => {
      token = value;
    },
  };
}

/** Antwort mit Kopfzeilen, wie sie der Server schickt. */
function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Liest den Anfragekoerper, auch wenn der Client ihn gzip-gepackt hat. */
async function readBody(init?: RequestInit): Promise<string> {
  const body = init?.body;
  if (typeof body === 'string') return body;

  const bytes = body as ArrayBuffer;
  const packed = new Headers(init?.headers).get('Content-Encoding') === 'gzip';
  if (!packed) return new TextDecoder().decode(bytes);

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function fresh(): GameState {
  return createNewGame(99, content, FIRST_MAP_ID);
}

describe('createApiClient', () => {
  // Test 1
  it('merkt sich den Token und schickt ihn beim naechsten Aufruf mit', async () => {
    const calls: RequestInit[] = [];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(init ?? {});
      return calls.length === 1
        ? reply(200, { userId: 7, token: 'a'.repeat(64), expiresAt: '2026-09-01T00:00:00Z' })
        : reply(200, { saves: [] });
    });

    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens: memoryTokens(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    const auth = await api.login('spieler@example.org', 'geheimnis123');
    expect(auth.token).toBe('a'.repeat(64));
    expect(new Headers(calls[0]?.headers).get('Authorization')).toBeNull();

    await api.listSaves();
    expect(new Headers(calls[1]?.headers).get('Authorization')).toBe(`Bearer ${'a'.repeat(64)}`);
  });

  // Test 2
  it('verwirft den Token bei 401 und wirft ApiError mit dem Code des Servers', async () => {
    const tokens = memoryTokens('b'.repeat(64));
    let signedOut = false;
    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens,
      onSignedOut: () => {
        signedOut = true;
      },
      fetcher: (async () =>
        reply(401, { error: { code: 'unauthorized', message: 'Anmeldung noetig' } })) as unknown as typeof fetch,
    });

    await expect(api.listSaves()).rejects.toMatchObject({
      name: 'ApiError',
      code: API_CODES.unauthorized,
      status: 401,
    });
    expect(await tokens.read()).toBeNull();
    expect(signedOut).toBe(true);
  });

  // Test 3
  it('bricht nach der Zeitgrenze mit ApiError ab, nicht mit einer offenen Ausnahme', async () => {
    vi.useFakeTimers();
    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens: memoryTokens(),
      timeoutMs: 15000,
      fetcher: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })) as unknown as typeof fetch,
    });

    const pending = api.listSaves();
    const settled = expect(pending).rejects.toMatchObject({
      name: 'ApiError',
      code: API_CODES.timeout,
    });
    await vi.advanceTimersByTimeAsync(15001);
    await settled;
    vi.useRealTimers();
  });

  it('meldet einen Netzfehler als ApiError mit dem Code offline', async () => {
    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens: memoryTokens(),
      fetcher: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });

    await expect(api.listSaves()).rejects.toMatchObject({ code: API_CODES.offline });
  });

  // Test 8
  it('schickt dieselbe Pruefsumme, die localStore berechnet', async () => {
    let sent: unknown = null;
    const state = fresh();
    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens: memoryTokens('c'.repeat(64)),
      fetcher: (async (_url: string, init?: RequestInit) => {
        sent = JSON.parse(await readBody(init));
        return reply(200, { meta: { slot: 1, checksum: 'egal' } });
      }) as unknown as typeof fetch,
    });

    await api.pushSave(1, state);
    expect((sent as { checksum: string }).checksum).toBe(await checksum(serialize(state)));
  });

  // Test 9
  it('sendet einen Stand ueber zwei Megabyte gar nicht erst', async () => {
    const fetcher = vi.fn(async () => reply(200, {}));
    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens: memoryTokens('d'.repeat(64)),
      fetcher: fetcher as unknown as typeof fetch,
    });

    const state = fresh();
    // Ein Protokolleintrag je Runde reicht, um die Grenze zu reissen.
    state.log = Array.from({ length: 40000 }, (_value, index) => ({
      turn: index,
      kind: 'system' as const,
      text: 'Ein sehr langer Eintrag, der den Stand aufblaeht '.repeat(2),
    }));

    await expect(api.pushSave(0, state)).rejects.toMatchObject({ code: API_CODES.tooLarge });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('wirft ApiError auch bei einer Antwort ohne Fehlerobjekt', async () => {
    const api = createApiClient({
      baseUrl: 'https://example.org/api',
      tokens: memoryTokens('e'.repeat(64)),
      fetcher: (async () => reply(500, {})) as unknown as typeof fetch,
    });

    const error = await api.listSaves().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('server_error');
  });
});
