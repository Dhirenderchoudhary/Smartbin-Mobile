// Where you are, from expo-location (GPS and compass). The web app does the same with navigator.geolocation.
import * as Location from "expo-location";
import { Platform } from "react-native";
import type { LatLng } from "./bins";
import { getPref, setPref } from "./storage";

// heading: direction of travel in degrees from north, when the device is moving (else null)
export type Fix = LatLng & { accuracy: number; heading: number | null };

const DENIED = "Location is turned off for SmartBin. Allow it in your phone's settings, then try again.";
const NO_FIX = "Couldn't find your location. Move to open sky and try again.";

async function allowed(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

// The last place we saw you, kept only on this device, so the map opens there next time
const LAST_KEY = "smartbin.lastLocation";

export async function lastKnownLocation(): Promise<LatLng | null> {
  try {
    const saved = JSON.parse((await getPref(LAST_KEY)) ?? "null");
    return typeof saved?.lat === "number" && typeof saved?.lng === "number" ? { lat: saved.lat, lng: saved.lng } : null;
  } catch {
    return null;
  }
}

function toFix(p: Location.LocationObject): Fix {
  const h = p.coords.heading;
  const fix = {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy ?? 50,
    // Android reports 0 when standing still; only trust a heading while moving
    heading: h !== null && h >= 0 && (p.coords.speed ?? 0) > 0.5 ? h : null,
  };
  setPref(LAST_KEY, JSON.stringify({ lat: fix.lat, lng: fix.lng }));
  return fix;
}

// Device position (with accuracy in metres); rejects with a message people can act on
export async function currentPosition(): Promise<Fix> {
  if (!(await allowed())) throw new Error(DENIED);
  try {
    return toFix(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
  } catch {
    throw new Error(NO_FIX);
  }
}

// Live position: a recent cached fix straight away, then updates as GPS sharpens or you move.
// onError fires only if there's no fix yet. Returns a function that stops watching.
export function watchLocation(onFix: (fix: Fix) => void, onError: (message: string) => void): () => void {
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;
  let gotFix = false;

  (async () => {
    if (!(await allowed())) return onError(DENIED);
    const cached = await Location.getLastKnownPositionAsync({ maxAge: 30_000 }).catch(() => null);
    if (cached && !stopped) {
      gotFix = true;
      onFix(toFix(cached));
    }
    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 2000 },
        (p) => {
          gotFix = true;
          onFix(toFix(p));
        },
        () => !gotFix && onError(NO_FIX)
      );
      if (stopped) sub.remove();
      else subscription = sub;
    } catch {
      if (!gotFix) onError(NO_FIX);
    }
  })();

  return () => {
    stopped = true;
    subscription?.remove();
  };
}

// Compass heading (degrees from true north), for turning the map while you walk.
// Phones only: browsers don't expose a compass to expo-location.
export function watchCompass(onHeading: (degrees: number) => void): () => void {
  if (Platform.OS === "web") return () => {};
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;
  Location.watchHeadingAsync((h) => {
    const degrees = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
    if (degrees >= 0 && h.accuracy > 0) onHeading(degrees);
  })
    .then((sub) => (stopped ? sub.remove() : (subscription = sub)))
    .catch(() => {});
  return () => {
    stopped = true;
    subscription?.remove();
  };
}
