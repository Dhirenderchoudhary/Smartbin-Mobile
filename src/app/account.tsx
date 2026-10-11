// Account: who you are, this month's limits, appearance, privacy, sign out. Mirrors apps/web/src/app/app/me/page.tsx.
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { AlertCircleIcon, ArrowLeftIcon, ExternalLinkIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Button, Spinner, Text } from "@/components/ui";
import { api, type Me, type Quota } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

function Card({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 16, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      <View style={{ gap: 2 }}>
        <Text heading size={18}>
          {title}
        </Text>
        {description ? (
          <Text size={14} tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Allowance({ label, used, limit }: { label: string; used: number; limit: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text weight="medium">{label}</Text>
        <Text tone="muted">
          {limit - used} of {limit} left
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: limit, now: used }}
        style={{ height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.secondary }}
      >
        <View style={{ height: "100%", borderRadius: 4, backgroundColor: colors.primary, width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }} />
      </View>
    </View>
  );
}

const THEMES: { value: ThemeChoice; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export default function Account() {
  const { colors, choice, setChoice } = useTheme();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<Me | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me>("/me").then(setMe, () => {});
    api<Quota>("/me/quota").then(setQuota, (e: Error) => setError(e.message));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderColor: colors.border }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 }}>
          <Button variant="ghost" size="lg" icon={ArrowLeftIcon} accessibilityLabel="Back to the map" onPress={() => router.back()} />
          <Text heading size={20}>
            Account
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary }}>
            <Text heading size={22}>
              {(me?.email?.[0] ?? "?").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium" size={18} numberOfLines={1}>
              {me?.email ?? " "}
            </Text>
            <Text tone="muted">{me?.role === "ADMIN" ? "Admin" : "Member"}</Text>
          </View>
        </View>

        <Card title="This month" description={quota ? `Your limits reset on ${dayMonth(quota.resetsOn)}.` : "Your monthly limits."}>
          {error ? <Alert icon={AlertCircleIcon} tone="destructive" text={error} /> : null}
          {!quota && !error ? <Spinner /> : null}
          {quota ? (
            <>
              <Allowance label="Bins added" used={quota.used.registrations} limit={quota.limits.registrations} />
              <Allowance label="Missing reports" used={quota.used.missingReports} limit={quota.limits.missingReports} />
            </>
          ) : null}
        </Card>

        <Card title="Appearance" description="System follows your phone's light or dark setting.">
          <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {THEMES.map(({ value, label, icon: Icon }) => {
              const on = choice === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  aria-checked={on}
                  onPress={() => setChoice(value)}
                  style={{ height: 40, paddingHorizontal: 16, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: on ? colors.primary : colors.secondary }}
                >
                  <Icon size={16} color={on ? colors.primaryForeground : colors.foreground} />
                  <Text weight="medium" size={15} style={{ color: on ? colors.primaryForeground : colors.foreground }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Button variant="outline" size="xl" icon={ExternalLinkIcon} label="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)} />
        <Button variant="secondary" size="xl" icon={LogOutIcon} label="Sign out" onPress={() => signOut()} />
      </ScrollView>
    </View>
  );
}
