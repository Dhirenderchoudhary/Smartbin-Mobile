# AWS hand-off: what's a local stand-in and what replaces it

The app runs fully against a laptop today. **Sign-in, map tiles, walking routes and the API's hosting, storage and photo check will move to AWS, and that work is done by the AWS/infra side of the team, not as part of feature work.** Each service already sits behind a single swap point in `src/lib/`, so the move changes env vars and one or two files, not screens.

The architecture and owners are in `plan-web-repo.md` in the `Smartbin` repo (AWS account, Cognito, Location and hosting: Dhirender; API integrations: Karan). The `Smartbin` repo has the same file for the web app and the API.

## The swap list

| Area | Today (local) | On AWS | Swap point | Status |
|---|---|---|---|---|
| **Sign-in** | `EXPO_PUBLIC_AUTH_MODE=dev`: the token is the email, any password works; "Continue as test user" | Amazon Cognito (user pool, `USER` / `ADMIN` groups) via `aws-amplify` v6 | `src/lib/auth.ts`: `signIn`, `signUp`, `signOut`, `getToken` (the comment at the top has the Amplify calls). Keep `useSession()` and `loadSession()` working: the router guards in `_layout.tsx` depend on them | Not wired. Sign-up needs a confirmation-code step |
| **Map tiles** | OpenFreeMap (positron / dark) | Amazon Location Maps, `Monochrome`, `political-view=IND` | `src/lib/mapStyle.ts` | Built; set `EXPO_PUBLIC_AWS_MAP_KEY`. On a load failure `switchToFallbackStyle()` moves to OpenFreeMap |
| **Walking routes** | FOSSGIS OSRM (fair use), then a straight line | Amazon Location Routes (pedestrian) | `src/lib/routes.ts` (`walkingRoute`) | Built; uses the same key if it allows geo-routes |
| **API address** | Metro host's IP, port 3000 (`config.ts`) | API Gateway URL | `EXPO_PUBLIC_API_URL` | Not deployed |
| **Photo links** | The API's `localhost` links, rewritten by `deviceUrl()` | S3 presigned upload, CloudFront image links | API side (`STORAGE_MODE=s3`); `deviceUrl()` leaves non-localhost links alone | Built on the API |
| **Photo check** | `VISION_PROVIDER=off` / OpenAI on the API | Amazon Bedrock on the API | API only, no app change | Built on the API |
| **Builds** | Development build via EAS (`eas.json` profile `development`) | EAS `preview` / `production` builds, store submission | `eas.json`, `app.json` (`com.smartbin.app`) | Profiles exist; no store accounts yet |

## Rules for anyone (and any AI) working in this repo

- **Don't build around the stand-ins.** Screens must only use `signIn` / `signUp` / `signOut` / `getToken` / `useSession` from `lib/auth.ts` and `api()` from `lib/api.ts`. Never read the `smartbin.session` secret directly or assume the token is an email.
- **Keep the function signatures** of `lib/auth.ts`, `lib/mapStyle.ts` and `lib/routes.ts`. They mirror the web app's files of the same names.
- **Don't remove the fallbacks** (OpenFreeMap, the OSM router, the straight line, `deviceUrl()`). They keep the app usable when a key is missing or AWS is throttled.
- **Local-only UI must check `LOCAL_AUTH`** (as "Continue as test user" does), so it disappears with Cognito.
- **The API contract doesn't change** with AWS: `docs/api.md` in the `Smartbin` repo stays the source of truth.
- `EXPO_PUBLIC_*` values are built into the app and visible to anyone. Only public keys belong there: the Amazon Location key is designed to be public and restricted by referrer and app. Never put secrets in them. Add new variables to `.env.example` with a placeholder.
- If you're asked to do the AWS swap itself, follow the comments at the swap points and get the real IDs and keys from the infra owners.

## Env vars that switch things over

```sh
# .env.local
EXPO_PUBLIC_AUTH_MODE=cognito
EXPO_PUBLIC_API_URL=https://<api-gateway-url>/v1
EXPO_PUBLIC_SITE_URL=https://<web-domain>
EXPO_PUBLIC_AWS_MAP_KEY=v1.public....     # Amazon Location API key (maps + routes)
EXPO_PUBLIC_AWS_REGION=ap-south-1
# Cognito pool / client IDs: add when lib/auth.ts is wired
```
