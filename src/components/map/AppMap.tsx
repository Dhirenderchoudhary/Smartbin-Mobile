// The map on phones. MapLibre Native has native code that Expo Go doesn't include, and importing it there
// crashes the app, so it's only loaded when its native module is in the build (a development build).
// In Expo Go the rest of the app still works and the map area says how to get the map.
// (AppMap.web.tsx is the browser version, on maplibre-gl.)
import Constants from "expo-constants";
import { MapIcon } from "lucide-react-native";
import { StyleSheet, TurboModuleRegistry, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Text } from "../ui";
import type { AppMapProps } from "./types";

const hasMapLibre = TurboModuleRegistry.get("MLRNCameraModule") != null;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- only load MapLibre when its native code exists
const MapLibreMap: React.ComponentType<AppMapProps> | null = hasMapLibre ? require("./MapLibreMap").default : null;

function MapUnavailable() {
  const { colors } = useTheme();
  const inExpoGo = Constants.executionEnvironment === "storeClient";
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.map, alignItems: "center", justifyContent: "center", padding: 24 }]}>
      <View style={{ maxWidth: 340, alignItems: "center", gap: 10, padding: 20, borderRadius: 20, backgroundColor: colors.card, boxShadow: colors.shadowFloat, marginBottom: "40%" }}>
        <MapIcon size={28} color={colors.foreground} />
        <Text heading size={18} style={{ textAlign: "center" }}>
          The map needs the SmartBin development build
        </Text>
        <Text size={14} tone="muted" style={{ textAlign: "center" }}>
          {inExpoGo
            ? "Expo Go doesn't include the map library. Everything else works here; install the development build to see the map."
            : "This build doesn't include the map library. Rebuild the app after installing dependencies."}
        </Text>
      </View>
    </View>
  );
}

export default function AppMap(props: AppMapProps) {
  return MapLibreMap ? <MapLibreMap {...props} /> : <MapUnavailable />;
}
