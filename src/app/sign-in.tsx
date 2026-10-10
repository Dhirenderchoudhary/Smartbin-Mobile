// Sign in or create an account. Same copy and behaviour as apps/web/src/components/AuthForm.tsx.
import * as WebBrowser from "expo-web-browser";
import { AlertCircleIcon, MoonIcon, SunIcon, UserRoundIcon } from "lucide-react-native";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/Logo";
import { Alert, Button, Field, Input, Text } from "@/components/ui";
import { api, type Me } from "@/lib/api";
import { DEMO_EMAIL, signIn, signUp } from "@/lib/auth";
import { LOCAL_AUTH, SITE_URL } from "@/lib/config";
import { useTheme } from "@/lib/theme";

type Mode = "login" | "signup";

const copy: Record<Mode, { title: string; subtitle: string; submit: string; switchText: string; switchAction: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to find and add bins near you.", submit: "Sign in", switchText: "New to SmartBin?", switchAction: "Create an account" },
  signup: { title: "Create your account", subtitle: "Free, and takes a few seconds.", submit: "Create account", switchText: "Already have an account?", switchAction: "Sign in" },
};

export default function SignIn() {
  const { colors, dark, setChoice } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const text = copy[mode];

  // The layout switches to the map once the session is set, so check the API first:
  // otherwise a failure flashes the map, signs out and loses the error
  async function enter(e: string, p: string) {
    setError(null);
    setBusy(true);
    try {
      if (LOCAL_AUTH) await api<Me>("/me", { token: e.trim().toLowerCase() }); // creates the account on the API
      await (mode === "signup" ? signUp : signIn)(e, p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
      setBusy(false);
    }
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= (mode === "signup" ? 8 : 1);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, gap: 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Logo />
          <Button variant="ghost" icon={dark ? SunIcon : MoonIcon} accessibilityLabel="Switch between light and dark mode" onPress={() => setChoice(dark ? "light" : "dark")} />
        </View>

        <View style={{ gap: 6, marginTop: 24 }}>
          <Text heading size={28}>
            {text.title}
          </Text>
          <Text tone="muted">{text.subtitle}</Text>
        </View>

        {LOCAL_AUTH && mode === "login" ? (
          <View style={{ gap: 10 }}>
            <Button size="xl" variant="secondary" icon={UserRoundIcon} label="Continue as test user" disabled={busy} onPress={() => enter(DEMO_EMAIL, "demo")} />
            <Text size={14} tone="muted">
              Local mode: one tap, or any email and password below.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text size={14} tone="muted">
                or with email
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
          </View>
        ) : null}

        <View style={{ gap: 20 }}>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
            />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
            <Input
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              textContentType={mode === "signup" ? "newPassword" : "password"}
              returnKeyType="go"
              onSubmitEditing={() => valid && enter(email, password)}
              accessibilityLabel="Password"
            />
          </Field>
          {error ? <Alert icon={AlertCircleIcon} tone="destructive" text={error} /> : null}
          <Button size="xl" label={busy ? "Please wait…" : text.submit} busy={busy} disabled={!valid} onPress={() => enter(email, password)} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
          <Text tone="muted">{text.switchText}</Text>
          <Pressable accessibilityRole="button" onPress={() => (setMode(mode === "login" ? "signup" : "login"), setError(null))}>
            <Text weight="medium">{text.switchAction}</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)} style={{ marginTop: "auto", alignSelf: "center", padding: 8 }}>
          <Text size={14} tone="muted">
            Privacy policy
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
