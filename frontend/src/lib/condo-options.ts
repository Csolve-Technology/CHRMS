export const CONDO_ROOM_TYPES = [
  { value: "studio", label: "Studio", rooms: 0 },
  { value: "one_bedroom", label: "1 Bedroom", rooms: 1 },
  { value: "two_bedroom", label: "2 Bedroom", rooms: 2 },
  { value: "three_bedroom", label: "3 Bedroom", rooms: 3 },
] as const;

export type CondoRoomType = (typeof CONDO_ROOM_TYPES)[number]["value"];

export function condoRoomTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return CONDO_ROOM_TYPES.find((r) => r.value === value)?.label ?? value;
}

export function roomsFromCondoRoomType(
  value: string | null | undefined,
): number | undefined {
  const match = CONDO_ROOM_TYPES.find((r) => r.value === value);
  return match ? match.rooms : undefined;
}
