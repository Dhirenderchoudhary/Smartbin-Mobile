import type { Bin, LatLng } from "@/lib/bins";

export type Padding = { top: number; bottom: number; left: number; right: number };

// Screens move the camera by sending a command; a new `key` runs it again
export type CameraCommand =
  | { key: number; kind: "ease"; center: LatLng; zoom?: number; bearing?: number; pitch?: number; padding?: Padding; duration?: number }
  | { key: number; kind: "fit"; points: LatLng[]; padding?: Padding; maxZoom?: number; duration?: number };

export interface AppMapProps {
  /** Where the map opens */
  start: LatLng;
  startZoom: number;
  bins: Bin[];
  /** "pins": tappable bin pins; "dots": small markers (picking a spot for a new bin) */
  pinStyle?: "pins" | "dots";
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Your real position; no dot until it's known. heading turns the cone. */
  you: (LatLng & { heading?: number | null }) | null;
  /** Walking route to draw, [lng, lat] points */
  route?: [number, number][] | null;
  camera?: CameraCommand | null;
  /** You dragged, pinched or rotated the map */
  onUserMove?: () => void;
  /** The map settled: its centre and the distance to its corner */
  onViewChange?: (center: LatLng, radius: number) => void;
  /** Every frame while moving (the add-a-bin picker) */
  onCenterChange?: (center: LatLng) => void;
}

// Pins are drawn as native views; past this many it gets slow, so the nearest ones are drawn.
// ponytail: switch to a symbol layer with clustering if areas get denser than this
export const MAX_PINS = 150;
