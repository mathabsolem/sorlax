# Scepter of Sorlax

Rundenbasierter Dungeon Crawler aus der Ego-Perspektive, Software-Renderer in
TypeScript. Spezifikation in `docs/SPEC.md`, Modulvertrag in `docs/INTERFACES.md`.

## Lokal entwickeln

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:host   # zusaetzlich im LAN, zum Testen auf dem Handy
npm run typecheck
npm test
npm run build
```

Im Entwicklungsbetrieb schaltet **F7** eine Helligkeitsansicht und **F8** die
Drehung jeder Bodenkachel als Farbe. Im Produktionsbuild sind beide Tasten tot.

## CI

`.github/workflows/ci.yml` laeuft bei jedem Push und Pull Request:
Typecheck, Tests, Build. Das Ergebnis liegt als Artefakt `sorlax-dist-<sha>`
am jeweiligen Lauf und bleibt 14 Tage abrufbar.

Der Stand des Default-Branch wird zusaetzlich auf GitHub Pages veroeffentlicht,
erreichbar unter <https://mathabsolem.github.io/sorlax/>. Die Adresse steht nach
jedem Lauf in der Zusammenfassung des Deploy-Jobs.

Voraussetzung dafuer: unter *Settings → Pages* muss als Quelle **GitHub Actions**
eingestellt sein. Solange das Repository privat ist, braucht das einen bezahlten
GitHub-Plan; bei einem oeffentlichen Repository geht es mit dem kostenlosen Plan.
