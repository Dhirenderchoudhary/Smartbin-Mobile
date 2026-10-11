import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, Mask, Path, Rect } from "react-native-svg";
import { useTheme } from "@/lib/theme";
import { Text } from "./ui";

// Rounded tile with the bin cut out, so it inverts cleanly on black or white (same mark as the web app)
export function LogoMark({ size = 32, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const id = useId().replace(/:/g, "");
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <Mask id={id}>
          <Rect width={32} height={32} fill="white" />
          <Path
            d="M9 11h14M13.5 8.5h5M11 11l1.3 12.5h7.4L21 11M14.6 14.5v5.5M17.4 14.5v5.5"
            fill="none"
            stroke="black"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Mask>
      </Defs>
      <Rect width={32} height={32} rx={9} fill={color ?? colors.foreground} mask={`url(#${id})`} />
    </Svg>
  );
}

export function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <View accessibilityLabel="SmartBin" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <LogoMark size={size} />
      {wordmark ? (
        <Text heading size={20}>
          SmartBin
        </Text>
      ) : null}
    </View>
  );
}
