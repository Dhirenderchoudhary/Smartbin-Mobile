// Bin pins and your location dot, as React Native views (drawn on the native map as view annotations)
import { Trash2Icon } from "lucide-react-native";
import { View } from "react-native";
import type { BinType } from "@/lib/bins";
import { useTheme } from "@/lib/theme";

export function Pin({ type, selected, dot }: { type: BinType; selected?: boolean; dot?: boolean }) {
  const { colors } = useTheme();
  const size = dot ? 16 : selected ? 44 : 36;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: dot ? 2 : 3,
        borderColor: colors.background,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: colors.shadowFloat,
        outlineWidth: selected ? 2 : 0,
        outlineColor: colors.foreground,
        outlineStyle: "solid",
      }}
    >
      {/* Wet and dry: half green, half blue */}
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", backgroundColor: type === "DRY" ? colors.dry : colors.wet }} />
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", backgroundColor: type === "WET" ? colors.wet : colors.dry }} />
      {dot ? null : <Trash2Icon size={selected ? 20 : 16} color="#ffffff" strokeWidth={2.4} />}
    </View>
  );
}

// heading: degrees, already relative to the map's rotation; null hides the cone
export function YouDot({ heading }: { heading: number | null }) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: colors.foreground, opacity: 0.12 }} />
      {heading !== null ? (
        <View style={{ position: "absolute", width: 44, height: 44, alignItems: "center", transform: [{ rotate: `${heading}deg` }] }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 7,
              borderRightWidth: 7,
              borderBottomWidth: 11,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: colors.foreground,
            }}
          />
        </View>
      ) : null}
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: colors.background, backgroundColor: colors.foreground, boxShadow: colors.shadowFloat }} />
    </View>
  );
}
