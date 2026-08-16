/**
 * 录入预览用：筹码超三位数且 ≥1/4 底池时附加底池比例说明。
 * 分析展示优先使用后端返回的 label；本函数仅作本地预览。
 */
const POT_FRACTION_CANDIDATES: ReadonlyArray<{ num: number; den: number }> = [
  { num: 1, den: 4 },
  { num: 1, den: 3 },
  { num: 1, den: 2 },
  { num: 2, den: 3 },
  { num: 3, den: 4 },
  { num: 1, den: 1 },
  { num: 3, den: 2 },
  { num: 2, den: 1 },
];

function nearestPotFractionLabel(chips: number, pot: number): string | null {
  if (!(pot > 0) || !(chips > 0)) return null;
  const ratio = chips / pot;
  let best = POT_FRACTION_CANDIDATES[0];
  let bestDiff = Math.abs(ratio - best.num / best.den);
  for (let i = 1; i < POT_FRACTION_CANDIDATES.length; i++) {
    const c = POT_FRACTION_CANDIDATES[i];
    const d = Math.abs(ratio - c.num / c.den);
    if (d < bestDiff) {
      best = c;
      bestDiff = d;
    }
  }
  if (best.den === 1) return `${best.num}底池`;
  return `${best.num}/${best.den}底池`;
}

export function formatChipWithPotHint(chips: number, pot: number): string {
  const n = Math.round(chips);
  const absStr = String(Math.abs(n));
  const overThreeDigits = absStr.length > 3;
  const atLeastQuarterPot = pot > 0 && n >= pot * 0.25;
  if (overThreeDigits && atLeastQuarterPot) {
    const frac = nearestPotFractionLabel(n, pot);
    if (frac) return `${n}(${frac})`;
  }
  return String(n);
}
