# DayGoblin

DayGoblin is a small shared calendar for choosing whole days. The local Node server stores data in `data/calendars.json` and updates open pages with Server-Sent Events. The Netlify version is static and uses Firebase Realtime Database plus anonymous Firebase Authentication for shared storage and live updates.

## Run locally

Requires Node.js 18 or newer. No npm packages are needed for local development.

```sh
npm start
```

Open `http://localhost:4173`. Local test calendars remain in the ignored `data/` folder.

## Configure Firebase before publishing

1. Create a Firebase project on the Spark plan.
2. In **Authentication → Sign-in method**, enable **Anonymous**.
3. Create a **Realtime Database** and note its database URL.
4. Copy the web app's `apiKey`, `authDomain`, `databaseURL`, `projectId`, and `appId` into `firebase-config.json`.
5. Publish `database.rules.json` to the Realtime Database. The rules require anonymous authentication, prevent a public room listing, allow reads only when a room URL is known, enforce each fixed calendar's participant limit, and let anyone with the link continue as an existing participant.
6. Run `npm run build`; the build stops if the Firebase configuration is incomplete.

Firebase's browser config is public by design and contains no service-account credential. Database security is enforced by `database.rules.json`.

## Netlify

Connect the repository to Netlify and keep the build settings in `netlify.toml`: build command `node scripts/build.mjs`, publish directory `dist`. The rewrite rules serve `/skapa` and each three-word room URL directly, including when a shared link is opened in a new browser. The build copies only public app files into `dist`; the local Node server and local calendar data are excluded.

## Offline behavior

Firebase provides real-time shared updates. The browser also caches the last room snapshot and queues that browser's own name and day changes in local storage if the connection drops. A toast explains when a change is waiting to sync. Queued changes sync when the browser reconnects. The cache is local to that browser and is not a substitute for Firebase sharing.

Three-word addresses are meant to be easy to share, not used as passwords. Anyone with a room link can read it and submit their own response. Anonymous authentication prevents one browser session from overwriting another participant's record.

## Vercel

The Vercel deployment uses `vercel.json`: `node scripts/build.mjs` builds the static site into `dist`, and the rewrite rules keep `/skapa` and shared calendar URLs working. The browser app currently uses Firebase Realtime Database for shared calendars. `netlify.toml` remains for the existing Netlify setup.
