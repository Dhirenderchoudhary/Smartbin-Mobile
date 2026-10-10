// The web app's building blocks (shadcn base-nova, Uber Base tokens) as React Native components:
// pill buttons, chips, badges, alerts, inputs and text. Colours come from the theme.
import type { LucideIcon } from "lucide-react-native";
import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { fonts, useTheme, type Colors } from "@/lib/theme";

type Tone = "default" | "muted" | "inverse" | "destructive" | "wet";

export function Text({
  heading,
  weight = "regular",
  size = 16,
  tone = "default",
  style,
  ...props
}: TextProps & { heading?: boolean; weight?: "regular" | "medium"; size?: number; tone?: Tone }) {
  const { colors } = useTheme();
  const color = { default: colors.foreground, muted: colors.mutedForeground, inverse: colors.primaryForeground, destructive: colors.destructive, wet: colors.wet }[tone];
  return (
    <RNText
      {...props}
      style={[
        {
          color,
          fontSize: size,
          lineHeight: Math.round(size * (heading ? 1.2 : 1.45)),
          fontFamily: heading ? fonts.heading : weight === "medium" ? fonts.medium : fonts.regular,
          letterSpacing: heading ? -0.3 : 0,
        },
        style,
      ]}
    />
  );
}

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "floating";
type Size = "sm" | "default" | "lg" | "xl";
const HEIGHT: Record<Size, number> = { sm: 36, default: 40, lg: 44, xl: 52 };

function variantStyle(variant: Variant, c: Colors): { bg: string; fg: string; border?: string; shadow?: string } {
  switch (variant) {
    case "secondary":
      return { bg: c.secondary, fg: c.foreground };
    case "outline":
      return { bg: c.background, fg: c.foreground, border: c.border };
    case "ghost":
      return { bg: "transparent", fg: c.foreground };
    case "destructive":
      return { bg: c.destructive, fg: "#ffffff" };
    case "floating":
      return { bg: c.card, fg: c.foreground, shadow: c.shadowFloat };
    default:
      return { bg: c.primary, fg: c.primaryForeground };
  }
}

export function Button({
  label,
  icon: Icon,
  iconRight: IconRight,
  variant = "default",
  size = "default",
  busy = false,
  disabled,
  style,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  label?: string;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const v = variantStyle(variant, colors);
  const off = disabled || busy;
  const iconOnly = !label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          minWidth: HEIGHT[size],
          paddingHorizontal: iconOnly ? 0 : size === "sm" ? 14 : 20,
          borderRadius: 999,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: off ? 0.5 : pressed ? 0.8 : 1,
          boxShadow: v.shadow,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={v.fg} /> : Icon ? <Icon size={size === "sm" ? 16 : 20} color={v.fg} /> : null}
      {label ? (
        <Text weight="medium" size={size === "sm" ? 14 : 16} style={{ color: v.fg }} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {IconRight ? <IconRight size={18} color={v.fg} /> : null}
    </Pressable>
  );
}

// One choice from a few, as pill chips (All / Wet / Dry, waste type, ...)
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  style,
}: {
  options: { value: T; label: string; dot?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: on ? colors.primary : colors.secondary,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {o.dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.dot }} /> : null}
            <Text weight="medium" size={15} style={{ color: on ? colors.primaryForeground : colors.foreground }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone = "secondary" }: { label: string; tone?: "secondary" | "wet" | "dry" | "warning" | "destructive" }) {
  const { colors } = useTheme();
  const look = {
    secondary: { bg: colors.secondary, fg: colors.foreground },
    wet: { bg: colors.wet + "26", fg: colors.wet },
    dry: { bg: colors.dry + "26", fg: colors.dry },
    warning: { bg: colors.warning, fg: colors.warningForeground },
    destructive: { bg: colors.destructive + "1a", fg: colors.destructive },
  }[tone];
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: look.bg }}>
      <Text weight="medium" size={13} style={{ color: look.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Alert({ icon: Icon, title, text, tone = "default", action }: { icon?: LucideIcon; title?: string; text: string; tone?: "default" | "destructive" | "warning"; action?: React.ReactNode }) {
  const { colors } = useTheme();
  const look = {
    default: { bg: colors.card, fg: colors.foreground, border: colors.border },
    destructive: { bg: colors.card, fg: colors.destructive, border: colors.border },
    warning: { bg: colors.warning, fg: colors.warningForeground, border: colors.warning },
  }[tone];
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: look.border, backgroundColor: look.bg }}>
      {Icon ? <Icon size={18} color={look.fg} style={{ marginTop: 2 }} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text weight="medium" style={{ color: look.fg }}>
            {title}
          </Text>
        ) : null}
        <Text size={15} style={{ color: look.fg }}>
          {text}
        </Text>
      </View>
      {action}
    </View>
  );
}

export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  const { colors } = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[
        {
          height: 52,
          borderRadius: 12,
          paddingHorizontal: 16,
          backgroundColor: colors.input,
          color: colors.foreground,
          fontFamily: fonts.regular,
          fontSize: 16, // 16+ so iOS doesn't zoom on focus
        },
        style as StyleProp<TextStyle>,
      ]}
    />
  );
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text weight="medium">{label}</Text>
      {children}
      {hint ? (
        <Text size={14} tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Spinner({ inverse }: { inverse?: boolean }) {
  const { colors } = useTheme();
  return <ActivityIndicator color={inverse ? colors.primaryForeground : colors.foreground} />;
}

// A floating card: the bottom sheet, the instruction card, banners
export function Surface({ children, style, inverse }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; inverse?: boolean }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: inverse ? colors.primary : colors.card, boxShadow: colors.shadowSheet }, style]}>{children}</View>;
}
