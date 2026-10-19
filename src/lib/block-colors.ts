import { dayBlockColors } from "@/lib/validation";

export type BlockColor = (typeof dayBlockColors)[number];

export const blockColors: Record<BlockColor, string> = {
  azure: "#2979ff",
  sky: "#3d9bd6",
  teal: "#17807a",
  emerald: "#287f52",
  sage: "#7c9a74",
  lime: "#9bbb3f",
  amber: "#dba22a",
  orange: "#e0782f",
  clay: "#bd6a4c",
  red: "#cc4437",
  rose: "#dc7484",
  pink: "#c9559e",
  violet: "#8a62c9",
  indigo: "#4f5bcf",
  wood: "#8d6e63",
  slate: "#5f6b7a",
};

export function asBlockColor(color: string | null): BlockColor {
  return color && color in blockColors ? (color as BlockColor) : "azure";
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ink = "#2b2926";
const inkLuminance = luminance(ink);

/** White or ink, whichever contrasts more with the fill. */
export function textOn(color: BlockColor): string {
  const fill = luminance(blockColors[color]);
  const white = 1.05 / (fill + 0.05);
  const dark = (fill + 0.05) / (inkLuminance + 0.05);
  return white >= dark ? "#ffffff" : ink;
}
