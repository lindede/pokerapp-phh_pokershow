<template>
  <div class="lab">
    <div class="lab-sidebar">
      <div class="lab-head">
        <div class="lab-title">复盘实验室</div>
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
            {{ c.has_result ? "已测" : "未测" }}
            · {{ c.n_prompts || 0 }} 点
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
          <span v-if="bundle.result_models?.length" class="model-last muted">
            已测 {{ bundle.result_models.length }} 个模型
          </span>
        </div>
        <div class="toolbar-actions">
          <div class="btn" :class="{ disabled: busy }" @click="onSavePrompts">保存提示词</div>
          <div class="btn" :class="{ disabled: busy }" @click="onResetPrompts">重置提示词</div>
          <div
            class="btn"
            :class="{ disabled: busy || !currentPrompt }"
            @click="onRefreshFact"
          >
            刷新本点
          </div>
          <div class="btn primary" :class="{ disabled: busy }" @click="onRun">
            {{ busy ? "测试中…" : "测试本点" }}
          </div>
        </div>
      </div>

      <div class="work">
        <div class="col col-spots">
          <div class="col-h">动作</div>
          <div class="spot-list">
            <template v-for="row in actionRows" :key="row.key">
              <div v-if="row.kind === 'street'" class="spot-street">
                {{ row.title }}
              </div>
              <div
                v-else
                class="spot-item"
                :class="{
                  active: row.promptIdx === promptIdx,
                  locked: row.promptIdx == null,
                  hero: row.who === 'hero',
                }"
                @click="onSelectSpot(row)"
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
              · {{ currentPrompt.kind }} #{{ currentPrompt.event_index }}
            </span>
          </div>
          <div class="prompt-hint">
            「刷新本点」同步 system、user、fact（含平衡视角）
            <span v-if="currentPrompt?.template_id" class="muted">
              · 模板 {{ currentPrompt.template_id }}
            </span>
            <span v-if="promptTemplateStale" class="prompt-stale">
              · 已过期，请点「刷新本点」
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
          <div class="col-h col-h-row">
            <span>测试结果</span>
            <label v-if="resultModelOptions.length" class="model-pick result-model-pick">
              <span class="model-lab">查看</span>
              <select
                class="model-select"
                :value="viewResultModel"
                @change="onViewResultModelChange"
              >
                <option
                  v-for="m in resultModelOptions"
                  :key="m.id"
                  :value="m.id"
                >
                  {{ m.label || m.id }}
                </option>
              </select>
            </label>
            <span
              v-if="currentResult"
              class="field-hint field-action"
              @click="onCopyResult"
            >复制</span>
          </div>
          <div class="result-scroll selectable">
            <div v-if="activeResultBundle" class="result-meta">
              {{ modelLabel(activeResultBundle.model || viewResultModel) }}
              <template v-if="activeResultBundle.ran_at">
                · {{ activeResultBundle.ran_at }}
              </template>
            </div>
            <div v-if="currentResult" class="result-card">
              <pre class="result-text">{{
                formatResultText(currentResult, resultWarnings)
              }}</pre>
            </div>
            <div v-else class="empty">
              {{
                resultModelOptions.length
                  ? "该模型尚未测此动作"
                  : "尚未测试，或该动作无结果"
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
import { computed, onMounted, ref, watch } from "vue";
import NativeMultiline from "@/components/NativeMultiline.vue";
import {
  labCaseUrl,
  labCasesUrl,
  labModelsUrl,
  labPromptsUrl,
  labPromptTemplateUrl,
  labRefreshFactUrl,
  labResetPromptsUrl,
  labRunUrl,
} from "@/config/review-lab-api";
import type {
  LabCaseBundle,
  LabCaseListItem,
  LabDraftEvent,
  LabModelOption,
  LabPromptRow,
  LabReviewRow,
} from "@/types/review-lab";

const MODEL_STORAGE_KEY = "review-lab-selected-model";

const cases = ref<LabCaseListItem[]>([]);
const selectedId = ref("");
const bundle = ref<LabCaseBundle | null>(null);
const promptIdx = ref(0);
const phhText = ref("");
const newTitle = ref("");
const status = ref("");
const busy = ref(false);
const editingField = ref<"" | "system" | "user" | "fact">("");
/** 强制重绘提示词区（避免 pre 组件偶发不刷新） */
const promptRenderKey = ref(0);
const expectedDecisionTemplateId = ref("");
const modelOptions = ref<LabModelOption[]>([]);
const selectedModel = ref("");
const defaultModel = ref("");
/** 右侧结果区当前查看的模型（可与跑测模型不同，便于对比） */
const viewResultModel = ref("");

const currentPrompt = computed(() => bundle.value?.prompts[promptIdx.value] ?? null);
const promptTemplateStale = computed(() => {
  const p = currentPrompt.value;
  const exp = expectedDecisionTemplateId.value;
  if (!p || p.kind === "summary" || !exp) return false;
  return (p.template_id || "") !== exp;
});

type ActionRow =
  | { kind: "street"; key: string; title: string }
  | {
      kind: "action";
      key: string;
      who: string;
      act: string;
      promptIdx: number | null;
      edited?: boolean;
    };

const STREET_ZH: Record<string, string> = {
  preflop: "翻前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
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

function formatAct(e: LabDraftEvent): string {
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

const actionRows = computed((): ActionRow[] => {
  const b = bundle.value;
  if (!b) return [];
  const prompts = b.prompts || [];
  const events = (b.draft?.by_action || []) as LabDraftEvent[];
  const heroSi = b.draft?.hero_seat_index ?? b.meta.hero_seat_index ?? 0;
  const decisionPromptIdxs: number[] = [];
  let summaryIdx: number | null = null;
  prompts.forEach((p, i) => {
    if (p.kind === "summary") summaryIdx = i;
    else decisionPromptIdxs.push(i);
  });
  const heroDecisionActs = new Set([
    "fold",
    "check",
    "call",
    "bet",
    "raise",
    "all_in",
    "allin",
  ]);

  const rows: ActionRow[] = [];
  if (!events.length) {
    prompts.forEach((p, i) => {
      rows.push({
        kind: "action",
        key: `p-${i}`,
        who: p.kind === "summary" ? "hero" : "hero",
        act: p.label || p.kind,
        promptIdx: i,
        edited: !!p.edited,
      });
    });
    return rows;
  }

  let lastStreet = "";
  let heroDec = 0;
  events.forEach((e, i) => {
    const action = (e.action || "").toLowerCase();
    if (action === "deal_hole") return;
    const street = e.street || "";
    if (action === "deal_board") {
      const title = `${STREET_ZH[street] || street} ${e.cards || ""}`.trim();
      rows.push({ kind: "street", key: `st-${i}`, title });
      lastStreet = street;
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
      : String(e.seat_name || (e.seat_index != null ? `P${e.seat_index + 1}` : "—"));
    const ei = e.event_index;
    const isHeroDecision =
      isHero && heroDecisionActs.has((e.action || "").toLowerCase());
    const pi = isHeroDecision
      ? decisionPromptIdxs[heroDec++] ?? null
      : null;
    const edited = pi != null ? !!prompts[pi]?.edited : false;
    rows.push({
      kind: "action",
      key: `a-${ei ?? i}`,
      who,
      act: formatAct(e),
      promptIdx: pi ?? null,
      edited,
    });
  });
  if (summaryIdx != null) {
    rows.push({
      kind: "action",
      key: "summary",
      who: "hero",
      act: prompts[summaryIdx]?.label || "整手总结",
      promptIdx: summaryIdx,
      edited: !!prompts[summaryIdx]?.edited,
    });
  }
  return rows;
});

const activeResultBundle = computed(() => {
  const b = bundle.value;
  if (!b) return null;
  const mid = viewResultModel.value;
  const by = b.results_by_model || {};
  if (mid && by[mid]) return by[mid];
  if (mid && b.result?.model === mid) return b.result;
  return b.result ?? null;
});

const currentResult = computed((): LabReviewRow | null => {
  const b = bundle.value;
  const p = currentPrompt.value;
  const reviews = activeResultBundle.value?.reviews;
  if (!b || !p || !reviews?.length) return null;
  if (p.kind === "summary") {
    return reviews.find((r) => r.kind === "summary") ?? null;
  }
  return (
    reviews.find(
      (r) => r.kind !== "summary" && r.event_index === p.event_index
    ) ?? null
  );
});

const resultWarnings = computed(
  () => activeResultBundle.value?.warnings ?? []
);

function modelLabel(id: string | null | undefined): string {
  const mid = String(id || "").trim();
  if (!mid) return "—";
  const hit = modelOptions.value.find((m) => m.id === mid);
  return hit?.label || mid;
}

const resultModelOptions = computed((): LabModelOption[] => {
  const ids = bundle.value?.result_models || [];
  const catalog = new Map(
    modelOptions.value.map((m) => [m.id, m.label || m.id])
  );
  return ids.map((id) => ({
    id,
    label: catalog.get(id) || id,
  }));
});

function syncViewResultModel(preferred?: string | null) {
  const ids = bundle.value?.result_models || [];
  if (!ids.length) {
    viewResultModel.value = "";
    return;
  }
  const want = String(preferred || viewResultModel.value || "").trim();
  if (want && ids.includes(want)) {
    viewResultModel.value = want;
    return;
  }
  const last = String(bundle.value?.meta?.model || "").trim();
  if (last && ids.includes(last)) {
    viewResultModel.value = last;
    return;
  }
  viewResultModel.value = ids[0];
}

function onViewResultModelChange(e: any) {
  const v = inputVal(e).trim();
  if (!v) return;
  viewResultModel.value = v;
}

function formatResultText(
  row: LabReviewRow,
  warnings: string[] = []
): string {
  const lines: string[] = [
    `评价: ${row.verdict || "—"}`,
    `实际: ${row.actual?.label || "—"}`,
    `推荐: ${row.recommend?.label || "—"}`,
  ];
  const reasons = row.reasons || [];
  if (reasons.length) {
    lines.push("", "reasons:");
    reasons.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }
  const bal = row.balance;
  if (bal?.notes?.length) {
    lines.push("", "平衡视角:");
    if (bal.alt?.label) lines.push(`混合可选: ${bal.alt.label}`);
    bal.notes.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
  }
  if (warnings.length) {
    lines.push("", "warnings:");
    warnings.forEach((w) => lines.push(`- ${w}`));
  }
  return lines.join("\n");
}

async function onCopyResult() {
  const row = currentResult.value;
  if (!row) return;
  const text = formatResultText(row, resultWarnings.value);
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
    toast("测试结果已复制");
  } catch {
    toast("复制失败，请手动选中右侧文本");
  }
}

function inputVal(e: any): string {
  return String(e?.detail?.value ?? e?.target?.value ?? "");
}

function startEdit(field: "system" | "user" | "fact") {
  editingField.value = field;
}

function stopEdit() {
  editingField.value = "";
}

function onSelectSpot(row: ActionRow) {
  if (row.kind !== "action" || row.promptIdx == null) return;
  promptIdx.value = row.promptIdx;
}

function setField(field: "system" | "user" | "fact", val: string) {
  const b = bundle.value;
  if (!b) return;
  const i = promptIdx.value;
  const row = b.prompts[i];
  if (!row) return;
  b.prompts[i] = { ...row, [field]: val, edited: true };
}

watch(promptIdx, () => {
  editingField.value = "";
});
watch(selectedId, () => {
  editingField.value = "";
});

function toast(msg: string) {
  status.value = msg;
  uni.showToast({ title: msg.slice(0, 40), icon: "none", duration: 2500 });
}

function requestJson(opts: {
  url: string;
  method?: "GET" | "POST" | "PUT";
  data?: unknown;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: opts.url,
      method: opts.method || "GET",
      data: opts.data as Record<string, unknown> | undefined,
      header: { "Content-Type": "application/json" },
      timeout: 180000,
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
  const data = await requestJson({ url: labCasesUrl() });
  cases.value = Array.isArray(data.cases) ? data.cases : [];
}

async function loadPromptTemplate() {
  try {
    const data = await requestJson({ url: labPromptTemplateUrl() });
    expectedDecisionTemplateId.value =
      data?.decision?.template_id || "";
  } catch {
    expectedDecisionTemplateId.value = "";
  }
}

async function loadModels() {
  try {
    const data = await requestJson({ url: labModelsUrl() });
    const list = Array.isArray(data?.models) ? data.models : [];
    modelOptions.value = list
      .map((m: any) => ({
        id: String(m?.id || "").trim(),
        label: String(m?.label || m?.id || "").trim(),
      }))
      .filter((m: LabModelOption) => !!m.id);
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
    selectedModel.value = selectedModel.value || "glm-5.1";
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

async function loadCase(id: string) {
  const data = (await requestJson({ url: labCaseUrl(id) })) as LabCaseBundle;
  bundle.value = data;
  selectedId.value = id;
  promptIdx.value = 0;
  promptRenderKey.value += 1;
  syncViewResultModel(data.meta?.model || selectedModel.value);
}

async function onSelect(id: string) {
  status.value = "";
  try {
    await loadCase(id);
  } catch (e) {
    toast(String((e as Error).message || e));
  }
}

function onPhhInput(e: any) {
  phhText.value = inputVal(e);
}

function onTitleInput(e: any) {
  newTitle.value = inputVal(e);
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
      url: labCasesUrl(),
      method: "POST",
      data: {
        phh_text: phhText.value,
        title: newTitle.value || undefined,
      },
    })) as LabCaseBundle;
    await refreshList();
    bundle.value = data;
    selectedId.value = data.case_id;
    promptIdx.value = 0;
    toast("已添加用例");
  } catch (e) {
    toast(String((e as Error).message || e));
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
      url: labPromptsUrl(b.case_id),
      method: "PUT",
      data: { prompts: b.prompts },
    })) as LabCaseBundle;
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
      url: labResetPromptsUrl(b.case_id),
      method: "POST",
    })) as LabCaseBundle;
    bundle.value = data;
    promptRenderKey.value += 1;
    toast("已从规则层重新生成提示词");
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
  editingField.value = "";
  try {
    const data = (await requestJson({
      url: labRefreshFactUrl(b.case_id),
      method: "POST",
      data: {
        kind: p.kind === "summary" ? "summary" : "decision",
        event_index: p.kind === "summary" ? null : p.event_index,
      },
    })) as LabCaseBundle;
    bundle.value = data;
    promptRenderKey.value += 1;
    const hasBal =
      typeof data.prompts?.[promptIdx.value]?.fact === "string" &&
      data.prompts[promptIdx.value].fact.includes("平衡视角");
    toast(hasBal ? "已同步 system/user/fact（含平衡视角）" : "已同步 system/user/fact");
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    busy.value = false;
  }
}

async function onRun() {
  const b = bundle.value;
  const p = currentPrompt.value;
  if (!b || busy.value) return;
  if (!p) {
    toast("请先选中要测的动作");
    return;
  }
  busy.value = true;
  status.value = `测试本点：${p.label || p.kind} · ${selectedModel.value || "默认"}…`;
  try {
    await requestJson({
      url: labPromptsUrl(b.case_id),
      method: "PUT",
      data: { prompts: b.prompts },
    });
    const data = (await requestJson({
      url: labRunUrl(b.case_id),
      method: "POST",
      data: {
        kind: p.kind === "summary" ? "summary" : "decision",
        event_index: p.kind === "summary" ? null : p.event_index,
        model: selectedModel.value || null,
      },
    })) as LabCaseBundle;
    bundle.value = data;
    syncViewResultModel(data.result?.model || selectedModel.value);
    toast(`本点测试完成（${modelLabel(data.result?.model || selectedModel.value)}）`);
    await refreshList();
  } catch (e) {
    toast(String((e as Error).message || e));
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadPromptTemplate(), loadModels()]);
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
  height: 160px;
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
.result-model-pick {
  margin-left: auto;
  margin-right: 8px;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.work {
  flex: 1 1 0;
  height: 0;
  display: grid;
  grid-template-columns: 200px 1fr 340px;
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
.prompt-hint {
  padding: 4px 12px 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #7a8fa3;
  border-bottom: 1px solid #1e2a3a;
}
.prompt-stale {
  color: #fbbf24;
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
.field-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-action {
  color: #5b9fd4;
}
.field-action.disabled {
  opacity: 0.45;
  pointer-events: none;
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
}
.spot-item.active {
  outline: 1px solid #3d8f68;
}
.spot-item.locked {
  opacity: 0.62;
  cursor: default;
  background: transparent;
}
.spot-item:not(.locked) {
  cursor: pointer;
}
.spot-who {
  width: 4.2em;
  flex-shrink: 0;
  color: #8aa0b5;
  white-space: pre;
}
.spot-item.hero .spot-who {
  color: #7dcea0;
  font-weight: 600;
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
.empty,
.warn {
  color: #8aa0b5;
  padding: 8px 0;
}
.warn {
  color: #e0b35c;
}
.lab-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8aa0b5;
}
</style>
