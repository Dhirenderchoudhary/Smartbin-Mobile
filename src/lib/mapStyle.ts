// Which map tiles to use. Amazon Location when a key is configured, OpenFreeMap otherwise,
// and OpenFreeMap again if Amazon fails while the app runs. All switching is by env, no code changes.
// Same rules as apps/web/src/lib/mapStyle.ts in the Smartbin repo.
//
//   EXPO_PUBLIC_AWS_MAP_KEY     Amazon Location API key (v1.public...). Unset = OpenFreeMap only
//   EXPO_PUBLIC_AWS_REGION      default ap-south-1 (Mumbai)
//   EXPO_PUBLIC_AWS_MAP_STYLE   Standard | Monochrome | Hybrid | Satellite, default Monochrome
//   EXPO_PUBLIC_MAP_STYLE_LIGHT / _DARK   fallback style URLs, default OpenFreeMap

export const AWS_KEY = process.env.EXPO_PUBLIC_AWS_MAP_KEY;
export const AWS_REGION = process.env.EXPO_PUBLIC_AWS_REGION ?? "ap-south-1";
const AWS_STYLE = process.env.EXPO_PUBLIC_AWS_MAP_STYLE ?? "Monochrome";

const FALLBACK = {
  light: process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.EXPO_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark",
};

// Once Amazon fails, the rest of this app session uses the fallback
let awsFailed = false;

export function mapStyleUrl(dark: boolean): string {
  if (!AWS_KEY || awsFailed) return dark ? FALLBACK.dark : FALLBACK.light;
  const query = `key=${encodeURIComponent(AWS_KEY)}&color-scheme=${dark ? "Dark" : "Light"}&political-view=IND`;
  return `https://maps.geo.${AWS_REGION}.amazonaws.com/v2/styles/${AWS_STYLE}/descriptor?${query}`;
}

// Called when the map can't load Amazon's style; returns true if there's something to fall back to
export function switchToFallbackStyle(): boolean {
  if (!AWS_KEY || awsFailed) return false;
  awsFailed = true;
  return true;
}
