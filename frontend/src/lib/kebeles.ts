/** Official kebele list for Chiro City housing registration. */
export const KEBELES = [
  "Ifa Misoomaa",
  "Madda Beku",
  "Caffee Araaraa",
  "Harawa Gora",
  "Burqaa Ciroo",
  "Burqaa Wad",
  "Ifaa Najbaas",
  "Barii Qillisoo",
  "Ballina Ciroo",
  "Madhicho",
] as const;

export type KebeleName = (typeof KEBELES)[number];
