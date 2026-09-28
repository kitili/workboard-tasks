export type TapLane = "mourine" | "paul";

export type TapSuggestion = {
  slot: 1 | 2 | 3 | 4 | 5;
  title: string;
  source: string;
};

const mourine: TapSuggestion[] = [
  { slot: 1, title: "Ship AI / automation work on ops, HR, or expansion systems", source: "Rock 2" },
  { slot: 2, title: "Move Silverleaf SIS: scope, data model, or architecture", source: "Rock 9" },
  { slot: 3, title: "Build the digital MEL / impact tools or automated dashboards", source: "Rocks 3.5–3.6" },
  { slot: 4, title: "A technical blocker that may stop a system from shipping today", source: "Challenge" },
  { slot: 5, title: "What shipped or moved yesterday on the technical TAP rocks", source: "Progress recap" },
];

const paul: TapSuggestion[] = [
  { slot: 1, title: "Push Ed Admin utilisation, parent data, or HT follow-up", source: "Rock 1" },
  { slot: 2, title: "Update the monthly KPI / SLT data pack or MEL calendar follow-up", source: "Rock 5" },
  { slot: 3, title: "Move school tech access, devices, surveys, hiring, or JDO", source: "Rocks 4, 6, 7, 8" },
  { slot: 4, title: "A non-technical blocker that may stop today’s TAP work", source: "Challenge" },
  { slot: 5, title: "What moved yesterday on Ed Admin, data, people, or school tech", source: "Progress recap" },
];

export function tapLaneForName(name: string | null | undefined): TapLane | null {
  const value = (name ?? "").toLowerCase();
  if (value.includes("mourine")) return "mourine";
  if (value.includes("paul")) return "paul";
  return null;
}

export function suggestionsForLane(lane: TapLane | null): TapSuggestion[] {
  if (lane === "mourine") return mourine;
  if (lane === "paul") return paul;
  return [];
}
