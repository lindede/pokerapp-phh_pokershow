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
 * 从牌串提取多张牌编码（如 Qh、Tc）。
 * 支持：
 * - Unicode：`Q♥5♣`、`7♠9♣T♣`
 * - 标准编码连写：`AsKh`、`Td9c`（复盘录入发牌用）
 */
export function unicodeCardsToCodes(human: string): string[] {
  if (!human || typeof human !== "string") return [];
  const s = human.trim();
  if (!s) return [];

  const out: string[] = [];
  const unicodeRe = /(10|[2-9]|[TJQKA])([♠♥♦♣♤♡♢♧])/gi;
  let m: RegExpExecArray | null;
  while ((m = unicodeRe.exec(s)) !== null) {
    let rank = m[1].toUpperCase();
    if (rank === "10") rank = "T";
    const suit = SUIT_MAP[m[2]];
    if (suit) out.push(`${rank}${suit}`);
  }
  if (out.length) return out;

  const asciiRe = /(10|[2-9]|[TJQKA])([shdc])/gi;
  while ((m = asciiRe.exec(s)) !== null) {
    let rank = m[1].toUpperCase();
    if (rank === "10") rank = "T";
    out.push(`${rank}${m[2].toLowerCase()}`);
  }
  return out;
}
