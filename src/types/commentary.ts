/** 与服务端约定的「一手牌解说」快照；GET/POST 返回 JSON 可直接传入 applyPayload */

export type Street = "preflop" | "flop" | "turn" | "river";

export type SeatPositionKey = "SB" | "BB" | "UTG" | "MP" | "CO" | "BTN";

export interface CommentaryActionItem {
  event_index: number;
  text: string;
}

/** commentary.by_action 单步事件（服务端新格式） */
/** 回放界面：单条动作标签（筹码单独一行便于窄宽度换行） */
export interface ReplayActionTrailItem {
  labelZh: string;
  /** 优先盲注倍数如 3B、2.5B；过大时为相对底池既约分数如 3/10P */
  chipsLine?: string;
  /** 该动作所属投注轮次（用于按街分列左对齐） */
  street?: Street;
}

export interface ByActionEvent {
  event_index: number;
  seat_index: number | null;
  seat_name: string;
  action: string;
  street: string;
  cards: string | null;
  text: string;
  /**
   * 与本 action 相关的筹码：回放里按「当前街结束后的该座位本轮总投入」理解
   * （与 PHH raise-to / call 至 facing 一致）；缺省时 call 用 facing 补齐。
   */
  chips?: number | null;
}

export interface CommentaryReplayMeta {
  startingStacks: number[];
  finishingStacks: number[];
  /** 与各座位对齐：盲注 / straddle 等量，用于起手底池与本街初始下注展示 */
  blindsOrStraddles?: number[];
}

export interface PlayerPayload {
  id?: string;
  seat?: number;
  /** 展示用，如 "(小盲)" */
  position?: string;
  positionKey?: SeatPositionKey;
  name?: string;
  stack?: number;
  bet?: number;
  /** 两张底牌，如 As、Th；null 表示未知 */
  hole?: [string | null, string | null];
  /** 最近行动：弃牌 / 跟注 / 加注 … */
  action?: string;
  analysisZh?: string;
  analysisZhDetail?: string;
  analysisEn?: string;
  /** 胜者：界面展示 WINS 标签 */
  winner?: boolean;
  /** 回放：是否已弃牌 */
  folded?: boolean;
}

export interface HandCommentaryPayload {
  datasetKey?: string;
  /**
   * 本局 id（CommentaryLite 根级 meta.i）。
   * i=-1 时 meta.i 为当前局；明确 i 请求时 meta.i 与请求 i 一致；语音 list/data 仅用 meta.i。
   */
  handIndex?: number | string;
  /** meta.id：稳定条目 id，分享链接 k=all&id= 使用 */
  commentaryId?: string | null;
  pot?: number;
  /** 长度 5，null 表示未发出或未知 */
  board?: (string | null)[];
  street?: Street;
  players?: PlayerPayload[];
  /** 当前聚焦玩家（界面7 黄框） */
  focusPlayerId?: string | null;
  /** commentary2：全文概要 */
  commentarySummary?: string;
  commentaryByAction?: CommentaryActionItem[];
  /** 完整时间线，用于逐步回放 */
  byActionTimeline?: ByActionEvent[];
  replayMeta?: CommentaryReplayMeta;
  /** meta.hero_seat_index：Hero 视角回放（常亮 hero、他人发牌/弃牌快进） */
  heroSeatIndex?: number | null;
}

export interface PlayerState {
  id: string;
  positionKey: SeatPositionKey;
  positionLabel: string;
  name: string;
  stack: number;
  bet: number;
  hole: [string | null, string | null];
  action: string;
  analysisZh: string;
  analysisZhDetail: string;
  analysisEn: string;
  winner: boolean;
  /** 回放：是否已弃牌 */
  folded?: boolean;
  /** 回放：截至当前步该座位已展示的动作标签（累加） */
  actionTrail?: ReplayActionTrailItem[];
}
