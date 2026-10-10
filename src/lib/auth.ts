// The only file that knows how sign-in works. Mirrors apps/web/src/lib/auth.ts in the Smartbin repo.
//
// Local mode (EXPO_PUBLIC_AUTH_MODE=dev, API has AUTH_MODE=dev): no Cognito; the token is the email
// and any password is accepted.
//
// ponytail: Cognito is not wired yet. For AWS, implement these with aws-amplify v6:
//   signIn  -> signIn({ username: email, password })
//   signUp  -> signUp(...) + confirmSignUp (add a code step)
//   signOut -> signOut()
//   getToken -> (await fetchAuthSession()).tokens?.accessToken?.toString()
import { useSyncExternalStore } from "react";
import { LOCAL_AUTH } from "./config";
import { getSecret, setSecret } from "./storage";

const KEY = "smartbin.session";

// One-tap test account for local mode
export const DEMO_EMAIL = "demo@smartbin.local";

// Signed-in state, loaded once at startup and kept in memory so screens can react to it
let token: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadSession(): Promise<void> {
  token = await getSecret(KEY);
  loaded = true;
  emit();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Cognito will use the password
export async function signIn(email: string, _password: string): Promise<void> {
  if (!LOCAL_AUTH) throw new Error("Cognito sign-in is not set up yet.");
  token = email.trim().toLowerCase();
  await setSecret(KEY, token);
  emit();
}

export async function signUp(email: string, password: string): Promise<void> {
  await signIn(email, password);
}

export async function signOut(): Promise<void> {
  token = null;
  await setSecret(KEY, null);
  emit();
}

export async function getToken(): Promise<string | null> {
  return token;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// "loading" until the stored session has been read
export function useSession(): "loading" | "signedIn" | "signedOut" {
  return useSyncExternalStore(subscribe, () => (!loaded ? "loading" : token ? "signedIn" : "signedOut"));
}
