import { Inter_400Regular, Inter_500Medium, useFonts } from "@expo-google-fonts/inter";
import { InterTight_700Bold } from "@expo-google-fonts/inter-tight";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadSession, useSession } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Screens() {
  const { colors, dark } = useTheme();
  const session = useSession();
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, InterTight_700Bold });
  const ready = fontsLoaded && session !== "loading";

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* Signed in: the map and everything off it */}
        <Stack.Protected guard={session === "signedIn"}>
          <Stack.Screen name="index" />
          <Stack.Screen name="add" />
          <Stack.Screen name="account" />
        </Stack.Protected>
        <Stack.Protected guard={session === "signedOut"}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    loadSession();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Screens />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
