# SmartBin mobile

The SmartBin app for people finding and adding public dustbins. It's the same design and features as the phone layout of the SmartBin web app (`apps/web` in the Smartbin repo), built with Expo SDK 57 and Expo Router. Admins use the web dashboard.

## What's in it

| Screen | What it does |
|---|---|
| Sign in (`src/app/sign-in.tsx`) | Email and password, or one tap as the test user in local mode |
| Map (`src/app/index.tsx`) | Bins near you on a live map, wet/dry filter, bottom sheet with the nearest bins. A selected bin shows its photo, problems, distance, **Directions** and **Report a problem** (full, broken, dirty, missing, something else), and lets people mark problems sorted. Loads more bins as you pan or zoom out |
| Directions | A route preview (time, distance, arrival time, steps) with **Start**. Then turn-by-turn: the map follows you heading-up and tilted, with the next turn on top, time and distance left, rerouting when you go off route, a **Re-centre** button after you pan, and "You've arrived". The screen stays on while walking |
| Add a bin (`src/app/add.tsx`) | Move the map until the pin sits on the bin (warns about bins already within 15 m), then a photo, wet or dry, and an optional name |
| Account (`src/app/account.tsx`) | This month's limits, light/dark/system theme, privacy policy, sign out |

Shared code is in `src/lib` (API client, bins, walking routes, location, theme, storage), much of it copied from the web app, and `src/components` (UI pieces, the bottom sheet, navigation panels, the map).

## Run it

```bash
corepack pnpm install        # or pnpm install
cp .env.example .env.local   # optional: the defaults suit local development
```

Start the API from the Smartbin repo first (`apps/api`, port 3000, `AUTH_MODE=dev`).

**The map needs a development build.** It uses MapLibre Native (`@maplibre/maplibre-react-native`), which isn't in Expo Go:

```bash
npx expo run:android            # or run:ios, on a device or emulator
# or in the cloud
npx eas-cli@latest build --profile development --platform android
```

then `npx expo start` and open the development build.

**A phone reaches your API** on the computer running Metro (same Wi-Fi), port 3000; set `EXPO_PUBLIC_API_URL` if it's elsewhere. Photo and upload links from the API are pointed at that same host, so leaving the API's `API_PUBLIC_URL` as `localhost` is fine.

**In a browser** (no phone needed; the map uses maplibre-gl there):

```bash
npx expo start --web            # http://localhost:8081
```

The API's `CORS_ORIGINS` must include `http://localhost:8081` (it does in `apps/api/.env.example`).

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo export --platform android --platform ios   # builds the native bundles
npx expo-doctor
```
