/**
 * Einhaengen des Canvas in eine Seite, PHASE_8.
 *
 * Getrennt vom Bootstrap, weil hier eine Regel steht, die man pruefen koennen
 * muss: Der Wirt behaelt die Geometrie, die die Seite ihm gegeben hat.
 *
 * Der Hintergrund ist ein Fehler aus dem Prototyp. Wird die Seite in einen
 * fremden Rahmen gesetzt, wie beim Veroeffentlichen als Artefakt, dann steht
 * `#app` nicht mehr als Flex-Kind im Rumpf. Eine Inline-Angabe des Bootstrap
 * schlaegt jedes Stylesheet: `position: relative` verdraengte das `fixed` der
 * Seite, `height: 100%` ihre Hoehe. Der Canvas stand danach im Fluss, wuchs
 * mit seinem eigenen Wirt und schaukelte sich ueber den ResizeObserver auf
 * mehrere hunderttausend Pixel Hoehe auf. Sichtbar blieb ein Streifen, in dem
 * sich nichts zu bewegen schien, waehrend HUD und Automap weiterliefen.
 */

/**
 * Braucht der Wirt einen eigenen Bezugspunkt fuer die absolut gesetzten Teile
 * der Oberflaeche? Nur wenn die Seite ihm keinen gegeben hat.
 */
export function needsPositioning(current: string): boolean {
  return current === 'static' || current === '';
}

/** Haengt den Canvas ein und gibt ihn zurueck. */
export function mountCanvas(host: HTMLElement): HTMLCanvasElement {
  const view = host.ownerDocument.defaultView;
  const placed = view?.getComputedStyle(host).position ?? 'static';
  if (needsPositioning(placed)) host.style.position = 'relative';

  const canvas = host.ownerDocument.createElement('canvas');
  canvas.style.display = 'block';
  // Ausserhalb des Flusses: so kann der Canvas seinen Wirt nicht vergroessern.
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.background = '#000';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);
  return canvas;
}
