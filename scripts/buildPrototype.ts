/**
 * Naeht den Prototyp der ersten Sohle zu einer einzigen HTML-Datei zusammen.
 *
 * Die Datei laeuft ohne Server und ohne Netz: JavaScript, CSS und die
 * Wandtexturen stehen als Text beziehungsweise data-URI darin. Gedacht ist sie
 * zum Herumlaufen und Anschauen, nicht als Auslieferung.
 *
 * Aufruf: npm run build:prototype
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng, resize } from './png.ts';

/** Kantenlaenge, auf die die Vorlagen gebracht werden. */
const TEXTURE_SIZE = 256;

const DIST = new URL('../dist-prototype/', import.meta.url);
const TEXTURES = new URL('../public/assets/textures/', import.meta.url);
const OUT = new URL('../dist-prototype/sohle-01.html', import.meta.url);

/** Alle vorhandenen Texturbilder als data-URI, verkleinert. */
function embedTextures(): { code: string; count: number; bytes: number } {
  const entries: string[] = [];
  let bytes = 0;

  for (const name of readdirSync(TEXTURES).sort()) {
    const match = /^(\d+)\.png$/.exec(name);
    if (match?.[1] === undefined) continue;

    const source = decodePng(new Uint8Array(readFileSync(new URL(name, TEXTURES))));
    const small = encodePng(resize(source, TEXTURE_SIZE));
    const uri = `data:image/png;base64,${Buffer.from(small).toString('base64')}`;
    bytes += uri.length;
    entries.push(`  ${match[1]}: '${uri}'`);
    console.log(`  ${name}: ${source.width}x${source.height} auf ${TEXTURE_SIZE}, ${Math.round(small.length / 1024)} kB`);
  }

  return { code: `globalThis.SORLAX_TEXTURES = {\n${entries.join(',\n')}\n};`, count: entries.length, bytes };
}

function main(): void {
  const js = readFileSync(new URL('app.js', DIST), 'utf8');
  const css = readFileSync(new URL('app.css', DIST), 'utf8');
  const textures = embedTextures();

  // Der Artefaktrahmen liefert doctype, head und body. Hier steht nur der
  // Inhalt der Seite, angefangen mit dem Titel.
  //
  // Der Rahmen um das Spiel bleibt schmal: eine Leiste mit dem Namen der Sohle
  // und der Tastenbelegung, darunter das Spiel ueber die ganze Flaeche. Die
  // Farben kommen aus src/ui/ui.css, damit die Leiste zum Spiel gehoert und
  // nicht daneben steht.
  const html = `<title>Sohle 1, Industrie</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">

<style>
${css}

  /* Die Regeln der Seite stehen hinter denen des Spiels. Die Hoehenangabe fuer
     #app aus ui.css wuerde die feste Geometrie sonst ueberschreiben. */

  /* Bewusst nur ein Erscheinungsbild: das Spiel ist ein dunkler Stollen, ein
     helles Thema waere hier kein Zugewinn, sondern ein Bruch. */
  :root {
    --ground: #101014;
    --panel: #191920;
    --rule: #2b2b34;
    --text: #d8d8de;
    --dim: #8a8a94;
    --accent: #d4915a;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--ground);
    color: var(--text);
    font-family: "Archivo Narrow", "Arial Narrow", system-ui, sans-serif;
    overflow: hidden;
  }

  /* Leiste und Spielflaeche haengen nicht am Elternteil: die Seite wird beim
     Veroeffentlichen in einen fremden Rahmen gesetzt, und ohne feste Hoehe
     waechst der Canvas dort ins Uferlose. */
  .rail {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 9px 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--rule);
  }

  .rail__name {
    display: flex;
    align-items: baseline;
    gap: 9px;
    flex-wrap: wrap;
    min-width: 0;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Der Strich steht fuer die Zone, nicht fuer Zierde: Zone 1 ist Industrie. */
  .rail__zone {
    width: 22px;
    height: 3px;
    background: var(--accent);
    border-radius: 1px;
  }

  .rail__hint {
    color: var(--dim);
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 7px;
    justify-content: flex-end;
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11.5px;
    color: var(--dim);
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .key b {
    font-weight: 500;
    color: var(--text);
    background: #23232c;
    border: 1px solid var(--rule);
    border-bottom-width: 2px;
    border-radius: 3px;
    padding: 1px 5px;
  }

  #app {
    position: fixed;
    top: var(--rail-h, 64px);
    left: 0;
    right: 0;
    bottom: 0;
    height: auto;
  }

  @media (max-width: 720px) {
    .keys { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
</style>

<div class="rail">
  <div class="rail__name">
    <span class="rail__zone" aria-hidden="true"></span>
    Sohle 1 · Industrie
    <span class="rail__hint">Wandbilder echt, alles Übrige Platzhalter · Lampen reichen fünf Kacheln weit · für Tasten erst ins Bild klicken</span>
  </div>
  <div class="keys">
    <span class="key"><b>WASD</b> gehen</span>
    <span class="key"><b>QE</b> drehen</span>
    <span class="key"><b>Leer</b> angreifen</span>
    <span class="key"><b>F</b> benutzen</span>
    <span class="key"><b>Tab</b> Karte</span>
    <span class="key"><b>Esc</b> Menü</span>
  </div>
</div>

<div id="app"></div>

<script>
  // Die Leiste bricht je nach Breite um. Ihre Hoehe wird gemessen, damit die
  // Spielflaeche darunter genau passt.
  (function () {
    var rail = document.querySelector('.rail');
    var fit = function () {
      document.documentElement.style.setProperty('--rail-h', rail.offsetHeight + 'px');
    };
    fit();
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(rail);
    window.addEventListener('resize', fit);
  })();
</script>

<script>${textures.code}</script>
<script type="module">${js}</script>
`;

  mkdirSync(new URL('.', OUT), { recursive: true });
  writeFileSync(OUT, html, 'utf8');
  console.log(
    `sohle-01.html: ${Math.round(html.length / 1024)} kB, ` +
      `${textures.count} Texturen (${Math.round(textures.bytes / 1024)} kB)`
  );
}

main();
