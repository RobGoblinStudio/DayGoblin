# DayGoblin

Delad kalender där en grupp väljer hela dagar som passar alla. Rum delas via treordslänkar (t.ex. `/bouncy-taco-wobble`). Del av RobGoblin Studio.

## Arkitektur

- **Ren statisk frontend**, inga npm-beroenden och inget ramverk. Vanilla JS, HTML och CSS i rotmappen.
- **Produktion:** statisk sajt mot Firebase Realtime Database + anonym Firebase Auth. Säkerheten ligger i `database.rules.json` (Firebase-configen i `firebase-config.json` är publik med avsikt).
- **Lokalt:** `server.js` (Node, inga paket) serverar filerna, sparar i `data/calendars.json` och pushar uppdateringar med Server-Sent Events.
- `data.js` väljer backend: Firebase om configen är komplett, annars den lokala servern.

## Viktiga filer

| Fil | Roll |
|---|---|
| `index.html` + `home.js` | Startsida |
| `create.html` | Skapa kalender (`/skapa`) |
| `calendar.html` + `calendar.js` | Själva kalendern (största filen) |
| `firebase-backend.js` | Firebase-läsning/skrivning, offline-kö |
| `i18n.js` | Alla UI-texter, svenska och engelska |
| `studio.html` | RobGoblin Studio-sida |
| `scripts/build.mjs` | Kopierar publika filer till `dist/` |
| `netlify/edge-functions/calendar-meta.ts` | Meta-taggar för delade länkar på Netlify |

## Kommandon

```sh
npm start          # lokal server på http://localhost:4173
npm run build      # bygger dist/ (stoppar om firebase-config.json är ofullständig)
DAYGOBLIN_ALLOW_EMPTY_CONFIG=1 npm run build   # bygg utan Firebase-config
```

Det finns inga automatiska tester. Verifiera ändringar genom att köra `npm start` och testa i webbläsaren.

## Arbetsflöde: lokalt först, publicera på begäran

- Allt arbete görs och testas lokalt (`npm start`, eller förhandsvisningen `daygoblin` i `.claude/launch.json`). På localhost används alltid den lokala servern och `data/`, aldrig Firebase-produktionsdatabasen.
- Committa gärna lokalt på `main`, men **pusha aldrig till GitHub förrän användaren uttryckligen ber om att publicera**. En push till `main` driftsätter sajten på Vercel (`daygoblin.robgoblin.studio`).
- Vid publicering: visa vilka commits som går ut, kör `npm run build`, pusha `main`, och kontrollera sedan att produktionssajten svarar och visar ändringen.
- Ändringar i `database.rules.json` publiceras separat i Firebase-konsolen. Påminn användaren om det.

## Driftsättning

- Både `vercel.json` och `netlify.toml` finns. `netlify.toml` gör 301-redirect av allt till `https://daygoblin.robgoblin.studio`.
- Rewrites måste hållas i synk mellan `vercel.json`, `_redirects` och `netlify.toml`: `/skapa` → `create.html`, treordsrum → `calendar.html`.
- Ny fil som ska publiceras måste läggas till i `files`-listan i `scripts/build.mjs`, och i `Dockerfile` om den behövs lokalt i Docker.

## Konventioner

- Koden är kompakt, ofta flera satser per rad. Behåll stilen i befintliga filer.
- Nya UI-texter läggs i `i18n.js` för både `sv` och `en`, aldrig hårdkodat i HTML/JS.
- localStorage-nycklar använder det gamla namnet `daybuddy` (t.ex. `daybuddy-language`). Byt inte namn, då tappar användare sina sparade val.
- Ändras datamodellen måste `database.rules.json` uppdateras och publiceras i Firebase.
