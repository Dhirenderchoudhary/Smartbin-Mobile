// Uber Base tokens, the same values as apps/web/src/app/globals.css in the Smartbin repo:
// black and white, colour only where it means something (wet green, dry blue, warning, negative).
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getPref, setPref } from "./storage";

const light = {
  background: "#ffffff",
  foreground: "#000000",
  card: "#ffffff",
  primary: "#000000",
  primaryForeground: "#ffffff",
  secondary: "#efefef",
  muted: "#f3f3f3",
  mutedForeground: "#5e5e5e",
  accent: "#e2e2e2",
  border: "#e2e2e2",
  input: "#efefef",
  destructive: "#e11900",
  wet: "#05944f",
  dry: "#276ef1",
  warning: "#ffc043",
  warningForeground: "#000000",
  map: "#e5e5e5",
  shadowFloat: "0 2px 8px rgba(0, 0, 0, 0.16)",
  shadowSheet: "0 4px 16px rgba(0, 0, 0, 0.16)",
};

export type Colors = typeof light;

const dark: Colors = {
  background: "#000000",
  foreground: "#ffffff",
  card: "#141414",
  primary: "#ffffff",
  primaryForeground: "#000000",
  secondary: "#282828",
  muted: "#1f1f1f",
  mutedForeground: "#a6a6a6",
  accent: "#333333",
  border: "#2e2e2e",
  input: "#282828",
  destructive: "#ff5a3c",
  wet: "#06c167",
  dry: "#5b91f5",
  warning: "#ffc043",
  warningForeground: "#000000",
  map: "#1b1b1b",
  shadowFloat: "0 2px 8px rgba(0, 0, 0, 0.6)",
  shadowSheet: "0 4px 16px rgba(0, 0, 0, 0.6)",
};

// Uber Move is proprietary; Inter Tight (headlines, 700) and Inter (text, 400/500) mirror its Move / Move Text pairing
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  heading: "InterTight_700Bold",
};

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "smartbin.theme";

const ThemeContext = createContext<{ colors: Colors; dark: boolean; choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>("system");

  useEffect(() => {
    getPref(KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setChoiceState(saved);
    });
  }, []);

  const value = useMemo(() => {
    const isDark = choice === "system" ? system === "dark" : choice === "dark";
    return {
      colors: isDark ? dark : light,
      dark: isDark,
      choice,
      setChoice: (c: ThemeChoice) => {
        setChoiceState(c);
        setPref(KEY, c === "system" ? null : c);
      },
    };
  }, [choice, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside <ThemeProvider>");
  return theme;
}
