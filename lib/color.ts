const DARK_TEXT = "#0f1722";
const LIGHT_TEXT = "#ffffff";

function channel(value: number) {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/**
 * The text color (dark or white) that reads best on a background color.
 * Compares the WCAG contrast of both options and picks the higher one, so a
 * yellow header gets dark text and a deep blue one gets white text.
 */
export function readableTextColor(background: string): string {
  const bg = luminance(background);
  if (bg === null) return LIGHT_TEXT;
  const dark = luminance(DARK_TEXT) as number;
  const light = 1;
  const contrastWithDark = (bg + 0.05) / (dark + 0.05);
  const contrastWithLight = (light + 0.05) / (bg + 0.05);
  return contrastWithDark >= contrastWithLight ? DARK_TEXT : LIGHT_TEXT;
}
