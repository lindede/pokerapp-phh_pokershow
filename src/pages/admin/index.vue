<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="true">
      <view class="page-inner">
        <view v-if="restoring" class="panel">
          <text class="title">数据管理</text>
          <text class="hint">正在验证管理员身份…</text>
        </view>
        <view v-else-if="isLoggedIn" class="session-bar">
          <text class="title session-title">数据管理</text>
          <view class="session-actions">
            <text class="session-ok">管理员已登录</text>
            <view class="logout-btn" @tap="logout">
              <text class="logout-btn-txt">退出</text>
            </view>
          </view>
        </view>
        <template v-else-if="!restoring">
          <text class="title">数据管理</text>
          <view class="panel">
            <text class="label">Admin Token</text>
            <input
              class="input"
              v-model="adminToken"
              password
              placeholder="与服务器 PLATFORM_ADMIN_TOKEN 一致"
              :disabled="verifying"
              @confirm="login"
            />
            <text v-if="authError" class="auth-error">{{ authError }}</text>
            <button class="btn" :loading="verifying" :disabled="verifying" @tap="login">
              登录
            </button>
          </view>
        </template>

        <template v-if="isLoggedIn">
        <view class="adm-nav">
          <text class="adm-nav-item" :class="{ on: tab === 'categories' }" @tap="onTab('categories')"
            >应用分类</text
          >
          <text class="adm-nav-item" :class="{ on: tab === 'spots' }" @tap="onTab('spots')">点位</text>
          <text class="adm-nav-item" :class="{ on: tab === 'content' }" @tap="onTab('content')">发布</text>
          <text class="adm-nav-item" :class="{ on: tab === 'credits' }" @tap="onTab('credits')"
            >信用与卡密</text
          >
          <text class="adm-nav-item" :class="{ on: tab === 'jobs' }" @tap="onTab('jobs')">任务</text>
        </view>

        <view v-if="tab === 'categories'" class="panel">
          <view class="adm-panel-head">
            <text class="adm-panel-title">应用分类</text>
            <text class="adm-panel-desc"
              >面向用户的分类（app_data/catalog）。在「点位」勾选原料后创建；这里设门槛并生成解说。</text
            >
          </view>
          <input
            class="input adm-search"
            v-model="categoryQuery"
            placeholder="搜索 code / 名称"
            @confirm="loadCategories"
          />
          <button class="btn btn--ghost" @tap="loadCategories">刷新分类</button>
          <text v-if="!categories.length" class="hint"
            >暂无应用分类。请到「点位」勾选后点「创建分类」。</text
          >
          <view v-for="c in categories" :key="c.category_code" class="cat-row">
            <view class="cat-row-head">
              <view class="cat-row-main">
                <view class="cat-row-top">
                  <text class="cat-row-title">{{ c.display_name || c.category_code }}</text>
                  <text v-if="c.is_experience" class="cat-tag">体验</text>
                  <text v-if="!c.in_catalog" class="cat-tag cat-tag--muted">仅库</text>
                  <text class="cat-row-count">{{ c.hand_count }} 手</text>
                </view>
                <text class="cat-row-code">{{ c.category_code }}</text>
              </view>
              <view class="cat-row-threshold">
                <input
                  class="cat-threshold"
                  type="number"
                  :value="String(c.access_threshold)"
                  :disabled="c.is_experience"
                  placeholder="门槛"
                  @input="onThresholdInput(c, $event)"
                />
              </view>
            </view>
            <view class="cat-row-actions">
              <button
                class="btn btn--sm btn--ghost cat-btn"
                @tap="c.is_experience = !c.is_experience"
              >
                {{ c.is_experience ? "取消体验" : "标为体验" }}
              </button>
              <button class="btn btn--sm cat-btn" @tap="saveCategory(c)">保存</button>
              <button class="btn btn--sm btn--ghost cat-btn" @tap="openHandsSheet(c)">
                编辑
              </button>
              <button
                class="btn btn--sm btn--ghost cat-btn"
                :disabled="!c.hand_count"
                @tap="openGenerateSheetForCategory(c)"
              >
                生成解说
              </button>
              <button
                v-if="!c.in_catalog"
                class="btn btn--sm btn--danger-ghost cat-btn"
                @tap="deleteCategory(c)"
              >
                删除
              </button>
            </view>
          </view>
          <text class="label">新增自定义 code（无点位采样时）</text>
          <input class="input" v-model="newCategoryCode" placeholder="如 experience" />
          <button class="btn btn--ghost" @tap="addCategoryRow">加入列表后保存门槛</button>
        </view>

        <view v-if="tab === 'spots'" class="panel">
          <view class="adm-panel-head">
            <text class="adm-panel-title">Hero 点位 · 选料</text>
            <text class="adm-panel-desc"
              >勾选点位后可「创建分类」或「追加到分类」。删手牌请到应用分类 · 编辑。</text
            >
          </view>

          <view class="spot-select-bar">
            <AdminCheck
              :model-value="allFilteredSelected"
              :indeterminate="someFilteredSelected && !allFilteredSelected"
              :disabled="!filteredSpots.length"
              @update:model-value="toggleSelectAllFiltered"
            >
              <text>全选当前列表</text>
              <text class="adm-muted">（{{ filteredSpots.length }} 格）</text>
            </AdminCheck>
            <text v-if="selectedSpotCodes.length" class="adm-text-btn" @tap="clearSpotSelection"
              >清空已选</text
            >
          </view>

          <view v-if="selectedSpotCodes.length" class="adm-selection-summary">
            已选 {{ selectedSpotCodes.length }} 格 · 目录 {{ selectedSpotHandSum }} 手
          </view>

          <view class="spot-actions">
            <button
              class="btn spot-gen-btn"
              :disabled="!selectedSpotCodes.length"
              @tap="openCreateAppCategorySheet"
            >
              创建分类
            </button>
            <button
              class="btn btn--ghost"
              :disabled="!selectedSpotCodes.length"
              @tap="openAppendToCategorySheet"
            >
              追加到分类
            </button>
            <button class="btn btn--ghost" @tap="loadSpots">刷新</button>
          </view>

          <text v-if="spotList" class="adm-panel-meta"
            >catalog 共 {{ spotList.bucket_count }} 格 · {{ spotList.spot_rows }} 条记录</text
          >

          <view class="adm-filter-tabs">
            <text
              v-for="p in spotPositions"
              :key="p || 'all'"
              class="adm-filter-tab"
              :class="{ on: spotPosition === p }"
              @tap="spotPosition = p"
              >{{ p || "全部" }}</text
            >
          </view>
          <input class="input adm-search" v-model="spotHandQuery" placeholder="起手过滤，如 AA / AKs / AKo" />

          <text v-if="!filteredSpots.length" class="hint">{{
            spotList ? "没有匹配的点位" : "点刷新加载 catalog/spots"
          }}</text>

          <view class="spot-list">
            <view
              v-for="s in filteredSpots"
              :key="s.code"
              class="spot-row"
              :class="{ 'spot-row--on': isSpotSelected(s.code) }"
              @tap="toggleSpotSelect(s.code)"
            >
              <AdminCheck
                :model-value="isSpotSelected(s.code)"
                @update:model-value="(on) => setSpotSelected(s.code, on)"
              />
              <view class="spot-row-body">
                <view class="spot-row-top">
                  <text class="spot-row-title">{{ s.position }} · {{ s.starting_hand }}</text>
                  <text class="spot-row-count">{{ s.hand_count }} 手</text>
                </view>
                <text class="spot-row-code">{{ s.code }}</text>
                <text class="adm-text-btn spot-row-link" @tap.stop="openSpot(s.code)">{{
                  openSpotCode === s.code ? "收起指针" : "查看指针"
                }}</text>
                <view v-if="openSpotCode === s.code" class="spot-hands" @tap.stop>
                  <text v-if="spotLoading" class="hint">加载中…</text>
                  <text v-for="(h, hi) in spotHands" :key="hi" class="spot-hand-line"
                    >{{ h.phhs_key }} · i={{ h.i }} · hero_seat={{ h.hero_seat }} · slug={{ h.i }}-{{
                      h.hero_seat
                    }}</text
                  >
                  <text
                    v-if="spotDetail && spotHands.length < spotDetail.hand_count"
                    class="adm-text-btn"
                    @tap="loadMoreSpotHands"
                    >再加载（{{ spotHands.length }}/{{ spotDetail.hand_count }}）</text
                  >
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="tab === 'content'" class="panel">
          <text class="hint">解说在「应用分类」生成到磁盘后，在这里导入索引，再内测 A / 全员 B。</text>
          <button class="btn" @tap="importDisk">从磁盘导入解说索引</button>
          <input
            class="input adm-search"
            v-model="contentSpotFilter"
            placeholder="按 spot_code 筛选，如 …_BTN_AA"
            @confirm="loadContent"
          />
          <button class="btn btn--ghost" @tap="loadContent">刷新列表</button>
          <view v-for="c in contentItems" :key="c.id" class="adm-card">
            <view class="adm-card-head">
              <text class="adm-card-title">#{{ c.id }} · {{ c.kind }}</text>
              <AdminBadge :label="c.status" :tone="contentStatusTone(c.status)" />
            </view>
            <text class="adm-card-mono">{{ c.external_key.slice(0, 36) }}…</text>
            <text v-if="contentSpotCode(c)" class="adm-card-mono">spot {{ contentSpotCode(c) }}</text>
            <view class="adm-card-actions">
              <button class="btn btn--sm btn--ghost" @tap="setStatus(c.id, 'staged')">内测 A</button>
              <button class="btn btn--sm" @tap="setStatus(c.id, 'published')">全员 B</button>
              <button class="btn btn--sm btn--danger-ghost" @tap="setStatus(c.id, 'archived')">下线</button>
            </view>
          </view>
        </view>

        <view v-if="tab === 'credits'" class="panel">
          <text class="label">新用户赠送</text>
          <input class="input" v-model="cfgGrant" type="number" placeholder="赠送信用" />
          <text class="label">复盘每次扣分</text>
          <input class="input" v-model="cfgCost" type="number" placeholder="复盘扣分" />
          <button class="btn" @tap="saveConfig">保存信用规则</button>

          <text class="label">查用户 @号（不含 @）</text>
          <input class="input" v-model="lookupPublicId" type="number" placeholder="384729" />
          <button class="btn btn--ghost" @tap="lookupUser">查询</button>
          <view v-if="lookedUser" class="row">
            <text class="row-id"
              >{{ lookedUser.display_id }} 余额 {{ lookedUser.credit_balance }} / 有效
              {{ lookedUser.effective_balance }}</text
            >
            <text class="row-key">内测 {{ lookedUser.is_beta_tester ? "是" : "否" }}</text>
            <input class="input" v-model="grantAmount" type="number" placeholder="赠送数量" />
            <view class="row-actions">
              <text class="link" @tap="grantUser">赠送</text>
              <text class="link" @tap="toggleBeta">{{
                lookedUser.is_beta_tester ? "取消内测" : "标为内测"
              }}</text>
            </view>
          </view>

          <text class="label">闲鱼卡密批次</text>
          <input class="input" v-model="batchId" placeholder="批次 ID" />
          <input class="input" v-model="batchCount" type="number" placeholder="数量" />
          <input class="input" v-model="batchAmount" type="number" placeholder="面值" />
          <button class="btn" @tap="createBatch">生成卡密（立刻下载 CSV）</button>
          <text v-for="(code, i) in batchCodes" :key="i" class="code-line">{{ code }}</text>
          <text class="label">作废未兑换码</text>
          <input class="input" v-model="revokeCode" placeholder="PKS-XXXX-…" />
          <button class="btn btn--ghost" @tap="revokeVoucher">作废</button>
        </view>

        <view v-if="tab === 'jobs'" class="panel">
          <button class="btn btn--ghost" @tap="loadJobs">刷新任务</button>
          <view v-for="j in jobs" :key="j.id" class="adm-card">
            <view class="adm-card-head">
              <text class="adm-card-title">#{{ j.id }} {{ jobTypeLabel(j.job_type) }}</text>
              <AdminBadge :label="j.status" :tone="jobStatusTone(j.status)" />
            </view>
            <text class="adm-card-sub">{{ jobProgressLine(j) }}</text>
            <text v-if="jobResultLine(j)" class="hint">{{ jobResultLine(j) }}</text>
            <text v-for="(line, ei) in jobErrorLines(j)" :key="ei" class="err">{{ line }}</text>
            <text v-if="j.error_message" class="err">{{ j.error_message }}</text>
          </view>
        </view>
        </template>
      </view>
    </scroll-view>
    <view v-if="generateSheetOpen" class="sheet-mask" @tap="closeGenerateSheet">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <view class="sheet-head-text">
            <text class="sheet-title">生成解说任务</text>
            <text class="sheet-sub">{{
              generateTarget
                ? `${generateTarget.display_name || generateTarget.category_code} · 确认参数后排队`
                : "确认参数后排队，Worker 在跑才会执行"
            }}</text>
          </view>
          <view class="sheet-close" @tap="closeGenerateSheet">
            <text class="sheet-close-txt">×</text>
          </view>
        </view>

        <view class="sheet-stats">
          <view class="sheet-stat">
            <text class="sheet-stat-val sheet-stat-val--code">{{
              generateTarget?.category_code || "—"
            }}</text>
            <text class="sheet-stat-lab">应用分类</text>
          </view>
          <view class="sheet-stat-div" />
          <view class="sheet-stat">
            <text class="sheet-stat-val">{{ generateTargetHandCount }}</text>
            <text class="sheet-stat-lab">分类手数</text>
          </view>
          <view class="sheet-stat-div" />
          <view class="sheet-stat sheet-stat--accent">
            <text class="sheet-stat-val">{{ plannedGenerateCount }}</text>
            <text class="sheet-stat-lab">本批生成</text>
          </view>
        </view>

        <view class="sheet-section">
          <text class="sheet-section-title">模型</text>
          <picker
            :range="generateModelLabels"
            :value="generateModelIndex"
            @change="onGenerateModelChange"
          >
            <view class="sheet-picker">
              <view class="sheet-picker-main">
                <text
                  class="sheet-badge"
                  :class="generateModelId === 'dummy' ? 'sheet-badge--dummy' : 'sheet-badge--llm'"
                  >{{ generateModelId === "dummy" ? "模板" : "LLM" }}</text
                >
                <text class="sheet-picker-label">{{ generateModelLabel }}</text>
              </view>
              <text class="sheet-picker-chevron">›</text>
            </view>
          </picker>
        </view>

        <view class="sheet-section">
          <view class="sheet-field-head">
            <text class="sheet-section-title sheet-section-title--inline">本批最多生成</text>
            <text
              class="sheet-chip"
              :class="{ on: isAllHandsLimit }"
              @tap="setGenerateLimitAllHands"
              >所有手</text
            >
          </view>
          <view class="sheet-inline">
            <input
              class="input sheet-input sheet-input--num"
              type="number"
              v-model="generateLimit"
              placeholder="10"
            />
            <text class="sheet-unit">手</text>
          </view>
          <text v-if="generateLimitCapNote" class="sheet-note">{{ generateLimitCapNote }}</text>
        </view>

        <view class="sheet-section">
          <text class="sheet-section-title">并发</text>
          <view class="sheet-inline">
            <input
              class="input sheet-input sheet-input--num"
              type="number"
              v-model="generateConcurrency"
              :placeholder="generateModelId === 'dummy' ? '16' : '4'"
            />
            <text class="sheet-unit">路</text>
          </view>
          <text class="sheet-note"
            >Dummy 可 16+；真模型建议 2–4。留空则用默认（Dummy 16 / LLM 4）。</text
          >
        </view>

        <view class="sheet-toggle-row" @tap="generateForce = !generateForce">
          <view class="sheet-toggle-copy">
            <text class="sheet-toggle-title">强制重跑</text>
            <text class="sheet-toggle-hint">已有制品也重新生成</text>
          </view>
          <view class="sheet-switch" :class="{ on: generateForce }">
            <view class="sheet-switch-knob" />
          </view>
        </view>

        <view class="sheet-foot">
          <button class="btn btn--ghost sheet-btn" :disabled="generating" @tap="closeGenerateSheet">
            取消
          </button>
          <button
            class="btn sheet-btn sheet-btn--primary"
            :loading="generating"
            :disabled="generating || plannedGenerateCount <= 0 || !generateTarget"
            @tap="startGenerateJob"
          >
            开始 · {{ plannedGenerateCount }} 手
          </button>
        </view>
      </view>
    </view>

    <view v-if="createCatSheetOpen" class="sheet-mask" @tap="closeCreateAppCategorySheet">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <view class="sheet-head-text">
            <text class="sheet-title">创建应用分类</text>
            <text class="sheet-sub">从已选点位采样手牌，写入 app_data/catalog</text>
          </view>
          <view class="sheet-close" @tap="closeCreateAppCategorySheet">
            <text class="sheet-close-txt">×</text>
          </view>
        </view>
        <view class="sheet-stats">
          <view class="sheet-stat">
            <text class="sheet-stat-val">{{ selectedSpotCodes.length }}</text>
            <text class="sheet-stat-lab">选中格</text>
          </view>
          <view class="sheet-stat-div" />
          <view class="sheet-stat">
            <text class="sheet-stat-val">{{ selectedSpotHandSum }}</text>
            <text class="sheet-stat-lab">原料手数</text>
          </view>
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">分类 code</text>
          <input class="input sheet-input" v-model="createCatCode" placeholder="如 beginner_btn" />
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">展示名</text>
          <input class="input sheet-input" v-model="createCatName" placeholder="新手 BTN" />
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">采样方式</text>
          <view class="adm-filter-tabs">
            <text
              class="adm-filter-tab"
              :class="{ on: createCatMode === 'per_spot' }"
              @tap="createCatMode = 'per_spot'"
              >每点位抽</text
            >
            <text
              class="adm-filter-tab"
              :class="{ on: createCatMode === 'total' }"
              @tap="createCatMode = 'total'"
              >合计抽</text
            >
          </view>
          <view class="sheet-inline" style="margin-top: 12rpx">
            <input
              class="input sheet-input sheet-input--num"
              type="number"
              v-model="createCatLimit"
              placeholder="空=全部"
            />
            <text class="sheet-unit">手</text>
          </view>
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">挑选</text>
          <view class="adm-filter-tabs">
            <text
              class="adm-filter-tab"
              :class="{ on: createCatPick === 'random' }"
              @tap="createCatPick = 'random'"
              >随机</text
            >
            <text
              class="adm-filter-tab"
              :class="{ on: createCatPick === 'sequential' }"
              @tap="createCatPick = 'sequential'"
              >顺序</text
            >
          </view>
        </view>
        <view class="sheet-actions">
          <button class="btn btn--ghost sheet-btn" @tap="closeCreateAppCategorySheet">取消</button>
          <button
            class="btn sheet-btn sheet-btn--primary"
            :loading="creatingCategory"
            :disabled="creatingCategory || !selectedSpotCodes.length"
            @tap="submitCreateAppCategory"
          >
            创建
          </button>
        </view>
      </view>
    </view>

    <view v-if="appendCatSheetOpen" class="sheet-mask" @tap="closeAppendToCategorySheet">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <view class="sheet-head-text">
            <text class="sheet-title">追加到已有分类</text>
            <text class="sheet-sub"
              >从已选 {{ selectedSpotCodes.length }} 格采样，跳过目标分类已有手</text
            >
          </view>
          <view class="sheet-close" @tap="closeAppendToCategorySheet">
            <text class="sheet-close-txt">×</text>
          </view>
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">目标分类</text>
          <scroll-view v-if="appendTargetOptions.length" class="append-cat-list" scroll-y>
            <view
              v-for="c in appendTargetOptions"
              :key="c.category_code"
              class="append-cat-row"
              :class="{ on: appendTargetCode === c.category_code }"
              @tap="appendTargetCode = c.category_code"
            >
              <text class="append-cat-name">{{ c.display_name || c.category_code }}</text>
              <text class="append-cat-meta">{{ c.hand_count }} 手 · {{ c.category_code }}</text>
            </view>
          </scroll-view>
          <text v-else class="hint">暂无应用分类，请先创建</text>
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">采样方式</text>
          <view class="adm-filter-tabs">
            <text
              class="adm-filter-tab"
              :class="{ on: appendCatMode === 'per_spot' }"
              @tap="appendCatMode = 'per_spot'"
              >每点位抽</text
            >
            <text
              class="adm-filter-tab"
              :class="{ on: appendCatMode === 'total' }"
              @tap="appendCatMode = 'total'"
              >合计抽</text
            >
          </view>
          <view class="sheet-inline" style="margin-top: 12rpx">
            <input
              class="input sheet-input sheet-input--num"
              type="number"
              v-model="appendCatLimit"
              placeholder="空=全部"
            />
            <text class="sheet-unit">手</text>
          </view>
        </view>
        <view class="sheet-section">
          <text class="sheet-section-title">挑选</text>
          <view class="adm-filter-tabs">
            <text
              class="adm-filter-tab"
              :class="{ on: appendCatPick === 'random' }"
              @tap="appendCatPick = 'random'"
              >随机</text
            >
            <text
              class="adm-filter-tab"
              :class="{ on: appendCatPick === 'sequential' }"
              @tap="appendCatPick = 'sequential'"
              >顺序</text
            >
          </view>
        </view>
        <view class="sheet-actions">
          <button class="btn btn--ghost sheet-btn" @tap="closeAppendToCategorySheet">取消</button>
          <button
            class="btn sheet-btn sheet-btn--primary"
            :loading="handsSaving"
            :disabled="
              handsSaving || !selectedSpotCodes.length || !appendTargetCode || !appendTargetOptions.length
            "
            @tap="submitAppendToCategory"
          >
            追加
          </button>
        </view>
      </view>
    </view>

    <view v-if="handsSheetOpen" class="sheet-mask" @tap="closeHandsSheet">
      <view class="sheet sheet--tall" @tap.stop>
        <view class="sheet-head">
          <view class="sheet-head-text">
            <text class="sheet-title">编辑 · {{ handsSheetTitle }}</text>
            <text class="sheet-sub"
              >{{ handsSheetHands.length }} 手 · 删除引用不影响已生成解说</text
            >
          </view>
          <view class="sheet-close" @tap="closeHandsSheet">
            <text class="sheet-close-txt">×</text>
          </view>
        </view>

        <view class="adm-filter-tabs hands-edit-tabs">
          <text
            class="adm-filter-tab"
            :class="{ on: handsEditTab === 'hands' }"
            @tap="handsEditTab = 'hands'"
            >按牌局</text
          >
          <text
            class="adm-filter-tab"
            :class="{ on: handsEditTab === 'spots' }"
            @tap="handsEditTab = 'spots'"
            >按点位采样</text
          >
        </view>

        <view v-if="handsEditTab === 'hands'" class="sheet-section">
          <view class="hands-toolbar">
            <text class="adm-text-btn" @tap="toggleSelectAllHands">
              {{ allHandsSelected ? "取消全选" : "全选手牌" }}
            </text>
            <button
              class="btn btn--sm btn--danger-ghost"
              :disabled="!handsSelectedKeys.length || handsSaving"
              :loading="handsSaving"
              @tap="removeSelectedHands"
            >
              删除所选 ({{ handsSelectedKeys.length }})
            </button>
          </view>
          <scroll-view v-if="handsBySpot.length" class="hands-list" scroll-y>
            <view v-for="g in handsBySpot" :key="g.spot" class="hands-spot-group">
              <view class="hands-spot-head" @tap="toggleSpotHandsSelect(g.spot)">
                <AdminCheck
                  :model-value="isSpotHandsFullySelected(g.spot)"
                  :indeterminate="isSpotHandsPartiallySelected(g.spot)"
                  @update:model-value="toggleSpotHandsSelect(g.spot)"
                />
                <view class="hands-spot-head-body">
                  <text class="hands-spot-code">{{ g.spot }}</text>
                  <text class="hands-spot-count">{{ g.hands.length }} 手</text>
                </view>
              </view>
              <view
                v-for="h in g.hands"
                :key="handKey(h)"
                class="hands-row"
                @tap="toggleHandSelect(h)"
              >
                <AdminCheck
                  :model-value="handsSelectedKeys.includes(handKey(h))"
                  @update:model-value="toggleHandSelect(h)"
                />
                <view class="hands-row-body">
                  <text class="hands-row-slug">{{ h.i }}-{{ h.hero_seat }}</text>
                  <text class="hands-row-key">{{ h.phhs_key }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
          <text v-else class="hint">本分类暂无手牌 · 请到「点位」追加</text>
        </view>

        <view v-else class="sheet-section">
          <text class="hint">勾选点位后，用采样方式 / 挑选删除本分类内手牌。</text>
          <view class="hands-toolbar" style="margin-top: 12rpx">
            <text class="adm-text-btn" @tap="toggleSelectAllRemoveSpots">
              {{ allRemoveSpotsSelected ? "取消全选点位" : "全选点位" }}
            </text>
            <text class="adm-muted">已选 {{ removeSpotCodes.length }} 格</text>
          </view>
          <scroll-view v-if="handsBySpot.length" class="append-cat-list" scroll-y>
            <view
              v-for="g in handsBySpot"
              :key="'rm-' + g.spot"
              class="append-cat-row"
              :class="{ on: removeSpotCodes.includes(g.spot) }"
              @tap="toggleRemoveSpot(g.spot)"
            >
              <AdminCheck
                :model-value="removeSpotCodes.includes(g.spot)"
                @update:model-value="toggleRemoveSpot(g.spot)"
              />
              <view class="hands-spot-head-body" style="margin-left: 12rpx">
                <text class="append-cat-name">{{ g.spot }}</text>
                <text class="append-cat-meta">{{ g.hands.length }} 手</text>
              </view>
            </view>
          </scroll-view>
          <text v-else class="hint">本分类暂无手牌 · 请到「点位」追加</text>
          <view class="sheet-section-title" style="margin-top: 20rpx">采样方式</view>
          <view class="adm-filter-tabs" style="margin-top: 8rpx">
            <text
              class="adm-filter-tab"
              :class="{ on: removeCatMode === 'per_spot' }"
              @tap="removeCatMode = 'per_spot'"
              >每点位抽</text
            >
            <text
              class="adm-filter-tab"
              :class="{ on: removeCatMode === 'total' }"
              @tap="removeCatMode = 'total'"
              >合计抽</text
            >
          </view>
          <view class="sheet-inline" style="margin-top: 12rpx">
            <input
              class="input sheet-input sheet-input--num"
              type="number"
              v-model="removeCatLimit"
              placeholder="空=全部"
            />
            <text class="sheet-unit">手</text>
          </view>
          <view class="sheet-section-title" style="margin-top: 16rpx">挑选</view>
          <view class="adm-filter-tabs" style="margin-top: 8rpx">
            <text
              class="adm-filter-tab"
              :class="{ on: removeCatPick === 'random' }"
              @tap="removeCatPick = 'random'"
              >随机</text
            >
            <text
              class="adm-filter-tab"
              :class="{ on: removeCatPick === 'sequential' }"
              @tap="removeCatPick = 'sequential'"
              >顺序</text
            >
          </view>
          <text v-if="removeSamplePreviewCount > 0" class="hint" style="margin-top: 12rpx"
            >将删除约 {{ removeSamplePreviewCount }} 手</text
          >
          <button
            class="btn btn--danger-ghost"
            style="margin-top: 16rpx"
            :disabled="!removeSpotCodes.length || handsSaving || removeSamplePreviewCount <= 0"
            :loading="handsSaving"
            @tap="removeSampledBySpots"
          >
            采样删除
          </button>
        </view>

        <view class="sheet-actions">
          <button class="btn btn--ghost sheet-btn" @tap="closeHandsSheet">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import AdminBadge from "@/components/admin/AdminBadge.vue";
import AdminCheck from "@/components/admin/AdminCheck.vue";
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  setAdminUnauthorizedHandler,
  verifyAdminToken,
  type AdminConfig,
  type AdminSpotDetail,
  type AdminSpotHand,
  type AdminSpotItem,
  type AdminSpotList,
  type AdminUser,
  type CatalogMeta,
  type CategoryPricingItem,
  type CommentaryModelItem,
  type ContentItem,
  type JobItem,
} from "@/config/admin-api";

type AdminTab = "categories" | "spots" | "content" | "credits" | "jobs";

const tab = ref<AdminTab>("categories");
const isLoggedIn = ref(false);
const verifying = ref(false);
const restoring = ref(Boolean(getAdminToken()));
const authError = ref("");
const adminToken = ref("");
const contentItems = ref<ContentItem[]>([]);
const contentSpotFilter = ref("");
const jobs = ref<JobItem[]>([]);
const categories = ref<CategoryPricingItem[]>([]);
const catalogMeta = ref<CatalogMeta | null>(null);
const categoryQuery = ref("");
const newCategoryCode = ref("");
const createCatSheetOpen = ref(false);
const creatingCategory = ref(false);
const createCatCode = ref("");
const createCatName = ref("");
const createCatMode = ref<"per_spot" | "total">("per_spot");
const createCatLimit = ref("");
const createCatPick = ref<"random" | "sequential">("random");
const handsSheetOpen = ref(false);
const handsSaving = ref(false);
const handsSheetCode = ref("");
const handsSheetTitle = ref("");
const handsSheetHands = ref<
  { phhs_key: string; i: number; hero_seat: number; spot_code?: string }[]
>([]);
const handsSelectedKeys = ref<string[]>([]);
const handsEditTab = ref<"hands" | "spots">("hands");
const removeSpotCodes = ref<string[]>([]);
const removeCatMode = ref<"per_spot" | "total">("per_spot");
const removeCatLimit = ref("");
const removeCatPick = ref<"random" | "sequential">("random");
const appendCatSheetOpen = ref(false);
const appendTargetCode = ref("");
const appendCatMode = ref<"per_spot" | "total">("per_spot");
const appendCatLimit = ref("");
const appendCatPick = ref<"random" | "sequential">("random");
const cfgGrant = ref("100");
const cfgCost = ref("10");
const lookupPublicId = ref("");
const lookedUser = ref<AdminUser | null>(null);
const grantAmount = ref("50");
const batchId = ref(`xy-${Date.now()}`);
const batchCount = ref("5");
const batchAmount = ref("100");
const batchCodes = ref<string[]>([]);
const revokeCode = ref("");
const spotList = ref<AdminSpotList | null>(null);
const spotPosition = ref("BTN");
const spotHandQuery = ref("");
const openSpotCode = ref("");
const spotDetail = ref<AdminSpotDetail | null>(null);
const spotHands = ref<AdminSpotHand[]>([]);
const spotLoading = ref(false);
const selectedSpotCodes = ref<string[]>([]);
const generateLimit = ref("10");
const generateForce = ref(false);
const generating = ref(false);
const generateSheetOpen = ref(false);
const generateTarget = ref<CategoryPricingItem | null>(null);
const generateConcurrency = ref("16");
const generateModelId = ref("dummy");
const commentaryModels = ref<CommentaryModelItem[]>([
  { id: "dummy", label: "DummyLLM（模板）", kind: "dummy" },
]);

const spotPositions = computed(() => {
  const fromApi = spotList.value?.positions?.length
    ? spotList.value.positions
    : ["SB", "BB", "UTG", "MP", "CO", "BTN"];
  return ["", ...fromApi];
});

const catalogMetaHint = computed(() => {
  return "应用分类存于 app_data/catalog；门槛在库表按需保存。";
});

const filteredSpots = computed(() => {
  let rows: AdminSpotItem[] = spotList.value?.buckets || [];
  if (spotPosition.value) {
    rows = rows.filter((s) => s.position === spotPosition.value);
  }
  const q = spotHandQuery.value.trim().toLowerCase();
  if (q) {
    rows = rows.filter((s) => s.starting_hand.toLowerCase().includes(q));
  }
  return rows.slice(0, 120);
});

const generateCap = computed(() => {
  const n = Number(generateLimit.value);
  if (!Number.isFinite(n)) return 10;
  return Math.min(500, Math.max(1, Math.floor(n)));
});

const generateConcurrencyCap = computed(() => {
  const n = Number(generateConcurrency.value);
  if (!Number.isFinite(n) || n <= 0) {
    return generateModelId.value === "dummy" ? 16 : 4;
  }
  return Math.min(32, Math.max(1, Math.floor(n)));
});

const generateModelLabels = computed(() =>
  commentaryModels.value.map((m) => m.label || m.id),
);

const generateModelIndex = computed(() => {
  const i = commentaryModels.value.findIndex((m) => m.id === generateModelId.value);
  return i >= 0 ? i : 0;
});

const generateModelLabel = computed(() => {
  const m = commentaryModels.value.find((x) => x.id === generateModelId.value);
  return m?.label || generateModelId.value;
});

const selectedSpotHandSum = computed(() => {
  const picked = new Set(selectedSpotCodes.value);
  return (spotList.value?.buckets || [])
    .filter((s) => picked.has(s.code))
    .reduce((n, s) => n + (s.hand_count || 0), 0);
});

const generateTargetHandCount = computed(() =>
  Math.max(0, generateTarget.value?.hand_count || 0),
);

const plannedGenerateCount = computed(() => {
  const total = generateTargetHandCount.value;
  if (total <= 0) return 0;
  return Math.min(generateCap.value, total);
});

const allFilteredSelected = computed(() => {
  const codes = filteredSpots.value.map((s) => s.code);
  return codes.length > 0 && codes.every((c) => selectedSpotCodes.value.includes(c));
});

const someFilteredSelected = computed(() =>
  filteredSpots.value.some((s) => selectedSpotCodes.value.includes(s.code)),
);

const generateLimitAllHands = computed(() => {
  const total = generateTargetHandCount.value;
  if (total <= 0) return 1;
  return Math.min(500, total);
});

const isAllHandsLimit = computed(
  () =>
    generateTargetHandCount.value > 0 && generateCap.value === generateLimitAllHands.value,
);

const generateLimitCapNote = computed(() => {
  const total = generateTargetHandCount.value;
  if (total <= 0) return "该分类没有手牌，无法生成";
  if (total > 500) {
    return `分类共 ${total} 手，单批上限 500；「所有手」会设为 500。`;
  }
  if (generateCap.value >= total) {
    return `将生成分类内全部 ${total} 手`;
  }
  return `分类共 ${total} 手，本批取列表前 ${generateCap.value} 手`;
});

function setGenerateLimitAllHands() {
  if (generateTargetHandCount.value <= 0) {
    uni.showToast({ title: "分类里没有手牌", icon: "none" });
    return;
  }
  generateLimit.value = String(generateLimitAllHands.value);
}

function isSpotSelected(code: string) {
  return selectedSpotCodes.value.includes(code);
}

function toggleSpotSelect(code: string) {
  setSpotSelected(code, !isSpotSelected(code));
}

function setSpotSelected(code: string, on: boolean) {
  if (on) {
    if (!isSpotSelected(code)) {
      selectedSpotCodes.value = [...selectedSpotCodes.value, code];
    }
    return;
  }
  selectedSpotCodes.value = selectedSpotCodes.value.filter((c) => c !== code);
}

function toggleSelectAllFiltered(on: boolean) {
  const codes = filteredSpots.value.map((s) => s.code);
  if (!codes.length) return;
  if (on) {
    selectedSpotCodes.value = [...new Set([...selectedSpotCodes.value, ...codes])];
    return;
  }
  const drop = new Set(codes);
  selectedSpotCodes.value = selectedSpotCodes.value.filter((c) => !drop.has(c));
}

function clearSpotSelection() {
  selectedSpotCodes.value = [];
}

function jobStatusTone(status: string) {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "info";
  if (status === "queued") return "muted";
  return "default";
}

function contentStatusTone(status: string) {
  if (status === "published") return "success";
  if (status === "staged") return "warn";
  if (status === "archived") return "muted";
  if (status === "draft") return "default";
  return "info";
}

function jobTypeLabel(jobType: string) {
  if (jobType === "generate_commentary_spots") return "生成解说";
  if (jobType === "generate_commentary_app_category") return "分类生成解说";
  if (jobType === "import_commentary_disk") return "导入解说索引";
  return jobType;
}

function jobProgressLine(j: JobItem) {
  const done = j.progress;
  const total = j.progress_total;
  if (
    j.job_type === "generate_commentary_spots" ||
    j.job_type === "generate_commentary_app_category"
  ) {
    return `${done}/${total} 手`;
  }
  return `${done}/${total}`;
}

function jobResultLine(j: JobItem) {
  const r = j.result;
  if (!r) return "";
  const parts: string[] = [];
  if (typeof r.generated === "number") parts.push(`新生成 ${r.generated}`);
  if (typeof r.skipped === "number") parts.push(`跳过 ${r.skipped}`);
  if (typeof r.skipped_inflight === "number" && r.skipped_inflight > 0) {
    parts.push(`他任务占用 ${r.skipped_inflight}`);
  }
  if (typeof r.failed === "number" && r.failed > 0) parts.push(`失败 ${r.failed}`);
  if (typeof r.imported === "number") parts.push(`导入 ${r.imported}`);
  if (typeof r.model === "string" && r.model) parts.push(String(r.model));
  return parts.join(" · ");
}

function jobErrorLines(j: JobItem) {
  const raw = j.result?.errors;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean).slice(0, 8);
}

async function login() {
  const token = adminToken.value.trim();
  if (!token) {
    authError.value = "请填写 Admin Token";
    return;
  }
  verifying.value = true;
  authError.value = "";
  try {
    const check = await verifyAdminToken(token);
    if (!check.ok) {
      authError.value = check.detail;
      uni.showToast({ title: check.detail, icon: "none" });
      return;
    }
    setAdminToken(token);
    adminToken.value = "";
    isLoggedIn.value = true;
    uni.showToast({ title: "已登录", icon: "success" });
    await loadWorkspace();
  } finally {
    verifying.value = false;
  }
}

function logout() {
  resetSession();
  uni.showToast({ title: "已退出", icon: "none" });
}

function resetSession() {
  clearAdminToken();
  isLoggedIn.value = false;
  authError.value = "";
  adminToken.value = "";
  categories.value = [];
  contentItems.value = [];
  jobs.value = [];
  lookedUser.value = null;
  batchCodes.value = [];
  spotList.value = null;
  openSpotCode.value = "";
  spotDetail.value = null;
  spotHands.value = [];
  selectedSpotCodes.value = [];
  generating.value = false;
  generateSheetOpen.value = false;
}

async function loadWorkspace() {
  await Promise.all([loadCategories(), loadContent(), loadJobs(), loadConfig()]);
}

function onTab(next: AdminTab) {
  tab.value = next;
  if (!isLoggedIn.value) return;
  if (next === "categories") loadCategories();
  if (next === "spots") loadSpots();
  if (next === "content") loadContent();
  if (next === "credits") loadConfig();
  if (next === "jobs") loadJobs();
}

function onThresholdInput(c: CategoryPricingItem, e: { detail?: { value?: string } }) {
  const n = Number(e.detail?.value ?? 0);
  c.access_threshold = Number.isFinite(n) ? Math.max(0, n) : 0;
}

function categoryLabel(c: CategoryPricingItem): string {
  if (c.position && c.starting_hand) {
    return `${c.position} · ${c.starting_hand}`;
  }
  const name = (c.display_name || "").trim();
  if (name && name !== c.category_code) {
    // Prefer short hand if display_name is a long path like "NLH / BB100 / … / BTN / 22"
    const parts = name.split(/\s*\/\s*/).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join(" · ");
    }
    return name;
  }
  return c.category_code;
}

function contentSpotCode(c: ContentItem): string {
  const v = c.meta?.spot_code;
  return typeof v === "string" ? v : "";
}

async function loadCategories() {
  const params = new URLSearchParams();
  params.set("limit", "200");
  params.set("taxonomy", "app");
  const q = categoryQuery.value.trim();
  if (q) params.set("q", q);
  categories.value = await adminFetch<CategoryPricingItem[]>(
    `/v3/admin/categories?${params.toString()}`,
  );
}

function openCreateAppCategorySheet() {
  if (!selectedSpotCodes.value.length) {
    uni.showToast({ title: "请先勾选点位", icon: "none" });
    return;
  }
  if (!createCatCode.value) {
    const first = selectedSpotCodes.value[0] || "app_cat";
    createCatCode.value = first.length > 40 ? `cat_${Date.now()}` : `app_${first}`;
  }
  if (!createCatName.value) createCatName.value = createCatCode.value;
  createCatSheetOpen.value = true;
}

function closeCreateAppCategorySheet() {
  createCatSheetOpen.value = false;
}

async function submitCreateAppCategory() {
  const code = createCatCode.value.trim();
  if (!code) {
    uni.showToast({ title: "请填写 code", icon: "none" });
    return;
  }
  creatingCategory.value = true;
  try {
    const limitRaw = createCatLimit.value.trim();
    const body: Record<string, unknown> = {
      code,
      name: createCatName.value.trim() || code,
      spot_codes: selectedSpotCodes.value,
      mode: createCatMode.value,
      pick: createCatPick.value,
      overwrite: false,
    };
    if (limitRaw) {
      const n = Number(limitRaw);
      if (Number.isFinite(n) && n > 0) body.limit = Math.floor(n);
    }
    const created = await adminFetch<{ code: string; hand_count: number }>(
      "/v3/admin/app-categories",
      { method: "POST", data: body },
    );
    createCatSheetOpen.value = false;
    uni.showToast({
      title: `已创建 ${created.hand_count} 手`,
      icon: "success",
    });
    tab.value = "categories";
    await loadCategories();
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : "创建失败",
      icon: "none",
    });
  } finally {
    creatingCategory.value = false;
  }
}

type AppHandRow = {
  phhs_key: string;
  i: number;
  hero_seat: number;
  spot_code?: string;
};

function handKey(h: AppHandRow): string {
  return `${h.phhs_key}|${h.i}|${h.hero_seat}`;
}

function spotKeyOf(h: AppHandRow): string {
  return (h.spot_code || "").trim() || "(未标注点位)";
}

const allHandsSelected = computed(
  () =>
    handsSheetHands.value.length > 0 &&
    handsSelectedKeys.value.length === handsSheetHands.value.length,
);

const handsBySpot = computed(() => {
  const map = new Map<string, AppHandRow[]>();
  for (const h of handsSheetHands.value) {
    const k = spotKeyOf(h);
    const arr = map.get(k);
    if (arr) arr.push(h);
    else map.set(k, [h]);
  }
  return [...map.entries()]
    .map(([spot, hands]) => ({ spot, hands }))
    .sort((a, b) => a.spot.localeCompare(b.spot));
});

const appendTargetOptions = computed(() => categories.value.filter((c) => c.in_catalog));

const allRemoveSpotsSelected = computed(
  () =>
    handsBySpot.value.length > 0 &&
    removeSpotCodes.value.length === handsBySpot.value.length,
);

function parseSampleLimit(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function pickSliceHands(items: AppHandRow[], limit: number | null, pick: "random" | "sequential"): AppHandRow[] {
  if (!items.length) return [];
  const ordered = [...items];
  if (pick === "random") {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ordered[i]!;
      ordered[i] = ordered[j]!;
      ordered[j] = tmp;
    }
  }
  if (limit == null || limit >= ordered.length) return ordered;
  return ordered.slice(0, limit);
}

function sampleHandsForRemove(): AppHandRow[] {
  const spots = removeSpotCodes.value;
  if (!spots.length) return [];
  const limit = parseSampleLimit(removeCatLimit.value);
  const pick = removeCatPick.value;
  const bySpot = spots.map((spot) => handsOfSpot(spot));
  if (removeCatMode.value === "total") {
    const pool: AppHandRow[] = [];
    for (const rows of bySpot) pool.push(...rows);
    return pickSliceHands(pool, limit, pick);
  }
  const out: AppHandRow[] = [];
  for (const rows of bySpot) {
    out.push(...pickSliceHands(rows, limit, pick));
  }
  return out;
}

const removeSamplePreviewCount = computed(() => sampleHandsForRemove().length);

async function openHandsSheet(c: CategoryPricingItem) {
  handsSheetCode.value = c.category_code;
  handsSheetTitle.value = c.display_name || c.category_code;
  handsSelectedKeys.value = [];
  handsEditTab.value = "hands";
  removeSpotCodes.value = [];
  removeCatMode.value = "per_spot";
  removeCatLimit.value = "";
  removeCatPick.value = "random";
  handsSheetHands.value = [];
  handsSheetOpen.value = true;
  try {
    const detail = await adminFetch<{
      code: string;
      name: string;
      hand_count: number;
      hands?: AppHandRow[];
    }>(`/v3/admin/app-categories/${encodeURIComponent(c.category_code)}`);
    handsSheetHands.value = Array.isArray(detail.hands) ? detail.hands : [];
    handsSheetTitle.value = detail.name || c.display_name || c.category_code;
    c.hand_count = detail.hand_count;
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : "加载手牌失败",
      icon: "none",
    });
  }
}

function closeHandsSheet() {
  handsSheetOpen.value = false;
}

function toggleHandSelect(h: AppHandRow) {
  const k = handKey(h);
  const i = handsSelectedKeys.value.indexOf(k);
  if (i >= 0) {
    handsSelectedKeys.value = handsSelectedKeys.value.filter((x) => x !== k);
  } else {
    handsSelectedKeys.value = [...handsSelectedKeys.value, k];
  }
}

function toggleSelectAllHands() {
  if (allHandsSelected.value) {
    handsSelectedKeys.value = [];
  } else {
    handsSelectedKeys.value = handsSheetHands.value.map(handKey);
  }
}

function handsOfSpot(spot: string): AppHandRow[] {
  return handsSheetHands.value.filter((h) => spotKeyOf(h) === spot);
}

function isSpotHandsFullySelected(spot: string): boolean {
  const rows = handsOfSpot(spot);
  return rows.length > 0 && rows.every((h) => handsSelectedKeys.value.includes(handKey(h)));
}

function isSpotHandsPartiallySelected(spot: string): boolean {
  const rows = handsOfSpot(spot);
  if (!rows.length) return false;
  const n = rows.filter((h) => handsSelectedKeys.value.includes(handKey(h))).length;
  return n > 0 && n < rows.length;
}

function toggleSpotHandsSelect(spot: string) {
  const rows = handsOfSpot(spot);
  if (!rows.length) return;
  if (isSpotHandsFullySelected(spot)) {
    const drop = new Set(rows.map(handKey));
    handsSelectedKeys.value = handsSelectedKeys.value.filter((k) => !drop.has(k));
  } else {
    const next = new Set(handsSelectedKeys.value);
    for (const h of rows) next.add(handKey(h));
    handsSelectedKeys.value = [...next];
  }
}

function toggleRemoveSpot(spot: string) {
  const i = removeSpotCodes.value.indexOf(spot);
  if (i >= 0) {
    removeSpotCodes.value = removeSpotCodes.value.filter((x) => x !== spot);
  } else {
    removeSpotCodes.value = [...removeSpotCodes.value, spot];
  }
}

function toggleSelectAllRemoveSpots() {
  if (allRemoveSpotsSelected.value) {
    removeSpotCodes.value = [];
  } else {
    removeSpotCodes.value = handsBySpot.value.map((g) => g.spot);
  }
}

async function patchRemoveHands(remove: AppHandRow[]) {
  if (!remove.length || !handsSheetCode.value) return;
  handsSaving.value = true;
  try {
    const res = await adminFetch<{
      removed: number;
      added: number;
      category: { hand_count: number; hands?: AppHandRow[] };
    }>(`/v3/admin/app-categories/${encodeURIComponent(handsSheetCode.value)}/hands`, {
      method: "PATCH",
      data: {
        remove: remove.map((h) => ({
          phhs_key: h.phhs_key,
          i: h.i,
          hero_seat: h.hero_seat,
          spot_code: h.spot_code || "",
        })),
      },
    });
    handsSheetHands.value = Array.isArray(res.category.hands) ? res.category.hands : [];
    handsSelectedKeys.value = [];
    const keepSpots = new Set(handsBySpot.value.map((g) => g.spot));
    removeSpotCodes.value = removeSpotCodes.value.filter((s) => keepSpots.has(s));
    uni.showToast({ title: `已删除 ${res.removed} 手`, icon: "success" });
    await loadCategories();
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : "删除失败",
      icon: "none",
    });
  } finally {
    handsSaving.value = false;
  }
}

async function removeSelectedHands() {
  if (!handsSelectedKeys.value.length || !handsSheetCode.value) return;
  const keySet = new Set(handsSelectedKeys.value);
  await patchRemoveHands(handsSheetHands.value.filter((h) => keySet.has(handKey(h))));
}

async function removeSampledBySpots() {
  if (!removeSpotCodes.value.length) {
    uni.showToast({ title: "请先勾选点位", icon: "none" });
    return;
  }
  const sampled = sampleHandsForRemove();
  if (!sampled.length) {
    uni.showToast({ title: "没有可删除的手牌", icon: "none" });
    return;
  }
  await patchRemoveHands(sampled);
}

async function openAppendToCategorySheet() {
  if (!selectedSpotCodes.value.length) {
    uni.showToast({ title: "请先勾选点位", icon: "none" });
    return;
  }
  if (!categories.value.length) {
    try {
      await loadCategories();
    } catch {
      /* ignore */
    }
  }
  const opts = appendTargetOptions.value;
  appendTargetCode.value = opts[0]?.category_code || "";
  appendCatMode.value = "per_spot";
  appendCatLimit.value = "";
  appendCatPick.value = "random";
  appendCatSheetOpen.value = true;
}

function closeAppendToCategorySheet() {
  if (handsSaving.value) return;
  appendCatSheetOpen.value = false;
}

async function submitAppendToCategory() {
  if (!appendTargetCode.value) {
    uni.showToast({ title: "请选择目标分类", icon: "none" });
    return;
  }
  if (!selectedSpotCodes.value.length) {
    uni.showToast({ title: "请先勾选点位", icon: "none" });
    return;
  }
  const body: Record<string, unknown> = {
    append_spots: {
      spot_codes: selectedSpotCodes.value,
      mode: appendCatMode.value,
      pick: appendCatPick.value,
    },
  };
  const limitRaw = appendCatLimit.value.trim();
  if (limitRaw) {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0) {
      (body.append_spots as Record<string, unknown>).limit = Math.floor(n);
    }
  }
  handsSaving.value = true;
  try {
    const res = await adminFetch<{
      removed: number;
      added: number;
      category: { hand_count: number; hands?: AppHandRow[] };
    }>(`/v3/admin/app-categories/${encodeURIComponent(appendTargetCode.value)}/hands`, {
      method: "PATCH",
      data: body,
    });
    uni.showToast({
      title: res.added ? `已追加 ${res.added} 手` : "没有可追加的新手牌",
      icon: res.added ? "success" : "none",
    });
    appendCatSheetOpen.value = false;
    await loadCategories();
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : "追加失败",
      icon: "none",
    });
  } finally {
    handsSaving.value = false;
  }
}

async function openGenerateSheetForCategory(c: CategoryPricingItem) {
  if (!c.hand_count) {
    uni.showToast({ title: "分类没有手牌", icon: "none" });
    return;
  }
  generateTarget.value = c;
  generateLimit.value = String(Math.min(500, Math.max(1, c.hand_count)));
  generateForce.value = false;
  await loadCommentaryModels();
  generateSheetOpen.value = true;
}

function closeGenerateSheet() {
  if (generating.value) return;
  generateSheetOpen.value = false;
  generateTarget.value = null;
}

async function startGenerateJob() {
  const target = generateTarget.value;
  if (!target) {
    uni.showToast({ title: "未选择分类", icon: "none" });
    return;
  }
  if (plannedGenerateCount.value <= 0) {
    uni.showToast({ title: "没有可生成的手牌", icon: "none" });
    return;
  }
  generating.value = true;
  try {
    const job = await adminFetch<JobItem>(
      `/v3/admin/app-categories/${encodeURIComponent(target.category_code)}/generate`,
      {
        method: "POST",
        data: {
          limit: generateCap.value,
          force: generateForce.value,
          model: generateModelId.value,
          concurrency: generateConcurrencyCap.value,
        },
      },
    );
    generateSheetOpen.value = false;
    generateTarget.value = null;
    uni.showToast({ title: `任务 #${job.id} 已排队`, icon: "success" });
    tab.value = "jobs";
    await loadJobs();
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : "排队失败",
      icon: "none",
    });
  } finally {
    generating.value = false;
  }
}

async function loadSpots() {
  spotList.value = await adminFetch<AdminSpotList>("/v3/admin/spots");
}

async function openSpot(code: string) {
  if (openSpotCode.value === code) {
    openSpotCode.value = "";
    spotDetail.value = null;
    spotHands.value = [];
    return;
  }
  openSpotCode.value = code;
  spotLoading.value = true;
  try {
    const detail = await adminFetch<AdminSpotDetail>(
      `/v3/admin/spots/${encodeURIComponent(code)}?offset=0&limit=40`,
    );
    spotDetail.value = detail;
    spotHands.value = detail.hands || [];
  } finally {
    spotLoading.value = false;
  }
}

async function loadMoreSpotHands() {
  if (!openSpotCode.value || !spotDetail.value) return;
  const next = await adminFetch<AdminSpotDetail>(
    `/v3/admin/spots/${encodeURIComponent(openSpotCode.value)}?offset=${spotHands.value.length}&limit=40`,
  );
  spotHands.value = [...spotHands.value, ...(next.hands || [])];
}

function defaultConcurrencyForModel(modelId: string) {
  return modelId === "dummy" ? "16" : "4";
}

function onGenerateModelChange(e: { detail?: { value?: string | number } }) {
  const i = Number(e.detail?.value ?? 0);
  const next = commentaryModels.value[i];
  if (!next) return;
  const prevDefault = defaultConcurrencyForModel(generateModelId.value);
  generateModelId.value = next.id;
  if (generateConcurrency.value === prevDefault) {
    generateConcurrency.value = defaultConcurrencyForModel(next.id);
  }
}

async function loadCommentaryModels() {
  try {
    const data = await adminFetch<{ default: string; models: CommentaryModelItem[] }>(
      "/v3/admin/commentary-models",
    );
    if (data.models?.length) {
      commentaryModels.value = data.models;
    }
    if (!commentaryModels.value.some((m) => m.id === generateModelId.value)) {
      generateModelId.value = data.default || commentaryModels.value[0].id;
    }
  } catch {
    /* keep Dummy fallback */
  }
}

function addCategoryRow() {
  const code = newCategoryCode.value.trim();
  if (!code) return;
  if (categories.value.some((c) => c.category_code === code)) {
    uni.showToast({ title: "已存在", icon: "none" });
    return;
  }
  categories.value.push({
    category_code: code,
    display_name: code,
    access_threshold: 0,
    is_experience: false,
    in_catalog: false,
    hand_count: 0,
    taxonomy_id: catalogMeta.value?.primary_taxonomy || "",
    parent: "",
    position: "",
    starting_hand: "",
  });
  newCategoryCode.value = "";
}

async function saveCategory(c: CategoryPricingItem) {
  const saved = await adminFetch<CategoryPricingItem>(
    `/v3/admin/categories/${encodeURIComponent(c.category_code)}`,
    {
      method: "PUT",
      data: {
        display_name: c.display_name,
        access_threshold: c.is_experience ? 0 : c.access_threshold,
        is_experience: c.is_experience,
      },
    },
  );
  const idx = categories.value.findIndex((x) => x.category_code === c.category_code);
  if (idx >= 0) categories.value[idx] = saved;
  uni.showToast({ title: "已保存", icon: "success" });
}

async function deleteCategory(c: CategoryPricingItem) {
  await adminFetch(`/v3/admin/categories/${encodeURIComponent(c.category_code)}`, {
    method: "DELETE",
  });
  categories.value = categories.value.filter((x) => x.category_code !== c.category_code);
  uni.showToast({ title: "已删除", icon: "success" });
}

async function loadContent() {
  const params = new URLSearchParams();
  params.set("limit", "50");
  const spot = contentSpotFilter.value.trim();
  if (spot) params.set("spot_code", spot);
  contentItems.value = await adminFetch<ContentItem[]>(
    `/v3/admin/content?${params.toString()}`,
  );
}

async function importDisk() {
  await adminFetch("/v3/admin/content/sync-from-disk", { method: "POST" });
  uni.showToast({ title: "已创建导入任务", icon: "none" });
  await loadJobs();
}

async function setStatus(id: number, status: string) {
  await adminFetch(`/v3/admin/content/${id}/status`, {
    method: "PATCH",
    data: { status },
  });
  await loadContent();
}

async function loadJobs() {
  jobs.value = await adminFetch<JobItem[]>("/v3/admin/jobs?limit=30");
}

async function loadConfig() {
  const cfg = await adminFetch<AdminConfig>("/v3/admin/config");
  cfgGrant.value = String(cfg.credit_new_user_grant);
  cfgCost.value = String(cfg.credit_review_analyze_cost);
}

async function saveConfig() {
  await adminFetch("/v3/admin/config", {
    method: "PUT",
    data: {
      credit_new_user_grant: Number(cfgGrant.value) || 0,
      credit_review_analyze_cost: Number(cfgCost.value) || 0,
    },
  });
  uni.showToast({ title: "已保存", icon: "success" });
}

async function lookupUser() {
  const pid = Number(lookupPublicId.value);
  lookedUser.value = await adminFetch<AdminUser>(`/v3/admin/users?public_id=${pid}`);
}

async function grantUser() {
  if (!lookedUser.value) return;
  lookedUser.value = await adminFetch<AdminUser>(
    `/v3/admin/users/${lookedUser.value.public_id}/credits`,
    { method: "POST", data: { amount: Number(grantAmount.value) || 1 } },
  );
  uni.showToast({ title: "已赠送", icon: "success" });
}

async function toggleBeta() {
  if (!lookedUser.value) return;
  lookedUser.value = await adminFetch<AdminUser>(
    `/v3/admin/users/${lookedUser.value.public_id}/beta`,
    {
      method: "PATCH",
      data: { is_beta_tester: !lookedUser.value.is_beta_tester },
    },
  );
}

async function createBatch() {
  const res = await adminFetch<{ codes: string[] }>("/v3/admin/vouchers/batch", {
    method: "POST",
    data: {
      batch_id: batchId.value,
      count: Number(batchCount.value) || 5,
      credit_amount: Number(batchAmount.value) || 100,
    },
  });
  batchCodes.value = res.codes || [];
  downloadCodesCsv();
}

function downloadCodesCsv() {
  if (!batchCodes.value.length) return;
  // #ifdef H5
  const amount = batchAmount.value;
  const bid = batchId.value;
  const lines = [
    "code,credit_amount,batch_id",
    ...batchCodes.value.map((c) => `${c},${amount},${bid}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bid}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  // #endif
}

async function revokeVoucher() {
  await adminFetch("/v3/admin/vouchers/revoke", {
    method: "POST",
    data: { code: revokeCode.value },
  });
  uni.showToast({ title: "已作废", icon: "success" });
  revokeCode.value = "";
}

onMounted(async () => {
  setAdminUnauthorizedHandler(() => {
    resetSession();
  });
  const stored = getAdminToken();
  if (!stored) {
    restoring.value = false;
    return;
  }
  restoring.value = true;
  try {
    const check = await verifyAdminToken(stored);
    if (!check.ok) {
      resetSession();
      authError.value = check.detail;
      return;
    }
    isLoggedIn.value = true;
    await loadWorkspace();
  } finally {
    restoring.value = false;
  }
});

onUnmounted(() => {
  setAdminUnauthorizedHandler(null);
});
</script>

<style scoped lang="scss">
.page-root {
  position: relative;
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0f172a;
  color: #e2e8f0;
  box-sizing: border-box;
}
.page-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
}
.page-inner {
  padding: 24rpx;
  padding-bottom: 80rpx;
  max-width: 960px;
  margin: 0 auto;
  box-sizing: border-box;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
  display: block;
}
.session-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.session-title {
  margin-bottom: 0;
  flex: 1;
  min-width: 0;
}
.session-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
}
.session-ok {
  font-size: 24rpx;
  color: #86efac;
  line-height: 1;
}
.logout-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}
.logout-btn:active {
  background: rgba(255, 255, 255, 0.14);
}
.logout-btn-txt {
  font-size: 24rpx;
  color: #cbd5e1;
  line-height: 1;
}
.auth-error {
  display: block;
  font-size: 24rpx;
  color: #f87171;
  margin: -8rpx 0 16rpx;
}
.panel {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.label {
  display: block;
  margin-bottom: 8rpx;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #94a3b8;
}
.panel > .label:first-child {
  margin-top: 0;
}
.hint {
  display: block;
  font-size: 24rpx;
  color: #64748b;
  margin-bottom: 12rpx;
}
.input {
  width: 100%;
  height: 88rpx;
  min-height: 88rpx;
  margin-bottom: 16rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: #1e293b;
  border-radius: 12rpx;
  color: #f8fafc;
  font-size: 28rpx;
  line-height: 88rpx;
}
.btn {
  margin-bottom: 12rpx;
  background: #22c55e;
  color: #052e16;
  font-size: 28rpx;
}
.btn--ghost {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}
.btn--sm {
  height: 64rpx;
  line-height: 64rpx;
  margin-bottom: 0;
  padding: 0 20rpx;
  font-size: 24rpx;
  border-radius: 10rpx;
}
.btn--danger-ghost {
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
}
.adm-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
  background: rgba(15, 23, 42, 0.55);
  border: 1rpx solid rgba(148, 163, 184, 0.12);
  border-radius: 14rpx;
}
.adm-nav-item {
  flex: 1 1 auto;
  min-width: 120rpx;
  text-align: center;
  padding: 14rpx 12rpx;
  border-radius: 10rpx;
  font-size: 24rpx;
  color: #94a3b8;
}
.adm-nav-item.on {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  font-weight: 600;
}
.adm-panel-head {
  margin-bottom: 20rpx;
}
.adm-panel-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.3;
}
.adm-panel-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.45;
}
.adm-panel-meta {
  display: block;
  margin-bottom: 16rpx;
  font-size: 22rpx;
  color: #64748b;
}
.adm-muted {
  color: #64748b;
  font-size: 24rpx;
}
.adm-text-btn {
  color: #38bdf8;
  font-size: 24rpx;
  line-height: 1.4;
}
.adm-selection-summary {
  margin-bottom: 16rpx;
  padding: 12rpx 16rpx;
  border-radius: 10rpx;
  background: rgba(34, 197, 94, 0.08);
  border: 1rpx solid rgba(34, 197, 94, 0.18);
  font-size: 24rpx;
  color: #86efac;
}
.adm-filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 16rpx;
}
.adm-filter-tab {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(148, 163, 184, 0.12);
}
.adm-filter-tab.on {
  color: #052e16;
  background: #22c55e;
  border-color: #22c55e;
}
.adm-search {
  margin-bottom: 20rpx;
}
.adm-card {
  padding: 20rpx;
  margin-bottom: 16rpx;
  border-radius: 14rpx;
  background: rgba(15, 23, 42, 0.45);
  border: 1rpx solid rgba(148, 163, 184, 0.1);
}
.adm-card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.adm-card-title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: #f1f5f9;
}
.adm-card-sub {
  display: block;
  font-size: 24rpx;
  color: #94a3b8;
  margin-bottom: 8rpx;
}
.adm-card-mono {
  display: block;
  font-family: monospace;
  font-size: 22rpx;
  color: #64748b;
  margin-bottom: 12rpx;
  word-break: break-all;
}
.adm-card-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12rpx;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.tab {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  font-size: 26rpx;
}
.tab.on {
  background: #22c55e;
  color: #052e16;
}
.row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.cat-row {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.cat-row-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
}
.cat-row-main {
  flex: 1;
  min-width: 0;
}
.cat-row-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}
.cat-row-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #e2e8f0;
}
.cat-row-count {
  font-size: 22rpx;
  color: #94a3b8;
}
.cat-row-code {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-row-threshold {
  flex-shrink: 0;
  width: 120rpx;
  display: flex;
  align-items: center;
}
.cat-threshold {
  width: 100%;
  height: 64rpx;
  box-sizing: border-box;
  padding: 0 12rpx;
  border-radius: 10rpx;
  border: 1rpx solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  font-size: 26rpx;
  text-align: center;
}
.cat-row-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10rpx;
  align-items: center;
}
.cat-btn {
  margin: 0;
  min-width: 0;
  padding: 0 22rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 22rpx;
  white-space: nowrap;
}
.cat-tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
}
.cat-tag--muted {
  background: rgba(148, 163, 184, 0.16);
  color: #94a3b8;
}
.row-key {
  font-size: 22rpx;
  color: #64748b;
  font-family: monospace;
  display: block;
  margin-bottom: 8rpx;
}
.row-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 8rpx;
}
.link {
  color: #38bdf8;
  font-size: 26rpx;
}
.link-danger {
  color: #f87171;
}
.code-line {
  display: block;
  font-family: monospace;
  font-size: 24rpx;
  margin-top: 8rpx;
}
.err {
  color: #f87171;
  font-size: 22rpx;
}
.spot-hands {
  margin-top: 8rpx;
}
.spot-select-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: rgba(15, 23, 42, 0.5);
  border: 1rpx solid rgba(148, 163, 184, 0.12);
}
.spot-actions {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.spot-gen-btn {
  flex: 1;
  margin-bottom: 0;
}
.spot-actions .btn--ghost {
  flex-shrink: 0;
  margin-bottom: 0;
  min-width: 160rpx;
}
.spot-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.spot-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12rpx;
  padding: 18rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(15, 23, 42, 0.35);
  border: 1rpx solid rgba(148, 163, 184, 0.1);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.spot-row--on {
  background: rgba(34, 197, 94, 0.07);
  border-color: rgba(34, 197, 94, 0.28);
}
.spot-row-body {
  flex: 1;
  min-width: 0;
}
.spot-row-top {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 6rpx;
}
.spot-row-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #f1f5f9;
}
.spot-row-count {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #94a3b8;
}
.spot-row-code {
  display: block;
  font-family: monospace;
  font-size: 22rpx;
  color: #64748b;
  margin-bottom: 8rpx;
  word-break: break-all;
}
.spot-row-link {
  display: inline-block;
}
.spot-hand-line {
  display: block;
  font-family: monospace;
  font-size: 20rpx;
  color: #64748b;
  margin-top: 6rpx;
  word-break: break-all;
}
.row-id {
  display: block;
  font-size: 28rpx;
}
.sheet-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 24rpx;
  box-sizing: border-box;
}
.sheet {
  width: 100%;
  max-width: 560px;
  max-height: 92%;
  overflow-y: auto;
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  border-radius: 24rpx 24rpx 20rpx 20rpx;
  padding: 28rpx 28rpx 32rpx;
  box-sizing: border-box;
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.45);
}
.sheet--tall {
  max-height: 94%;
}
.hands-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}
.hands-list {
  max-height: 640rpx;
  border: 1rpx solid rgba(148, 163, 184, 0.12);
  border-radius: 12rpx;
}
.hands-edit-tabs {
  margin-bottom: 8rpx;
}
.hands-spot-group {
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.12);
}
.hands-spot-group:last-child {
  border-bottom: none;
}
.hands-spot-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 16rpx 12rpx;
  background: rgba(15, 23, 42, 0.55);
  position: sticky;
  top: 0;
  z-index: 1;
}
.hands-spot-head-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}
.hands-spot-code {
  font-size: 24rpx;
  font-weight: 600;
  color: #86efac;
  word-break: break-all;
}
.hands-spot-count {
  font-size: 20rpx;
  color: rgba(148, 163, 184, 0.95);
}
.hands-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12rpx;
  padding: 12rpx 16rpx 12rpx 20rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.06);
}
.hands-row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.hands-row-slug {
  font-size: 26rpx;
  font-weight: 600;
  color: #e2e8f0;
}
.hands-row-key {
  font-size: 20rpx;
  color: rgba(148, 163, 184, 0.95);
  word-break: break-all;
}
.append-cat-list {
  max-height: 360rpx;
  margin-top: 8rpx;
  border: 1rpx solid rgba(148, 163, 184, 0.12);
  border-radius: 12rpx;
}
.append-cat-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 16rpx 18rpx;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.08);
}
.append-cat-row:last-child {
  border-bottom: none;
}
.append-cat-row.on {
  background: rgba(56, 189, 248, 0.12);
}
.append-cat-name {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #e2e8f0;
}
.append-cat-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: rgba(148, 163, 184, 0.95);
}
.sheet-head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.sheet-head-text {
  flex: 1;
  min-width: 0;
}
.sheet-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.3;
}
.sheet-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
  line-height: 1.45;
}
.sheet-close {
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-close:active {
  background: rgba(255, 255, 255, 0.12);
}
.sheet-close-txt {
  font-size: 36rpx;
  line-height: 1;
  color: #94a3b8;
  margin-top: -4rpx;
}
.sheet-stats {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  background: rgba(15, 23, 42, 0.65);
  border: 1rpx solid rgba(148, 163, 184, 0.12);
  border-radius: 16rpx;
  padding: 20rpx 8rpx;
  margin-bottom: 28rpx;
}
.sheet-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}
.sheet-stat--accent .sheet-stat-val {
  color: #86efac;
}
.sheet-stat-val {
  font-size: 36rpx;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.sheet-stat-val--code {
  font-size: 22rpx;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  max-width: 200rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: normal;
}
.sheet-stat-lab {
  font-size: 20rpx;
  color: #64748b;
  line-height: 1;
}
.sheet-stat-div {
  width: 1rpx;
  align-self: stretch;
  background: rgba(148, 163, 184, 0.14);
  margin: 4rpx 0;
}
.sheet-section {
  margin-bottom: 24rpx;
}
.sheet-section-title {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.02em;
  margin-bottom: 12rpx;
}
.sheet-section-title--inline {
  margin-bottom: 0;
}
.sheet-field-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}
.sheet-chip {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(148, 163, 184, 0.2);
  line-height: 1.2;
}
.sheet-chip.on {
  color: #052e16;
  background: #86efac;
  border-color: #86efac;
}
.sheet-picker {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 88rpx;
  padding: 0 24rpx;
  background: rgba(15, 23, 42, 0.8);
  border: 1rpx solid rgba(148, 163, 184, 0.16);
  border-radius: 14rpx;
  box-sizing: border-box;
}
.sheet-picker-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
}
.sheet-badge {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 18rpx;
  font-weight: 600;
  line-height: 1.3;
}
.sheet-badge--dummy {
  color: #fde68a;
  background: rgba(251, 191, 36, 0.15);
}
.sheet-badge--llm {
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.12);
}
.sheet-picker-label {
  font-size: 28rpx;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sheet-picker-chevron {
  flex-shrink: 0;
  font-size: 32rpx;
  color: #64748b;
  line-height: 1;
}
.sheet-inline {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
}
.sheet-input {
  margin-bottom: 0;
  flex: 1;
  min-width: 0;
  border: 1rpx solid rgba(148, 163, 184, 0.16);
}
.sheet-input--num {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.sheet-unit {
  flex-shrink: 0;
  width: 48rpx;
  font-size: 26rpx;
  color: #64748b;
}
.sheet-note {
  display: block;
  margin-top: 10rpx;
  font-size: 20rpx;
  color: #64748b;
  line-height: 1.45;
}
.sheet-toggle-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 4rpx 8rpx;
  margin-bottom: 8rpx;
}
.sheet-toggle-copy {
  flex: 1;
  min-width: 0;
}
.sheet-toggle-title {
  display: block;
  font-size: 28rpx;
  color: #e2e8f0;
  line-height: 1.3;
}
.sheet-toggle-hint {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #64748b;
}
.sheet-switch {
  flex-shrink: 0;
  width: 88rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: rgba(148, 163, 184, 0.25);
  padding: 4rpx;
  box-sizing: border-box;
  transition: background 0.15s ease;
}
.sheet-switch.on {
  background: #22c55e;
}
.sheet-switch-knob {
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: #f8fafc;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
  transform: translateX(0);
  transition: transform 0.15s ease;
}
.sheet-switch.on .sheet-switch-knob {
  transform: translateX(40rpx);
}
.sheet-foot {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin-top: 12rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.12);
}
.sheet-btn {
  flex: 1;
  margin-bottom: 0;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.sheet-btn--primary {
  flex: 1.4;
}
</style>
