# SmartBin mobile: design

The phone app copies the **phone layout of the SmartBin web app** (`apps/web` in the `Smartbin` repo, see its `DESIGN.md`), built in React Native. The look is **Uber's Base design system**: black and white, big type, pill buttons, floating controls over a full-screen map, and a bottom sheet. Colour appears only where it means something. If the web app and this app disagree, they should be brought back in line rather than drifting further apart.

## Principles

1. **The map is the product.** The home screen is a full-screen map. The top bar is floating pills and the bottom sheet holds the bins.
2. **Black and white, colour with a meaning.** Green means wet waste and blue means dry. Yellow means a problem has been reported, and red means an error or a destructive action (End, Report missing).
3. **One-handed, outdoors.** Main actions are 52 px pills (`size="xl"`) near the bottom. Text is at least 14 px, inputs 16 px. Respect safe areas (`useSafeAreaInsets`) on every edge.
4. **One clear action per screen.** It is a black pill, with secondary actions as grey or outline pills.
5. **Plain words.** The copy is the same as the web app's, word for word where the screens match.

## Tokens (`src/lib/theme.tsx`)

The values are copied from `apps/web/src/app/globals.css`. **Change both together.** Use `const { colors, dark } = useTheme()` and never hard-code a hex in a screen.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | `#ffffff` / `#000000` | `#000000` / `#ffffff` | Screens, text, icons |
| `card` | `#ffffff` | `#141414` | Sheets, floating pills, cards |
| `primary` / `primaryForeground` | `#000000` / `#ffffff` | `#ffffff` / `#000000` | Main buttons, selected chips, the turn card |
| `secondary` | `#efefef` | `#282828` | Grey pills and chips |
| `muted` / `mutedForeground` | `#f3f3f3` / `#5e5e5e` | `#1f1f1f` / `#a6a6a6` | Quiet panels, secondary text |
| `accent` | `#e2e2e2` | `#333333` | Sheet handle |
| `border` | `#e2e2e2` | `#2e2e2e` | List dividers, outline buttons |
| `input` | `#efefef` | `#282828` | Filled text inputs |
| `destructive` | `#e11900` | `#ff5a3c` | Errors, End, Report missing |
| `wet` / `dry` | `#05944f` / `#276ef1` | `#06c167` / `#5b91f5` | Waste types, success ticks, walking minutes |
| `warning` / `warningForeground` | `#ffc043` / `#000000` | same | Open problems |
| `map` | `#e5e5e5` | `#1b1b1b` | Behind the map while tiles load |
| `shadowFloat` / `shadowSheet` | `0 2px 8px` / `0 4px 16px` at 16% | at 60% | Floating pills / sheets (React Native `boxShadow` strings) |

**Theme:** Light, Dark or System, chosen on the Account screen or with the sun/moon button on sign-in. It's saved with `setPref("smartbin.theme")` (AsyncStorage). The map style, status bar and system background follow it.

## Type

Inter Tight 700 for headings and Inter 400/500 for text (Uber Move is proprietary), from `@expo-google-fonts`. They're loaded in `src/app/_layout.tsx`, which keeps the splash screen up until fonts and the saved session are ready. **Always use the `Text` from `components/ui.tsx`,** never React Native's directly:

```tsx
<Text heading size={28}>Welcome back</Text>          // Inter Tight 700, line height 1.2
<Text weight="medium">Nearest bins</Text>            // Inter 500
<Text size={14} tone="muted">Wet and dry</Text>      // tone: default | muted | inverse | destructive | wet
```

Screen titles are 28, sheet titles 20, big numbers (walking minutes, distance) 30, body 16 and secondary lines 14. Use sentence case: no all-caps, no letter-spacing changes.

## Components (`src/components/ui.tsx`)

| Component | Variants | Notes |
|---|---|---|
| `Button` | `default` (black), `secondary` (grey), `outline`, `ghost`, `destructive` (red), `floating` (card + `shadowFloat`, for map controls); sizes `sm` 36, `default` 40, `lg` 44, `xl` 52 | Always a pill. `icon` / `iconRight` take lucide icons. Without a `label` it's an icon button and **needs `accessibilityLabel`**. `busy` shows a spinner |
| `Chips` | | Single choice as pills (All / Wet / Dry, waste type). The selected chip is black; `dot` adds a colour dot |
| `Badge` | `secondary`, `wet`, `dry`, `warning`, `destructive` | Waste type, problem labels |
| `Alert` | `default`, `destructive`, `warning` | Inline feedback, with an optional `action` |
| `Input`, `Field` | | Filled input, 52 px high; `Field` adds a label above and a hint below |
| `Surface` | `inverse` | A floating card: banners, status sheets |
| `Spinner` | `inverse` | |

App pieces:
- `Logo`: an SVG bin mark in a black rounded square.
- `BinSheet`: the bottom sheet, the selected bin and the report modal.
- `NavigationPanel`: `RoutePreview` and `ActiveNavigation`.
- `map/Markers`: `Pin` and `YouDot`.

Icons come from `lucide-react-native`, the same names as the web app.

## The map

```
┌────────────────────────────┐
│ (Logo SmartBin) [+ Add] (👤)│  floating pills, below the status bar
│ [All|Wet|Dry]          (◎) │
│                            │
│      map, pins, you        │
│                            │
│╭──────────────────────────╮│
││          ═══             ││  handle: swipe down / tap to collapse
││ Selected bin / Nearest   ││  max 46% of the screen, scrolls inside
│╰──────────────────────────╯│
└────────────────────────────┘
```

- **`AppMap`** (`src/components/map/`) has one set of props (`types.ts`) and three implementations:
  - `MapLibreMap.tsx`: phones, using `@maplibre/maplibre-react-native` v11.
  - `AppMap.web.tsx`: browsers, using maplibre-gl.
  - `AppMap.tsx`: picks MapLibre if its native module is in the build. Otherwise it shows "The map needs the SmartBin development build", as in Expo Go.
- **Camera** is driven by commands. The map screen sends `{ kind: "ease" | "fit", …, key }` and the map runs each one once. Padding keeps the subject above the sheet.
- **Pins**: 36 px circles (44 px when selected, with a `foreground` outline) with a 3 px `background` border, filled wet, dry or half-and-half, with a white bin icon. Only the nearest 150 are drawn (`MAX_PINS`). The add-a-bin map shows other bins as 16 px dots.
- **You**: a dot with a soft halo and a heading cone. The cone is counter-rotated by the map bearing, because annotations stay upright.
- **Route**: a `foreground` line, 6 px, on an 11 px `background` casing.
- **Navigation** turns the map heading-up (compass, else GPS course, else the route direction), tilts it 50° at zoom 18, and keeps you in the lower part of the screen. A black turn card sits at the top and a sheet at the bottom shows the minutes in `wet` green, the distance, the arrival time, **End** (red) and **Google Maps**.

**Known gap:** the web pins show a yellow dot for bins with open problems; the mobile `Pin` doesn't yet.

## Platform rules

- **Accessibility:** use the `aria-*` props (`aria-checked`, `aria-expanded`, `aria-disabled`, `aria-busy`) rather than `accessibilityState`, because React Native for web only maps the `aria-*` ones. Every pressable gets `accessibilityRole`, and icon-only ones an `accessibilityLabel`. Use `accessibilityLiveRegion="polite"` for the turn card.
- `pointerEvents` goes in `style`, not as a prop.
- Haptics: a medium tap on Start, a success buzz on arrival.
- The screen stays on while navigating (`expo-keep-awake`).
- Photos are shown with `expo-image`, and remote links are passed through `deviceUrl()` (see `CLAUDE.md`).
