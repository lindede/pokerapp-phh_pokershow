import type { CommentaryReplayMeta } from "@/types/commentary";

/** C 端「1bb = 0.25」；无 bbReal / 无效时返回空串（不展示货币符号）。 */
export function formatBbRealAnchor(bbReal: number | null | undefined): string {
  if (bbReal == null || !Number.isFinite(bbReal) || bbReal <= 0) return "";
  const s = String(Number(bbReal.toFixed(4)));
  return `1bb = ${s}`;
}

export function cloneReplayMeta(
  meta: CommentaryReplayMeta | null | undefined,
): CommentaryReplayMeta | null {
  if (!meta) return null;
  return {
    startingStacks: [...meta.startingStacks],
    finishingStacks: [...meta.finishingStacks],
    blindsOrStraddles: meta.blindsOrStraddles
      ? [...meta.blindsOrStraddles]
      : undefined,
    chipScale: meta.chipScale,
    bbReal: meta.bbReal ?? null,
  };
}
