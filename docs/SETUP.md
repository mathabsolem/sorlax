# Scepter of Sorlax — SETUP

Ziel dieser Anleitung: lauffaehige TypeScript-Umgebung, in der Claude Code danach nur noch
Dateien fuellt. Einmal durchziehen, dann nicht mehr anfassen.

---

## 1. Voraussetzungen

- Node.js 20 LTS oder neuer. Pruefen mit `node -v`.
- Git.
- Fuer Android spaeter: Android Studio plus JDK 17.
- Fuer iOS spaeter: macOS mit Xcode. Ohne Mac gibt es keinen iOS-Build, das ist eine harte
  Einschraenkung von Apple und nicht umgehbar.

## 2. Projekt anlegen

```bash
npm create vite@latest sorlax -- --template vanilla-ts
cd sorlax
npm install
git init && git add -A && git commit -m "init"
```

Test: `npm run dev` startet einen Server auf localhost. Wenn die Vite-Startseite erscheint,
ist die Basis in Ordnung.

## 3. Zusatzpakete

```bash
npm i -D vitest @types/node
npm i idb
```

`vitest` fuer Tests der Kernlogik, `idb` als duenner Wrapper um IndexedDB.
Mehr wird vorerst nicht gebraucht. Jede weitere Abhaengigkeit muss begruendet werden.

## 4. tsconfig.json

Ersetze den Inhalt vollstaendig:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@render/*": ["src/render/*"],
      "@ui/*": ["src/ui/*"],
      "@input/*": ["src/input/*"],
      "@data/*": ["src/data/*"],
      "@net/*": ["src/net/*"]
    }
  },
  "include": ["src", "tests"]
}
```

`noUncheckedIndexedAccess` ist unbequem, faengt aber genau die Zugriffe auf das `walls`-Array
ab, die sonst zur Laufzeit `undefined` liefern. Nicht abschalten.

## 5. vite.config.ts

```ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@input': fileURLToPath(new URL('./src/input', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@net': fileURLToPath(new URL('./src/net', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://deine-domain.tld',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: { target: 'es2022', assetsInlineLimit: 0 }
});
```

`base: './'` ist Pflicht, sonst laden die Assets im Capacitor-Container nicht.
`assetsInlineLimit: 0` verhindert, dass kleine PNG als Data-URL eingebettet werden, was den
Sprite-Loader unnoetig verkompliziert.

## 6. Verzeichnisstruktur

```bash
mkdir -p src/{core,render,ui,input,data,net,app} tests docs
mkdir -p public/assets/{textures,sprites,weapons,ui,sounds}
mkdir -p content
```

`content/` enthaelt die JSON-Dateien aus INTERFACES.md Abschnitt 5 und 6.
`public/assets/` enthaelt die PNG- und Audiodateien.

Lege SPEC.md und INTERFACES.md nach `docs/`.

## 7. package.json Skripte

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

`build` bricht bei Typfehlern ab. Das ist gewollt.

## 8. CLAUDE.md im Projektwurzelverzeichnis

Diese Datei liest Claude Code automatisch bei jeder Sitzung. Inhalt:

```markdown
# Scepter of Sorlax

Lies vor jeder Aufgabe docs/SPEC.md und docs/INTERFACES.md.

## Harte Regeln
- INTERFACES.md ist ein Vertrag. Aendere keine Signatur, keinen Typ, keinen Feldnamen.
  Wenn eine Schnittstelle nicht ausreicht, brich ab und melde das, statt sie anzupassen.
- src/core enthaelt keinen Zugriff auf DOM, Canvas, fetch, Date oder Math.random.
  Zufall kommt ausschliesslich aus dem seeded RNG in src/core/rng.ts.
- Keine neuen npm-Abhaengigkeiten ohne Rueckfrage.
- Kein Code auskommentieren und stehen lassen. Loeschen.
- Jede exportierte Funktion in src/core braucht einen Test in tests/.
- TypeScript strict, kein any, kein Non-Null-Assertion-Operator ausser mit Kommentar,
  der begruendet warum der Wert nicht null sein kann.

## Stil
- Deutsche Kommentare, englische Bezeichner.
- Kleine Dateien. Ueber 300 Zeilen aufteilen.
```

## 9. Erster Rauchtest

Lege `src/core/rng.ts` mit einem xorshift128 an und `tests/rng.test.ts` mit einem Test, der
prueft, dass zwei Instanzen mit gleichem Seed die gleiche Sequenz liefern.
`npm test` muss gruen sein, bevor irgendetwas anderes gebaut wird.

## 10. Capacitor, erst nach Phase 4

Nicht jetzt einrichten. Ein Browser-Build reicht bis zur spielbaren Version.

```bash
npm i @capacitor/core && npm i -D @capacitor/cli
npx cap init "Scepter of Sorlax" tld.deinedomain.sorlax --web-dir=dist
npm i @capacitor/android && npx cap add android
npm run build && npx cap sync && npx cap open android
```

Wichtig fuer spaeter: Capacitor laedt die App unter einem eigenen Origin. Cookies fuer die
Session funktionieren dort nicht zuverlaessig, deshalb steht in BACKEND.md ein Bearer-Token
im Authorization-Header und keine Cookie-Session.
