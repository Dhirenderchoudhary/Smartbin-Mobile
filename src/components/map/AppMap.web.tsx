// The map in a browser (Expo web), on maplibre-gl like the SmartBin web app. Same props as AppMap.tsx.
import { LngLatBounds, Map as MapLibre, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { metresBetween, type Bin } from "@/lib/bins";
import { mapStyleUrl, switchToFallbackStyle } from "@/lib/mapStyle";
import { useTheme, type Colors } from "@/lib/theme";
import { MAX_PINS, type AppMapProps } from "./types";

// Copied to public/ by the postinstall script (bundling breaks the worker's own lookup)
setWorkerUrl("/maplibre-gl-worker.mjs");

const BIN_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';

const pinBackground = (type: Bin["type"], c: Colors) =>
  type === "WET" ? c.wet : type === "DRY" ? c.dry : `linear-gradient(90deg, ${c.wet} 50%, ${c.dry} 50%)`;

// The marker element itself must stay unstyled (maplibre positions it with transform); the look is on a child
function pinElement(bin: Bin, c: Colors, dot: boolean, onPress: () => void) {
  const root = document.createElement("div");
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", bin.name);
  const size = dot ? 16 : 36;
  Object.assign(button.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: `${dot ? 2 : 3}px solid ${c.background}`,
    background: pinBackground(bin.type, c),
    boxShadow: c.shadowFloat,
    display: "grid",
    placeItems: "center",
    padding: "0",
    cursor: dot ? "default" : "pointer",
    transition: "transform 150ms",
  });
  if (!dot) button.innerHTML = BIN_ICON;
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!dot) onPress();
  });
  root.append(button);
  return { root, button };
}

function youElement(c: Colors) {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Your location");
  Object.assign(el.style, { width: "44px", height: "44px", display: "grid", placeItems: "center", pointerEvents: "none", zIndex: "10" });
  el.innerHTML =
    `<span style="position:absolute;inset:2px;border-radius:50%;background:${c.foreground};opacity:.12"></span>` +
    `<span data-cone style="position:absolute;inset:0;display:none"><span style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid ${c.foreground}"></span></span>` +
    `<span style="position:relative;width:16px;height:16px;border-radius:50%;border:3px solid ${c.background};background:${c.foreground};box-shadow:${c.shadowFloat}"></span>`;
  return el;
}

const ROUTE = "walk-route";
function drawRoute(m: MapLibre, line: [number, number][] | null, c: Colors) {
  const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line ?? [] } };
  const source = m.getSource(ROUTE) as GeoJSONSource | undefined;
  if (source) return source.setData(data);
  m.addSource(ROUTE, { type: "geojson", data });
  m.addLayer({ id: `${ROUTE}-casing`, type: "line", source: ROUTE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.background, "line-width": 11 } });
  m.addLayer({ id: ROUTE, type: "line", source: ROUTE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.foreground, "line-width": 6 } });
}

export default function AppMap({
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
  const host = useRef<View>(null);
  const map = useRef<MapLibre | null>(null);
  const styleReady = useRef(false);
  const pins = useRef(new globalThis.Map<string, { marker: Marker; button: HTMLButtonElement }>());
  const youMarker = useRef<Marker | null>(null);
  const latest = useRef({ onSelect, onUserMove, onViewChange, onCenterChange, route, colors });

  useEffect(() => {
    latest.current = { onSelect, onUserMove, onViewChange, onCenterChange, route, colors };
  });

  // Create once
  useEffect(() => {
    // On the web, a View's ref is its DOM element
    const m = new MapLibre({
      container: host.current as unknown as HTMLElement,
      style: mapStyleUrl(dark),
      center: [start.lng, start.lat],
      zoom: startZoom,
      attributionControl: { compact: true },
      validateStyle: false,
    });
    map.current = m;
    m.on("error", (e) => {
      if (String((e.error as { url?: string })?.url ?? e.error?.message).includes("amazonaws.com") && switchToFallbackStyle()) m.setStyle(mapStyleUrl(dark));
    });
    m.on("styledataloading", () => (styleReady.current = false));
    m.on("style.load", () => {
      styleReady.current = true;
      drawRoute(m, latest.current.route, latest.current.colors);
    });
    m.on("click", () => latest.current.onSelect?.(null));
    m.on("movestart", (e) => e.originalEvent && latest.current.onUserMove?.());
    m.on("move", () => {
      const c = m.getCenter();
      latest.current.onCenterChange?.({ lat: c.lat, lng: c.lng });
    });
    m.on("moveend", () => {
      const c = m.getCenter();
      const ne = m.getBounds().getNorthEast();
      latest.current.onViewChange?.({ lat: c.lat, lng: c.lng }, metresBetween({ lat: c.lat, lng: c.lng }, { lat: ne.lat, lng: ne.lng }));
    });
    const currentPins = pins.current;
    return () => {
      currentPins.clear();
      youMarker.current = null;
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once
  }, []);

  // Theme: new style (markers are rebuilt below with the new colours)
  useEffect(() => {
    map.current?.setStyle(mapStyleUrl(dark));
    for (const { marker } of pins.current.values()) marker.remove();
    pins.current.clear();
    youMarker.current?.remove();
    youMarker.current = null;
  }, [dark]);

  // Route
  useEffect(() => {
    if (map.current && styleReady.current) drawRoute(map.current, route, colors);
  }, [route, colors]);

  // Pins: the nearest MAX_PINS plus the selected one
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const shown = bins.slice(0, MAX_PINS);
    const sel = bins.find((b) => b.id === selectedId);
    if (sel && !shown.includes(sel)) shown.push(sel);
    const ids = new Set(shown.map((b) => b.id));
    for (const [id, pin] of pins.current) {
      if (!ids.has(id)) {
        pin.marker.remove();
        pins.current.delete(id);
      }
    }
    for (const bin of shown) {
      if (pins.current.has(bin.id)) continue;
      const { root, button } = pinElement(bin, colors, pinStyle === "dots", () => latest.current.onSelect?.(bin.id));
      pins.current.set(bin.id, { button, marker: new Marker({ element: root }).setLngLat([bin.longitude, bin.latitude]).addTo(m) });
    }
    for (const [id, pin] of pins.current) {
      pin.button.style.transform = id === selectedId ? "scale(1.25)" : "";
      pin.button.style.outline = id === selectedId ? `2px solid ${colors.foreground}` : "";
    }
  }, [bins, selectedId, pinStyle, colors]);

  // You
  useEffect(() => {
    const m = map.current;
    if (!m || !you) return;
    // rotationAlignment "map": maplibre takes the map's own rotation into account
    youMarker.current ??= new Marker({ element: youElement(colors), rotationAlignment: "map" }).setLngLat([you.lng, you.lat]).addTo(m);
    youMarker.current.setLngLat([you.lng, you.lat]);
    const cone = youMarker.current.getElement().querySelector<HTMLElement>("[data-cone]")!;
    cone.style.display = typeof you.heading === "number" ? "block" : "none";
    if (typeof you.heading === "number") youMarker.current.setRotation(you.heading);
  }, [you, colors]);

  // Camera commands, once each
  useEffect(() => {
    const m = map.current;
    if (!camera || !m) return;
    if (camera.kind === "ease") {
      m.easeTo({
        center: [camera.center.lng, camera.center.lat],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
        padding: camera.padding,
        duration: camera.duration ?? 600,
      });
    } else if (camera.points.length) {
      const bounds = new LngLatBounds();
      camera.points.forEach((p) => bounds.extend([p.lng, p.lat]));
      m.fitBounds(bounds, { padding: camera.padding, maxZoom: camera.maxZoom ?? 16.5, duration: camera.duration ?? 600, bearing: 0, pitch: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new command arrives
  }, [camera?.key]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.map }]}>
      <View ref={host} style={{ flex: 1 }} />
    </View>
  );
}
