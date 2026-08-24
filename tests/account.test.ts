/**
 * Kontobereich, PHASE_7 Block 4.
 */
import { describe, expect, it } from 'vitest';
import { accountSummary, errorText } from '../src/ui/account';

describe('accountSummary', () => {
  it('unterscheidet ohne Server, nicht angemeldet und angemeldet', () => {
    expect(accountSummary({ email: null, pending: 0, configured: false })).toBe(
      'Kein Server eingerichtet'
    );
    expect(accountSummary({ email: null, pending: 0, configured: true })).toBe('Nicht angemeldet');
    expect(accountSummary({ email: 'a@example.org', pending: 0, configured: true })).toBe(
      'a@example.org · alles übertragen'
    );
  });

  it('zaehlt die wartenden Staende und beugt sie richtig', () => {
    expect(accountSummary({ email: 'a@example.org', pending: 1, configured: true })).toBe(
      'a@example.org · 1 Stand wartet'
    );
    expect(accountSummary({ email: 'a@example.org', pending: 3, configured: true })).toBe(
      'a@example.org · 3 Stände warten'
    );
  });
});

describe('errorText', () => {
  it('uebersetzt die Codes des Servers ins Deutsche', () => {
    expect(errorText('unauthorized')).toBe('E-Mail oder Passwort stimmt nicht');
    expect(errorText('conflict')).toBe('Diese Adresse ist schon vergeben');
    expect(errorText('rate_limited')).toContain('Zu viele Versuche');
    expect(errorText('offline')).toContain('Keine Verbindung');
    expect(errorText('timeout')).toContain('nicht rechtzeitig');
  });

  it('hat fuer unbekannte Codes eine Antwort, die keine Innereien zeigt', () => {
    expect(errorText('irgendwas_neues')).toBe('Das hat nicht geklappt');
  });
});
