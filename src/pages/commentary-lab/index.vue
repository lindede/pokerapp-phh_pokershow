<template>
  <div class="lab">
    <div class="lab-sidebar">
      <div class="lab-head">
        <div class="lab-title">解说实验室</div>
        <div class="lab-sub">PC 宽屏 · 提示词对照</div>
      </div>
      <textarea
        class="phh-input"
        :maxlength="-1"
        :value="phhText"
        placeholder="粘贴 PHH 文本后点「添加用例」"
        @input="onPhhInput"
      />
      <input
        class="title-input"
        :value="newTitle"
        placeholder="可选标题"
        @input="onTitleInput"
      />
      <label class="way-pick">
        <span class="model-lab">生成方式</span>
        <select
          class="model-select"
          :value="createWay"
          :disabled="busy"
          @change="onCreateWayChange"
        >
          <option v-for="w in wayOptions" :key="w.id" :value="w.id">
            {{ w.label || w.id }}
          </option>
        </select>
      </label>
      <div class="btn-row">
        <div
          class="btn primary"
          :class="{ disabled: busy }"
          @click="onCreate"
        >
          添加用例
        </div>
      </div>
      <div v-if="status" class="status">{{ status }}</div>
      <div class="case-list">
        <div
          v-for="c in cases"
          :key="c.case_id"
          class="case-item"
          :class="{ active: c.case_id === selectedId }"
          @click="onSelect(c.case_id)"
        >
          <div class="case-name">{{ c.title }}</div>
          <div class="case-meta">
            {{ wayLabel(c.way) }}
            · {{ c.n_prompts || 0 }} 点
            · {{ c.has_result ? "已测" : "未测" }}
          </div>
          <div class="case-time">{{ c.last_run_at || c.created_at }}</div>
        </div>
      </div>
    </div>

    <div class="lab-main" v-if="bundle">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="toolbar-title">{{ bundle.meta.title || bundle.case_id }}</div>
          <label class="model-pick">
            <span class="model-lab">方式</span>
            <select
              class="model-select"
              :value="currentWay"
              :disabled="busy"
              @change="onWayChange"
            >
              <option v-for="w in wayOptions" :key="'tb-' + w.id" :value="w.id">
                {{ w.label || w.id }}
              </option>
            </select>
          </label>
          <label class="model-pick">
            <span class="model-lab">跑测</span>
            <select
              class="model-select"
              :value="selectedModel"
              :disabled="busy"
              @change="onModelChange"
            >
              <option v-for="m in modelOptions" :key="m.id" :value="m.id">
                {{ m.label || m.id }}
              </option>
            </select>
          </label>
          <span v-if="bundle.result_keys?.length" class="model-last muted">
            已存 {{ bundle.result_keys.length }} 组结果
          </span>
        </div>
        <div class="toolbar-actions">
          <div class="btn" :class="{ disabled: busy }" @click="onSavePrompts">
            保存提示词
          </div>
          <div class="btn" :class="{ disabled: busy }" @click="onResetPrompts">
            重置
          </div>
          <div
            class="btn"
            :class="{ disabled: busy || !currentPrompt }"
            @click="onRefreshFact"
          >
            刷新本点
          </div>
          <div
            class="btn primary"
            :class="{ disabled: busy || !currentPrompt }"
            @click="onRun"
          >
            {{ busy ? "测试中…" : "测试本点" }}
          </div>
          <div
            class="btn primary"
            :class="{ disabled: busy }"
            @click="onRunAll"
          >
            测试全部
          </div>
        </div>
      </div>

      <div class="work">
        <div class="col col-spots">
          <div class="col-h">动作</div>
          <div class="spot-list">
            <template v-for="row in timelineRows" :key="row.key">
              <div v-if="row.kind === 'street'" class="spot-street">
                {{ row.title }}
              </div>
              <div
                v-else
                class="spot-item"
                :class="{
                  active: isTimelineRowActive(row),
                  locked: row.locked,
                  hero: row.who === 'hero',
                }"
                @click="onSelectTimelineRow(row)"
              >
                <span class="spot-who">{{ row.who }}</span>
                <span class="spot-act">{{ row.act }}</span>
                <span v-if="row.edited" class="spot-edited">已改</span>
              </div>
            </template>
          </div>
        </div>

        <div class="col col-prompt">
          <div class="col-h">
            提示词
            <span v-if="currentPrompt" class="muted">
              · {{ currentPrompt.kind }}
              <template v-if="currentPrompt.kind !== 'oneshot'">
                #{{ currentPrompt.event_index }}
              </template>
            </span>
          </div>
          <div class="prompt-hint">
            「刷新本点」同步 system、user、fact
            <span v-if="currentPrompt?.template_id" class="muted">
              · 模板 {{ currentPrompt.template_id }}
            </span>
          </div>
          <div class="prompt-scroll" v-if="currentPrompt">
            <div class="field-row">
              <span class="field-lab">system</span>
              <span
                class="field-hint"
                v-if="editingField === 'system'"
                @click="stopEdit"
              >完成</span>
              <span class="field-hint" v-else>点击编辑</span>
            </div>
            <NativeMultiline
              :key="'sys-' + promptRenderKey"
              :model-value="currentPrompt.system"
              :editing="editingField === 'system'"
              @start-edit="startEdit('system')"
              @update:model-value="setField('system', $event)"
            />

            <div class="field-row">
              <span class="field-lab">user</span>
              <span
                class="field-hint"
                v-if="editingField === 'user'"
                @click="stopEdit"
              >完成</span>
              <span class="field-hint" v-else>点击编辑</span>
            </div>
            <NativeMultiline
              :key="'usr-' + promptRenderKey"
              :model-value="currentPrompt.user"
              :editing="editingField === 'user'"
              @start-edit="startEdit('user')"
              @update:model-value="setField('user', $event)"
            />

            <div class="field-row">
              <span class="field-lab">fact（多行 JSON 或纯文本）</span>
              <span
                class="field-hint"
                v-if="editingField === 'fact'"
                @click="stopEdit"
              >完成</span>
              <span class="field-hint" v-else>点击编辑</span>
            </div>
            <NativeMultiline
              :key="'fact-' + promptRenderKey"
              :model-value="currentPrompt.fact"
              :editing="editingField === 'fact'"
              @start-edit="startEdit('fact')"
              @update:model-value="setField('fact', $event)"
            />
          </div>
        </div>

        <div class="col col-result">
          <div class="col-h result-head">
            <div class="result-head-top">
              <span class="result-head-title">结果</span>
              <label v-if="resultKeyOptions.length" class="model-pick">
                <span class="model-lab">查看</span>
                <select
                  class="model-select model-select--compact"
                  :value="viewResultKey"
                  @change="onViewResultKeyChange"
                >
                  <option
                    v-for="k in resultKeyOptions"
                    :key="k"
                    :value="k"
                  >
                    {{ k }}
                  </option>
                </select>
              </label>
              <span
                v-if="resultDisplayText"
                class="field-hint field-action"
                @click="onCopyResult"
              >复制</span>
            </div>
            <div v-if="resultDisplayText" class="result-head-tts">
              <label class="model-pick">
                <span class="model-lab">音色</span>
                <select
                  class="model-select model-select--compact"
                  :value="ttsVoice"
                  :disabled="ttsBusy || !ttsAvailable"
                  @change="onTtsVoiceChange"
                >
                  <option v-for="v in ttsVoices" :key="v.id" :value="v.id">
                    {{ v.label || v.id }}
                  </option>
                </select>
              </label>
              <button
                type="button"
                class="tts-btn"
                :disabled="ttsBusy || !ttsAvailable"
                @click="onPlayTts"
              >
                {{ ttsBusy ? "合成中…" : "▶ 试听" }}
              </button>
            </div>
          </div>
          <div class="result-scroll selectable">
            <div v-if="activeResult" class="result-meta">
              {{ activeResult.way || currentWay }}
              · {{ modelLabel(activeResult.model) }}
              <template v-if="activeResult.ran_at">
                · {{ activeResult.ran_at }}
              </template>
            </div>
            <div v-if="resultDisplayText" class="result-card">
              <pre class="result-text">{{ resultDisplayText }}</pre>
            </div>
            <div v-else class="empty">
              {{
                resultKeyOptions.length
                  ? "该结果组暂无文本"
                  : "尚未测试，或尚无结果"
              }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="lab-empty" v-else>
      从左侧粘贴 PHH 添加用例，或选择已有用例
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import NativeMultiline from "@/components/NativeMultiline.vue";
import {
  commentaryLabCaseUrl,
  commentaryLabCasesUrl,
  commentaryLabModelsUrl,
  commentaryLabPromptsUrl,
  commentaryLabRefreshFactUrl,
  commentaryLabResetPromptsUrl,
  commentaryLabRunUrl,
  commentaryLabTtsUrl,
  commentaryLabTtsVoicesUrl,
  commentaryLabWayUrl,
  commentaryLabWaysUrl,
} from "@/config/commentary-lab-api";
import type {
  CommentaryLabCaseBundle,
  CommentaryLabCaseListItem,
  CommentaryLabDraftEvent,
  CommentaryLabModelOption,
  CommentaryLabPromptRow,
  CommentaryLabResult,
  CommentaryLabWayOption,
} from "@/types/commentary-lab";

const MODEL_STORAGE_KEY = "commentary-lab-selected-model";

const cases = ref<CommentaryLabCaseListItem[]>([]);
const selectedId = ref("");
const bundle = ref<CommentaryLabCaseBundle | null>(null);
const promptIdx = ref(0);
/** oneshot 时间线点选的 focus event_index；null=看全部 */
const focusEventIndex = ref<number | null>(null);
const promptRenderKey = ref(0);
const editingField = ref<"" | "system" | "user" | "fact">("");
const phhText = ref("");
const newTitle = ref("");
const status = ref("");
const busy = ref(false);
const modelOptions = ref<CommentaryLabModelOption[]>([]);
const wayOptions = ref<CommentaryLabWayOption[]>([]);
const selectedModel = ref("");
const defaultModel = ref("");
const createWay = ref("batched");
const viewResultKey = ref("");
const ttsAvailable = ref(false);
const ttsBusy = ref(false);
const ttsVoice = ref("zh-CN-YunxiNeural");
const ttsVoices = ref<{ id: string; label: string }[]>([
  { id: "zh-CN-YunxiNeural", label: "云希 · 男" },
]);
let ttsAudio: HTMLAudioElement | null = null;
let ttsObjectUrl: string | null = null;

const prompts = computed(
  (): CommentaryLabPromptRow[] => bundle.value?.prompts || []
);

const currentPrompt = computed(
  () => prompts.value[promptIdx.value] ?? null
);

const currentWay = computed(() => {
  const w = String(bundle.value?.meta?.way || createWay.value || "batched");
  return w === "oneshot" ? "oneshot" : "batched";
});

const STREET_ZH: Record<string, string> = {
  preflop: "翻前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  all: "整手",
};

type TimelineRow =
  | { kind: "street"; key: string; title: string }
  | {
      kind: "action";
      key: string;
      who: string;
      act: string;
      promptIdx: number | null;
      eventIndex: number | null;
      locked: boolean;
      edited?: boolean;
    };

function actionZh(action: string): string {
  const a = (action || "").trim().toLowerCase();
  const map: Record<string, string> = {
    fold: "弃牌",
    check: "过牌",
    call: "跟注",
    bet: "下注",
    raise: "加注",
    all_in: "全下",
    allin: "全下",
    showdown: "摊牌",
  };
  if (map[a]) return map[a];
  if (/^\d+bet$/.test(a)) return a;
  return action || "";
}

function formatDraftAct(e: CommentaryLabDraftEvent): string {
  const a = (e.action || "").toLowerCase();
  if (a === "deal_board") {
    return e.cards ? String(e.cards) : "";
  }
  let s = actionZh(e.action || "");
  if (e.chips != null) {
    s += ` ${e.chips}`;
  }
  if (a === "showdown" && e.cards) {
    s += ` ${e.cards}`;
  }
  return s;
}

/** 与复盘实验室一致：用 draft.by_action 展示整手过程 */
const timelineRows = computed((): TimelineRow[] => {
  const b = bundle.value;
  if (!b) return [];
  const list = prompts.value;
  const events = (b.draft?.by_action || []) as CommentaryLabDraftEvent[];
  const heroSi = b.draft?.hero_seat_index ?? b.meta.hero_seat_index ?? 0;
  const oneshot =
    currentWay.value === "oneshot" || list.every((p) => p.kind === "oneshot");

  const promptByEi = new Map<number, number>();
  let oneshotPromptIdx: number | null = null;
  list.forEach((p, i) => {
    if (p.kind === "oneshot") {
      oneshotPromptIdx = i;
      return;
    }
    const ei = Number(p.event_index);
    if (Number.isFinite(ei) && ei >= 0) promptByEi.set(ei, i);
  });

  const focusEis = new Set<number>();
  if (oneshot) {
    const p0 = list[0];
    (p0?.focus_spots || []).forEach((s) => focusEis.add(Number(s.event_index)));
    if (!focusEis.size && p0?.fact) {
      try {
        const obj = JSON.parse(p0.fact) as { focus?: unknown[] };
        (obj.focus || []).forEach((x) => {
          const n = Number(x);
          if (Number.isFinite(n)) focusEis.add(n);
        });
      } catch {
        /* ignore */
      }
    }
  }

  const rows: TimelineRow[] = [];
  if (oneshot && oneshotPromptIdx != null) {
    rows.push({
      kind: "action",
      key: "oneshot-mode",
      who: "hero",
      act: list[oneshotPromptIdx]?.label || "整手一次生成",
      promptIdx: oneshotPromptIdx,
      eventIndex: null,
      locked: false,
      edited: !!list[oneshotPromptIdx]?.edited,
    });
  }

  if (!events.length) {
    list.forEach((p, i) => {
      if (oneshot && p.kind === "oneshot") return;
      rows.push({
        kind: "action",
        key: `p-${i}`,
        who: "hero",
        act: p.label || p.kind,
        promptIdx: i,
        eventIndex: p.event_index >= 0 ? p.event_index : null,
        locked: false,
        edited: !!p.edited,
      });
    });
    return rows;
  }

  let lastStreet = "";
  events.forEach((e, i) => {
    const action = (e.action || "").toLowerCase();
    if (action === "deal_hole") return;
    const street = e.street || "";
    if (action === "deal_board") {
      const title = `${STREET_ZH[street] || street} ${e.cards || ""}`.trim();
      rows.push({ kind: "street", key: `st-${i}`, title });
      lastStreet = street;
      const ei = e.event_index ?? null;
      const pi =
        ei != null && promptByEi.has(ei) ? (promptByEi.get(ei) as number) : null;
      const isFocus = ei != null && (oneshot ? focusEis.has(ei) : pi != null);
      // 解说 focus 含发公共牌：街标题下再给可点行（复盘实验室无此需求）
      if (isFocus) {
        rows.push({
          kind: "action",
          key: `board-${ei ?? i}`,
          who: "board",
          act: e.cards ? String(e.cards) : "发公共牌",
          promptIdx: oneshot ? oneshotPromptIdx : pi,
          eventIndex: ei,
          locked: false,
          edited: pi != null ? !!list[pi]?.edited : false,
        });
      }
      return;
    }
    if (street && street !== lastStreet && street === "preflop") {
      rows.push({ kind: "street", key: "st-preflop", title: "翻前" });
      lastStreet = street;
    } else if (street && street !== lastStreet && action !== "deal_board") {
      rows.push({
        kind: "street",
        key: `st-${street}-${i}`,
        title: STREET_ZH[street] || street,
      });
      lastStreet = street;
    }
    const isHero = e.seat_index === heroSi;
    const who = isHero
      ? "hero"
      : String(
          e.seat_name || (e.seat_index != null ? `P${e.seat_index + 1}` : "—")
        );
    const ei = e.event_index ?? null;
    const pi =
      ei != null && promptByEi.has(ei) ? (promptByEi.get(ei) as number) : null;
    const isFocus =
      ei != null && (oneshot ? focusEis.has(ei) || pi != null : pi != null);
    rows.push({
      kind: "action",
      key: `a-${ei ?? i}`,
      who,
      act: formatDraftAct(e),
      promptIdx: oneshot ? oneshotPromptIdx : pi,
      eventIndex: ei,
      locked: oneshot ? !isFocus : pi == null,
      edited: pi != null ? !!list[pi]?.edited : false,
    });
  });
  return rows;
});

function isTimelineRowActive(row: TimelineRow): boolean {
  if (row.kind !== "action") return false;
  if (row.key === "oneshot-mode") {
    return promptIdx.value === row.promptIdx && focusEventIndex.value == null;
  }
  if (currentWay.value === "oneshot") {
    if (focusEventIndex.value != null && row.eventIndex != null) {
      return focusEventIndex.value === row.eventIndex;
    }
    return false;
  }
  return row.promptIdx != null && row.promptIdx === promptIdx.value;
}

const activeResult = computed((): CommentaryLabResult | null => {
  const b = bundle.value;
  if (!b) return null;
  const key = viewResultKey.value;
  const by = b.results_by_key || {};
  if (key && by[key]) return by[key];
  if (key && b.result?.result_key === key) return b.result;
  return b.result ?? null;
});

const resultKeyOptions = computed((): string[] => {
  const b = bundle.value;
  if (!b) return [];
  const keys = [...(b.result_keys || [])];
  if (b.result?.result_key && !keys.includes(b.result.result_key)) {
    keys.unshift(b.result.result_key);
  }
  Object.keys(b.results_by_key || {}).forEach((k) => {
    if (!keys.includes(k)) keys.push(k);
  });
  return keys;
});

const resultDisplayText = computed((): string => {
  const res = activeResult.value;
  if (!res) return "";
  const lines: string[] = [];
  const p = currentPrompt.value;
  const ba = res.by_action || [];
  const focusEi = focusEventIndex.value;
  const showAll =
    focusEi == null &&
    (!p ||
      p.kind === "oneshot" ||
      currentWay.value === "oneshot");

  if (focusEi != null) {
    const hit = ba.find((row) => Number(row.event_index) === focusEi);
    if (hit) {
      lines.push(`[${hit.event_index}] ${hit.text || ""}`);
    } else {
      lines.push(`（关注点 #${focusEi} 暂无结果）`);
    }
  } else if (showAll) {
    if (ba.length) {
      lines.push("by_action:");
      ba.forEach((row) => {
        lines.push(`[${row.event_index}] ${row.text || ""}`);
      });
    }
  } else {
    const hit = ba.find((row) => row.event_index === p!.event_index);
    if (hit) {
      lines.push(`[${hit.event_index}] ${hit.text || ""}`);
    } else if (ba.length) {
      lines.push("（本点无单独结果，显示全部）");
      ba.forEach((row) => {
        lines.push(`[${row.event_index}] ${row.text || ""}`);
      });
    }
  }

  if (res.summary) {
    if (lines.length) lines.push("");
    lines.push("summary:");
    lines.push(String(res.summary));
  }

  const warnings = res.warnings || [];
  if (warnings.length) {
    if (lines.length) lines.push("");
    lines.push("warnings:");
    warnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join("\n");
});

function wayLabel(id: string | null | undefined): string {
  const mid = String(id || "batched").trim() || "batched";
  const hit = wayOptions.value.find((w) => w.id === mid);
  return hit?.label || mid;
}

function modelLabel(id: string | null | undefined): string {
  const mid = String(id || "").trim();
  if (!mid) return "—";
  const hit = modelOptions.value.find((m) => m.id === mid);
  return hit?.label || mid;
}

function syncViewResultKey(preferred?: string | null) {
  const keys = resultKeyOptions.value;
  if (!keys.length) {
    viewResultKey.value = "";
    return;
  }
  const want = String(preferred || viewResultKey.value || "").trim();
  if (want && keys.includes(want)) {
    viewResultKey.value = want;
    return;
  }
  const fromResult = String(bundle.value?.result?.result_key || "").trim();
  if (fromResult && keys.includes(fromResult)) {
    viewResultKey.value = fromResult;
    return;
  }
  viewResultKey.value = keys[0];
}

function inputVal(e: any): string {
  return String(e?.detail?.value ?? e?.target?.value ?? "");
}

function toast(msg: string) {
  status.value = msg;
  try {
    uni.showToast({ title: msg.slice(0, 40), icon: "none", duration: 2500 });
  } catch {
    if (typeof alert === "function") alert(msg);
  }
}

/** oneshot / 多点跑测常超过 3 分钟；默认拉长，避免前端先超时而服务端其实已出结果 */
const DEFAULT_REQ_TIMEOUT_MS = 180_000;
const RUN_REQ_TIMEOUT_MS = 1_200_000; // 20 分钟

function requestJson(opts: {
  url: string;
  method?: "GET" | "POST" | "PUT";
  data?: unknown;
  timeoutMs?: number;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: opts.url,
      method: opts.method || "GET",
      data: opts.data as Record<string, unknown> | undefined,
      header: { "Content-Type": "application/json" },
      timeout: opts.timeoutMs ?? DEFAULT_REQ_TIMEOUT_MS,
      success: (res) => {
        const body = res.data as any;
        const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
        if (!ok) {
          const d = body?.detail;
          let msg = `HTTP ${res.statusCode ?? "?"}`;
          if (typeof d === "string") msg = d;
          else if (Array.isArray(d) && d.length) {
            msg = d
              .map((x: any) => x?.msg || JSON.stringify(x))
              .join("; ");
          }
          reject(new Error(msg));
          return;
        }
        resolve(body);
      },
      fail: (err) => {
        reject(
          new Error(
            err && typeof err === "object" && "errMsg" in err
              ? String((err as { errMsg?: string }).errMsg)
              : "网络错误"
          )
        );
      },
    });
  });
}

async function refreshList() {
  const data = await requestJson({ url: commentaryLabCasesUrl() });
  cases.value = Array.isArray(data.cases) ? data.cases : [];
}

async function loadWays() {
  try {
    const data = await requestJson({ url: commentaryLabWaysUrl() });
    const list = Array.isArray(data?.ways) ? data.ways : [];
    wayOptions.value = list
      .map((w: any) => ({
        id: String(w?.id || "").trim(),
        label: String(w?.label || w?.id || "").trim(),
        description: w?.description ? String(w.description) : undefined,
      }))
      .filter((w: CommentaryLabWayOption) => !!w.id);
    const def = String(data?.default || "batched").trim();
    if (wayOptions.value.some((w) => w.id === def)) {
      createWay.value = def;
    } else if (wayOptions.value[0]) {
      createWay.value = wayOptions.value[0].id;
    }
    if (!wayOptions.value.length) {
      wayOptions.value = [
        { id: "batched", label: "按点多次生成" },
        { id: "oneshot", label: "整手一次生成" },
      ];
    }
  } catch {
    wayOptions.value = [
      { id: "batched", label: "按点多次生成" },
      { id: "oneshot", label: "整手一次生成" },
    ];
  }
}

async function loadModels() {
  try {
    const data = await requestJson({ url: commentaryLabModelsUrl() });
    const list = Array.isArray(data?.models) ? data.models : [];
    modelOptions.value = list
      .map((m: any) => ({
        id: String(m?.id || "").trim(),
        label: String(m?.label || m?.id || "").trim(),
        kind: m?.kind ? String(m.kind) : undefined,
      }))
      .filter((m: CommentaryLabModelOption) => !!m.id);
    defaultModel.value = String(data?.default || "").trim();
    let stored = "";
    try {
      stored = String(localStorage.getItem(MODEL_STORAGE_KEY) || "").trim();
    } catch {
      stored = "";
    }
    const ids = new Set(modelOptions.value.map((m) => m.id));
    if (stored && ids.has(stored)) {
      selectedModel.value = stored;
    } else if (defaultModel.value && ids.has(defaultModel.value)) {
      selectedModel.value = defaultModel.value;
    } else if (modelOptions.value[0]) {
      selectedModel.value = modelOptions.value[0].id;
    }
  } catch {
    modelOptions.value = [];
    selectedModel.value = selectedModel.value || "";
  }
}

function onModelChange(e: any) {
  const v = inputVal(e).trim();
  if (!v) return;
  selectedModel.value = v;
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
}

function onCreateWayChange(e: any) {
  const v = inputVal(e).trim();
  if (!v) return;
  createWay.value = v === "oneshot" ? "oneshot" : "batched";
}

function onViewResultKeyChange(e: any) {
  const v = inputVal(e).trim();
  if (!v) return;
  viewResultKey.value = v;
}

async function loadCase(id: string) {
  const data = (await requestJson({
    url: commentaryLabCaseUrl(id),
  })) as CommentaryLabCaseBundle;
  bundle.value = data;
  selectedId.value = id;
  promptIdx.value = 0;
  focusEventIndex.value = null;
  editingField.value = "";
  promptRenderKey.value += 1;
  if (data.generation_ways?.ways?.length) {
    wayOptions.value = data.generation_ways.ways;
  }
  syncViewResultKey(data.result?.result_key || selectedModel.value);
}

async function onSelect(id: string) {
  status.value = "";
  try {
    await loadCase(id);
  } catch (e) {
    toast(String((e as Error).message || e));
  }
}

function onSelectPromptSpot(idx: number) {
  promptIdx.value = idx;
  focusEventIndex.value = null;
  editingField.value = "";
  promptRenderKey.value += 1;
}

function onSelectTimelineRow(row: TimelineRow) {
  if (row.kind !== "action") return;
  if (row.key === "oneshot-mode") {
    if (row.promptIdx == null) return;
    onSelectPromptSpot(row.promptIdx);
    return;
  }
  if (currentWay.value === "oneshot") {
    // 整手模式：点任意行动可对照结果；非 focus 行仍可浏览
    if (row.promptIdx != null) promptIdx.value = row.promptIdx;
    focusEventIndex.value =
      row.eventIndex != null ? row.eventIndex : null;
    editingField.value = "";
    return;
  }
  if (row.locked || row.promptIdx == null) return;
  promptIdx.value = row.promptIdx;
  focusEventIndex.value = null;
  editingField.value = "";
  promptRenderKey.value += 1;
}

function onSelectSpot(idx: number) {
  onSelectPromptSpot(idx);
}

function onPhhInput(e: any) {
  phhText.value = inputVal(e);
}

function onTitleInput(e: any) {
  newTitle.value = inputVal(e);
}

function startEdit(field: "system" | "user" | "fact") {
  editingField.value = field;
}

function stopEdit() {
  editingField.value = "";
}

function setField(field: "system" | "user" | "fact", val: string) {
  const b = bundle.value;
  if (!b?.prompts) return;
  const i = promptIdx.value;
  const row = b.prompts[i];
  if (!row) return;
  b.prompts[i] = { ...row, [field]: val, edited: true };
}

async function onCreate() {
  if (busy.value) return;
  if (!phhText.value.trim()) {
    toast("请先粘贴 PHH");
    return;
  }
  busy.value = true;
  status.value = "正在创建…";
  try {
    const data = (await requestJson({
      url: commentaryLabCasesUrl(),
      method: "POST",
      data: {
        phh_text: phhText.value,
        title: newTitle.value || undefined,
        way: createWay.value === "oneshot" ? "oneshot" : "batched",
      },
    })) as CommentaryLabCaseBundle;
    await refreshList();
    bundle.value = data;
    selectedId.value = data.case_id;
    promptIdx.value = 0;
    focusEventIndex.value = null;
    editingField.value = "";
    promptRenderKey.value += 1;
    syncViewResultKey(data.result?.result_key);
    toast("已添加用例");
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    busy.value = false;
  }
}

async function onWayChange(e: any) {
  const b = bundle.value;
  if (!b || busy.value) return;
  const v = inputVal(e).trim();
  const way = v === "oneshot" ? "oneshot" : "batched";
  if (way === currentWay.value) return;
  busy.value = true;
  status.value = "切换生成方式…";
  try {
    const data = (await requestJson({
      url: commentaryLabWayUrl(b.case_id),
      method: "POST",
      data: { way },
    })) as CommentaryLabCaseBundle;
    bundle.value = data;
    promptIdx.value = 0;
    focusEventIndex.value = null;
    editingField.value = "";
    promptRenderKey.value += 1;
    syncViewResultKey(data.result?.result_key);
    toast(`已切换为 ${wayLabel(way)}`);
    await refreshList();
  } catch (err) {
    toast(String((err as Error).message || err));
  } finally {
    busy.value = false;
  }
}

async function onSavePrompts() {
  const b = bundle.value;
  if (!b || busy.value) return;
  busy.value = true;
  status.value = "保存中…";
  try {
    const data = (await requestJson({
      url: commentaryLabPromptsUrl(b.case_id),
      method: "PUT",
      data: { prompts: b.prompts },
    })) as CommentaryLabCaseBundle;
    bundle.value = data;
    toast("提示词已保存");
    await refreshList();
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    busy.value = false;
  }
}

async function onResetPrompts() {
  const b = bundle.value;
  if (!b || busy.value) return;
  busy.value = true;
  status.value = "重置提示词…";
  try {
    const data = (await requestJson({
      url: commentaryLabResetPromptsUrl(b.case_id),
      method: "POST",
    })) as CommentaryLabCaseBundle;
    bundle.value = data;
    promptIdx.value = 0;
    focusEventIndex.value = null;
    editingField.value = "";
    promptRenderKey.value += 1;
    toast("已重新生成提示词");
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    busy.value = false;
  }
}

async function onRefreshFact() {
  const b = bundle.value;
  const p = currentPrompt.value;
  if (!b || !p || busy.value) return;
  busy.value = true;
  status.value = "刷新本点…";
  try {
    const data = (await requestJson({
      url: commentaryLabRefreshFactUrl(b.case_id),
      method: "POST",
      data: {
        kind: p.kind === "oneshot" ? "oneshot" : "action",
        event_index: p.kind === "oneshot" ? null : p.event_index,
      },
    })) as CommentaryLabCaseBundle;
    bundle.value = data;
    editingField.value = "";
    promptRenderKey.value += 1;
    toast("已同步 system/user/fact");
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    busy.value = false;
  }
}

async function applyRunBundle(
  data: CommentaryLabCaseBundle,
  doneMsg: string,
) {
  bundle.value = data;
  syncViewResultKey(data.result?.result_key);
  toast(doneMsg);
  await refreshList();
}

/** 前端超时或断连时，服务端可能已写完结果——再拉一次用例 */
async function recoverRunResult(caseId: string, err: unknown): Promise<boolean> {
  try {
    const data = (await requestJson({
      url: commentaryLabCaseUrl(caseId),
      timeoutMs: DEFAULT_REQ_TIMEOUT_MS,
    })) as CommentaryLabCaseBundle;
    const ba = data.result?.by_action || [];
    if (data.result && (ba.length || data.result.summary)) {
      await applyRunBundle(
        data,
        `请求已中断，但服务端已有结果（${modelLabel(data.result.model)}），已刷新`,
      );
      return true;
    }
  } catch {
    /* ignore recover errors */
  }
  toast(String((err as Error)?.message || err));
  return false;
}

async function onRun() {
  const b = bundle.value;
  const p = currentPrompt.value;
  if (!b || busy.value) return;
  if (!p) {
    toast("请先选中要测的点");
    return;
  }
  const caseId = b.case_id;
  busy.value = true;
  status.value =
    currentWay.value === "oneshot"
      ? `整手测试中（可能需数分钟）· ${selectedModel.value || "默认"}…`
      : `测试本点：${p.label || p.kind} · ${selectedModel.value || "默认"}…`;
  try {
    await requestJson({
      url: commentaryLabPromptsUrl(caseId),
      method: "PUT",
      data: { prompts: b.prompts },
    });
    const data = (await requestJson({
      url: commentaryLabRunUrl(caseId),
      method: "POST",
      data: {
        kind: p.kind,
        event_index: p.event_index,
        model: selectedModel.value || null,
      },
      timeoutMs: RUN_REQ_TIMEOUT_MS,
    })) as CommentaryLabCaseBundle;
    await applyRunBundle(
      data,
      `本点测试完成（${modelLabel(data.result?.model || selectedModel.value)}）`,
    );
  } catch (e) {
    await recoverRunResult(caseId, e);
  } finally {
    busy.value = false;
  }
}

async function onRunAll() {
  const b = bundle.value;
  if (!b || busy.value) return;
  const caseId = b.case_id;
  busy.value = true;
  status.value = `测试全部（可能需数分钟）· ${selectedModel.value || "默认"}…`;
  try {
    await requestJson({
      url: commentaryLabPromptsUrl(caseId),
      method: "PUT",
      data: { prompts: b.prompts },
    });
    const data = (await requestJson({
      url: commentaryLabRunUrl(caseId),
      method: "POST",
      data: {
        run_all: true,
        model: selectedModel.value || null,
      },
      timeoutMs: RUN_REQ_TIMEOUT_MS,
    })) as CommentaryLabCaseBundle;
    await applyRunBundle(
      data,
      `全部测试完成（${modelLabel(data.result?.model || selectedModel.value)}）`,
    );
  } catch (e) {
    await recoverRunResult(caseId, e);
  } finally {
    busy.value = false;
  }
}

async function onCopyResult() {
  const text = resultDisplayText.value;
  if (!text) return;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      await new Promise<void>((resolve, reject) => {
        uni.setClipboardData({
          data: text,
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });
    }
    toast("结果已复制");
  } catch {
    toast("复制失败，请手动选中右侧文本");
  }
}

function ttsPlainText(): string {
  const res = activeResult.value;
  if (!res) return "";
  const ba = res.by_action || [];
  const focusEi = focusEventIndex.value;
  const p = currentPrompt.value;
  const parts: string[] = [];

  if (focusEi != null) {
    const hit = ba.find((row) => Number(row.event_index) === focusEi);
    if (hit?.text) parts.push(String(hit.text));
  } else if (p && p.kind !== "oneshot" && currentWay.value !== "oneshot") {
    const hit = ba.find((row) => row.event_index === p.event_index);
    if (hit?.text) parts.push(String(hit.text));
    else ba.forEach((row) => {
      if (row.text) parts.push(String(row.text));
    });
  } else {
    ba.forEach((row) => {
      if (row.text) parts.push(String(row.text));
    });
  }
  if (res.summary && focusEi == null && (!p || p.kind === "oneshot")) {
    parts.push(String(res.summary));
  }
  return parts.join("。\n").trim();
}

function onTtsVoiceChange(e: Event) {
  const el = e.target as HTMLSelectElement | null;
  if (el?.value) ttsVoice.value = el.value;
}

function stopTtsAudio() {
  if (ttsAudio) {
    try {
      ttsAudio.pause();
    } catch {
      /* ignore */
    }
    ttsAudio = null;
  }
  if (ttsObjectUrl) {
    URL.revokeObjectURL(ttsObjectUrl);
    ttsObjectUrl = null;
  }
}

async function loadTtsVoices() {
  try {
    const data = (await requestJson({ url: commentaryLabTtsVoicesUrl() })) as {
      available?: boolean;
      default_voice?: string;
      voices?: { id: string; label: string }[];
      hint?: string | null;
    };
    ttsAvailable.value = Boolean(data.available);
    if (Array.isArray(data.voices) && data.voices.length) {
      ttsVoices.value = data.voices;
    }
    if (data.default_voice) ttsVoice.value = data.default_voice;
    if (!data.available && data.hint) {
      status.value = data.hint;
    }
  } catch {
    ttsAvailable.value = false;
  }
}

async function onPlayTts() {
  if (ttsBusy.value) return;
  if (!ttsAvailable.value) {
    toast("未安装 edge-tts，请在 API 环境 pip install edge-tts 后重启");
    return;
  }
  const text = ttsPlainText();
  if (!text) {
    toast("当前没有可朗读的解说文本");
    return;
  }
  if (text.length > 4000) {
    toast("文本过长，请先点左侧某一关注点再试听");
    return;
  }
  ttsBusy.value = true;
  stopTtsAudio();
  try {
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      uni.request({
        url: commentaryLabTtsUrl(),
        method: "POST",
        data: {
          text,
          voice: ttsVoice.value,
          normalize: true,
          rate: "+0%",
        },
        responseType: "arraybuffer",
        timeout: 120000,
        success: (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            let detail = `HTTP ${res.statusCode}`;
            try {
              const dec = new TextDecoder().decode(res.data as ArrayBuffer);
              const j = JSON.parse(dec) as { detail?: string };
              if (j.detail) detail = String(j.detail);
            } catch {
              /* ignore */
            }
            reject(new Error(detail));
            return;
          }
          resolve(res.data as ArrayBuffer);
        },
        fail: (err) => reject(new Error(err.errMsg || "tts request failed")),
      });
    });
    const blob = new Blob([buf], { type: "audio/mpeg" });
    ttsObjectUrl = URL.createObjectURL(blob);
    ttsAudio = new Audio(ttsObjectUrl);
    await ttsAudio.play();
    toast("开始播放");
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    ttsBusy.value = false;
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadWays(), loadModels(), loadTtsVoices()]);
    await refreshList();
    if (cases.value[0]) await loadCase(cases.value[0].case_id);
  } catch (e) {
    toast(String((e as Error).message || e));
  }
});
</script>

<style>
html,
body,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body {
  height: 100% !important;
  overflow: hidden !important;
}
</style>

<style scoped lang="scss">
.lab {
  position: fixed;
  left: 0;
  right: 0;
  top: var(--window-top, 44px);
  bottom: 0;
  display: flex;
  overflow: hidden;
  background: #0b1220;
  color: #e5eef5;
  font-size: 14px;
}
.lab-sidebar {
  width: 300px;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid #1e2a3a;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lab-title {
  font-size: 18px;
  font-weight: 700;
}
.lab-sub {
  font-size: 12px;
  color: #8aa0b5;
}
.phh-input {
  height: 140px;
  background: #111a28;
  color: #d7e6f2;
  border: 1px solid #2a3b50;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
}
.title-input {
  background: #111a28;
  color: #d7e6f2;
  border: 1px solid #2a3b50;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
}
.way-pick {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-row {
  display: flex;
  gap: 8px;
}
.btn {
  font-size: 13px;
  background: #1c2b3d;
  color: #d7e6f2;
  border: none;
  border-radius: 6px;
  padding: 0 12px;
  height: 34px;
  line-height: 34px;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
}
.btn.primary {
  background: #1f4d3a;
}
.btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.status {
  font-size: 12px;
  color: #ffd27a;
  background: #1a2433;
  border-radius: 4px;
  padding: 6px 8px;
  white-space: pre-wrap;
}
.case-list {
  flex: 1 1 0;
  height: 0;
  min-height: 80px;
  overflow-y: scroll;
}
.case-item {
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  background: #111a28;
  cursor: pointer;
}
.case-item.active {
  outline: 1px solid #3d8f68;
}
.case-name {
  display: block;
  font-weight: 600;
}
.case-meta,
.case-time {
  display: block;
  font-size: 11px;
  color: #8aa0b5;
}
.lab-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #1e2a3a;
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}
.toolbar-title {
  font-weight: 700;
  font-size: 16px;
}
.model-pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.model-lab {
  font-size: 12px;
  color: #8aa0b5;
}
.model-select {
  background: #111a28;
  color: #d7e6f2;
  border: 1px solid #2a3b50;
  border-radius: 6px;
  height: 34px;
  padding: 0 8px;
  font-size: 13px;
  max-width: 200px;
}
.model-select:disabled {
  opacity: 0.5;
}
.model-last {
  font-size: 12px;
}
.field-hint.disabled {
  opacity: 0.45;
  pointer-events: none;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.work {
  flex: 1 1 0;
  height: 0;
  display: grid;
  grid-template-columns: 200px minmax(280px, 1fr) minmax(360px, 1.1fr);
  min-height: 0;
  overflow: hidden;
}
.col {
  border-right: 1px solid #1e2a3a;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.col-result {
  border-right: none;
}
.col-h {
  padding: 8px 12px;
  font-weight: 600;
  color: #b8c9d9;
  border-bottom: 1px solid #1e2a3a;
}
.result-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  flex-shrink: 0;
}
.result-head-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.result-head-title {
  flex-shrink: 0;
}
.result-head-tts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.model-select--compact {
  max-width: min(220px, 100%);
  height: 30px;
  font-size: 12px;
}
.tts-btn {
  flex-shrink: 0;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #2f6fed;
  border-radius: 6px;
  background: #1a3a6e;
  color: #d7e6f2;
  font-size: 12px;
  cursor: pointer;
}
.tts-btn:hover:not(:disabled) {
  background: #244a88;
}
.tts-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.prompt-hint {
  padding: 4px 12px 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #7a8fa3;
  border-bottom: 1px solid #1e2a3a;
}
.col-h-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.selectable,
.selectable * {
  user-select: text;
  -webkit-user-select: text;
}
.muted {
  color: #8aa0b5;
  font-weight: 400;
}
.spot-list,
.prompt-scroll,
.result-scroll {
  flex: 1 1 0;
  height: 0;
  min-height: 0;
  padding: 8px 12px 16px;
  overflow-x: hidden;
  overflow-y: scroll;
}
.field-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0 4px;
}
.field-lab {
  font-size: 12px;
  color: #8aa0b5;
}
.field-hint {
  font-size: 11px;
  color: #6d8296;
  cursor: pointer;
}
.field-action {
  color: #5b9fd4;
}
.spot-street {
  margin: 10px 0 4px;
  padding: 0 4px;
  font-size: 11px;
  color: #6d8296;
  letter-spacing: 0.04em;
}
.spot-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  background: #111a28;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  cursor: pointer;
}
.spot-item.active {
  outline: 1px solid #3d8f68;
}
.spot-item.locked {
  opacity: 0.62;
  background: transparent;
}
.spot-who {
  width: 4.2em;
  flex-shrink: 0;
  color: #8aa0b5;
  white-space: pre;
}
.spot-item.hero .spot-who {
  color: #7dcea0;
}
.spot-act {
  flex: 1;
  min-width: 0;
  color: #d7e6f2;
}
.spot-edited {
  font-size: 11px;
  color: #e0b35c;
  flex-shrink: 0;
}
.result-meta {
  font-size: 12px;
  color: #8aa0b5;
  margin-bottom: 8px;
}
.result-card {
  background: #111a28;
  border-radius: 8px;
  padding: 12px;
}
.result-text {
  margin: 0;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  color: #d7e6f2;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.empty {
  color: #8aa0b5;
  padding: 8px 0;
}
.lab-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8aa0b5;
}
</style>
