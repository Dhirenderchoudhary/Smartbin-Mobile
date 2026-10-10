// The map: bins near you, a bottom sheet, and walking directions. Mirrors apps/web/src/app/app/page.tsx.
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2Icon, LocateFixedIcon, MapPinOffIcon, PlusIcon, UserRoundIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BinSheet } from "@/components/BinSheet";
import { LogoMark } from "@/components/Logo";
import AppMap from "@/components/map/AppMap";
import type { CameraCommand, CameraMove } from "@/components/map/types";
import { ActiveNavigation, ARRIVED_WITHIN_M, RoutePreview } from "@/components/NavigationPanel";
import { Button, Chips, Spinner, Surface, Text } from "@/components/ui";
import { fetchArea, fetchNearby, INDIA_VIEW, metresBetween, trackInteraction, type Bin, type BinIssue, type LatLng } from "@/lib/bins";
import { lastKnownLocation, watchCompass, watchLocation } from "@/lib/location";
import { routeProgress, walkingRoute, type WalkRoute } from "@/lib/routes";
import { useTheme } from "@/lib/theme";

// Recalculate the route when you're this far off it (and not more often than every 10 s)
const OFF_ROUTE_M = 35;
const REROUTE_EVERY_MS = 10_000;
// Past this (about a large city across), the map asks you to zoom in instead of loading bins
const MAX_VIEW_RADIUS_M = 50_000;
// While walking: close in, tilted, the way you're facing at the top
const NAV_ZOOM = 18;
const NAV_PITCH = 50;

type Filter = "ALL" | "WET" | "DRY";
type Stage = "preview" | "active";

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ bin?: string; added?: string; lat?: string; lng?: string }>();

  // Where the map opens: your last known spot, or all of India (undefined while reading it)
  const [start, setStart] = useState<{ at: LatLng | null } | undefined>(undefined);
  const [you, setYou] = useState<(LatLng & { heading: number | null }) | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [watchKey, setWatchKey] = useState(0);
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [added, setAdded] = useState(false);
  const [tooWide, setTooWide] = useState(false);
  const loadedAround = useRef<LatLng | null>(null);
  const loadedAreas = useRef<{ center: LatLng; radius: number }[]>([]);

  // Camera: a new command each time the view should move
  const [camera, setCamera] = useState<CameraCommand | null>(null);
  const cameraKey = useRef(0);
  const move = useCallback((c: CameraMove) => setCamera({ ...c, key: ++cameraKey.current }), []);
  const wantFrame = useRef(true); // frame you and the nearest bins once both are known

  // Directions
  const [navBin, setNavBin] = useState<Bin | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [follow, setFollow] = useState(false);
  const [compass, setCompass] = useState<number | null>(null);
  const [navSheet, setNavSheet] = useState(260);
  const routedAt = useRef(0);
  const routeRequest = useRef(0); // ignores route answers that arrive after you ended or rerouted
  const arrivedAt = useRef<string | null>(null);

  const sheetMax = Math.round(height * 0.46);

  useEffect(() => {
    lastKnownLocation().then((at) => setStart({ at }));
  }, []);

  // Bins arrive from several places (around you, the area in view, a bin you just added): keep them all
  const merge = useCallback((list: Bin[]) => {
    setBins((prev) => [...new Map([...prev, ...list].map((b) => [b.id, b])).values()]);
  }, []);

  const reload = useCallback(
    async (at: LatLng) => {
      loadedAround.current = at;
      setLoading(true);
      setLoadError(null);
      try {
        merge(await fetchNearby(at, true));
        loadedAreas.current.push({ center: at, radius: 2000 });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Couldn't load bins. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [merge]
  );

  const loadView = useCallback(
    (center: LatLng, radius: number) => {
      setTooWide(radius > MAX_VIEW_RADIUS_M);
      if (radius > MAX_VIEW_RADIUS_M) return;
      if (loadedAreas.current.some((a) => metresBetween(a.center, center) + radius <= a.radius)) return;
      fetchArea(center, radius).then((list) => {
        merge(list);
        // ponytail: an area that hit the API's 500 cap is incomplete, so it isn't remembered
        if (list.length < 500) loadedAreas.current.push({ center, radius });
      }, () => {});
    },
    [merge]
  );

  // Follow your live position; bins reload after you move ~300 m
  useEffect(() => {
    return watchLocation(
      (fix) => {
        const at = { lat: fix.lat, lng: fix.lng };
        setLocError(null);
        setYou({ ...at, heading: fix.heading });
        if (!loadedAround.current || metresBetween(loadedAround.current, at) > 300) reload(at);
      },
      (message) => {
        setLocError(message);
        setLoading(false);
      }
    );
  }, [watchKey, reload]);

  // Back from the add screen (this screen stays mounted underneath, so watch the params, not just the first ones):
  // show the bin, confirm it, and fetch it by its location in case it's far from you
  useEffect(() => {
    if (!params.bin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route params arrive from navigation, outside React state
    setSelectedId(params.bin);
    if (params.added === "1") {
      setAdded(true);
      const lat = Number(params.lat), lng = Number(params.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) fetchNearby({ lat, lng }).then(merge, () => {});
    }
    router.setParams({ bin: undefined, added: undefined, lat: undefined, lng: undefined });
  }, [params.bin, params.added, params.lat, params.lng, merge]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 6000);
    return () => clearTimeout(t);
  }, [added]);

  // Distances from where you are now, nearest first
  const visible = useMemo(() => {
    const shown = filter === "ALL" ? bins : bins.filter((b) => b.type === filter || b.type === "BOTH");
    if (!you) return shown;
    return shown.map((b) => ({ ...b, distance: metresBetween(you, b) })).sort((a, b) => a.distance - b.distance);
  }, [bins, filter, you]);
  const selected = visible.find((b) => b.id === selectedId) ?? null;

  // Frame you and the nearest bins (first fix, first bins, the locate button)
  useEffect(() => {
    if (!wantFrame.current || navBin || (!you && !visible.length)) return;
    if (you && loading) return; // wait for the bins around you
    wantFrame.current = false;
    const points = [...(you ? [you] : []), ...visible.slice(0, 5).map((b) => ({ lat: b.latitude, lng: b.longitude }))];
    if (selected) points.push({ lat: selected.latitude, lng: selected.longitude });
    move({ kind: "fit", points, maxZoom: 16.5, padding: { top: insets.top + 130, bottom: sheetMax + 24, left: 40, right: 40 } });
  }, [you, visible, loading, navBin, selected, move, insets.top, sheetMax]);

  // Centre the selected bin above the sheet
  useEffect(() => {
    if (!selected || navBin) return;
    trackInteraction(selected.id, "VIEW");
    move({ kind: "ease", center: { lat: selected.latitude, lng: selected.longitude }, padding: { top: insets.top + 120, bottom: sheetMax, left: 0, right: 0 }, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the selection changes, not on every distance update
  }, [selectedId, !!selected]);

  // ---- directions

  const routeTo = useCallback((from: LatLng, bin: Bin) => {
    routedAt.current = Date.now();
    const request = ++routeRequest.current;
    walkingRoute(from, { lat: bin.latitude, lng: bin.longitude }).then((r) => request === routeRequest.current && setRoute(r));
  }, []);

  function openDirections(bin: Bin) {
    trackInteraction(bin.id, "DIRECTIONS");
    arrivedAt.current = null;
    setSelectedId(bin.id);
    setNavBin(bin);
    setStage("preview");
    setRoute(null);
    setFollow(false);
    if (you) routeTo(you, bin);
  }

  function startWalking() {
    setStage("active");
    setFollow(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }

  function endDirections() {
    routeRequest.current++;
    setNavBin(null);
    setStage(null);
    setRoute(null);
    setFollow(false);
    setCompass(null);
    // Back to a flat, north-up map around you and the bins
    if (you) move({ kind: "ease", center: you, zoom: 16, bearing: 0, pitch: 0, padding: { top: insets.top + 120, bottom: sheetMax, left: 0, right: 0 } });
  }

  // Route as soon as we know where you are, and reroute when you stray
  useEffect(() => {
    if (!navBin || !you) return;
    const stale = Date.now() - routedAt.current > REROUTE_EVERY_MS;
    if (!route ? stale || !routedAt.current : stale && routeProgress(route, you).offRoute > OFF_ROUTE_M) routeTo(you, navBin);
  }, [navBin, you, route, routeTo]);

  // Preview: the whole route on screen, above the sheet
  useEffect(() => {
    if (stage !== "preview" || !route) return;
    const points = route.line.map(([lng, lat]) => ({ lat, lng }));
    if (you) points.push(you);
    move({ kind: "fit", points, padding: { top: insets.top + 40, bottom: navSheet + 32, left: 40, right: 40 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the route arrives, not on every GPS fix
  }, [stage, route, navSheet]);

  // Compass while walking (phones); small wobbles are ignored so the map doesn't jitter
  useEffect(() => {
    if (stage !== "active") return;
    return watchCompass((deg) => setCompass((prev) => (prev === null || Math.abs(((deg - prev + 540) % 360) - 180) > 8 ? deg : prev)));
  }, [stage]);

  // Which way you're facing: compass, else GPS course, else the route's direction where you are
  const progress = route && you ? routeProgress(route, you) : null;
  const heading = stage === "active" ? (compass ?? you?.heading ?? progress?.heading ?? null) : null;

  // Active: follow you, heading-up and tilted, with you low on the screen so you see what's ahead
  useEffect(() => {
    if (stage !== "active" || !follow || !you) return;
    move({
      kind: "ease",
      center: you,
      zoom: NAV_ZOOM,
      bearing: heading ?? undefined,
      pitch: NAV_PITCH,
      padding: { top: Math.round(height * 0.42), bottom: navSheet, left: 0, right: 0 },
      duration: 700,
    });
  }, [stage, follow, you, heading, move, height, navSheet]);

  // Keep the screen on while walking
  useEffect(() => {
    if (stage !== "active") return;
    activateKeepAwakeAsync("navigation").catch(() => {});
    return () => void deactivateKeepAwake("navigation").catch(() => {});
  }, [stage]);

  // Arrival: count it once, and a buzz
  useEffect(() => {
    if (stage !== "active" || !navBin || !you || arrivedAt.current === navBin.id || metresBetween(you, navBin) > ARRIVED_WITHIN_M) return;
    arrivedAt.current = navBin.id;
    trackInteraction(navBin.id, "ARRIVED");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [stage, navBin, you]);

  const navigating = !!navBin;
  const narrow = width < 360;

  return (
    <View style={{ flex: 1, backgroundColor: colors.map }}>
      {start !== undefined ? (
        <AppMap
          start={start.at ?? INDIA_VIEW.center}
          startZoom={start.at ? 15 : INDIA_VIEW.zoom}
          bins={visible}
          selectedId={selectedId}
          onSelect={(id) => !navigating && setSelectedId(id)}
          you={you ? { ...you, heading: heading ?? you.heading } : null}
          route={route?.line ?? null}
          camera={camera}
          onUserMove={() => stage === "active" && setFollow(false)}
          onViewChange={loadView}
        />
      ) : null}

      {stage === "preview" && navBin ? (
        <RoutePreview bin={navBin} route={route} bottomInset={insets.bottom} onStart={startWalking} onClose={endDirections} onHeight={setNavSheet} />
      ) : null}
      {stage === "active" && navBin ? (
        <>
          <ActiveNavigation bin={navBin} route={route} you={you} topInset={insets.top} bottomInset={insets.bottom} onEnd={endDirections} onHeight={setNavSheet} />
          {!follow ? (
            <Button
              size="lg"
              variant="floating"
              icon={LocateFixedIcon}
              label="Re-centre"
              style={{ position: "absolute", alignSelf: "center", bottom: navSheet + 16 }}
              onPress={() => setFollow(true)}
            />
          ) : null}
        </>
      ) : null}

      {added ? (
        <Surface inverse style={{ position: "absolute", left: 16, right: 16, top: insets.top + 12, zIndex: 30, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CheckCircle2Icon size={24} color={colors.wet} />
          <Text tone="inverse" style={{ flex: 1 }}>
            <Text tone="inverse" weight="medium">
              Bin added.
            </Text>{" "}
            Thanks, it&apos;s on the map for everyone now.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setAdded(false)} hitSlop={12}>
            <Text tone="inverse" size={14}>
              Dismiss
            </Text>
          </Pressable>
        </Surface>
      ) : null}

      {!you && !locError ? (
        <View style={{ pointerEvents: "none", position: "absolute", top: "33%", left: 0, right: 0, alignItems: "center" }}>
          <Surface style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Spinner />
            <Text>Finding your location…</Text>
          </Surface>
        </View>
      ) : null}

      {!navigating ? (
        <>
          {/* Top bar */}
          <View style={{ position: "absolute", top: insets.top + 12, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View
              accessibilityLabel="SmartBin"
              style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6, paddingRight: narrow ? 6 : 16, borderRadius: 999, backgroundColor: colors.card, boxShadow: colors.shadowFloat }}
            >
              <LogoMark size={32} />
              {!narrow ? (
                <Text heading size={18}>
                  SmartBin
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button size="lg" icon={PlusIcon} label="Add a bin" style={{ boxShadow: colors.shadowFloat }} onPress={() => router.push("/add")} />
              <Button size="lg" variant="floating" icon={UserRoundIcon} accessibilityLabel="Your account" onPress={() => router.push("/account")} />
            </View>
          </View>

          {/* Filter chips and the locate button */}
          <View style={{ position: "absolute", top: insets.top + 68, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ padding: 4, borderRadius: 999, backgroundColor: colors.card, boxShadow: colors.shadowFloat }}>
              <Chips
                label="Waste type"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "ALL", label: "All" },
                  { value: "WET", label: "Wet" },
                  { value: "DRY", label: "Dry" },
                ]}
                style={{ gap: 4, flexWrap: "nowrap" }}
              />
            </View>
            <Button
              size="lg"
              variant="floating"
              icon={LocateFixedIcon}
              accessibilityLabel="Show my location"
              onPress={() => {
                if (!you) return setWatchKey((k) => k + 1);
                wantFrame.current = true;
                reload(you);
              }}
            />
          </View>

          {tooWide ? (
            <View style={{ pointerEvents: "none", position: "absolute", top: insets.top + 128, left: 0, right: 0, alignItems: "center" }}>
              <Surface style={{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}>
                <Text>Zoom in to see bins</Text>
              </Surface>
            </View>
          ) : null}

          {locError ? (
            <Surface style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 24 + insets.bottom, gap: 16 }}>
              <MapPinOffIcon size={32} color={colors.foreground} />
              <View style={{ gap: 4 }}>
                <Text heading size={20}>
                  Turn on location to see bins near you
                </Text>
                <Text tone="muted">{locError}</Text>
              </View>
              <Button
                size="xl"
                label="Try again"
                onPress={() => {
                  setLocError(null);
                  setLoading(true);
                  setWatchKey((k) => k + 1);
                }}
              />
            </Surface>
          ) : loadError ? (
            <Surface style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 24 + insets.bottom, gap: 16 }}>
              <Text heading size={20}>
                Couldn&apos;t load bins
              </Text>
              <Text tone="muted">{loadError}</Text>
              <Button size="xl" label="Try again" onPress={() => you && reload(you)} />
            </Surface>
          ) : (
            <BinSheet
              bins={visible}
              selected={selected}
              you={you}
              loading={loading}
              bottomInset={insets.bottom}
              onSelect={setSelectedId}
              onReported={(removed) => {
                if (removed) {
                  setBins((list) => list.filter((b) => b.id !== selectedId));
                  setSelectedId(null);
                }
              }}
              onIssues={(id: string, issues: BinIssue[]) => setBins((list) => list.map((b) => (b.id === id ? { ...b, issues } : b)))}
              onNavigate={openDirections}
            />
          )}
        </>
      ) : null}
    </View>
  );
}
