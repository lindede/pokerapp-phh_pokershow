/** 解析服务端Unicode花色字符串 → parseCardCode 可用的编码（如 Qh、Tc） */

const SUIT_MAP: Record<string, string> = {
  "♠": "s",
  "♥": "h",
  "♦": "d",
  "♣": "c",
  "♤": "s",
  "♡": "h",
  "♢": "d",
  "♧": "c",
};

/**
 * 从 "Q♥5♣"、"7♠9♣T♣"、"2♣" 等串中提取多张牌编码。
 * 支持点数 2–9、10、T、J、Q、K、A。
 */
export function unicodeCardsToCodes(human: string): string[] {
  if (!human || typeof human !== "string") return [];
  const s = human.trim();
  const out: string[] = [];
  const re = /(10|[2-9]|[TJQKA])([♠♥♦♣♤♡♢♧])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    let rank = m[1].toUpperCase();
    if (rank === "10") rank = "T";
    const suitSym = m[2];
    const suit = SUIT_MAP[suitSym];
    if (suit) out.push(`${rank}${suit}`);
  }
  return out;
}
