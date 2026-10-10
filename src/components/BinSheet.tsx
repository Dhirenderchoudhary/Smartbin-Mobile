// The bottom sheet on the map: nearest bins, or the selected bin with directions and problem reports.
// Same content and copy as apps/web/src/components/map/BinPanel.tsx in the Smartbin repo.
import { Image } from "expo-image";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, CheckIcon, FlagIcon, NavigationIcon } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { ApiError } from "@/lib/api";
import {
  formatDistance,
  ISSUE_LABEL,
  ISSUE_RADIUS_M,
  reportIssue,
  reportMissing,
  resolveIssue,
  timeAgo,
  TYPE_LABEL,
  walkMinutes,
  type Bin,
  type BinIssue,
  type BinType,
  type IssueType,
  type LatLng,
} from "@/lib/bins";
import { currentPosition } from "@/lib/location";
import { useTheme } from "@/lib/theme";
import { Alert, Badge, Button, Input, Spinner, Text } from "./ui";

export function TypeBadges({ type }: { type: BinType }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {type !== "DRY" && <Badge label="Wet" tone="wet" />}
      {type !== "WET" && <Badge label="Dry" tone="dry" />}
    </View>
  );
}

function TypeDot({ type }: { type: BinType }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 12, height: 12, borderRadius: 6, overflow: "hidden", flexDirection: "row" }}>
      <View style={{ flex: 1, backgroundColor: type === "DRY" ? colors.dry : colors.wet }} />
      <View style={{ flex: 1, backgroundColor: type === "WET" ? colors.wet : colors.dry }} />
    </View>
  );
}

// "Missing" goes through its own endpoint (enough reports take the bin off the map)
type Problem = IssueType | "MISSING";

const PROBLEMS: { value: Problem; title: string; hint: string }[] = [
  { value: "FULL", title: "It's full", hint: "Overflowing, or no room for more" },
  { value: "BROKEN", title: "It's broken", hint: "Damaged, lid missing or knocked over" },
  { value: "DIRTY", title: "It's dirty", hint: "Smelly, or rubbish dumped around it" },
  { value: "MISSING", title: "It's not here", hint: "The bin is gone. After enough reports it comes off the map." },
  { value: "OTHER", title: "Something else", hint: "Tell people what's wrong" },
];

// What the "it's sorted" button says for each problem
const SORTED: Record<IssueType, string> = { FULL: "Emptied", BROKEN: "Fixed", DIRTY: "Cleaned", OTHER: "Sorted" };

type Outcome = { tone: "ok" | "error"; text: string } | null;

function errorText(err: unknown, radius: number): string {
  if (err instanceof ApiError && err.code === "TOO_FAR") return `You need to be within ${radius} m of the bin. Walk over and try again.`;
  return err instanceof Error ? err.message : "Couldn't send that. Try again.";
}

function ReportProblem({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (p: Problem, note: string) => Promise<void> }) {
  const { colors } = useTheme();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const missing = problem === "MISSING";
  const ready = problem && (problem !== "OTHER" || note.trim());

  async function send() {
    if (!problem) return;
    setBusy(true);
    await onSend(problem, note.trim());
    setBusy(false);
    setProblem(null);
    setNote("");
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ maxHeight: "92%", borderRadius: 20, backgroundColor: colors.card }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 6 }}>
              <Text heading size={20} style={{ textAlign: "center" }}>
                What&apos;s wrong with this bin?
              </Text>
              <Text tone="muted" style={{ textAlign: "center" }}>
                Report it from the spot. You need to be within {missing ? 20 : ISSUE_RADIUS_M} m of the bin.
              </Text>
            </View>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {PROBLEMS.map((p) => {
                const on = problem === p.value;
                return (
                  <Pressable
                    key={p.value}
                    accessibilityRole="radio"
                    aria-checked={on}
                    onPress={() => setProblem(p.value)}
                    style={{ padding: 14, borderRadius: 14, backgroundColor: on ? colors.primary : colors.muted }}
                  >
                    <Text weight="medium" style={{ color: on ? colors.primaryForeground : colors.foreground }}>
                      {p.title}
                    </Text>
                    <Text size={14} style={{ color: on ? colors.primaryForeground : colors.foreground, opacity: 0.75 }}>
                      {p.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {problem === "OTHER" ? <Input autoFocus accessibilityLabel="What's wrong" placeholder="e.g. Blocked by a parked cart" maxLength={200} value={note} onChangeText={setNote} /> : null}
            <View style={{ gap: 8 }}>
              <Button size="xl" label={missing ? "Report missing" : "Send report"} variant={missing ? "destructive" : "default"} disabled={!ready} busy={busy} onPress={send} />
              <Button size="xl" label="Cancel" variant="outline" disabled={busy} onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SelectedBin({
  bin,
  you,
  onReported,
  onIssues,
  onNavigate,
}: {
  bin: Bin;
  you: LatLng | null;
  onReported: (removed: boolean) => void;
  onIssues: (binId: string, issues: BinIssue[]) => void;
  onNavigate: (bin: Bin) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [sorting, setSorting] = useState<IssueType | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  // The map is already tracking you; only wait for a fresh GPS fix if it isn't yet
  const here = async () => you ?? (await currentPosition());

  async function send(problem: Problem, note: string) {
    try {
      const at = await here();
      if (problem === "MISSING") {
        const r = await reportMissing(bin.id, at);
        setOutcome({
          tone: "ok",
          text: r.removed
            ? "Reported. This bin had enough reports and is now off the map."
            : `Reported. ${r.missingReports} of ${r.threshold} reports needed to take it off the map.`,
        });
        onReported(r.removed);
      } else {
        const r = await reportIssue(bin.id, problem, at, note);
        onIssues(bin.id, r.issues);
        setOutcome({ tone: "ok", text: "Reported. People nearby will see it before they walk over." });
      }
    } catch (err) {
      setOutcome({ tone: "error", text: errorText(err, problem === "MISSING" ? 20 : ISSUE_RADIUS_M) });
    }
    setOpen(false);
  }

  async function sorted(type: IssueType) {
    setSorting(type);
    try {
      const r = await resolveIssue(bin.id, type, await here());
      onIssues(bin.id, r.issues);
      setOutcome({ tone: "ok", text: "Thanks for letting everyone know." });
    } catch (err) {
      setOutcome({ tone: "error", text: errorText(err, ISSUE_RADIUS_M) });
    } finally {
      setSorting(null);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Image source={{ uri: bin.imageUrl }} accessibilityLabel={`Photo of ${bin.name}`} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: colors.muted }} contentFit="cover" />
        <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
          <Text heading size={20} numberOfLines={2}>
            {bin.name}
          </Text>
          <TypeBadges type={bin.type} />
          {bin.missingReports > 0 ? (
            <Text size={14} tone="muted">
              {bin.missingReports === 1 ? "1 person reported it missing" : `${bin.missingReports} people reported it missing`}
            </Text>
          ) : null}
        </View>
      </View>

      {bin.issues.length ? (
        <View accessibilityLabel="Problems reported" style={{ gap: 8 }}>
          {bin.issues.map((issue) => (
            <View key={issue.type} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.warning + "33" }}>
              <AlertTriangleIcon size={20} color={colors.foreground} />
              <View style={{ flex: 1 }}>
                <Text weight="medium">{issue.type === "OTHER" && issue.note ? issue.note : ISSUE_LABEL[issue.type]}</Text>
                <Text size={14} tone="muted">
                  Reported {timeAgo(issue.lastReportedAt)}
                  {issue.reports > 1 ? `, by ${issue.reports} people` : ""}
                </Text>
              </View>
              <Button
                size="sm"
                variant="secondary"
                icon={CheckIcon}
                label={SORTED[issue.type]}
                accessibilityLabel={`Mark as ${SORTED[issue.type].toLowerCase()}`}
                busy={sorting === issue.type}
                disabled={!!sorting}
                onPress={() => sorted(issue.type)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text heading size={30}>
          {formatDistance(bin.distance)}
        </Text>
        <Text tone="muted">{walkMinutes(bin.distance)} min walk</Text>
      </View>

      {outcome ? <Alert icon={outcome.tone === "error" ? AlertCircleIcon : CheckCircle2Icon} tone={outcome.tone === "error" ? "destructive" : "default"} text={outcome.text} /> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button size="xl" icon={NavigationIcon} label="Directions" style={{ flexGrow: 1, minWidth: 128 }} onPress={() => onNavigate(bin)} />
        <Button size="xl" variant="secondary" icon={FlagIcon} label="Report a problem" style={{ flexGrow: 1 }} onPress={() => setOpen(true)} />
      </View>

      <ReportProblem open={open} onClose={() => setOpen(false)} onSend={send} />
    </View>
  );
}

// Bottom sheet: up to 46% of the screen, scrolls inside
export function BinSheet({
  bins,
  selected,
  you,
  loading,
  bottomInset,
  onSelect,
  onReported,
  onIssues,
  onNavigate,
}: {
  bins: Bin[];
  selected: Bin | null;
  you: LatLng | null;
  loading: boolean;
  bottomInset: number;
  onSelect: (id: string) => void;
  onReported: (removed: boolean) => void;
  onIssues: (binId: string, issues: BinIssue[]) => void;
  onNavigate: (bin: Bin) => void;
}) {
  const { colors } = useTheme();
  // The map can hold hundreds after zooming out; the list keeps to the nearest
  const others = bins.filter((b) => b.id !== selected?.id).slice(0, 25);
  return (
    <View
      accessibilityLabel="Nearby bins"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "46%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.card, boxShadow: colors.shadowSheet }}
    >
      <View style={{ alignSelf: "center", marginTop: 10, width: 40, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 20 + bottomInset, gap: 20 }}>
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }}>
            <Spinner />
            <Text tone="muted">Finding bins near you…</Text>
          </View>
        ) : null}

        {!loading && !bins.length ? (
          <View style={{ gap: 4, paddingVertical: 8 }}>
            <Text heading size={20}>
              No bins mapped here yet
            </Text>
            <Text tone="muted">Spotted one nearby? Add it and it&apos;ll show up for everyone.</Text>
          </View>
        ) : null}

        {selected ? <SelectedBin key={selected.id} bin={selected} you={you} onReported={onReported} onIssues={onIssues} onNavigate={onNavigate} /> : null}

        {!loading && others.length ? (
          <View>
            <Text weight="medium" style={{ paddingBottom: 8 }}>
              {selected ? "Other bins nearby" : "Nearest bins"}
            </Text>
            {others.map((bin, i) => (
              <Pressable
                key={bin.id}
                accessibilityRole="button"
                accessibilityLabel={`${bin.name}, ${formatDistance(bin.distance)}`}
                onPress={() => onSelect(bin.id)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: colors.border, opacity: pressed ? 0.6 : 1 })}
              >
                <TypeDot type={bin.type} />
                <View style={{ flex: 1 }}>
                  <Text weight="medium" numberOfLines={1}>
                    {bin.name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text size={14} tone="muted">
                      {TYPE_LABEL[bin.type]}
                    </Text>
                    {bin.issues.length ? <Badge label={ISSUE_LABEL[bin.issues[0]!.type]} tone="warning" /> : null}
                  </View>
                </View>
                <Text weight="medium">{formatDistance(bin.distance)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
