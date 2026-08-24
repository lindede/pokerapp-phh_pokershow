export interface LabCaseListItem {
  case_id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
  last_run_at?: string | null;
  has_result?: boolean;
  n_prompts?: number;
  hero_seat_index?: number | null;
  model?: string | null;
  result_models?: string[];
}

export interface LabModelOption {
  id: string;
  label?: string;
}

export interface LabModelsCatalog {
  default: string;
  models: LabModelOption[];
}

export interface LabPromptRow {
  kind: string;
  event_index: number;
  street: string;
  label: string;
  /** 与 GET /v2/ReviewLab/prompt-template 对照，判断是否过期 */
  template_id?: string;
  system: string;
  user: string;
  fact: string;
  edited?: boolean;
}

export interface LabReviewRow {
  kind?: string;
  event_index?: number;
  actual?: { kind?: string; label?: string; chips?: number | null };
  recommend?: { kind?: string; label?: string; chips?: number | null };
  verdict?: string;
  reasons?: string[];
  balance?: {
    alt?: { kind?: string; label?: string; chips?: number | null };
    notes?: string[];
  };
}

export interface LabResult {
  case_id?: string;
  reviews?: LabReviewRow[];
  warnings?: string[];
  ran_at?: string;
  model?: string;
  last_ran?: {
    kind?: string;
    event_index?: number | null;
  };
}

export interface LabDraftEvent {
  event_index?: number;
  seat_index?: number | null;
  seat_name?: string;
  action?: string;
  street?: string;
  cards?: string | null;
  chips?: number | null;
}

export interface LabCaseBundle {
  case_id: string;
  meta: Record<string, unknown> & {
    title?: string;
    last_run_at?: string | null;
    has_result?: boolean;
    model?: string;
    warnings?: string[];
    hero_seat_index?: number | null;
    result_models?: string[];
  };
  phh_text: string;
  draft?: {
    hero_seat_index?: number;
    by_action?: LabDraftEvent[];
  };
  prompts: LabPromptRow[];
  result?: LabResult | null;
  /** 按模型分存的测试结果，便于对比 */
  results_by_model?: Record<string, LabResult>;
  result_models?: string[];
}
