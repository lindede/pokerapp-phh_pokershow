import type {
  CommentaryEquityPayload,
  EquityByActionEvent,
  EquityDetailSection,
  EquityDistributionItem,
  EquitySeatRow,
  EquityStepView,
  EquityValueTrend,
} from "@/types/commentaryEquity";

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asNumList(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => asNum(x) ?? -1);
}

function parseDetails(raw: unknown): EquityByActionEvent["details"] {
  if (!raw || typeof raw !== "object") return {};
  const d = raw as Record<string, unknown>;
  return {
    raw_equity_list: asNumList(d.raw_equity_list),
    average_equity_list: asNumList(d.average_equity_list),
    hd: asNumList(d.hd),
    bhd: asNumList(d.bhd),
    pot_odd: asNum(d.pot_odd),
  };
}

function distributionRatio(v: number | undefined): number {
  if (v == null || v < 0 || !Number.isFinite(v)) return 0;
  return v;
}

/** 将皇家同花顺合并到同花顺列 */
function mergeRoyalFlushIntoStraightFlush(
  names: string[],
  values?: number[],
): { names: string[]; values?: number[] } {
  const royalIdx = names.indexOf("皇家同花顺");
  if (royalIdx < 0) return { names, values };

  const straightIdx = names.indexOf("同花顺");
  const mergedStraight =
    distributionRatio(values?.[straightIdx >= 0 ? straightIdx : undefined]) +
    distributionRatio(values?.[royalIdx]);

  const newNames: string[] = [];
  const newValues: number[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (name === "皇家同花顺") continue;
    if (name === "同花顺") {
      newNames.push("同花顺");
      if (values) newValues.push(mergedStraight);
      continue;
    }
    newNames.push(name);
    if (values) newValues.push(distributionRatio(values[i]));
  }

  if (straightIdx < 0) {
    newNames.splice(royalIdx, 0, "同花顺");
    if (values) newValues.splice(royalIdx, 0, mergedStraight);
  }

  return { names: newNames, values: values ? newValues : undefined };
}

function mergeEquityHandColumns(
  hdNames: string[],
  byAction: EquityByActionEvent[],
): { hdNames: string[]; byAction: EquityByActionEvent[] } {
  if (hdNames.indexOf("皇家同花顺") < 0) return { hdNames, byAction };

  const { names: mergedNames } = mergeRoyalFlushIntoStraightFlush(hdNames);
  const mergedByAction = byAction.map((e) => ({
    ...e,
    details: {
      ...e.details,
      hd: mergeRoyalFlushIntoStraightFlush(hdNames, e.details.hd).values,
      bhd: mergeRoyalFlushIntoStraightFlush(hdNames, e.details.bhd).values,
    },
  }));

  return { hdNames: mergedNames, byAction: mergedByAction };
}

/** 解析 equity 接口 JSON */
export function adaptEquityResponse(data: unknown): {
  hdNames: string[];
  byAction: EquityByActionEvent[];
} | null {
  if (!data || typeof data !== "object") return null;
  const root = data as CommentaryEquityPayload;
  const hdNames = Array.isArray(root.meta?.hd_names)
    ? root.meta!.hd_names!.map((x) => String(x))
    : [];
  const rawList = root.commentary?.by_action;
  if (!Array.isArray(rawList)) return mergeEquityHandColumns(hdNames, []);

  const byAction: EquityByActionEvent[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const eventIndex = asNum(o.event_index);
    if (eventIndex == null) continue;
    const seatRaw = o.seat_index;
    const seat_index =
      seatRaw == null ? null : asNum(seatRaw) ?? null;
    byAction.push({
      event_index: Math.round(eventIndex),
      seat_index:
        seat_index != null && Number.isFinite(seat_index)
          ? Math.round(seat_index)
          : null,
      details: parseDetails(o.details),
    });
  }
  byAction.sort((a, b) => a.event_index - b.event_index);
  return mergeEquityHandColumns(hdNames, byAction);
}

export function formatEquityPct(v: number | undefined): string {
  if (v == null || v < 0 || !Number.isFinite(v)) return "--";
  return `${Math.round(v * 100)}%`;
}

export function formatPotOdd(v: number | undefined): string {
  if (v == null || v < 0 || !Number.isFinite(v)) return "--";
  return `${(Math.round(v * 10) / 10).toFixed(1)}:1`;
}

function formatDistributionPct(v: number): string {
  return `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

function findEquityEntry(
  byAction: EquityByActionEvent[],
  eventIndex: number,
): EquityByActionEvent | null {
  if (!byAction.length) return null;
  const exact = byAction.find((e) => e.event_index === eventIndex);
  if (exact) return exact;
  let best: EquityByActionEvent | null = null;
  for (const e of byAction) {
    if (e.event_index <= eventIndex) {
      if (!best || e.event_index > best.event_index) best = e;
    }
  }
  return best;
}

function hasEquityLists(details: EquityByActionEvent["details"]): boolean {
  return Boolean(
    details.raw_equity_list?.some((v) => v >= 0) ||
      details.average_equity_list?.some((v) => v >= 0),
  );
}

function resolveEquityDetails(
  byAction: EquityByActionEvent[],
  eventIndex: number,
): { details: EquityByActionEvent["details"]; actingSeat: number | null } {
  const entry = findEquityEntry(byAction, eventIndex);
  if (!entry) return { details: {}, actingSeat: null };

  let details = { ...entry.details };
  const actingSeat = entry.seat_index;

  if (!hasEquityLists(details)) {
    for (let i = byAction.length - 1; i >= 0; i--) {
      const e = byAction[i];
      if (e.event_index > eventIndex) continue;
      if (!hasEquityLists(e.details)) continue;
      details = {
        ...e.details,
        pot_odd: details.pot_odd ?? e.details.pot_odd,
      };
      break;
    }
  }

  return { details, actingSeat: actingSeat ?? entry.seat_index };
}

function currentDistributionValues(
  byAction: EquityByActionEvent[],
  eventIndex: number,
  field: "hd" | "bhd",
): number[] | undefined {
  const exact = byAction.find((e) => e.event_index === eventIndex);
  if (!exact) return undefined;
  const vals = exact.details[field];
  if (!vals?.some((v) => v >= 0)) return undefined;
  return vals;
}

function buildDistributionSection(
  title: string,
  subtitle: string,
  names: string[],
  values: number[] | undefined,
): EquityDetailSection | null {
  if (!names.length) return null;
  const hasData = values != null;
  const items: EquityDistributionItem[] = names.map((name, i) => {
    if (!hasData) {
      return { name, pct: "--", ratio: 0 };
    }
    const raw = values[i];
    const v =
      raw != null && raw >= 0 && Number.isFinite(raw) ? raw : 0;
    return {
      name,
      pct: formatDistributionPct(v),
      ratio: Math.min(1, Math.max(0, v)),
    };
  });
  return { title, subtitle, items };
}

function trendFromDisplay(
  curStr: string,
  prevStr: string,
): EquityValueTrend {
  if (curStr === "--" || prevStr === "--" || curStr === prevStr) {
    return "none";
  }
  const curPct = Number.parseInt(curStr, 10);
  const prevPct = Number.parseInt(prevStr, 10);
  if (
    !Number.isFinite(curPct) ||
    !Number.isFinite(prevPct) ||
    curPct === prevPct
  ) {
    return "none";
  }
  return curPct > prevPct ? "up" : "down";
}

/** 按当前 replay event_index 生成权益表与详情区 */
export function buildEquityStepView(
  byAction: EquityByActionEvent[],
  hdNames: string[],
  seatCount: number,
  eventIndex: number,
  prevEventIndex: number | null = null,
): EquityStepView {
  const { details, actingSeat } = resolveEquityDetails(byAction, eventIndex);
  const prevResolved =
    prevEventIndex != null
      ? resolveEquityDetails(byAction, prevEventIndex).details
      : null;

  const rows: EquitySeatRow[] = [];
  for (let seat = 0; seat < seatCount; seat++) {
    const rawEquity = formatEquityPct(details.raw_equity_list?.[seat]);
    const averageEquity = formatEquityPct(
      details.average_equity_list?.[seat],
    );
    const prevRawEquity = prevResolved
      ? formatEquityPct(prevResolved.raw_equity_list?.[seat])
      : "--";
    const prevAverageEquity = prevResolved
      ? formatEquityPct(prevResolved.average_equity_list?.[seat])
      : "--";

    rows.push({
      seatIndex: seat,
      rawEquity,
      averageEquity,
      potOdds:
        actingSeat === seat && details.pot_odd != null
          ? formatPotOdd(details.pot_odd)
          : "--",
      rawEquityTrend: trendFromDisplay(rawEquity, prevRawEquity),
      averageEquityTrend: trendFromDisplay(averageEquity, prevAverageEquity),
    });
  }

  const detailSections: EquityDetailSection[] = [];
  if (hdNames.length) {
    const hdValues = currentDistributionValues(byAction, eventIndex, "hd");
    const bhdValues = currentDistributionValues(byAction, eventIndex, "bhd");

    detailSections.push(
      buildDistributionSection(
        "平均牌型分布",
        "当前动作玩家计算平均权益时的分布",
        hdNames,
        hdValues,
      )!,
    );
    detailSections.push(
      buildDistributionSection(
        "击败牌型分布",
        "能击败当前玩家的牌型分布",
        hdNames,
        bhdValues,
      )!,
    );
  }

  return { rows, detailSections };
}
