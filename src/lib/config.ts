import Constants from "expo-constants";
import { Platform } from "react-native";

// Everything is set with EXPO_PUBLIC_* variables (see .env.example); these are the local-development defaults.

// On a phone, "localhost" is the phone itself, so in development the API is reached on the same
// computer that serves the app (Metro's address), port 3000.
function devApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return Platform.OS === "web" || !host ? "http://localhost:3000/v1" : `http://${host}:3000/v1`;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? devApiUrl();

// "dev": no Cognito; the token is the email (the API needs AUTH_MODE=dev too)
export const LOCAL_AUTH = (process.env.EXPO_PUBLIC_AUTH_MODE ?? "dev") === "dev";

// The web app, for the privacy policy
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "http://localhost:3001";

// The API builds photo and upload links from its own API_PUBLIC_URL, which is "localhost" in local
// development. A phone can't reach that, so point those links at the API host this app uses.
// (Plain string parsing: React Native's URL class has been incomplete across versions.)
const ORIGIN = /^(https?:\/\/([^/:]+)(?::\d+)?)(.*)$/;
const [, apiOrigin = "", apiHost = ""] = API_URL.match(ORIGIN) ?? [];
export function deviceUrl(url: string): string {
  const [, , host, rest] = url.match(ORIGIN) ?? [];
  if ((host === "localhost" || host === "127.0.0.1") && apiHost && apiHost !== host) return apiOrigin + rest;
  return url;
}
