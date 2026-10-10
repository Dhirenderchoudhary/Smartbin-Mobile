# SmartBin mobile

The SmartBin phone app: find the nearest public dustbin in India, walk there with turn-by-turn directions, report problems, and add bins. It's a copy of the phone layout of the SmartBin web app (`apps/web` in the `Smartbin` repo), which also holds the API (`apps/api`, contract in `docs/api.md`). Admins use the web dashboard.

Expo SDK 57 · React Native 0.86 (New Architecture) · React 19.2 · Expo Router 57 · `@maplibre/maplibre-react-native` 11 (maplibre-gl on web) · TypeScript.

@AGENTS.md
@DESIGN.md
@FLOWS.md

**AWS:** sign-in, map tiles and walking routes are local stand-ins that the infra side of the team will swap for AWS (Cognito, Amazon Location). See `.claude/rules/aws-handoff.md`, and keep screens calling `lib/auth.ts`, `lib/api.ts`, `lib/mapStyle.ts` and `lib/routes.ts` rather than working around them.

## Where things are

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router): `_layout.tsx` (fonts, splash, guarded stack), `sign-in`, `index` (map), `add`, `account` |
| `src/components/ui.tsx` | `Text`, `Button`, `Chips`, `Badge`, `Alert`, `Input`, `Field`, `Spinner`, `Surface` |
| `src/components/BinSheet.tsx` | Bottom sheet, selected bin, report-a-problem modal |
| `src/components/NavigationPanel.tsx` | `RoutePreview` (Start) and `ActiveNavigation` (turn-by-turn) |
| `src/components/map/` | `AppMap` (one interface: `types.ts`), `MapLibreMap` (native), `AppMap.web.tsx` (browser), `Markers` |
| `src/lib/` | `api.ts`, `auth.ts`, `bins.ts`, `routes.ts`, `mapStyle.ts`, `location.ts` (GPS + compass), `theme.tsx`, `storage.ts` (prefs + secure store), `config.ts` (env, `deviceUrl`) |

`lib/bins.ts`, `lib/routes.ts`, `lib/mapStyle.ts`, `lib/auth.ts` and `lib/api.ts` are **ports of the web app's files with the same names**. Keep them in step: a rule or message change there usually belongs here too.

## Run it

```sh
corepack pnpm install          # postinstall copies the maplibre worker to public/ for web
npx expo start                 # then open in the SmartBin development build (not Expo Go)
npx expo start --web           # browser at http://localhost:8081, map included
```

- **The map needs a development build.** MapLibre has native code that Expo Go doesn't include. Expo Go still runs the app, but the map area says it needs the build. Build once with `npx eas-cli@latest build --profile development --platform android` (profiles are in `eas.json`), or `npx expo run:android` with the Android SDK.
- **API:** run the `Smartbin` API on port 3000 with `AUTH_MODE=dev`. Phones reach it at the Metro host's address (same Wi-Fi), port 3000. Set `EXPO_PUBLIC_API_URL` if it's elsewhere.
- Before calling something done: `npx tsc --noEmit` and `npx expo lint`. For native-only changes also run `npx expo export --platform android` and `npx expo-doctor`.

## Things that bite

- **Hermes has no `Intl.RelativeTimeFormat` and no `AbortSignal.timeout`.** `bins.ts` formats "5 minutes ago" by hand and `routes.ts` has a `timeout()` helper. Avoid `URL` for parsing (use the regex in `config.ts`).
- **Don't import `@maplibre/maplibre-react-native` outside `MapLibreMap.tsx`.** `AppMap.tsx` only `require`s it when `TurboModuleRegistry.get("MLRNCameraModule")` exists; a top-level import crashes Expo Go.
- **MapLibre RN v11 API**, not v10: `<Map mapStyle>`, `<Camera ref initialViewState>` with `easeTo` / `fitBounds([w, s, e, n])`, `<GeoJSONSource><Layer type="line" /></GeoJSONSource>`, `<ViewAnnotation lngLat>`. Region events give `nativeEvent.center`, `bounds`, `bearing`, `userInteraction`.
- **The camera is command-based.** Screens call `move({ kind: "ease" | "fit", … })`, and each command runs once by `key`. Don't drive the camera from props.
- **`localhost` links from the API** (photos, upload URLs in local mode) don't work on a phone. Pass them through `deviceUrl()`.
- **The map screen stays mounted under `/add` and `/account`.** Come back with `router.dismissTo("/", params)` and react to params in an effect (then `router.setParams` to clear them), not only on mount.
- **React Native for web:** use `aria-checked` / `aria-expanded` / `aria-disabled` / `aria-busy`, not `accessibilityState`, and put `pointerEvents` in `style`.
- **Image manipulation** uses the new API: `ImageManipulator.manipulate(uri).resize(...).renderAsync()` then `saveAsync({ format: SaveFormat.JPEG, compress })`.
- Lint flags `setState` in effects and reading refs during render. Use the patterns already in the code (adjusting state while rendering, `useState(() => …)` for one-time objects such as a `PanResponder`).

## Rules

- Follow `DESIGN.md`: colours from `useTheme()`, `Text` and `Button` from `ui.tsx`, `size="xl"` for main actions, and the same copy as the web app.
- Check new UI in light and dark mode, at a 360 px wide screen, with safe areas.
- New native modules: `npx expo install <pkg>`, then rebuild the development build. Tell the team, because everyone needs the new build.
- Never edit `android/` or `ios/` by hand (they're generated); configure through `app.json` and plugins.
