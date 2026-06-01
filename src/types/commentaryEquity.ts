/** GET /v2/Commentary/additional/equity 返回体 */

export interface EquityActionDetails {
  raw_equity_list?: number[];
  average_equity_list?: number[];
  /** 当前动作玩家平均权益的牌型分布（与 meta.hd_names 对齐） */
  hd?: number[];
  /** 击败当前玩家的牌型分布 */
  bhd?: number[];
  pot_odd?: number;
}

export interface EquityByActionEvent {
  event_index: number;
  seat_index: number | null;
  details: EquityActionDetails;
}

export interface CommentaryEquityPayload {
  meta?: {
    k?: string;
    i?: number;
    hd_names?: string[];
  };
  commentary?: {
    by_action?: EquityByActionEvent[];
  };
}

/** 相对上一步权益数值变化方向 */
export type EquityValueTrend = "up" | "down" | "none";

export interface EquitySeatRow {
  seatIndex: number;
  rawEquity: string;
  averageEquity: string;
  potOdds: string;
  rawEquityTrend: EquityValueTrend;
  averageEquityTrend: EquityValueTrend;
}

export interface EquityDistributionItem {
  name: string;
  pct: string;
  /** 0–1，用于进度条宽度 */
  ratio: number;
}

export interface EquityDetailSection {
  title: string;
  subtitle: string;
  items: EquityDistributionItem[];
}

export interface EquityStepView {
  rows: EquitySeatRow[];
  detailSections: EquityDetailSection[];
}
