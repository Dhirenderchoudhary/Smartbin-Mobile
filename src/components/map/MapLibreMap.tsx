// The map on phones: MapLibre Native, with the same OpenFreeMap / Amazon Location styles as the web app.
// Loaded by AppMap.tsx only when the native module is in the build (a development build, not Expo Go).
import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation, type CameraRef } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { metresBetween } from "@/lib/bins";
import { mapStyleUrl, switchToFallbackStyle } from "@/lib/mapStyle";
import { useTheme } from "@/lib/theme";
import { Pin, YouDot } from "./Markers";
import { MAX_PINS, type AppMapProps } from "./types";

export default function MapLibreMap({
  start,
  startZoom,
  bins,
  pinStyle = "pins",
  selectedId = null,
  onSelect,
  you,
  route = null,
  camera = null,
  onUserMove,
  onViewChange,
  onCenterChange,
}: AppMapProps) {
  const { colors, dark } = useTheme();
  const cameraRef = useRef<CameraRef>(null);
  const [, setFallbackTick] = useState(0);
  const [bearing, setBearing] = useState(0);
  const pinPressedAt = useRef(0);

  // Run each camera command once
  useEffect(() => {
    const cam = cameraRef.current;
    if (!camera || !cam) return;
    if (camera.kind === "ease") {
      cam.easeTo({
        center: [camera.center.lng, camera.center.lat],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
        padding: camera.padding,
        duration: camera.duration ?? 600,
      });
    } else if (camera.points.length) {
      const lngs = camera.points.map((p) => p.lng);
      const lats = camera.points.map((p) => p.lat);
      const [w, s, e, n] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
      // fitBounds on a single point would zoom to the maximum; ease there instead
      if (w === e && s === n) cam.easeTo({ center: [w, s], zoom: camera.maxZoom ?? 16, padding: camera.padding, duration: camera.duration ?? 600 });
      else cam.fitBounds([w, s, e, n], { padding: camera.padding, duration: camera.duration ?? 600, bearing: 0, pitch: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new command arrives
  }, [camera?.key]);

  // The nearest bins (the list is sorted by distance), plus the selected one
  const pins = useMemo(() => {
    const shown = bins.slice(0, MAX_PINS);
    const sel = bins.find((b) => b.id === selectedId);
    return sel && !shown.includes(sel) ? [...shown, sel] : shown;
  }, [bins, selectedId]);

  const routeShape = useMemo(
    () => (route?.length ? { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route } } : null),
    [route]
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.map }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyleUrl(dark)}
        logo={false}
        compass={false}
        attributionPosition={{ bottom: 8, right: 8 }}
        onDidFailLoadingMap={() => switchToFallbackStyle() && setFallbackTick((t) => t + 1)}
        onPress={() => {
          // A pin tap also reaches the map; don't let it clear the selection it just made
          if (Date.now() - pinPressedAt.current > 400) onSelect?.(null);
        }}
        onRegionWillChange={(e) => e.nativeEvent.userInteraction && onUserMove?.()}
        onRegionIsChanging={(e) => onCenterChange?.({ lng: e.nativeEvent.center[0], lat: e.nativeEvent.center[1] })}
        onRegionDidChange={(e) => {
          const { center, bounds } = e.nativeEvent;
          const c = { lng: center[0], lat: center[1] };
          setBearing(e.nativeEvent.bearing);
          onCenterChange?.(c);
          onViewChange?.(c, metresBetween(c, { lng: bounds[2], lat: bounds[3] }));
        }}
      >
        <Camera ref={cameraRef} initialViewState={{ center: [start.lng, start.lat], zoom: startZoom }} />

        {routeShape ? (
          <GeoJSONSource id="walk-route" data={routeShape}>
            <Layer type="line" id="walk-route-casing" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": colors.background, "line-width": 11 }} />
            <Layer type="line" id="walk-route-line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": colors.foreground, "line-width": 6 }} />
          </GeoJSONSource>
        ) : null}

        {pins.map((bin) => (
          <ViewAnnotation
            key={bin.id}
            id={`bin-${bin.id}`}
            lngLat={[bin.longitude, bin.latitude]}
            onPress={() => {
              pinPressedAt.current = Date.now();
              onSelect?.(bin.id);
            }}
          >
            <Pin type={bin.type} selected={bin.id === selectedId} dot={pinStyle === "dots"} />
          </ViewAnnotation>
        ))}

        {you ? (
          <ViewAnnotation id="you" lngLat={[you.lng, you.lat]}>
            {/* Annotations stay upright on screen, so take the map's rotation off the heading */}
            <YouDot heading={typeof you.heading === "number" ? you.heading - bearing : null} />
          </ViewAnnotation>
        ) : null}
      </Map>
    </View>
  );
}
