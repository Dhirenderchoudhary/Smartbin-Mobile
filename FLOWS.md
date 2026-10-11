# SmartBin mobile: screens and flows

The same journeys as the web app's user side (`apps/web/FLOWS.md` in the `Smartbin` repo), built for phones. The main difference is that directions get a **route preview with Start**, then Google-Maps-style turn-by-turn navigation. Admins use the web dashboard; there's no admin UI here. The API behind every step is described in `docs/api.md` in the `Smartbin` repo.

## Screens (Expo Router, `src/app/`)

| Route | File | Screen |
|---|---|---|
| `/sign-in` | `sign-in.tsx` | Sign in / create account |
| `/` | `index.tsx` | Map: nearby bins, bin sheet, directions and navigation |
| `/add` | `add.tsx` | Add a bin (2 steps) |
| `/account` | `account.tsx` | Account |

`_layout.tsx` builds one `Stack` with no headers and two `Stack.Protected` groups. When signed in you get `index`, `add` and `account`; when signed out you get `sign-in`. **Changing the session is the navigation:** `signIn()` and `signOut()` update `useSession()`, and the router switches groups by itself, so screens never `router.replace` after signing in or out. The splash screen stays up until fonts and the saved session have loaded.

## Sign in

```mermaid
flowchart LR
  O[App opens] --> L{Saved session?}
  L -->|yes| MAP[Map]
  L -->|no| S[Sign in]
  S -->|email + password| CHK[GET /me with that token: creates the account, checks the API is reachable]
  CHK -->|ok| SAVE[signIn saves the session] --> MAP
  CHK -->|fails| ERR[Error stays on the sign-in screen, e.g. Can't reach SmartBin]
  S -.local mode only.-> T[Continue as test user: demo@smartbin.local]
  T --> CHK
```

- The API is checked **before** the session is saved. Saving first would flash the map, sign out again and lose the error.
- Sign in / Create account toggles the copy ("Welcome back" / "Create your account"). Sign-up needs a password of at least 8 characters.
- The token lives in `expo-secure-store` (`localStorage` on web) under `smartbin.session`.
- **Local mode** (`EXPO_PUBLIC_AUTH_MODE=dev`): the token is the email and any password works. With Cognito, the test button disappears and `lib/auth.ts` is replaced (see `.claude/rules/aws-handoff.md`).

## Find a bin (`/`)

```mermaid
flowchart TD
  O[Open map] --> P{Last location saved?}
  P -->|yes| Z[Map opens there, zoom 15]
  P -->|no| IN[All of India]
  Z & IN --> W[watchLocation, expo-location]
  W -->|permission denied / no fix| E[Sheet: Turn on location to see bins near you, Try again]
  W -->|first fix| F[GET /dustbins/nearby 2 km, log=1; frame you + nearest bins]
  F --> SH[Pins + bottom sheet: Nearest bins]
  SH -->|pan or zoom| V{View over 50 km across?}
  V -->|yes| ZI[Zoom in to see bins]
  V -->|no| AR[Load bins for the view, skip areas already loaded]
  SH -->|moved over 300 m| F
```

- Filter chips: **All / Wet / Dry**. "Wet" also includes bins that take both.
- Tapping a pin or a list row selects the bin (`POST /interactions VIEW`). The camera eases it above the sheet and the sheet opens. Tapping empty map clears the selection.
- **Sheet:** shows up to 46% of the screen. Swipe the handle down, or tap it, to collapse it to one line; swipe up or tap to open it.
- **Locate button (◎):** recentres on you and reloads nearby bins.

### Selected bin and problems

Shows the photo, name, wet/dry badges, missing-report count, open problems with **Emptied / Fixed / Cleaned / Sorted**, distance and walking minutes, plus **Directions** and **Report a problem**.

```mermaid
flowchart TD
  R[Report a problem] --> CH{It's full / broken / dirty / not here / something else}
  CH -->|something else| NOTE[Note required]
  CH --> POS[Uses your live position]
  POS -->|issue, over 50 m away| TF[You need to be within 50 m of the bin...]
  POS -->|missing, over 20 m away| TF2[You need to be within 20 m...]
  POS -->|ok| OK[Reported. People nearby will see it before they walk over.]
  CH -->|not here, threshold reached| GONE[Bin removed from the map]
```

The rules are the same as on the web: problems close when someone marks them sorted (also within 50 m), and "full" closes on its own after `fullIssueHours`. Missing reports count against the monthly quota.

## Directions and navigation

```mermaid
flowchart TD
  B[Selected bin] -->|Directions| PV[Route preview: POST interactions DIRECTIONS]
  PV --> RT[walkingRoute: Amazon Routes, then OSM router, then a straight line]
  RT --> SHOW[Whole route fitted on screen; sheet: Walk to X, N min, distance, Arrive around 10:42, Steps, Start, Google Maps, close]
  SHOW -->|close| B
  SHOW -->|Start, haptic tap| ACT[Active: zoom 18, tilted 50°, heading-up, screen kept on]
  ACT --> TURN[Turn card: icon, distance to the turn, instruction]
  ACT -->|you drag the map| RC[Follow stops: Re-centre pill]
  ACT -->|35 m off the route, at most every 10 s| RT
  ACT -->|within 20 m of the bin| ARR[You've arrived, success haptic, POST interactions ARRIVED, Done]
  ACT -->|End| FLAT[Back to a flat, north-up map around you]
```

- **Heading** comes from the compass first (`watchCompass`, ignoring wobbles under 8°), then the GPS course, then the direction of the route where you are.
- Pins can't be selected while directions are open.
- If routing fails, the route is a straight line with "Walking routes are unavailable right now, so this is a straight line. Stick to paths and roads."
- **Google Maps** opens Google Maps walking directions to the bin.

## Add a bin (`/add`)

```mermaid
flowchart TD
  S1[Step 1: Where is the bin?] --> G[currentPosition; map at zoom 18, fixed centre pin, other bins as dots]
  G -->|move the map| SP[Spot = map centre]
  SP --> DUP{A bin within 15 m?}
  DUP -->|yes| DW[There's already a bin here, View it; Confirm disabled]
  DUP -->|no| CF[Confirm location]
  CF --> S2[Step 2: Location set, Change]
  S2 --> PH[Take a photo, camera permission; or Choose from your photos]
  PH --> SHR[expo-image-manipulator: resize to 1280 px, JPEG]
  S2 --> TY[What does it take? Wet / Dry / Wet and dry] --> NM[Name it, optional]
  NM --> UP[GET /dustbins/upload-url, PUT the photo to deviceUrl uploadUrl]
  UP --> POST[POST /dustbins: Checking the photo…]
  POST -->|DUPLICATE_NEARBY| E1[This bin is already on the map, View it]
  POST -->|NOT_A_BIN| E2[We couldn't see a dustbin in that photo; photo cleared]
  POST -->|ok| BACK[router.dismissTo / with bin, added, lat, lng]
  BACK --> BAN[Map: banner Bin added. Thanks, it's on the map for everyone now. Bin selected.]
```

- The map screen stays mounted underneath `/add`, so it reacts to the new params in an effect, fetches the bin around `lat`/`lng`, selects it, then clears the params with `router.setParams`.
- **View it** in the duplicate warnings goes back to the map with that bin selected.

## Account (`/account`)

Shows your email and role, **This month** (bins added and missing reports left, and the reset date), **Appearance** (Light / Dark / System), **Privacy policy** (opens `${EXPO_PUBLIC_SITE_URL}/privacy` in an in-app browser) and **Sign out**, after which the guard shows sign-in.

## States every screen handles

| State | What people see |
|---|---|
| Starting | The splash screen, until fonts and the session are loaded |
| Location off | "Location is turned off for SmartBin. Allow it in your phone's settings, then try again." with **Try again** |
| API unreachable | "Can't reach SmartBin. Check your connection and try again." |
| 401 from the API | `api()` signs out, and the guard shows sign-in |
| No bins | "No bins mapped here yet. Spotted one nearby? Add it and it'll show up for everyone." |
| Map tiles fail | `switchToFallbackStyle()` moves from Amazon to OpenFreeMap for the rest of the session |
| Expo Go (no MapLibre) | The map area says it needs the development build; everything else works |
