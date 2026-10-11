// Walking directions, like Google Maps: a route preview with Start, then turn-by-turn while you walk.
import {
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CornerUpLeftIcon,
  CornerUpRightIcon,
  ExternalLinkIcon,
  FlagIcon,
  NavigationIcon,
  Undo2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { directionsUrl, formatDistance, metresBetween, walkMinutes, type Bin, type LatLng } from "@/lib/bins";
import { routeProgress, stepPoint, type Turn, type WalkRoute } from "@/lib/routes";
import { useTheme } from "@/lib/theme";
import { TypeBadges } from "./BinSheet";
import { Button, Spinner, Text } from "./ui";

export const TURN_ICON: Record<Turn, LucideIcon> = {
  depart: ArrowUpIcon,
  straight: ArrowUpIcon,
  left: CornerUpLeftIcon,
  right: CornerUpRightIcon,
  "slight-left": ArrowUpLeftIcon,
  "slight-right": ArrowUpRightIcon,
  uturn: Undo2Icon,
  arrive: FlagIcon,
};

// Close enough to see the bin, and the same distance the app needs for a missing report
export const ARRIVED_WITHIN_M = 20;

const clock = (minutesFromNow: number) => {
  const d = new Date(Date.now() + minutesFromNow * 60000);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
};

function Sheet({ children, bottomInset, onHeight }: { children: React.ReactNode; bottomInset: number; onHeight?: (h: number) => void }) {
  const { colors } = useTheme();
  return (
    <View
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "60%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.card, boxShadow: colors.shadowSheet, padding: 20, paddingBottom: 20 + bottomInset, gap: 16 }}
    >
      {children}
    </View>
  );
}

// Before you set off: the whole route, how long it takes, and Start
export function RoutePreview({
  bin,
  route,
  bottomInset,
  onStart,
  onClose,
  onHeight,
}: {
  bin: Bin;
  route: WalkRoute | null;
  bottomInset: number;
  onStart: () => void;
  onClose: () => void;
  onHeight: (h: number) => void;
}) {
  const { colors } = useTheme();
  const [showSteps, setShowSteps] = useState(false);
  const minutes = route ? walkMinutes(route.distance) : null;

  return (
    <Sheet bottomInset={bottomInset} onHeight={onHeight}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text tone="muted" numberOfLines={1}>
            Walk to {bin.name}
          </Text>
          {route ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <Text heading size={30} style={{ color: colors.wet }}>
                {minutes} min
              </Text>
              <Text heading size={20} tone="muted">
                ({formatDistance(route.distance)})
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <Spinner />
              <Text>Finding a walking route…</Text>
            </View>
          )}
          {route ? <Text tone="muted">Arrive around {clock(minutes!)}</Text> : null}
        </View>
        <Button size="default" variant="secondary" icon={XIcon} accessibilityLabel="Close directions" onPress={onClose} />
      </View>

      {route?.provider === "direct" ? (
        <Text size={14} tone="muted">
          Walking routes are unavailable right now, so this is a straight line. Stick to paths and roads.
        </Text>
      ) : null}

      {route && route.steps.length > 1 ? (
        <View>
          <Pressable accessibilityRole="button" aria-expanded={showSteps} onPress={() => setShowSteps((s) => !s)} style={{ paddingVertical: 4 }}>
            <Text weight="medium">{showSteps ? "Hide steps" : `Steps (${route.steps.length})`}</Text>
          </Pressable>
          {showSteps ? (
            <ScrollView style={{ maxHeight: 180, marginTop: 8 }}>
              {route.steps.map((step, i) => {
                const Icon = TURN_ICON[step.turn];
                const next = route.steps[i + 1];
                return (
                  <View key={`${step.index}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                    <Icon size={22} color={colors.foreground} />
                    <Text style={{ flex: 1 }}>{step.text}</Text>
                    {next ? (
                      <Text size={14} tone="muted">
                        {formatDistance(metresBetween(stepPoint(route, step), stepPoint(route, next)))}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button size="xl" icon={NavigationIcon} label="Start" disabled={!route} style={{ flex: 1 }} onPress={onStart} />
        <Button size="xl" variant="outline" icon={ExternalLinkIcon} accessibilityLabel="Open in Google Maps" onPress={() => Linking.openURL(directionsUrl(bin))} />
      </View>
    </Sheet>
  );
}

// While walking: the next turn on top, time and distance left at the bottom, then "You've arrived"
export function ActiveNavigation({
  bin,
  route,
  you,
  topInset,
  bottomInset,
  onEnd,
  onHeight,
}: {
  bin: Bin;
  route: WalkRoute | null;
  you: LatLng | null;
  topInset: number;
  bottomInset: number;
  onEnd: () => void;
  onHeight: (h: number) => void;
}) {
  const { colors } = useTheme();
  const toBin = you ? metresBetween(you, bin) : null;
  const arrived = toBin !== null && toBin <= ARRIVED_WITHIN_M;
  const progress = route && you ? routeProgress(route, you) : null;
  const remaining = progress?.remaining ?? toBin ?? route?.distance ?? 0;
  const next = progress?.next ?? null;
  const NextIcon = next ? TURN_ICON[next.turn] : ArrowUpIcon;

  return (
    <>
      {!arrived ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ position: "absolute", left: 12, right: 12, top: topInset + 12, flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 20, backgroundColor: colors.primary, boxShadow: colors.shadowSheet }}
        >
          {route && next ? (
            <>
              <NextIcon size={40} color={colors.primaryForeground} />
              <View style={{ flex: 1 }}>
                {you && next.turn !== "depart" ? (
                  <Text heading size={26} tone="inverse">
                    {formatDistance(metresBetween(you, stepPoint(route, next)))}
                  </Text>
                ) : null}
                <Text size={18} tone="inverse">
                  {next.text}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Spinner inverse />
              <Text size={18} tone="inverse">
                Finding a walking route…
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <Sheet bottomInset={bottomInset} onHeight={onHeight}>
        {arrived ? (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <CheckCircle2Icon size={28} color={colors.wet} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text heading size={24}>
                  You&apos;ve arrived
                </Text>
                <Text tone="muted">
                  {bin.name} should be within {ARRIVED_WITHIN_M} m of you. Can&apos;t see it, or something&apos;s wrong with it? Tap Done, then Report a problem.
                </Text>
              </View>
            </View>
            <Button size="xl" label="Done" onPress={onEnd} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Text heading size={30} style={{ color: colors.wet }}>
                    {walkMinutes(remaining)} min
                  </Text>
                  <Text heading size={18} tone="muted">
                    {formatDistance(remaining)}
                  </Text>
                </View>
                <Text tone="muted" numberOfLines={1}>
                  Arrive {clock(walkMinutes(remaining))}, {bin.name}
                </Text>
              </View>
              <TypeBadges type={bin.type} />
            </View>
            {route?.provider === "direct" ? (
              <Text size={14} tone="muted">
                Walking routes are unavailable right now, so this is a straight line. Stick to paths and roads.
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button size="xl" variant="destructive" label="End" style={{ flex: 1 }} onPress={onEnd} />
              <Button size="xl" variant="outline" icon={ExternalLinkIcon} label="Google Maps" onPress={() => Linking.openURL(directionsUrl(bin))} />
            </View>
          </>
        )}
      </Sheet>
    </>
  );
}
