// Add a bin in two steps: drop the pin on it, then photo, type and name. Mirrors apps/web/src/app/app/add/page.tsx.
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { AlertCircleIcon, ArrowLeftIcon, CameraIcon, ImageIcon, LocateFixedIcon, MapPinIcon, MapPinOffIcon, Trash2Icon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppMap from "@/components/map/AppMap";
import type { CameraCommand } from "@/components/map/types";
import { Alert, Button, Chips, Field, Input, Spinner, Surface, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { DUPLICATE_RADIUS_M, fetchNearby, formatDistance, INDIA_VIEW, metresBetween, type Bin, type BinType, type LatLng } from "@/lib/bins";
import { deviceUrl } from "@/lib/config";
import { currentPosition, lastKnownLocation, type Fix } from "@/lib/location";
import { useTheme } from "@/lib/theme";

// The API asks for photos of about 1280 px; this also keeps uploads well under 5 MB
async function shrinkPhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const big = Math.max(asset.width, asset.height) > 1280;
  const context = ImageManipulator.manipulate(asset.uri);
  if (big) context.resize(asset.width >= asset.height ? { width: 1280 } : { height: 1280 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

type Problem = { text: string; title?: string; existingBinId?: string };

// Back to the map, showing a bin (the map screen is underneath this one)
const showOnMap = (params: Record<string, string>) => router.dismissTo({ pathname: "/", params });

export default function AddBin() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"where" | "details">("where");

  // Step 1: where
  const [gps, setGps] = useState<Fix | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [start, setStart] = useState<LatLng | null>(null);
  const [spot, setSpot] = useState<LatLng | null>(null);
  const [nearby, setNearby] = useState<Bin[]>([]);
  const fetchedAround = useRef<LatLng | null>(null);
  const [camera, setCamera] = useState<CameraCommand | null>(null);
  const cameraKey = useRef(0);

  // Step 2: details
  const [photo, setPhoto] = useState<string | null>(null);
  const [type, setType] = useState<BinType | null>(null);
  const [name, setName] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  const locate = useCallback(async () => {
    try {
      const at = await currentPosition();
      setGps(at);
      setGpsError(null);
      setStart((s) => s ?? at);
      setSpot((s) => s ?? at);
      setCamera({ kind: "ease", center: at, zoom: 18, key: ++cameraKey.current });
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : "Couldn't find your location.");
      setStart((s) => s ?? null);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    // Open where you were last time while GPS warms up
    lastKnownLocation().then((at) => setStart((s) => s ?? at));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the device location (an external system)
    locate();
  }, [locate]);

  // Bins around the pin, for the dots and the duplicate check (refetched after moving ~1 km)
  useEffect(() => {
    if (!spot || (fetchedAround.current && metresBetween(fetchedAround.current, spot) < 1000)) return;
    fetchedAround.current = spot;
    fetchNearby(spot).then(setNearby, () => {});
  }, [spot]);

  const duplicate = spot ? nearby.find((b) => metresBetween(spot, b) < DUPLICATE_RADIUS_M) : undefined;
  const fromYou = gps && spot ? metresBetween(gps, spot) : null;

  async function choosePhoto(source: "camera" | "library") {
    setProblem(null);
    try {
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Camera access is off for SmartBin. Allow it in your phone's settings, or choose a photo instead.");
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      setPhoto(await shrinkPhoto(result.assets[0]));
    } catch (err) {
      setProblem({ text: err instanceof Error ? err.message : "Couldn't read that photo. Try another." });
    }
  }

  async function submit() {
    if (!photo || !spot || !type) return;
    setProblem(null);
    try {
      setSending("Uploading photo…");
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>("/dustbins/upload-url?contentType=image/jpeg");
      const body = await (await fetch(photo)).blob();
      const put = await fetch(deviceUrl(uploadUrl), { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body });
      if (!put.ok) throw new Error("The photo didn't upload. Check your connection and try again.");

      setSending("Checking the photo…");
      const bin = await api<{ id: string }>("/dustbins", {
        method: "POST",
        body: { imageKey: key, type, latitude: spot.lat, longitude: spot.lng, ...(name.trim() && { name: name.trim() }) },
      });
      // The map only loads bins around you, so pass where this one is in case it's further away
      showOnMap({ bin: bin.id, added: "1", lat: String(spot.lat), lng: String(spot.lng) });
    } catch (err) {
      setSending(null);
      if (err instanceof ApiError && err.code === "DUPLICATE_NEARBY") {
        setProblem({ title: "This bin is already on the map", text: err.message, existingBinId: err.details?.existingBinId as string });
      } else if (err instanceof ApiError && err.code === "NOT_A_BIN") {
        setPhoto(null);
        setProblem({ title: "We couldn't see a dustbin in that photo", text: "Take a clearer photo with the whole bin in view." });
      } else {
        setProblem({ text: err instanceof Error ? err.message : "Something went wrong, try again." });
      }
    }
  }

  // ---- Step 1: move the map until the pin sits on the bin
  if (step === "where") {
    const ready = start !== null || !locating;
    return (
      <View style={{ flex: 1, backgroundColor: colors.map }}>
        {ready ? (
          <AppMap
            start={start ?? INDIA_VIEW.center}
            startZoom={start ? 18 : INDIA_VIEW.zoom}
            bins={nearby}
            pinStyle="dots"
            you={gps}
            camera={camera}
            onCenterChange={setSpot}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Surface style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Spinner />
              <Text>Finding your location…</Text>
            </Surface>
          </View>
        )}

        {/* Fixed centre pin: its tip marks the spot */}
        {ready ? (
          <View style={{ pointerEvents: "none", position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <View style={{ alignItems: "center", transform: [{ translateY: -30 }] }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", boxShadow: colors.shadowSheet }}>
                <Trash2Icon size={20} color={colors.primaryForeground} strokeWidth={2.4} />
              </View>
              <View style={{ width: 4, height: 16, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.primary }} />
            </View>
          </View>
        ) : null}

        <View style={{ position: "absolute", top: insets.top + 12, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
          <Button size="lg" variant="floating" icon={ArrowLeftIcon} accessibilityLabel="Cancel and go back to the map" onPress={() => router.back()} />
          <Button
            size="lg"
            variant="floating"
            icon={LocateFixedIcon}
            accessibilityLabel="Use my location"
            onPress={() => (gps ? setCamera({ kind: "ease", center: gps, zoom: 18, key: ++cameraKey.current }) : locate())}
          />
        </View>

        <Surface style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 20 + insets.bottom, gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Text heading size={24}>
              Where is the bin?
            </Text>
            <Text tone="muted">Move the map so the pin sits right on the bin. Zoom in to be exact.</Text>
          </View>

          {duplicate ? (
            <Alert
              icon={AlertCircleIcon}
              tone="destructive"
              title="There's already a bin here"
              text={`${duplicate.name} is ${formatDistance(metresBetween(spot!, duplicate))} from the pin. Bins need to be at least ${DUPLICATE_RADIUS_M} m apart.`}
              action={<Button size="sm" variant="secondary" label="View it" onPress={() => showOnMap({ bin: duplicate.id })} />}
            />
          ) : gpsError ? (
            <Alert icon={MapPinOffIcon} tone="warning" text="We couldn't find your location, so move the map to the bin yourself." />
          ) : fromYou !== null && fromYou > 100 ? (
            <Text size={14} tone="muted">
              The pin is {formatDistance(fromYou)} from you. Make sure it&apos;s on the right bin.
            </Text>
          ) : gps ? (
            <Text size={14} tone="muted">
              Your location is accurate to about {Math.max(1, Math.round(gps.accuracy))} m.
            </Text>
          ) : null}

          <Button size="xl" label={spot ? "Confirm location" : "Move the map to the bin"} disabled={!spot || !!duplicate} onPress={() => setStep("details")} />
        </Surface>
      </View>
    );
  }

  // ---- Step 2: photo, type and name
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 }}>
          <Button variant="ghost" size="lg" icon={ArrowLeftIcon} accessibilityLabel="Back to location" onPress={() => setStep("where")} />
          <Text heading size={20}>
            Add a bin
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.muted }}>
          <MapPinIcon size={20} color={colors.foreground} />
          <Text size={15} style={{ flex: 1 }}>
            Location set
            {fromYou !== null ? <Text size={15} tone="muted">{`, ${formatDistance(fromYou)} from you`}</Text> : null}
          </Text>
          <Button size="sm" variant="secondary" label="Change" onPress={() => setStep("where")} />
        </View>

        <Field label="Photo of the bin">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photo ? "Retake the photo" : "Take a photo"}
            onPress={() => choosePhoto("camera")}
            style={{ aspectRatio: 4 / 3, borderRadius: 16, overflow: "hidden", backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
          >
            {photo ? (
              <>
                <Image source={{ uri: photo }} accessibilityLabel="Your photo of the bin" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
                <View style={{ position: "absolute", right: 12, bottom: 12, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.card, boxShadow: colors.shadowFloat }}>
                  <Text weight="medium" size={14}>
                    Retake
                  </Text>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", gap: 8 }}>
                <CameraIcon size={32} color={colors.mutedForeground} />
                <Text weight="medium">Take a photo</Text>
                <Text size={14} tone="muted">
                  Get the whole bin in the picture
                </Text>
              </View>
            )}
          </Pressable>
          <Button variant="ghost" size="sm" icon={ImageIcon} label="Choose from your photos" style={{ alignSelf: "flex-start" }} onPress={() => choosePhoto("library")} />
        </Field>

        <Field label="What does it take?" hint="Green bins are usually for wet waste, blue bins for dry.">
          <Chips
            label="Waste type"
            value={type}
            onChange={setType}
            options={[
              { value: "WET", label: "Wet", dot: colors.wet },
              { value: "DRY", label: "Dry", dot: colors.dry },
              { value: "BOTH", label: "Wet and dry" },
            ]}
          />
        </Field>

        <Field label="Name it (optional)" hint="Helps people find it, like a landmark or shop name.">
          <Input value={name} onChangeText={setName} maxLength={100} placeholder="e.g. Next to metro gate 2" accessibilityLabel="Name it (optional)" returnKeyType="done" />
        </Field>

        {problem ? (
          <Alert
            icon={AlertCircleIcon}
            tone="destructive"
            title={problem.title}
            text={problem.text}
            action={problem.existingBinId ? <Button size="sm" variant="secondary" label="View it" onPress={() => showOnMap({ bin: problem.existingBinId! })} /> : undefined}
          />
        ) : null}

        <Button
          size="xl"
          busy={!!sending}
          disabled={!photo || !type || !!sending}
          label={sending ?? (!photo ? "Add a photo to continue" : !type ? "Choose wet or dry" : "Add bin")}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
