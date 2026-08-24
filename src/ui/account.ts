/**
 * Anmeldung und Kontobereich, PHASE_7 Block 4.
 *
 * "Ohne Konto spielen" steht gleichberechtigt neben Anmelden und
 * Registrieren. Wer offline spielen will, soll das ohne Umweg koennen.
 */
import { Overlay, overlayButton } from './overlay';
import type { ApiClient } from '../core/types';

export type AccountState = {
  /** E-Mail der angemeldeten Sitzung, sonst null. */
  email: string | null;
  /** Wie viele Staende warten noch auf Uebertragung? */
  pending: number;
  /** Ist ueberhaupt ein Backend eingerichtet? */
  configured: boolean;
};

export type AccountHandlers = {
  onDone: () => void;
  onSignedIn: (email: string) => void;
  onSignedOut: () => void;
};

/** Zustandstext des Kontobereichs im Menue. */
export function accountSummary(state: AccountState): string {
  if (!state.configured) return 'Kein Server eingerichtet';
  if (state.email === null) return 'Nicht angemeldet';
  if (state.pending === 0) return `${state.email} · alles übertragen`;
  const staende = state.pending === 1 ? 'Stand wartet' : 'Stände warten';
  return `${state.email} · ${state.pending} ${staende}`;
}

/** Deutsche Meldung zu einem Fehlercode des Servers. */
export function errorText(code: string): string {
  switch (code) {
    case 'unauthorized':
      return 'E-Mail oder Passwort stimmt nicht';
    case 'conflict':
      return 'Diese Adresse ist schon vergeben';
    case 'rate_limited':
      return 'Zu viele Versuche. Bitte später erneut probieren';
    case 'offline':
      return 'Keine Verbindung zum Server';
    case 'timeout':
      return 'Der Server hat nicht rechtzeitig geantwortet';
    case 'bad_request':
      return 'Bitte E-Mail und ein Passwort mit mindestens zehn Zeichen angeben';
    default:
      return 'Das hat nicht geklappt';
  }
}

/** Ein beschriftetes Eingabefeld. Der Aufrufer haengt `wrap` ein. */
function field(
  doc: Document,
  label: string,
  type: string
): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = doc.createElement('label');
  wrap.className = 'sx-field';
  const caption = doc.createElement('span');
  caption.textContent = label;
  const input = doc.createElement('input');
  input.type = type;
  input.className = 'sx-field__input';
  input.autocomplete = type === 'password' ? 'current-password' : 'email';
  wrap.append(caption, input);
  return { wrap, input };
}

export class AccountView {
  constructor(
    private readonly overlay: Overlay,
    private readonly api: ApiClient,
    private readonly handlers: AccountHandlers
  ) {}

  /** Anmeldemaske. `mode` entscheidet nur ueber Beschriftung und Endpunkt. */
  open(mode: 'login' | 'register' = 'login'): void {
    const doc = this.overlay.element().ownerDocument;
    const email = field(doc, 'E-Mail', 'email');
    const password = field(doc, 'Passwort', 'password');
    const address = (): string => email.input.value.trim();
    const note = doc.createElement('p');
    note.className = 'sx-overlay__note';

    const submit = async (): Promise<void> => {
      note.textContent = 'Einen Moment …';
      try {
        const result =
          mode === 'register'
            ? await this.api.register(address(), password.input.value)
            : await this.api.login(address(), password.input.value);
        if (result.token !== '') this.handlers.onSignedIn(address());
      } catch (error) {
        const code = (error as { code?: string }).code ?? 'server_error';
        note.textContent = errorText(code);
      }
    };

    this.overlay.show(
      mode === 'register' ? 'Konto anlegen' : 'Anmelden',
      email.wrap,
      password.wrap,
      overlayButton(doc, mode === 'register' ? 'Konto anlegen' : 'Anmelden', '', () => void submit()),
      overlayButton(
        doc,
        mode === 'register' ? 'Ich habe schon ein Konto' : 'Neues Konto anlegen',
        '',
        () => this.open(mode === 'register' ? 'login' : 'register')
      ),
      overlayButton(doc, 'Ohne Konto spielen', 'Spielstände bleiben auf diesem Gerät', () =>
        this.handlers.onDone()
      ),
      note
    );
  }

  /** Kontobereich im Menue: Adresse, Warteschlange, Abmelden. */
  openSection(state: AccountState): void {
    const doc = this.overlay.element().ownerDocument;
    const rows: HTMLElement[] = [
      overlayButton(doc, 'Zustand', accountSummary(state), () => undefined, true),
    ];

    if (state.configured && state.email === null) {
      rows.push(overlayButton(doc, 'Anmelden', '', () => this.open('login')));
      rows.push(overlayButton(doc, 'Konto anlegen', '', () => this.open('register')));
    }
    if (state.email !== null) {
      rows.push(
        overlayButton(doc, 'Abmelden', 'Spielstände bleiben auf diesem Gerät', () => {
          void this.api.logout().finally(() => this.handlers.onSignedOut());
        })
      );
    }

    rows.push(overlayButton(doc, 'Zurück', '', () => this.handlers.onDone()));
    this.overlay.show('Konto', ...rows);
  }
}
