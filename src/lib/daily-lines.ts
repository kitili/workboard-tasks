export const DAILY_LINES = [
  { slot: 1, label: "Priority", hint: "First priority for today" },
  { slot: 2, label: "Priority", hint: "Second priority for today" },
  { slot: 3, label: "Priority", hint: "Third priority for today" },
  {
    slot: 4,
    label: "Challenge",
    hint: "Setbacks that got in the way of these three priorities",
  },
  {
    slot: 5,
    label: "Yesterday",
    hint: "Progress or updates on yesterday’s priorities",
  },
] as const;

export function dailyLineLabel(slot: number) {
  return DAILY_LINES.find((line) => line.slot === slot)?.label ?? `Line ${slot}`;
}
