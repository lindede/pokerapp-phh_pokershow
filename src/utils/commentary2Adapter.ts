import type {
  ByActionEvent,
  CommentaryActionItem,
  CommentaryReplayMeta,
  HandCommentaryPayload,
  PlayerPayload,
  SeatPositionKey,
  Street,
} from "@/types/commentary";
import { computeReplaySnapshot } from "@/utils/replayByAction";

const POS_ABBR: Record<string, SeatPositionKey> = {
  SB: "SB",
  BB: "BB",
  UTG: "UTG",
  MP: "MP",
  CO: "CO",
  BTN: "BTN",
  小盲: "SB",
  大盲: "BB",
  枪口: "UTG",
  中位: "MP",
  关位: "CO",
  庄位: "BTN",
  中间: "MP",
  关煞: "CO",
};

const POS_LABEL_ZH: Record<SeatPositionKey, string> = {
  SB: "(小盲)",
  BB: "(大盲)",
  UTG: "(枪口)",
  MP: "(中位)",
  CO: "(关位)",
  BTN: "(庄位)",
};

function streetFromBoardCount(n: number): Street {
  if (n >= 5) return "river";
  if (n >= 4) return "turn";
  if (n >= 3) return "flop";
  return "preflop";
}

/** 把服务端公共牌 token 规范成 parseCardCode 可识别的编码（如 Qh、Tc） */
function normalizeHoleToken(raw: string): string {
  let t = raw.trim().replace(/10/gi, "T");
  return t.length >= 2 ? t.slice(0, -1).toUpperCase() + t.slice(-1).toLowerCase() : t;
}

function extractPotFromText(text: string): number | undefined {
  const m =
    text.match(/拿下\s*(\d+)\s*底池/) ||
    text.match(/(\d+)\s*底池/) ||
    text.match(/底池\s*[：:]?\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

function parseWinnerSeat(facts: string[]): number | undefined {
  for (const line of facts) {
    const m = line.match(/赢家[：:]\s*P(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

function isStructuredCommentary(comm: Record<string, unknown>): boolean {
  if (!Array.isArray(comm.players) || comm.players.length < 6) return false;
  const ba = comm.by_action;
  if (!Array.isArray(ba) || ba.length === 0) return false;
  const x = ba[0];
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.action === "string" && typeof o.street === "string";
}

/** 解析 blinds_or_straddles：数组或按座位键的对象 */
function normalizeBlindsOrStraddles(
  raw: unknown,
  seatCount: number,
): number[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return undefined;
    return Array.from({ length: seatCount }, (_, i) =>
      i < raw.length ? Math.max(0, Number(raw[i]) || 0) : 0,
    );
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const arr = Array.from({ length: seatCount }, (_, i) => {
      const candidates = [
        o[String(i)],
        o[i],
        o[`seat_${i}`],
        o[`p${i}`],
        o[String(i + 1)],
        o[`P${i + 1}`],
      ];
      for (const c of candidates) {
        if (c == null) continue;
        const n = Number(c);
        if (Number.isFinite(n)) return Math.max(0, n);
      }
      return 0;
    });
    return arr.some((x) => x > 0) ? arr : undefined;
  }
  return undefined;
}

/** 若全场座位号均为 1..seatCount 且无 0，按 1-based 转为 0-based */
function normalizeTimelineSeatIndices(
  events: ByActionEvent[],
  seatCount: number,
): void {
  const seats = new Set<number>();
  for (const e of events) {
    if (e.seat_index != null && Number.isFinite(e.seat_index)) {
      seats.add(Math.round(e.seat_index));
    }
  }
  if (seats.size === 0) return;
  if (seats.has(0)) return;
  let min = Infinity;
  let max = -Infinity;
  for (const s of seats) {
    min = Math.min(min, s);
    max = Math.max(max, s);
  }
  if (min >= 1 && max <= seatCount) {
    for (const e of events) {
      if (e.seat_index != null) e.seat_index -= 1;
    }
  }
}

function normalizeByActionTimeline(raw: unknown[]): ByActionEvent[] {
  const out: ByActionEvent[] = [];
  let autoEventIndex = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    let event_index =
      typeof o.event_index === "number" ? o.event_index : Number(o.event_index);
    if (!Number.isFinite(event_index)) {
      event_index = autoEventIndex;
    }
    autoEventIndex = Math.max(autoEventIndex, Math.floor(event_index) + 1);
    let seat_index: number | null = null;
    if (typeof o.seat_index === "number" && Number.isFinite(o.seat_index)) {
      seat_index = Math.round(o.seat_index);
    } else if (o.seat_index != null && String(o.seat_index).trim() !== "") {
      const sn = Number(o.seat_index);
      if (Number.isFinite(sn)) seat_index = Math.round(sn);
    }
    const seat_name = typeof o.seat_name === "string" ? o.seat_name : "";
    const action = typeof o.action === "string" ? o.action : "";
    const street = typeof o.street === "string" ? o.street : "preflop";
    const cards =
      o.cards === null || o.cards === undefined ? null : String(o.cards);
    const text = typeof o.text === "string" ? o.text : "";
    let chips: number | null = null;
    if (typeof o.chips === "number" && Number.isFinite(o.chips)) {
      chips = o.chips;
    } else if (o.chips != null && String(o.chips).trim() !== "") {
      const cn = Number(o.chips);
      if (Number.isFinite(cn)) chips = cn;
    }
    out.push({
      event_index,
      seat_index,
      seat_name,
      action,
      street,
      cards,
      text,
      chips,
    });
  }
  out.sort((a, b) => a.event_index - b.event_index);
  normalizeTimelineSeatIndices(out, 6);
  return out;
}

/** commentary 含 players + 结构化 by_action（座位、街道、发牌等） */
function parseStructuredCommentary(
  d: Record<string, unknown>,
  comm: Record<string, unknown>,
): HandCommentaryPayload | null {
  const names = comm.players as unknown[];
  const seatEng = comm.seat_eng_names as unknown[];
  const starting = comm.starting_stacks as unknown[];
  const finishing = comm.finishing_stacks as unknown[];
  if (!Array.isArray(names) || names.length < 6) return null;
  if (!Array.isArray(seatEng) || seatEng.length < 6) return null;
  if (!Array.isArray(starting) || starting.length < 6) return null;
  if (!Array.isArray(finishing) || finishing.length < 6) return null;

  const timeline = normalizeByActionTimeline(
    Array.isArray(comm.by_action) ? comm.by_action : [],
  );
  if (timeline.length === 0) return null;

  const meta: CommentaryReplayMeta = {
    startingStacks: starting.slice(0, 6).map((x) => Number(x)),
    finishingStacks: finishing.slice(0, 6).map((x) => Number(x)),
  };
  const blindsParsed = normalizeBlindsOrStraddles(comm.blinds_or_straddles, 6);
  if (blindsParsed?.some((x) => x > 0)) {
    meta.blindsOrStraddles = blindsParsed;
  }

  const finalSnap = computeReplaySnapshot(
    timeline,
    timeline.length - 1,
    meta,
    6,
  );

  const facts = Array.isArray(d.facts)
    ? d.facts.filter((x): x is string => typeof x === "string")
    : [];
  const summary = typeof comm.summary === "string" ? comm.summary : "";
  let pot = finalSnap.pot > 0 ? finalSnap.pot : undefined;
  if (pot == null) {
    pot = extractPotFromText(summary);
  }
  if (pot == null) {
    for (const line of facts) {
      pot = extractPotFromText(line);
      if (pot != null) break;
    }
  }

  const players: PlayerPayload[] = [];
  for (let i = 0; i < 6; i++) {
    const raw = String(seatEng[i] ?? "BTN").trim();
    const pk = (POS_ABBR[raw] ?? POS_ABBR[raw.toUpperCase()] ?? "BTN") as SeatPositionKey;

    players.push({
      id: `p${i}`,
      seat: i,
      positionKey: pk,
      position: POS_LABEL_ZH[pk],
      name: String(names[i] ?? `玩家${i + 1}`),
      stack: meta.finishingStacks[i],
      bet: Math.round(finalSnap.handBets[i] ?? 0),
      hole: finalSnap.holes[i],
      action: "",
      analysisZh: "",
      analysisZhDetail: "",
      analysisEn: "",
      winner: false,
    });
  }

  const winSeat = parseWinnerSeat(facts);
  if (winSeat != null) {
    players.forEach((p) => {
      const sn = (p.seat ?? 0) + 1;
      if (sn === winSeat) p.winner = true;
    });
  }

  const commentaryByAction: CommentaryActionItem[] = timeline
    .filter((e) => e.text.trim())
    .map((e) => ({ event_index: e.event_index, text: e.text }));

  return {
    pot: pot ?? 0,
    board: finalSnap.board,
    street: finalSnap.street,
    players,
    focusPlayerId: winSeat != null ? `p${winSeat - 1}` : null,
    commentarySummary: summary,
    commentaryByAction,
    byActionTimeline: timeline,
    replayMeta: meta,
  };
}

/** 解析 commentary2 接口：facts + commentary */
function parseCommentary2Shape(d: Record<string, unknown>): HandCommentaryPayload | null {
  const facts = d.facts;
  if (!Array.isArray(facts)) return null;

  const lines = facts.filter((x): x is string => typeof x === "string");

  let boardTokens: string[] = [];
  for (const line of lines) {
    const bm = line.match(/最终公共牌[：:]\s*([^。]+)/);
    if (bm) {
      boardTokens = bm[1]
        .trim()
        .split(/\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      break;
    }
  }

  const board: (string | null)[] = boardTokens.map((t) => normalizeHoleToken(t));
  while (board.length < 5) board.push(null);

  let pot: number | undefined;
  const comm = d.commentary as Record<string, unknown> | undefined;
  const summary = typeof comm?.summary === "string" ? comm.summary : "";
  pot = extractPotFromText(summary);
  if (pot == null) {
    for (const line of lines) {
      pot = extractPotFromText(line);
      if (pot != null) break;
    }
  }

  const players: PlayerPayload[] = [];
  const playerRe =
    /^P(\d)\(([^)]+)\)\s*([^：:]+)\s*[：:]\s*起手(\d+)\s+结束(\d+)\s*[，,]\s*底牌\s+(\S+)\s+(\S+)\s*[，,]\s*于\s+(\S+)\s+([^。]+)。/;

  for (const line of lines) {
    const m = line.match(playerRe);
    if (!m) continue;
    const seatNum = parseInt(m[1], 10);
    const abbr = m[2].trim();
    const posKey = POS_ABBR[abbr] ?? POS_ABBR[abbr.replace(/\s/g, "")] ?? "BTN";
    const idx = seatNum - 1;
    const hole: [string | null, string | null] = [
      normalizeHoleToken(m[6]),
      normalizeHoleToken(m[7]),
    ];
    const actionStreet = m[8].trim();
    const actionVerb = m[9].trim();
    players.push({
      id: `p${idx}`,
      seat: idx,
      positionKey: posKey,
      position: POS_LABEL_ZH[posKey],
      name: m[3].trim(),
      stack: parseInt(m[5], 10),
      bet: 0,
      hole,
      action: actionVerb,
      analysisZh: "",
      analysisZhDetail: "",
      analysisEn: "",
      winner: false,
    });
  }

  if (players.length === 0) return null;

  const winSeat = parseWinnerSeat(lines);
  if (winSeat != null) {
    players.forEach((p) => {
      const sn = (p.seat ?? 0) + 1;
      if (sn === winSeat) p.winner = true;
    });
  }

  const street = streetFromBoardCount(boardTokens.length);

  const byActionRaw = comm?.by_action;
  let commentaryByAction: CommentaryActionItem[] | undefined;
  if (Array.isArray(byActionRaw)) {
    commentaryByAction = byActionRaw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const event_index =
          typeof o.event_index === "number" ? o.event_index : Number(o.event_index);
        const text = typeof o.text === "string" ? o.text : "";
        if (!Number.isFinite(event_index)) return null;
        return { event_index, text };
      })
      .filter((x): x is CommentaryActionItem => x != null);
  }

  const focusPlayerId =
    winSeat != null ? `p${winSeat - 1}` : undefined;

  return {
    pot: pot ?? 0,
    board,
    street,
    players,
    focusPlayerId: focusPlayerId ?? null,
    commentarySummary: summary,
    commentaryByAction: commentaryByAction ?? [],
  };
}

/**
 * 将 GET /v1/commentary2 返回体转为界面用的 HandCommentaryPayload。
 * 若已是扁平结构（含 board 数组）则原样透传。
 */
export function adaptCommentaryResponse(data: unknown): HandCommentaryPayload | null {
  if (data == null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (
    !d.commentary &&
    (Array.isArray(d.board) || Array.isArray(d.players))
  ) {
    return d as HandCommentaryPayload;
  }

  if (d.commentary != null && typeof d.commentary === "object") {
    const comm = d.commentary as Record<string, unknown>;
    if (isStructuredCommentary(comm)) {
      const structured = parseStructuredCommentary(d, comm);
      if (structured) return structured;
    }
  }

  if (d.commentary != null && Array.isArray(d.facts)) {
    return parseCommentary2Shape(d);
  }

  return null;
}
