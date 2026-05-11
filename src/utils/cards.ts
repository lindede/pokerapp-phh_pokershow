export interface ParsedCard {
  rank: string;
  suitChar: string;
  red: boolean;
}

/** 解析扑克编码：As、Th、10h（大小写均可）→ 展示用 */
export function parseCardCode(raw: string | null | undefined): ParsedCard | null {
  if (raw == null || raw === "" || raw === "?") return null;
  const s = raw.trim();
  const m = s.match(/^([2-9]|10|[TtJjQqKkAa])([shdcSHDC])$/);
  if (!m) return null;
  let rank = m[1].toUpperCase();
  if (rank === "T") rank = "10";
  const suitKey = m[2].toLowerCase();
  const suits: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
  const suitChar = suits[suitKey];
  if (!suitChar) return null;
  const red = suitKey === "h" || suitKey === "d";
  return { rank, suitChar, red };
}
