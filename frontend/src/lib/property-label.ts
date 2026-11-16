/** Human-facing property id: house number (unique per city + kebele). */
export function propertyLabel(
  property:
    | {
        houseNumber?: string | null;
        woreda?: string | null;
        kebele?: string | null;
      }
    | null
    | undefined,
  opts?: { withAddress?: boolean },
): string {
  const num = property?.houseNumber?.trim();
  if (!num) return "—";
  const label = `#${num}`;
  if (
    opts?.withAddress &&
    property?.woreda != null &&
    property.woreda !== "" &&
    property?.kebele != null &&
    property.kebele !== ""
  ) {
    return `${label} · ${property.woreda}, Kebele ${property.kebele}`;
  }
  return label;
}
