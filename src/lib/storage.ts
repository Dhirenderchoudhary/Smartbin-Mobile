import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Small preferences (theme, last location): AsyncStorage on every platform
export async function getPref(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // storage unavailable: the preference lasts until the app closes
  }
}

// The sign-in token: the device keychain/keystore on phones; there's no secure store on web
export async function getSecret(key: string): Promise<string | null> {
  if (Platform.OS === "web") return getPref(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecret(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") return setPref(key, value);
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // keystore unavailable: signed in until the app closes
  }
}
