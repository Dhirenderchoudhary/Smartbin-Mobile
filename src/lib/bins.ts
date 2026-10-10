// Same as apps/web/src/lib/bins.ts in the Smartbin repo (location lives in ./location here).
import { api } from "./api";
import { deviceUrl } from "./config";

export type BinType = "WET" | "DRY" | "BOTH";

export interface Bin {
  id: string;
  name: string;
  type: BinType;
  latitude: number;
  longitude: number;
  missingReports: number;
  createdAt: string;
  distance: number;
  imageUrl: string;
  /** Open problems, one per type, most recent first */
  issues: BinIssue[];
}

export type IssueType = "FULL" | "BROKEN" | "DIRTY" | "OTHER";

export interface BinIssue {
  type: IssueType;
  reports: number;
  lastReportedAt: string;
  note: string | null;
}

export const ISSUE_LABEL: Record<IssueType, string> = { FULL: "Full", BROKEN: "Broken", DIRTY: "Dirty", OTHER: "Problem reported" };

// Same as the API: you need to be this close to report or clear a problem
export const ISSUE_RADIUS_M = 50;

export interface LatLng {
  lat: number;
  lng: number;
}

// Map view before we know where you are: all of India
export const INDIA_VIEW = { center: { lat: 22.5, lng: 79 } as LatLng, zoom: 4 };

// Same as the API's duplicate rule: no two bins within 15 m
export const DUPLICATE_RADIUS_M = 15;

export const TYPE_LABEL: Record<BinType, string> = { WET: "Wet", DRY: "Dry", BOTH: "Wet and dry" };

// Bins within 2 km; if there are none, the 5 closest wherever they are
// search: count this as a "bins near me" search in the admin stats (not for map pans)
export async function fetchNearby({ lat, lng }: LatLng, search = false): Promise<Bin[]> {
  const near = await api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}&radius=2000${search ? "&log=1" : ""}`);
  return withDeviceUrls(near.length ? near : await api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}`));
}

const withDeviceUrls = (bins: Bin[]) => bins.map((b) => ({ ...b, imageUrl: deviceUrl(b.imageUrl) }));

// Every bin within radius metres (the API caps it at the 500 nearest)
export async function fetchArea({ lat, lng }: LatLng, radius: number): Promise<Bin[]> {
  return withDeviceUrls(await api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}&radius=${Math.ceil(radius)}`));
}

export type Interaction = "VIEW" | "DIRECTIONS" | "ARRIVED";

// Tells admins which bins people look for. Best effort: never blocks or fails the UI.
export function trackInteraction(binId: string, type: Interaction): void {
  api(`/dustbins/${binId}/interactions`, { method: "POST", body: { type } }).catch(() => {});
}

export function reportMissing(binId: string, at: LatLng) {
  return api<{ id: string; missingReports: number; threshold: number; removed: boolean }>(
    `/dustbins/${binId}/report-missing`,
    { method: "POST", body: at }
  );
}

export function reportIssue(binId: string, type: IssueType, at: LatLng, note?: string) {
  return api<{ id: string; issues: BinIssue[] }>(`/dustbins/${binId}/issues`, {
    method: "POST",
    body: { type, lat: at.lat, lng: at.lng, ...(note && { note }) },
  });
}

export function resolveIssue(binId: string, type: IssueType, at: LatLng) {
  return api<{ id: string; resolved: number; issues: BinIssue[] }>(`/dustbins/${binId}/issues/resolve`, {
    method: "POST",
    body: { type, lat: at.lat, lng: at.lng },
  });
}

// "5 minutes ago", "yesterday" (written out: Hermes has no Intl.RelativeTimeFormat)
export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (minutes < 1) return "just now";
  if (minutes < 60) return ago(minutes, "minute");
  if (minutes < 60 * 24) return ago(Math.round(minutes / 60), "hour");
  const days = Math.round(minutes / 60 / 24);
  return days === 1 ? "yesterday" : ago(days, "day");
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

// Average walking pace of about 80 m a minute
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

// Hands off to Google Maps for walking directions (opens the app on phones)
export function directionsUrl(bin: Pick<Bin, "latitude" | "longitude">): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${bin.latitude},${bin.longitude}&travelmode=walking`;
}

// Straight-line distance in metres
export function metresBetween(a: LatLng, b: { lat?: number; lng?: number; latitude?: number; longitude?: number }): number {
  const lat2 = b.latitude ?? b.lat!;
  const lng2 = b.longitude ?? b.lng!;
  const rad = Math.PI / 180;
  const dLat = (lat2 - a.lat) * rad;
  const dLng = (lng2 - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
