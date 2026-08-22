/**
 * Garantierte Bossbeute, CONTENT_TABLES Abschnitt 2.
 *
 * Die ersten vier einzigartigen Gegenstaende fallen ausschliesslich beim
 * jeweiligen Boss und dort ohne Wurf. Die Zuordnung soll laut PHASE_5 ueber ein
 * neues Feld `guaranteedUniqueId` in `EnemyDef` laufen. Das Feld ist eine
 * Vertragsluecke und bis zur Freigabe nicht gesetzt; der in PHASE_5 genannte
 * Zwischenweg ueber `drops` traegt keine Instanz mit Affixen. Bis der Vertrag
 * nachzieht, steht die Zuordnung hier und nicht in content/.
 */

/** Boss-Id zu seinem garantierten einzigartigen Gegenstand. */
export const BOSS_UNIQUES: Readonly<Record<string, string>> = {
  boss_halvern: 'uq_halvern_visier',
  boss_sporemother: 'uq_sporenlunge',
  boss_rime: 'uq_frostkern',
  boss_sorlax: 'uq_sorlax_auge',
};

/** Der garantierte einzigartige Gegenstand dieses Gegners, falls es einen gibt. */
export function bossUniqueId(defId: string): string | undefined {
  return BOSS_UNIQUES[defId];
}

/** Faellt dieser einzigartige Gegenstand nur beim Boss, nie im normalen Wurf? */
export function isBossOnlyUnique(uniqueId: string): boolean {
  return Object.values(BOSS_UNIQUES).includes(uniqueId);
}
