export interface CommentaryLabCaseListItem {
  case_id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
  last_run_at?: string | null;
  has_result?: boolean;
  n_prompts?: number;
  hero_seat_index?: number | null;
  way?: string;
  model?: string | null;
  result_keys?: string[];
}

export interface CommentaryLabModelOption {
  id: string;
  label?: string;
  kind?: string;
}

export interface CommentaryLabWayOption {
  id: string;
  label: string;
  description?: string;
}

export interface CommentaryLabFocusSpot {
  event_index: number;
  street: string;
  label: string;
  focus_kind?: string;
}

export interface CommentaryLabPromptRow {
  kind: string;
  event_index: number;
  street: string;
  label: string;
  focus_kind?: string;
  template_id?: string;
  system: string;
  user: string;
  fact: string;
  edited?: boolean;
  /** oneshot：各 focus 点，供时间线展示（非独立提示词） */
  focus_spots?: CommentaryLabFocusSpot[];
}

export interface CommentaryLabResult {
  case_id?: string;
  result_key?: string;
  way?: string;
  model?: string;
  ran_at?: string;
  by_action?: { event_index: number; text: string }[];
  summary?: string | null;
  warnings?: string[];
  last_ran?: { kind?: string; event_index?: number | null };
}

export interface CommentaryLabCaseBundle {
  case_id: string;
  meta: Record<string, unknown> & {
    title?: string;
    way?: string;
    last_run_at?: string | null;
    has_result?: boolean;
    model?: string;
    warnings?: string[];
    hero_seat_index?: number | null;
  };
  phh_text?: string;
  draft?: {
    by_action?: CommentaryLabDraftEvent[];
    hero_seat_index?: number;
  };
  prompts?: CommentaryLabPromptRow[];
  result?: CommentaryLabResult | null;
  results_by_key?: Record<string, CommentaryLabResult>;
  result_keys?: string[];
  generation_ways?: {
    default: string;
    ways: CommentaryLabWayOption[];
  };
}

export interface CommentaryLabDraftEvent {
  event_index?: number;
  seat_index?: number | null;
  seat_name?: string;
  action?: string;
  street?: string;
  cards?: string | null;
  chips?: number | null;
}
