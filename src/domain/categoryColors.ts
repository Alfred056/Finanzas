/** Colores de categoría (compartido entre servidor y cliente). */
export const DEFAULT_CATEGORY_COLOR = "#9c9c9d";

export const BASE_CATEGORIES = [
  { name: "Comida", type: "EXPENSE", color: "#ffa660" },
  { name: "Transporte", type: "EXPENSE", color: "#f2d060" },
  { name: "Servicios", type: "EXPENSE", color: "#56c2ff" },
  { name: "Ocio", type: "EXPENSE", color: "#b794ff" },
  { name: "Salud", type: "EXPENSE", color: "#ff85b3" },
  { name: "Sueldo", type: "INCOME", color: "#59d499" },
] as const;

export const COLOR_SWATCHES: string[] = [DEFAULT_CATEGORY_COLOR, ...BASE_CATEGORIES.map((c) => c.color), "#4fd6c4", "#8b95ff"];

export const defaultColorFor = (name: string): string =>
  BASE_CATEGORIES.find((c) => c.name === name)?.color ?? DEFAULT_CATEGORY_COLOR;

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** `#rrggbb` → `rgba()`; un valor inválido usa el color por defecto. */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt((isHexColor(hex) ? hex : DEFAULT_CATEGORY_COLOR).slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
