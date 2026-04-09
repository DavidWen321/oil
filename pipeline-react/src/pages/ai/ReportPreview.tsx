import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Button, DatePicker, Empty, Select, Space, Spin, Switch, Tag, message } from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { calculationHistoryApi, pipelineApi, projectApi, pumpStationApi } from '../../api';
import { agentApi } from '../../api/agent';
import AnimatedPage from '../../components/common/AnimatedPage';
import DynamicReportView from '../../components/reporting/DynamicReportView';
import { useThemeStore } from '../../stores/themeStore';
import type { CalculationHistory, PageResult, Pipeline, Project, PumpStation, R } from '../../types';
import type {
  DynamicReportRequestPayload,
  DynamicReportResponsePayload,
  DynamicReportSectionPayload,
} from '../../types/agent';

const { RangePicker } = DatePicker;
type ReportType = 'AI_REPORT' | 'RISK_REVIEW' | 'ENERGY_DIAGNOSIS' | 'OPERATION_BRIEF';
type RangePreset = '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';
type OutputFormat = 'markdown' | 'docx' | 'pdf';
type IntelligenceLevel = 'standard' | 'enhanced' | 'expert';
type HistoryFilter = 'all' | 'ai' | 'normal' | 'completed' | 'running' | 'failed';
type DateRangeValue = [Dayjs, Dayjs] | null;
type JsonRecord = Record<string, unknown>;
type BusinessOutputStyle = 'simple' | 'professional' | 'presentation';
type RiskLevel = '楂? | '涓? | '浣?;
type SuggestionPriority = '楂? | '涓? | '浣?;

type RiskItem = {
  target: string;
  riskType: string;
  level: RiskLevel;
  reason: string;
  suggestion: string;
};

type SuggestionItem = {
  target: string;
  reason: string;
  action: string;
  expected: string;
  priority: SuggestionPriority;
};

type ReportResult = {
  source: 'ai' | 'fallback' | 'history';
  highlights: string[];
  summary: string[];
  risks: RiskItem[];
  suggestions: SuggestionItem[];
  conclusion: string;
  rawText: string;
  report?: DynamicReportResponsePayload | null;
};

type PreviewRecord = {
  id: string;
  title: string;
  typeLabel: string;
  createdAt: string;
  rangeLabel: string;
  intelligenceLabel: string;
  projectNames: string[];
  outputStyle?: BusinessOutputStyle;
  outputStyleLabel?: string;
  outputFormat: OutputFormat;
  sourceLabel: string;
  result: ReportResult;
};

type LocalReportRecord = PreviewRecord & { selectedProjectIds: number[] };

type ProjectInsight = {
  project: Project;
  pipelineCount: number;
  totalThroughput: number;
  historyCount: number;
  abnormalCount: number;
  failedCount: number;
  lowPressureCount: number;
  infeasibleCount: number;
  avgFrictionRatio: number | null;
  avgEnergyIntensity: number | null;
};

type HistoryItem = {
  id: string;
  kind: 'ai' | 'normal';
  status: 'completed' | 'running' | 'failed';
  title: string;
  time: string;
  summary: string;
  outputStyleLabel?: string;
  preview?: PreviewRecord | LocalReportRecord;
};

const TEMPLATE_KEY = 'pipeline-ai-report-template-v3';
const LEGACY_HISTORY_KEY = 'pipeline-ai-report-history-v3';
const COUNT_KEY = 'pipeline-ai-report-count-v3';

const COMMON_HISTORY_INPUT_FIELDS: Array<{ label: string; keys: string[] }> = [
  { label: '娴侀噺', keys: ['flowRate', 'throughput', 'flow'] },
  { label: '瀵嗗害', keys: ['density'] },
  { label: '绮樺害', keys: ['viscosity'] },
  { label: '闀垮害', keys: ['length', 'pipelineLength'] },
  { label: '绠″緞', keys: ['diameter', 'pipeDiameter'] },
  { label: '澹佸帤', keys: ['thickness', 'wallThickness'] },
  { label: '绮楃硻搴?, keys: ['roughness'] },
  { label: '璧风偣楂樼▼', keys: ['startAltitude', 'startElevation'] },
  { label: '缁堢偣楂樼▼', keys: ['endAltitude', 'endElevation'] },
  { label: '棣栫珯杩涚珯鍘嬪ご', keys: ['inletPressure', 'firstStationInPressure', 'stationInPressure'] },
  { label: '娉垫暟閲?鎵▼', keys: ['pumpCombination', 'pumpHeads', 'pumpHead', 'pump375Head', 'pump480Head'] },
  { label: '鏁堢巼', keys: ['pumpEfficiency', 'motorEfficiency', 'electricEfficiency', 'efficiency'] },
  { label: '鐢典环', keys: ['electricityPrice', 'powerPrice'] },
  { label: '宸ヤ綔澶╂暟', keys: ['workingDays'] },
  { label: '鏁忔劅鍙橀噺绫诲瀷', keys: ['sensitiveVariableType', 'sensitivityVariableType', 'variableType'] },
];

const HYDRAULIC_RESULT_FIELDS: Array<{ label: string; keys: string[] }> = [
  { label: '闆疯鏁?, keys: ['reynoldsNumber', 'reynolds'] },
  { label: '娴佹€?, keys: ['flowRegime', 'regime'] },
  { label: '鎽╅樆鎹熷け', keys: ['frictionHeadLoss', 'frictionLoss'] },
  { label: '姘村姏鍧￠檷', keys: ['hydraulicSlope', 'slope'] },
  { label: '鎬绘壃绋?, keys: ['totalHead'] },
  { label: '棣栫珯鍑虹珯鍘嬪ご', keys: ['firstStationOutPressure', 'outletPressure'] },
  { label: '鏈珯杩涚珯鍘嬪ご', keys: ['endStationInPressure', 'terminalInPressure'] },
];

const OPTIMIZATION_RESULT_FIELDS: Array<{ label: string; keys: string[] }> = [
  { label: '鎺ㄨ崘娉电粍鍚?, keys: ['recommendedPumpCombination', 'pumpCombination', 'description'] },
  { label: '鎬绘壃绋?, keys: ['totalHead'] },
  { label: '鎬诲帇闄?, keys: ['totalPressureDrop', 'pressureDrop'] },
  { label: '鏈珯杩涚珯鍘嬪ご', keys: ['endStationInPressure', 'terminalInPressure'] },
  { label: '鍙鎬?, keys: ['isFeasible', 'feasible'] },
  { label: '骞磋兘鑰?, keys: ['totalEnergyConsumption', 'annualEnergyConsumption', 'energyConsumption'] },
  { label: '鎬绘垚鏈?, keys: ['totalCost', 'annualCost'] },
  { label: '鎺ㄨ崘璇存槑', keys: ['description', 'recommendation', 'remark'] },
];

function resolveOutputStyle(style?: string | null, label?: string | null): BusinessOutputStyle | undefined {
  if (style === 'simple' || style === 'professional' || style === 'presentation') return style;
  if (label === '绠€鏄庣増' || label === '绠€娲佺増') return 'simple';
  if (label === '涓撲笟鐗?) return 'professional';
  if (label === '绠＄悊鐗? || label === '姹囨姤鐗?) return 'presentation';
  return undefined;
}

function getOutputStyleMeta(style?: string | null, label?: string | null) {
  const resolvedStyle = resolveOutputStyle(style, label);
  if (resolvedStyle === 'simple') {
    return {
      style: resolvedStyle,
      label: '绠€鏄庣増',
      audience: '閫傚悎蹇€熸煡鐪?,
      emphasis: '鍙繚鐣欐牳蹇冪粨璁恒€佸叧閿寚鏍囧拰鐩存帴寤鸿',
      cardClassName: 'border-emerald-300/25 bg-emerald-400/8',
      stripeClassName: 'from-emerald-300 via-cyan-300 to-transparent',
      badgeClassName: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
      chips: ['鐭憳瑕?, '灏戠珷鑺?, '蹇喅绛?],
    };
  }

  if (resolvedStyle === 'presentation') {
    return {
      style: resolvedStyle,
      label: '绠＄悊鐗?,
      audience: '閫傚悎棰嗗姹囨姤',
      emphasis: '绐佸嚭缁撹銆侀闄╁拰琛屽姩椤癸紝寮卞寲杩囩▼缁嗚妭',
      cardClassName: 'border-amber-300/25 bg-amber-400/8',
      stripeClassName: 'from-amber-300 via-orange-300 to-transparent',
      badgeClassName: 'border-amber-300/30 bg-amber-400/10 text-amber-50',
      chips: ['缁撹浼樺厛', '椋庨櫓绐佸嚭', '琛屽姩瀵煎悜'],
    };
  }

  return {
    style: 'professional' as const,
    label: '涓撲笟鐗?,
    audience: '閫傚悎鎶€鏈闃?,
    emphasis: '淇濈暀瀹屾暣鍒嗘瀽缁撴瀯銆佽瘖鏂繃绋嬨€侀闄╀笌寤鸿',
    cardClassName: 'border-cyan-300/25 bg-cyan-400/8',
    stripeClassName: 'from-cyan-300 via-blue-300 to-transparent',
    badgeClassName: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-50',
    chips: ['缁撴瀯瀹屾暣', '缁嗚妭鍏呭垎', '鎶€鏈垎鏋?],
  };
}

function formatPreviewTitle(title: string, style?: string | null, label?: string | null) {
  const styleMeta = getOutputStyleMeta(style, label);
  return title.includes(styleMeta.label) ? title : `${title} 路 ${styleMeta.label}`;
}

function PreviewContent({ preview }: { preview: PreviewRecord | LocalReportRecord }) {
  const styleMeta = getOutputStyleMeta(preview.outputStyle, preview.outputStyleLabel);
  const sectionCount = preview.result.report?.sections?.length ?? 0;
  const summaryCount = preview.result.summary.length;
  const riskCount = preview.result.risks.length;

  if (preview.result.report?.sections?.length) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鐢熸垚鏃堕棿</div>
              <div className="mt-2 text-sm text-slate-100">{formatTime(preview.createdAt)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鍒嗘瀽鑼冨洿</div>
              <div className="mt-2 text-sm text-slate-100">{preview.rangeLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鏅鸿兘绛夌骇</div>
              <div className="mt-2 text-sm text-slate-100">{preview.intelligenceLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鎶ュ憡绫诲瀷</div>
              <div className="mt-2 text-sm text-slate-100">{preview.typeLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">杈撳嚭鏍煎紡</div>
              <div className="mt-2 text-sm text-slate-100">{preview.outputFormat.toUpperCase()}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鏉ユ簮</div>
              <div className="mt-2 text-sm text-slate-100">{preview.sourceLabel}</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="text-slate-400">瑕嗙洊椤圭洰锛?/span>
            {preview.projectNames.length ? preview.projectNames.join('銆?) : '鏈€夋嫨椤圭洰'}
          </div>
        </div>

        <div className={`relative overflow-hidden rounded-[24px] border p-5 shadow-[0_18px_40px_rgba(15,23,42,0.22)] xl:col-span-2 ${styleMeta.cardClassName}`}>
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styleMeta.stripeClassName}`} />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Tag color="geekblue">{styleMeta.label}</Tag>
                <span className="text-sm text-slate-300">{styleMeta.audience}</span>
              </div>
              <div className="mt-3 text-lg font-semibold text-white">{formatPreviewTitle(preview.title, preview.outputStyle, preview.outputStyleLabel)}</div>
              <div className="mt-2 text-sm leading-7 text-slate-300">{styleMeta.emphasis}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {styleMeta.chips.map((item) => (
                  <span key={item} className={`rounded-full border px-3 py-1 text-xs ${styleMeta.badgeClassName}`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid min-w-[260px] gap-3 sm:grid-cols-3 lg:w-[360px]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">鎽樿</div>
                <div className="mt-2 text-2xl font-semibold text-white">{summaryCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">绔犺妭</div>
                <div className="mt-2 text-2xl font-semibold text-white">{sectionCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">椋庨櫓</div>
                <div className="mt-2 text-2xl font-semibold text-white">{riskCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <DynamicReportView report={preview.result.report} />
        </div>

        {preview.result.rawText ? (
          <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
            <div className="text-lg font-semibold text-white">鍘熷璁＄畻鏁版嵁</div>
            <pre className="report-raw-code mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4 text-xs leading-6 text-slate-200">
              {preview.result.rawText}
            </pre>
          </div>
        ) : null}

      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鐢熸垚鏃堕棿</div>
            <div className="mt-2 text-sm text-slate-100">{formatTime(preview.createdAt)}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鍒嗘瀽鑼冨洿</div>
            <div className="mt-2 text-sm text-slate-100">{preview.rangeLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鏅鸿兘绛夌骇</div>
            <div className="mt-2 text-sm text-slate-100">{preview.intelligenceLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鎶ュ憡绫诲瀷</div>
            <div className="mt-2 text-sm text-slate-100">{preview.typeLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">杈撳嚭鏍煎紡</div>
            <div className="mt-2 text-sm text-slate-100">{preview.outputFormat.toUpperCase()}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">鏉ユ簮</div>
            <div className="mt-2 text-sm text-slate-100">{preview.sourceLabel}</div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span className="text-slate-400">瑕嗙洊椤圭洰锛?/span>
          {preview.projectNames.length ? preview.projectNames.join('銆?) : '鏈€夋嫨椤圭洰'}
        </div>
      </div>

      <div className="rounded-[24px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_40px_rgba(8,47,73,0.18)] xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">鍏抽敭鍙戠幇</div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">AI Findings</div>
        </div>
        {preview.result.highlights.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {preview.result.highlights.map((item, index) => (
              <div key={`${index}-${item}`} className="rounded-[20px] border border-cyan-200/15 bg-slate-950/35 px-4 py-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">鍙戠幇 {String(index + 1).padStart(2, '0')}</div>
                <div className="mt-3 text-sm leading-7 text-slate-100">{item}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">鏆傛棤鍏抽敭鍙戠幇</div>
        )}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">椋庨櫓瀵硅薄</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">瀵硅薄 / 绫诲瀷 / 绛夌骇 / 鍘熷洜 / 寤鸿</div>
        </div>
        {preview.result.risks.length ? (
          <>
            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead>
                  <tr className="text-slate-400">
                    <th className="px-4 py-3 font-medium">椋庨櫓瀵硅薄</th>
                    <th className="px-4 py-3 font-medium">椋庨櫓绫诲瀷</th>
                    <th className="px-4 py-3 font-medium">绛夌骇</th>
                    <th className="px-4 py-3 font-medium">鍘熷洜</th>
                    <th className="px-4 py-3 font-medium">寤鸿</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {preview.result.risks.map((item, index) => (
                    <tr key={`${item.target}-${item.riskType}-${index}`} className="align-top text-slate-200">
                      <td className="px-4 py-4 font-medium text-white">{item.target}</td>
                      <td className="px-4 py-4">{item.riskType}</td>
                      <td className="px-4 py-4"><Tag color={getRiskLevelColor(item.level)}>{item.level}</Tag></td>
                      <td className="px-4 py-4 leading-6">{item.reason}</td>
                      <td className="px-4 py-4 leading-6">{item.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 lg:hidden">
              {preview.result.risks.map((item, index) => (
                <div key={`${item.target}-${item.riskType}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-400">椋庨櫓瀵硅薄</div>
                      <div className="mt-1 text-base font-semibold text-white">{item.target}</div>
                    </div>
                    <Tag color={getRiskLevelColor(item.level)}>{item.level}</Tag>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-300">
                    <div>
                      <div className="text-slate-400">椋庨櫓绫诲瀷</div>
                      <div className="mt-1 text-slate-100">{item.riskType}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">鍘熷洜</div>
                      <div className="mt-1 leading-6 text-slate-100">{item.reason}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">寤鸿</div>
                      <div className="mt-1 leading-6 text-slate-100">{item.suggestion}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 text-slate-400">鏆傛棤椋庨櫓瀵硅薄</div>
        )}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">浼樺寲寤鸿</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">瀵硅薄 / 鍘熷洜 / 鎺柦 / 棰勬湡</div>
        </div>
        {preview.result.suggestions.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {preview.result.suggestions.map((item, index) => (
              <div key={`${item.target}-${item.action}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-400">浼樺寲瀵硅薄</div>
                    <div className="mt-1 text-base font-semibold text-white">{item.target}</div>
                  </div>
                  <Tag color={getSuggestionPriorityColor(item.priority)}>{item.priority}</Tag>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  <div>
                    <div className="text-slate-400">瑙﹀彂鍘熷洜</div>
                    <div className="mt-1 leading-6 text-slate-100">{item.reason}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">寤鸿鎺柦</div>
                    <div className="mt-1 leading-6 text-slate-100">{item.action}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">棰勬湡鏀剁泭</div>
                    <div className="mt-1 leading-6 text-slate-100">{item.expected}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-slate-400">鏆傛棤浼樺寲寤鸿</div>
        )}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="text-lg font-semibold text-white">鎶ュ憡鎽樿</div>
        <div className="mt-4 space-y-3">
          {preview.result.summary.length
            ? preview.result.summary.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                  {item}
                </div>
              ))
            : <div className="text-slate-400">鏆傛棤鎶ュ憡鎽樿</div>}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="text-lg font-semibold text-white">鏈€缁堢粨璁?/div>
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-200">
          {preview.result.conclusion || '鏆傛棤缁撹'}
        </div>
      </div>

      {preview.result.rawText ? (
        <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
          <div className="text-lg font-semibold text-white">鍘熷璁＄畻鏁版嵁</div>
          <pre className="report-raw-code mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4 text-xs leading-6 text-slate-200">
            {preview.result.rawText}
          </pre>
        </div>
      ) : null}

    </div>
  );
}
const REPORT_TYPE_OPTIONS: Array<{ label: string; value: ReportType }> = [
  { label: '鏅鸿兘鍒嗘瀽鎶ュ憡', value: 'AI_REPORT' },
  { label: '椋庨櫓澶嶇洏鎶ュ憡', value: 'RISK_REVIEW' },
  { label: '鑳借€楄瘖鏂姤鍛?, value: 'ENERGY_DIAGNOSIS' },
  { label: '杩愯绠€鎶?, value: 'OPERATION_BRIEF' },
];
const RANGE_OPTIONS: Array<{ label: string; value: RangePreset }> = [
  { label: '鏈€杩?澶?, value: '7d' },
  { label: '鏈€杩?0澶?, value: '30d' },
  { label: '鏈€杩?0澶?, value: '90d' },
  { label: '鏈勾搴?, value: 'year' },
  { label: '鍏ㄩ儴鍘嗗彶', value: 'all' },
  { label: '鑷畾涔?, value: 'custom' },
];
const INTELLIGENCE_OPTIONS: Array<{ label: string; value: IntelligenceLevel }> = [
  { label: '鏍囧噯', value: 'standard' },
  { label: '澧炲己', value: 'enhanced' },
  { label: '涓撳', value: 'expert' },
];
const OUTPUT_OPTIONS: Array<{ label: string; value: OutputFormat }> = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'DOCX 妯℃澘', value: 'docx' },
  { label: 'PDF 妯℃澘', value: 'pdf' },
];
const HISTORY_FILTER_OPTIONS: Array<{ label: string; value: HistoryFilter }> = [
  { label: '鍏ㄩ儴鎶ュ憡', value: 'all' },
  { label: 'AI鎶ュ憡', value: 'ai' },
  { label: '鏅€氭姤鍛?, value: 'normal' },
  { label: '宸插畬鎴?, value: 'completed' },
  { label: '鐢熸垚涓?, value: 'running' },
  { label: '澶辫触', value: 'failed' },
];

const CALCULATION_TYPE_LABELS: Record<string, string> = {
  HYDRAULIC: '姘村姏鍒嗘瀽',
  OPTIMIZATION: '娉电珯浼樺寲',
  SENSITIVITY: '鏁忔劅鎬у垎鏋?,
};

const HISTORY_FIELD_LABELS: Record<string, string> = {
  flowRate: '娴侀噺',
  density: '瀵嗗害',
  viscosity: '绮樺害',
  length: '绠￠亾闀垮害',
  diameter: '绠″緞',
  thickness: '澹佸帤',
  roughness: '绮楃硻搴?,
  startAltitude: '璧风偣楂樼▼',
  endAltitude: '缁堢偣楂樼▼',
  inletPressure: '棣栫珯杩涚珯鍘嬪ご',
  pump480Num: 'ZMI480 鏁伴噺',
  pump375Num: 'ZMI375 鏁伴噺',
  pump480Head: 'ZMI480 鎵▼',
  pump375Head: 'ZMI375 鎵▼',
  pumpEfficiency: '娉垫晥鐜?,
  motorEfficiency: '鐢垫満鏁堢巼',
  electricityPrice: '鐢典环',
  workingDays: '宸ヤ綔澶╂暟',
  hydraulicSlope: '姘村姏鍧￠檷',
  frictionHeadLoss: '鎽╅樆鎹熷け',
  totalHead: '鎬绘壃绋?,
  firstStationOutPressure: '棣栫珯鍑虹珯鍘嬪ご',
  endStationInPressure: '鏈珯杩涚珯鍘嬪ご',
  reynoldsNumber: '闆疯鏁?,
  flowRegime: '娴佹€?,
  totalPressureDrop: '鎬诲帇闄?,
  totalEnergyConsumption: '鎬昏兘鑰?,
  totalCost: '鎬绘垚鏈?,
  isFeasible: '鏂规鍙鎬?,
  totalCalculations: '鎬昏绠楁鏁?,
  duration: '鍒嗘瀽鑰楁椂',
};

const DEFAULT_ANALYSIS_TARGET = '褰撳墠鍒嗘瀽鑼冨洿';

function normalizeRiskLevel(value: unknown): RiskLevel {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '涓?;
  if (text.includes('楂?) || text.includes('high') || text.includes('critical') || text.includes('涓ラ噸')) return '楂?;
  if (text.includes('浣?) || text.includes('low')) return '浣?;
  return '涓?;
}

function getRiskLevelColor(level: RiskLevel) {
  if (level === '楂?) return 'red';
  if (level === '涓?) return 'gold';
  return 'blue';
}

function normalizeSuggestionPriority(value: unknown): SuggestionPriority {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '涓?;
  if (text.includes('楂?) || text.includes('high') || text.includes('critical') || text.includes('绱ф€?)) return '楂?;
  if (text.includes('浣?) || text.includes('low')) return '浣?;
  return '涓?;
}

function getSuggestionPriorityColor(priority: SuggestionPriority) {
  if (priority === '楂?) return 'red';
  if (priority === '涓?) return 'gold';
  return 'blue';
}

function pickFirstString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function buildRiskItem(
  target: string,
  riskType: string,
  level: RiskLevel,
  reason: string,
  suggestion: string,
): RiskItem {
  return {
    target: target.trim() || DEFAULT_ANALYSIS_TARGET,
    riskType: riskType.trim() || '椋庨櫓鎻愮ず',
    level,
    reason: reason.trim() || '闇€瑕佺粨鍚堜笂涓嬫枃杩涗竴姝ユ牳瀹炪€?,
    suggestion: suggestion.trim() || '寤鸿琛ュ厖鐜板満鏁版嵁鍚庡鏍搞€?,
  };
}

function buildSuggestionItem(
  target: string,
  reason: string,
  action: string,
  expected: string,
  priority: SuggestionPriority = '涓?,
): SuggestionItem {
  return {
    target: target.trim() || DEFAULT_ANALYSIS_TARGET,
    reason: reason.trim() || '闇€瑕佺粨鍚堜笂涓嬫枃琛ュ厖瑙﹀彂鍘熷洜銆?,
    action: action.trim() || '寤鸿缁撳悎褰撳墠宸ュ喌杩涗竴姝ュ鏍搞€?,
    expected: expected.trim() || '寤鸿琛ュ厖閲忓寲鏀剁泭鎴栧悗缁窡韪寚鏍囥€?,
    priority,
  };
}

function pickLabelValue(text: string, label: string) {
  const match = text.match(new RegExp(`${label}[锛?]\\s*([^\\n]+)`));
  return match?.[1]?.trim() ?? '';
}

function inferSuggestionPriorityFromText(text: string): SuggestionPriority {
  if (text.includes('楂樹紭鍏堢骇') || text.includes('绔嬪嵆') || text.includes('浼樺厛') || text.includes('寮傚父')) return '楂?;
  if (text.includes('璺熻釜') || text.includes('鎸佺画')) return '涓?;
  return '浣?;
}

function inferRiskTypeFromText(text: string) {
  if (text.includes('鍘嬮檷') || text.includes('鎽╅樆')) return '鍘嬮檷鍋忛珮';
  if (text.includes('鏁堢巼')) return '鏁堢巼涓嬮檷';
  if (text.includes('鑳借€?) || text.includes('娉㈠姩')) return '鑳借€楁尝鍔?;
  if (text.includes('涓嶅彲琛?)) return '鏂规涓嶅彲琛?;
  if (text.includes('澶辫触') || text.includes('閿欒')) return '璁＄畻澶辫触';
  if (text.includes('鍘嬪姏') || text.includes('鍘嬪ご')) return '鍘嬪姏寮傚父';
  return '椋庨櫓鎻愮ず';
}

function inferRiskLevelFromText(text: string): RiskLevel {
  if (text.includes('涓嶅彲琛?) || text.includes('澶辫触') || text.includes('閿欒') || text.includes('灏忎簬绛変簬 0')) return '楂?;
  if (text.includes('鍋忛珮') || text.includes('涓嬮檷') || text.includes('娉㈠姩') || text.includes('寮傚父')) return '涓?;
  return '浣?;
}

function normalizeRiskItem(value: unknown): RiskItem | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    return buildRiskItem(DEFAULT_ANALYSIS_TARGET, inferRiskTypeFromText(text), inferRiskLevelFromText(text), text, '寤鸿缁撳悎涓婁笅鏂囪繘涓€姝ュ鏍搞€?);
  }

  if (!isRecord(value)) return null;

  const target = pickFirstString(value, ['target', 'object', 'subject', 'name', 'riskObject', '瀵硅薄', '椋庨櫓瀵硅薄']);
  const riskType = pickFirstString(value, ['riskType', 'type', 'category', 'risk_category', '椋庨櫓绫诲瀷']);
  const reason = pickFirstString(value, ['reason', 'cause', 'description', 'detail', '鍘熷洜']);
  const suggestion = pickFirstString(value, ['suggestion', 'advice', 'recommendation', 'action', '寤鸿']);
  const summaryText = pickFirstString(value, ['summary', 'text', 'message']);

  if (!target && !riskType && !reason && !suggestion && !summaryText) return null;

  const mergedReason = reason || summaryText;
  return buildRiskItem(
    target || DEFAULT_ANALYSIS_TARGET,
    riskType || inferRiskTypeFromText(mergedReason || summaryText),
    normalizeRiskLevel(value.level ?? value.riskLevel ?? value['绛夌骇']),
    mergedReason || '闇€瑕佺粨鍚堜笂涓嬫枃杩涗竴姝ユ牳瀹炪€?,
    suggestion || '寤鸿缁撳悎涓婁笅鏂囪繘涓€姝ュ鏍搞€?,
  );
}

function normalizeRiskList(value: unknown): RiskItem[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeRiskItem(item))
      .filter((item): item is RiskItem => Boolean(item))
      .slice(0, 6);
  }

  if (typeof value === 'string') {
    return toLines(value)
      .map((item) => normalizeRiskItem(item))
      .filter((item): item is RiskItem => Boolean(item))
      .slice(0, 6);
  }

  return [];
}

function normalizeSuggestionItem(value: unknown): SuggestionItem | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const target = pickLabelValue(text, '瀵硅薄');
    const reason = pickLabelValue(text, '鍘熷洜');
    const action = pickLabelValue(text, '鎺柦') || pickLabelValue(text, '寤鸿');
    const expected = pickLabelValue(text, '棰勬湡');
    const priority = pickLabelValue(text, '浼樺厛绾?);
    return buildSuggestionItem(
      target || DEFAULT_ANALYSIS_TARGET,
      reason || '璇ュ缓璁潵鑷棫鐗堟枃鏈紝寤鸿缁撳悎鏈€鏂版暟鎹ˉ鍏呭師鍥犺鏄庛€?,
      action || text,
      expected || '寤鸿琛ュ厖閲忓寲鏀剁泭鎴栨墽琛屼紭鍏堢骇鍚庤惤鍦般€?,
      normalizeSuggestionPriority(priority || inferSuggestionPriorityFromText(text)),
    );
  }

  if (!isRecord(value)) return null;

  const target = pickFirstString(value, ['target', 'object', 'subject', 'name', '瀵硅薄']);
  const reason = pickFirstString(value, ['reason', 'cause', 'why', 'description', 'detail', '鍘熷洜']);
  const action = pickFirstString(value, ['action', 'measure', 'step', 'suggestion', 'advice', 'recommendation', '鎺柦', '寤鸿']);
  const expected = pickFirstString(value, ['expected', 'impact', 'benefit', 'result', 'outcome', '棰勬湡']);
  const summaryText = pickFirstString(value, ['summary', 'text', 'message']);

  if (!target && !reason && !action && !expected && !summaryText) return null;

  return buildSuggestionItem(
    target || DEFAULT_ANALYSIS_TARGET,
    reason || summaryText || '寤鸿缁撳悎涓婁笅鏂囪ˉ鍏呰Е鍙戝師鍥犮€?,
    action || summaryText || '寤鸿缁撳悎褰撳墠宸ュ喌杩涗竴姝ュ鏍搞€?,
    expected || '寤鸿琛ュ厖閲忓寲鏀剁泭鎴栧悗缁窡韪寚鏍囥€?,
    normalizeSuggestionPriority(value.priority ?? value.level ?? value['浼樺厛绾?] ?? value['绛夌骇'] ?? inferSuggestionPriorityFromText(`${reason} ${action} ${summaryText}`)),
  );
}

function normalizeSuggestionList(value: unknown): SuggestionItem[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeSuggestionItem(item))
      .filter((item): item is SuggestionItem => Boolean(item))
      .slice(0, 4);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    const labeledSuggestion = normalizeSuggestionItem(text);
    if (
      labeledSuggestion &&
      (text.includes('瀵硅薄锛?) || text.includes('鎺柦锛?) || text.includes('鍘熷洜锛?) || text.includes('棰勬湡锛?) || text.includes('浼樺厛绾э細'))
    ) {
      return [labeledSuggestion];
    }
    return toLines(text)
      .map((item) => normalizeSuggestionItem(item))
      .filter((item): item is SuggestionItem => Boolean(item))
      .slice(0, 4);
  }

  return [];
}

function normalizeDynamicReportSection(value: unknown): DynamicReportSectionPayload | null {
  if (!isRecord(value)) return null;
  const kind = pickFirstString(value, ['kind']);
  const allowedKinds: DynamicReportSectionPayload['kind'][] = ['metrics', 'bullets', 'table', 'markdown', 'callout'];
  const normalizedKind = allowedKinds.includes(kind as DynamicReportSectionPayload['kind'])
    ? (kind as DynamicReportSectionPayload['kind'])
    : 'bullets';
  const metrics = Array.isArray(value.metrics)
    ? value.metrics
        .filter((item): item is JsonRecord => isRecord(item))
        .map((item) => ({
          label: pickFirstString(item, ['label']) || '-',
          value: pickFirstString(item, ['value']) || '-',
          note: pickFirstString(item, ['note']) || undefined,
        }))
    : [];
  const items = Array.isArray(value.items)
    ? value.items
        .filter((item): item is JsonRecord => isRecord(item))
        .map((item) => ({
          title: pickFirstString(item, ['title']) || undefined,
          content: pickFirstString(item, ['content', 'text', 'summary']) || '',
        }))
        .filter((item) => item.content)
    : [];
  const table = isRecord(value.table)
    ? {
        columns: Array.isArray(value.table.columns) ? value.table.columns.map((item) => String(item)) : [],
        rows: Array.isArray(value.table.rows)
          ? value.table.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell)) : [String(row)]))
          : [],
      }
    : undefined;

  return {
    id: pickFirstString(value, ['id']) || `section-${Date.now()}`,
    kind: normalizedKind,
    title: pickFirstString(value, ['title']) || '鏈懡鍚嶇珷鑺?,
    summary: pickFirstString(value, ['summary']) || undefined,
    content: pickFirstString(value, ['content']) || undefined,
    metrics,
    items,
    table,
  };
}

function normalizeDynamicReport(value: unknown): DynamicReportResponsePayload | null {
  if (!isRecord(value)) return null;
  const source = pickFirstString(value, ['source']);
  const sections = Array.isArray(value.sections)
    ? value.sections
        .map((item) => normalizeDynamicReportSection(item))
        .filter((item): item is DynamicReportSectionPayload => Boolean(item))
    : [];

  return {
    title: pickFirstString(value, ['title']) || '鍔ㄦ€佹姤鍛?,
    abstract: pickFirstString(value, ['abstract']) || '',
    source: source === 'ai' || source === 'rules' || source === 'hybrid' ? source : 'rules',
    summary: toLines(value.summary),
    highlights: toLines(value.highlights),
    risks: normalizeRiskList(value.risks),
    suggestions: normalizeSuggestionList(value.suggestions),
    conclusion: pickFirstString(value, ['conclusion']) || '',
    sections,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    raw_text: pickFirstString(value, ['raw_text', 'rawText']) || '',
  };
}

function getOutputStyleLabel(style?: string | null) {
  if (style === 'simple') return '绠€鏄庣増';
  if (style === 'professional') return '涓撲笟鐗?;
  if (style === 'presentation') return '绠＄悊鐗?;
  return '';
}

function getOutputStyleFromLabel(label?: string | null): BusinessOutputStyle | undefined {
  if (label === '绠€鏄庣増') return 'simple';
  if (label === '涓撲笟鐗?) return 'professional';
  if (label === '绠＄悊鐗?) return 'presentation';
  return undefined;
}

function buildHistorySummary(preview?: PreviewRecord | LocalReportRecord) {
  if (!preview) {
    return '宸茬敓鎴愭櫤鑳芥姤鍛娿€?;
  }

  const style = preview.outputStyle ?? getOutputStyleFromLabel(preview.outputStyleLabel);
  const reportAbstract = preview.result.report?.abstract?.trim() || '';
  const firstSummary = preview.result.summary[0]?.trim() || '';
  const secondSummary = preview.result.summary[1]?.trim() || '';
  const firstHighlight = preview.result.highlights[0]?.trim() || '';
  const conclusion = preview.result.conclusion?.trim() || '';

  if (style === 'simple') {
    return firstSummary || firstHighlight || conclusion || reportAbstract || '宸茬敓鎴愮畝鏄庣増鎶ュ憡銆?;
  }

  if (style === 'presentation') {
    return conclusion || firstHighlight || firstSummary || reportAbstract || '宸茬敓鎴愮鐞嗙増鎶ュ憡銆?;
  }

  return reportAbstract || [firstSummary, secondSummary].filter(Boolean).join(' ') || conclusion || '宸茬敓鎴愪笓涓氱増鎶ュ憡銆?;
}

function buildRichHistorySummary(preview?: PreviewRecord | LocalReportRecord) {
  if (!preview) {
    return '宸茬敓鎴愭櫤鑳芥姤鍛娿€?;
  }

  const legacySummary = buildHistorySummary(preview);
  const styleMeta = getOutputStyleMeta(preview.outputStyle, preview.outputStyleLabel);
  const reportAbstract = preview.result.report?.abstract?.trim() || '';
  const firstSummary = preview.result.summary[0]?.trim() || '';
  const secondSummary = preview.result.summary[1]?.trim() || '';
  const firstHighlight = preview.result.highlights[0]?.trim() || '';
  const conclusion = preview.result.conclusion?.trim() || '';
  const sectionCount = preview.result.report?.sections?.length ?? 0;
  const metricsLabel = `${preview.result.summary.length} 鏉℃憳瑕?/ ${sectionCount} 涓珷鑺俙;

  if (styleMeta.style === 'simple') {
    return `${styleMeta.label} 路 ${metricsLabel} 路 ${firstSummary || firstHighlight || reportAbstract || conclusion || legacySummary}`;
  }

  if (styleMeta.style === 'presentation') {
    return `${styleMeta.label} 路 ${metricsLabel} 路 ${conclusion || firstHighlight || firstSummary || reportAbstract || legacySummary}`;
  }

  return `${styleMeta.label} 路 ${metricsLabel} 路 ${reportAbstract || [firstSummary, secondSummary].filter(Boolean).join(' ') || conclusion || legacySummary}`;
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br />');
}

function formatPercent(value: number, digits = 1) {
  return `${new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value * 100)}%`;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatTime(value?: string) {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : value.replace('T', ' ');
}

function getRangeLabel(preset: RangePreset, customRange: DateRangeValue) {
  if (preset === 'custom' && customRange) {
    return `${customRange[0].format('YYYY-MM-DD')} 鑷?${customRange[1].format('YYYY-MM-DD')}`;
  }
  return RANGE_OPTIONS.find((item) => item.value === preset)?.label ?? '鏈€杩?0澶?;
}

function getComparisonLabel(preset: RangePreset, customRange: DateRangeValue) {
  if (preset === 'custom' && customRange) {
    const currentStart = customRange[0].startOf('day');
    const currentEnd = customRange[1].endOf('day');
    const days = currentEnd.startOf('day').diff(currentStart.startOf('day'), 'day') + 1;
    const previousEnd = currentStart.subtract(1, 'day').endOf('day');
    const previousStart = previousEnd.subtract(days - 1, 'day').startOf('day');
    return `${currentStart.format('YYYY-MM-DD')} 鑷?${currentEnd.format('YYYY-MM-DD')} vs ${previousStart.format('YYYY-MM-DD')} 鑷?${previousEnd.format('YYYY-MM-DD')}`;
  }
  if (preset === '7d') return '鏈€杩?澶?vs 鍓?澶?;
  if (preset === '30d') return '鏈€杩?0澶?vs 鍓?0澶?;
  if (preset === '90d') return '鏈€杩?0澶?vs 鍓?0澶?;
  if (preset === 'year') return '鏈勾搴?vs 鍘诲勾鍚屾湡';
  return '鍏ㄩ儴鍘嗗彶绱锛堟棤鍓嶇疆鍛ㄦ湡锛?;
}

function getRangeWindow(preset: RangePreset, customRange: DateRangeValue) {
  if (preset === 'custom') {
    return { start: customRange?.[0]?.startOf('day') ?? null, end: customRange?.[1]?.endOf('day') ?? null };
  }
  if (preset === 'all') return { start: null, end: null };
  if (preset === 'year') return { start: dayjs().startOf('year'), end: dayjs().endOf('day') };
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { start: dayjs().subtract(days - 1, 'day').startOf('day'), end: dayjs().endOf('day') };
}

function inWindow(value: string | undefined, start: Dayjs | null, end: Dayjs | null) {
  if (!value) return false;
  const current = dayjs(value);
  if (!current.isValid()) return false;
  if (start && current.isBefore(start)) return false;
  if (end && current.isAfter(end)) return false;
  return true;
}


function toLines(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\r?\n|(?<=[銆傦紒锛燂紱!?])/).map((item) => item.replace(/^[\d.銆乗-\s]+/, '').trim()).filter(Boolean);
  }
  return [];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonRecord(value?: string): JsonRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? '鏄? : '鍚?;
  if (Array.isArray(value)) {
    const text = value.map((item) => formatFieldValue(item)).filter((item) => item !== '-').join('锛?);
    return text || '-';
  }
  if (isRecord(value)) return JSON.stringify(value, null, 2);
  return String(value);
}

function isFilledSnapshotValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function getCollectionCompleteness<T extends object>(items: T[], keys: string[]) {
  if (!items.length || !keys.length) return { filled: 0, total: 0 };
  return items.reduce((acc, item) => {
    const current = item as Record<string, unknown>;
    keys.forEach((key) => {
      acc.total += 1;
      if (isFilledSnapshotValue(current[key])) acc.filled += 1;
    });
    return acc;
  }, { filled: 0, total: 0 });
}

function getHistoryCompleteness(histories: CalculationHistory[]) {
  if (!histories.length) return { filled: 0, total: 0 };
  return histories.reduce((acc, history) => {
    const checks = [
      Boolean(history.calcType?.trim() || history.calcTypeName?.trim()),
      typeof history.projectId === 'number' || Boolean(history.projectName?.trim()),
      Boolean(history.createTime && dayjs(history.createTime).isValid()),
      Object.keys(parseJsonRecord(history.inputParams)).length > 0,
      Object.keys(parseJsonRecord(history.outputResult)).length > 0,
    ];
    acc.total += checks.length;
    acc.filled += checks.filter(Boolean).length;
    return acc;
  }, { filled: 0, total: 0 });
}

function getHistoryStatusLabel(status?: number) {
  if (status === 0) return '鐢熸垚涓?;
  if (status === 2) return '澶辫触';
  return '宸插畬鎴?;
}

function getHistoryTypeLabel(history: CalculationHistory) {
  if (history.calcTypeName?.trim()) return history.calcTypeName;
  const calcType = history.calcType?.toUpperCase();
  if (calcType && CALCULATION_TYPE_LABELS[calcType]) return CALCULATION_TYPE_LABELS[calcType];
  return history.calcType || '鏅€氭姤鍛?;
}

function getHistoryInputSource(history: CalculationHistory, input: JsonRecord) {
  return history.calcType?.toUpperCase() === 'SENSITIVITY' && isRecord(input.baseParams) ? input.baseParams : input;
}

function getHistoryOutputSource(history: CalculationHistory, output: JsonRecord) {
  return history.calcType?.toUpperCase() === 'SENSITIVITY' && isRecord(output.baseResult) ? output.baseResult : output;
}

function getHistoryCalcTypeKey(history: CalculationHistory) {
  const calcType = history.calcType?.toUpperCase();
  if (calcType === 'HYDRAULIC' || calcType === 'OPTIMIZATION' || calcType === 'SENSITIVITY') return calcType;
  const typeLabel = getHistoryTypeLabel(history);
  if (typeLabel.includes('姘村姏')) return 'HYDRAULIC';
  if (typeLabel.includes('浼樺寲')) return 'OPTIMIZATION';
  if (typeLabel.includes('鏁忔劅')) return 'SENSITIVITY';
  return 'NORMAL';
}

function pickRecordValue(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined || value === '') continue;
    return value;
  }
  return undefined;
}

function buildHistoryFieldRows(record: JsonRecord, fields: Array<{ label: string; keys: string[] }>) {
  return fields
    .map((field) => {
      const value = pickRecordValue(record, field.keys);
      if (value === undefined) return null;
      return [field.label, formatFieldValue(value)];
    })
    .filter((item): item is [string, string] => Boolean(item));
}

function buildOptimizationPumpCombination(output: JsonRecord) {
  const direct = pickFirstString(output, ['recommendedPumpCombination', 'pumpCombination']);
  if (direct) return direct;

  const pump375Num = toFiniteNumber(output.pump375Num);
  const pump480Num = toFiniteNumber(output.pump480Num);
  if (pump375Num !== null || pump480Num !== null) {
    return `ZMB375 寮€鍚?${pump375Num ?? 0} 鍙帮紝ZMB480 寮€鍚?${pump480Num ?? 0} 鍙癭;
  }

  return '';
}

function buildSensitivitySummaryRows(output: JsonRecord) {
  const baseResult = isRecord(output.baseResult) ? output.baseResult : output;
  const rows: Array<[string, string]> = [];

  const baseValue =
    pickRecordValue(baseResult, ['endStationInPressure', 'frictionHeadLoss', 'totalHead']) ??
    pickRecordValue(output, ['baseResultValue']);
  if (baseValue !== undefined) rows.push(['鍩哄噯缁撴灉', formatFieldValue(baseValue)]);

  const sensitivityCoefficient = pickRecordValue(output, ['sensitivityCoefficient', 'coefficient']);
  if (sensitivityCoefficient !== undefined) rows.push(['鏁忔劅绯绘暟', formatFieldValue(sensitivityCoefficient)]);

  const maxImpact = pickRecordValue(output, ['maxImpactAmplitude', 'maxImpact', 'maximumImpact']);
  if (maxImpact !== undefined) rows.push(['鏈€澶у奖鍝嶅箙搴?, formatFieldValue(maxImpact)]);

  const ranking = pickRecordValue(output, ['ranking', 'rank']);
  if (ranking !== undefined) rows.push(['鎺掑悕', formatFieldValue(ranking)]);

  return rows;
}

function buildSensitivityDetailRows(output: JsonRecord) {
  const details = Array.isArray(output.details)
    ? output.details
    : Array.isArray(output.detailList)
      ? output.detailList
      : Array.isArray(output.sensitivityDetails)
        ? output.sensitivityDetails
        : [];

  return details
    .filter((item): item is JsonRecord => isRecord(item))
    .map((item) => [
      formatFieldValue(pickRecordValue(item, ['changePercent', 'ratio', 'changeRate'])),
      formatFieldValue(pickRecordValue(item, ['pressure', 'endStationInPressure'])),
      formatFieldValue(pickRecordValue(item, ['frictionHeadLoss', 'frictionLoss'])),
      formatFieldValue(pickRecordValue(item, ['flowRegime', 'regime'])),
    ]);
}

function buildHistoryStructuredReport(
  history: CalculationHistory,
  inputSource: JsonRecord,
  outputSource: JsonRecord,
  summary: string[],
  risks: RiskItem[],
  suggestions: SuggestionItem[],
  conclusion: string,
  rawText: string,
): DynamicReportResponsePayload {
  const typeKey = getHistoryCalcTypeKey(history);
  const sections: DynamicReportSectionPayload[] = [
    {
      id: 'history-summary',
      kind: 'bullets',
      title: '璁板綍姒傝',
      summary: '鏅€氭姤鍛婂熀浜庡巻鍙茶绠楄褰曞洖鏀剧敓鎴愩€?,
      content: undefined,
      metrics: [],
      items: summary.map((item, index) => ({ title: `瑕佺偣 ${index + 1}`, content: item })),
      table: null,
    },
  ];

  const inputRows = buildHistoryFieldRows(inputSource, COMMON_HISTORY_INPUT_FIELDS);
  if (inputRows.length) {
    sections.push({
      id: 'history-inputs',
      kind: 'table',
      title: '璁＄畻鍏ュ弬',
      summary: '鎶ュ憡缁熶竴灞曠ず鏈鏅€氳绠椾娇鐢ㄧ殑鍏抽敭杈撳叆鍙傛暟銆?,
      content: undefined,
      metrics: [],
      items: [],
      table: {
        columns: ['鍙傛暟椤?, '鍙傛暟鍊?],
        rows: inputRows,
      },
    });
  }

  if (typeKey === 'HYDRAULIC') {
    const hydraulicRows = buildHistoryFieldRows(outputSource, HYDRAULIC_RESULT_FIELDS);
    if (hydraulicRows.length) {
      sections.push({
        id: 'history-hydraulic-results',
        kind: 'table',
        title: '姘村姏缁撴灉',
        summary: '灞曠ず姘村姏鍒嗘瀽瀵瑰簲鐨勬牳蹇冭绠楃粨鏋溿€?,
        content: undefined,
        metrics: [],
        items: [],
        table: {
          columns: ['缁撴灉椤?, '缁撴灉鍊?],
          rows: hydraulicRows,
        },
      });
    }
  }

  if (typeKey === 'OPTIMIZATION') {
    const optimizationRecord: JsonRecord = {
      ...outputSource,
      recommendedPumpCombination: buildOptimizationPumpCombination(outputSource) || outputSource.recommendedPumpCombination,
    };
    const optimizationRows = buildHistoryFieldRows(optimizationRecord, OPTIMIZATION_RESULT_FIELDS);
    if (optimizationRows.length) {
      sections.push({
        id: 'history-optimization-results',
        kind: 'table',
        title: '浼樺寲缁撴灉',
        summary: '灞曠ず娉电粍浼樺寲璁＄畻杈撳嚭鐨勬柟妗堜笌缁忔祹鎬х粨鏋溿€?,
        content: undefined,
        metrics: [],
        items: [],
        table: {
          columns: ['缁撴灉椤?, '缁撴灉鍊?],
          rows: optimizationRows,
        },
      });
    }
  }

  if (typeKey === 'SENSITIVITY') {
    const sensitivityRows = buildSensitivitySummaryRows(parseJsonRecord(history.outputResult));
    if (sensitivityRows.length) {
      sections.push({
        id: 'history-sensitivity-results',
        kind: 'table',
        title: '鏁忔劅鎬х粨鏋?,
        summary: '灞曠ず鏁忔劅鎬у垎鏋愮殑鍩哄噯缁撴灉銆佹晱鎰熺郴鏁板拰褰卞搷鎺掑簭銆?,
        content: undefined,
        metrics: [],
        items: [],
        table: {
          columns: ['缁撴灉椤?, '缁撴灉鍊?],
          rows: sensitivityRows,
        },
      });
    }

    const sensitivityDetailRows = buildSensitivityDetailRows(parseJsonRecord(history.outputResult));
    if (sensitivityDetailRows.length) {
      sections.push({
        id: 'history-sensitivity-detail',
        kind: 'table',
        title: '鍚勫彉鍖栨瘮渚嬩笅鐨勫帇鍔?鎽╅樆/娴佹€佹槑缁?,
        summary: '灞曠ず涓嶅悓鍙樺寲姣斾緥涓嬬殑鍘嬪姏銆佹懇闃讳笌娴佹€佹槑缁嗐€?,
        content: undefined,
        metrics: [],
        items: [],
        table: {
          columns: ['鍙樺寲姣斾緥', '鍘嬪姏', '鎽╅樆', '娴佹€?],
          rows: sensitivityDetailRows,
        },
      });
    }
  }

  if (risks.length) {
    sections.push({
      id: 'history-risks',
      kind: 'bullets',
      title: '涓昏椋庨櫓',
      summary: '鍩轰簬鏈璁＄畻缁撴灉璇嗗埆鍑虹殑閲嶇偣椋庨櫓銆?,
      content: undefined,
      metrics: [],
      items: risks.map((item) => ({
        title: `${item.riskType}锛?{item.level}锛塦,
        content: `${item.reason} 寤鸿锛?{item.suggestion}`,
      })),
      table: null,
    });
  }

  if (suggestions.length) {
    sections.push({
      id: 'history-suggestions',
      kind: 'bullets',
      title: '浼樺寲寤鸿',
      summary: '鏍规嵁鏈鏅€氳绠楃粨鏋滄暣鐞嗗嚭鐨勫缓璁姩浣溿€?,
      content: undefined,
      metrics: [],
      items: suggestions.map((item) => ({
        title: `${item.target}锛?{item.priority}锛塦,
        content: `${item.action} 棰勬湡锛?{item.expected}`,
      })),
      table: null,
    });
  }

  if (conclusion) {
    sections.push({
      id: 'history-conclusion',
      kind: 'callout',
      title: '鎶ュ憡缁撹',
      summary: undefined,
      content: conclusion,
      metrics: [],
      items: [],
      table: null,
    });
  }

  return {
    title: `${history.projectName || '鏈懡鍚嶉」鐩?} ${getHistoryTypeLabel(history)}`,
    abstract: summary[0] || '鏅€氳绠楄褰曠粨鏋勫寲鎶ュ憡銆?,
    source: 'rules',
    summary,
    highlights: summary.slice(0, 3),
    risks,
    suggestions,
    conclusion,
    sections,
    metadata: {
      history_id: history.id,
      calc_type: history.calcType || '',
      structured_from_history: true,
    },
    raw_text: rawText,
  };
}

function isHistoryAbnormal(history: CalculationHistory) {
  const outputSource = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
  if (history.status === 2) return true;
  if (history.errorMessage?.trim()) return true;
  if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) return true;
  if (outputSource.isFeasible === false) return true;
  if (
    typeof outputSource.frictionHeadLoss === 'number' &&
    typeof outputSource.totalHead === 'number' &&
    outputSource.totalHead > 0 &&
    outputSource.frictionHeadLoss / outputSource.totalHead > 0.7
  ) {
    return true;
  }
  return false;
}

function buildMetricLines(source: JsonRecord, limit: number) {
  return Object.entries(source)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .filter(([, value]) => !isRecord(value))
    .slice(0, limit)
    .map(([key, value]) => `${HISTORY_FIELD_LABELS[key] ?? key}锛?{formatFieldValue(value)}`);
}

function normalizeEfficiencyRatio(value: unknown) {
  const numberValue = toFiniteNumber(value);
  if (numberValue === null || numberValue <= 0) return null;
  return numberValue > 1 ? numberValue / 100 : numberValue;
}

function buildProjectInsights(
  selectedProjects: Project[],
  visiblePipelines: Pipeline[],
  visibleHistories: CalculationHistory[],
): ProjectInsight[] {
  const pipelinesByProject = new Map<number, Pipeline[]>();
  const historiesByProject = new Map<number, CalculationHistory[]>();

  visiblePipelines.forEach((item) => {
    const list = pipelinesByProject.get(item.proId) ?? [];
    list.push(item);
    pipelinesByProject.set(item.proId, list);
  });

  visibleHistories.forEach((item) => {
    if (typeof item.projectId !== 'number') return;
    const list = historiesByProject.get(item.projectId) ?? [];
    list.push(item);
    historiesByProject.set(item.projectId, list);
  });

  return selectedProjects.map((project) => {
    const projectPipelines = pipelinesByProject.get(project.proId) ?? [];
    const projectHistories = historiesByProject.get(project.proId) ?? [];
    let abnormalCount = 0;
    let failedCount = 0;
    let lowPressureCount = 0;
    let infeasibleCount = 0;
    let frictionRatioSum = 0;
    let frictionRatioCount = 0;
    let energyIntensitySum = 0;
    let energyIntensityCount = 0;

    projectHistories.forEach((history) => {
      const input = getHistoryInputSource(history, parseJsonRecord(history.inputParams));
      const output = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
      if (isHistoryAbnormal(history)) abnormalCount += 1;
      if (history.status === 2) failedCount += 1;
      if (typeof output.endStationInPressure === 'number' && output.endStationInPressure <= 0) lowPressureCount += 1;
      if (output.isFeasible === false) infeasibleCount += 1;

      const frictionHeadLoss = toFiniteNumber(output.frictionHeadLoss);
      const totalHead = toFiniteNumber(output.totalHead);
      if (frictionHeadLoss !== null && totalHead !== null && totalHead > 0) {
        frictionRatioSum += frictionHeadLoss / totalHead;
        frictionRatioCount += 1;
      }

      const totalEnergyConsumption = toFiniteNumber(output.totalEnergyConsumption);
      const flowRate = toFiniteNumber(input.flowRate ?? output.flowRate);
      if (totalEnergyConsumption !== null && flowRate !== null && flowRate > 0) {
        energyIntensitySum += totalEnergyConsumption / flowRate;
        energyIntensityCount += 1;
      }
    });

    return {
      project,
      pipelineCount: projectPipelines.length,
      totalThroughput: projectPipelines.reduce((sum, item) => sum + (toFiniteNumber(item.throughput) ?? 0), 0),
      historyCount: projectHistories.length,
      abnormalCount,
      failedCount,
      lowPressureCount,
      infeasibleCount,
      avgFrictionRatio: frictionRatioCount ? frictionRatioSum / frictionRatioCount : null,
      avgEnergyIntensity: energyIntensityCount ? energyIntensitySum / energyIntensityCount : null,
    };
  });
}

function buildProjectContextLines(projectInsights: ProjectInsight[]) {
  return projectInsights
    .sort((left, right) => (right.abnormalCount - left.abnormalCount) || ((right.avgEnergyIntensity ?? 0) - (left.avgEnergyIntensity ?? 0)))
    .slice(0, 5)
    .map((item) => {
      const parts = [
        `绠￠亾 ${item.pipelineCount} 鏉,
        item.totalThroughput > 0 ? `璁捐杈撻噺 ${formatNumber(item.totalThroughput)}` : '',
        `鍘嗗彶 ${item.historyCount} 鏉,
        `寮傚父 ${item.abnormalCount} 鏉,
        item.avgEnergyIntensity !== null ? `鍗曚綅杈撻噺鑳借€楁寚鏁?${formatNumber(item.avgEnergyIntensity)}` : '',
        item.avgFrictionRatio !== null ? `骞冲潎鎽╅樆鍗犳瘮 ${formatPercent(item.avgFrictionRatio)}` : '',
      ].filter(Boolean);
      return `${item.project.name}锛?{parts.join('锛?)}`;
    });
}

function buildAnalysisRisks(projectInsights: ProjectInsight[]) {
  const risks: RiskItem[] = [];
  const seen = new Set<string>();

  const pushRisk = (item: RiskItem | null) => {
    if (!item) return;
    const key = `${item.target}-${item.riskType}`;
    if (seen.has(key)) return;
    seen.add(key);
    risks.push(item);
  };

  const abnormalProject = [...projectInsights]
    .filter((item) => item.abnormalCount > 0)
    .sort((left, right) => (right.abnormalCount - left.abnormalCount) || (right.failedCount - left.failedCount))[0];

  if (abnormalProject) {
    pushRisk(buildRiskItem(
      abnormalProject.project.name,
      '鍘嗗彶寮傚父闆嗕腑',
      abnormalProject.lowPressureCount > 0 || abnormalProject.infeasibleCount > 0 ? '楂? : '涓?,
      `${abnormalProject.historyCount} 鏉″巻鍙蹭腑鏈?${abnormalProject.abnormalCount} 鏉″紓甯搞€俙,
      '寤鸿浼樺厛澶嶆牳璇ラ」鐩殑鍏抽敭鍏ュ弬銆佸帇鍔涚害鏉熷拰璁＄畻杈圭晫鏉′欢銆?,
    ));
  }

  const frictionProject = [...projectInsights]
    .filter((item) => item.avgFrictionRatio !== null && item.avgFrictionRatio > 0.7)
    .sort((left, right) => (right.avgFrictionRatio ?? 0) - (left.avgFrictionRatio ?? 0))[0];

  if (frictionProject?.avgFrictionRatio !== null) {
    pushRisk(buildRiskItem(
      frictionProject.project.name,
      '鎽╅樆鍗犳瘮鍋忛珮',
      frictionProject.avgFrictionRatio > 0.85 ? '楂? : '涓?,
      `骞冲潎鎽╅樆鍗犳瘮绾?${formatPercent(frictionProject.avgFrictionRatio)}銆俙,
      '寤鸿澶嶆牳绠″緞銆佺矖绯欏害鍜岃繍琛屾祦閲忥紝蹇呰鏃堕噸鏂版牎鏍告按鍔涘弬鏁般€?,
    ));
  }

  const energyProject = [...projectInsights]
    .filter((item) => item.avgEnergyIntensity !== null)
    .sort((left, right) => (right.avgEnergyIntensity ?? 0) - (left.avgEnergyIntensity ?? 0))[0];

  if (energyProject?.avgEnergyIntensity !== null) {
    pushRisk(buildRiskItem(
      energyProject.project.name,
      '鑳借€楁按骞冲亸楂?,
      '涓?,
      `鍗曚綅杈撻噺鑳借€楁寚鏁扮害 ${formatNumber(energyProject.avgEnergyIntensity)}銆俙,
      '寤鸿缁撳悎娉电珯缁勫悎銆佹晥鐜囧拰鐢典环杩涗竴姝ュ仛鑺傝兘浼樺寲銆?,
    ));
  }

  return risks.slice(0, 4);
}

function buildPumpStationContextLines(pumpStations: PumpStation[]) {
  return pumpStations
    .map((station) => {
      const pumpEfficiency = normalizeEfficiencyRatio(station.pumpEfficiency);
      const electricEfficiency = normalizeEfficiencyRatio(station.electricEfficiency);
      const combinedEfficiency = pumpEfficiency !== null && electricEfficiency !== null ? pumpEfficiency * electricEfficiency : null;
      const parts = [
        pumpEfficiency !== null ? `娉垫晥鐜?${formatPercent(pumpEfficiency)}` : '',
        electricEfficiency !== null ? `鐢垫満鏁堢巼 ${formatPercent(electricEfficiency)}` : '',
        combinedEfficiency !== null ? `缁煎悎鏁堢巼 ${formatPercent(combinedEfficiency)}` : '',
        toFiniteNumber(station.displacement) !== null ? `鎺掗噺 ${formatNumber(station.displacement)}` : '',
      ].filter(Boolean);
      return { text: `${station.name}锛?{parts.join('锛?)}`, combinedEfficiency: combinedEfficiency ?? Number.POSITIVE_INFINITY };
    })
    .sort((left, right) => left.combinedEfficiency - right.combinedEfficiency)
    .slice(0, 5)
    .map((item) => item.text);
}

function buildAnalysisSuggestions(
  projectInsights: ProjectInsight[],
  pumpStations: PumpStation[],
  selectedProjects: Project[],
  historyCount: number,
  dataCompletenessRate: number,
): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];
  const seen = new Set<string>();
  const pushSuggestion = (item: SuggestionItem | null) => {
    if (!item) return;
    const key = `${item.target}|${item.action}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(item);
  };

  const energyProjects = projectInsights.filter((item) => item.avgEnergyIntensity !== null);
  if (energyProjects.length) {
    const avgEnergyIntensity = energyProjects.reduce((sum, item) => sum + (item.avgEnergyIntensity ?? 0), 0) / energyProjects.length;
    const highestEnergyProject = [...energyProjects].sort((left, right) => (right.avgEnergyIntensity ?? 0) - (left.avgEnergyIntensity ?? 0))[0];
    if (highestEnergyProject?.avgEnergyIntensity !== null && avgEnergyIntensity > 0 && highestEnergyProject.avgEnergyIntensity > avgEnergyIntensity * 1.05) {
      const deviation = (highestEnergyProject.avgEnergyIntensity - avgEnergyIntensity) / avgEnergyIntensity;
      pushSuggestion(buildSuggestionItem(
        highestEnergyProject.project.name,
        `鍗曚綅杈撻噺鑳借€楅珮浜庡凡閫夐」鐩潎鍊?${formatPercent(deviation)}銆俙,
        '浼樺寲娉电珯璐熻嵎鍒嗛厤锛屽鏍搁珮宄版椂娈佃繍琛岀瓥鐣ャ€?,
        '棰勮鍙檷浣庡崟浣嶈緭閲忚兘鑰?5%~8%銆?,
        deviation > 0.12 ? '楂? : '涓?,
      ));
    }
  }

  const abnormalProject = [...projectInsights].sort((left, right) => (right.abnormalCount - left.abnormalCount) || (right.failedCount - left.failedCount))[0];
  if (abnormalProject && abnormalProject.abnormalCount > 0) {
    const reasonParts = [
      `${abnormalProject.historyCount} 鏉″巻鍙蹭腑鏈?${abnormalProject.abnormalCount} 鏉″紓甯竊,
      abnormalProject.lowPressureCount > 0 ? `鏈珯鍘嬪姏涓嶈冻 ${abnormalProject.lowPressureCount} 娆 : '',
      abnormalProject.infeasibleCount > 0 ? `鏂规涓嶅彲琛?${abnormalProject.infeasibleCount} 娆 : '',
    ].filter(Boolean);
    pushSuggestion(buildSuggestionItem(
      abnormalProject.project.name,
      reasonParts.join('锛?),
      '澶嶆牳鍏ュ彛鍘嬪ご銆佹车鎵▼涓庢祦閲忚瀹氾紝蹇呰鏃堕噸鏂版墽琛屾按鍔涘垎鏋愬拰娉电珯浼樺寲銆?,
      '浼樺厛娑堥櫎涓嶅彲琛屽伐鍐碉紝鍑忓皯寮傚父鍥炴斁娆℃暟銆?,
      abnormalProject.lowPressureCount > 0 || abnormalProject.infeasibleCount > 0 ? '楂? : '涓?,
    ));
  }

  const frictionProject = [...projectInsights]
    .filter((item) => item.avgFrictionRatio !== null && item.avgFrictionRatio > 0.7)
    .sort((left, right) => (right.avgFrictionRatio ?? 0) - (left.avgFrictionRatio ?? 0))[0];
  if (frictionProject) {
    pushSuggestion(buildSuggestionItem(
      frictionProject.project.name,
      `骞冲潎鎽╅樆鎹熷け鍗犳€绘壃绋?${formatPercent(frictionProject.avgFrictionRatio ?? 0)}锛屾部绋嬪帇闄嶅亸楂樸€俙,
      '澶嶆牳绠￠亾绮楃硻搴︺€佹竻绠¤鍒掑拰褰撳墠杈撻噺璁剧疆锛屽繀瑕佹椂鎷嗗垎宄板€煎伐鍐点€?,
      '鏈夊姪浜庡洖鏀堕儴鍒嗘壃绋嬭搴﹀苟闄嶄綆娌跨▼鎹熷け銆?,
      (frictionProject.avgFrictionRatio ?? 0) > 0.85 ? '楂? : '涓?,
    ));
  }

  const stationCandidates = pumpStations
    .map((station) => {
      const pumpEfficiency = normalizeEfficiencyRatio(station.pumpEfficiency);
      const electricEfficiency = normalizeEfficiencyRatio(station.electricEfficiency);
      if (pumpEfficiency === null || electricEfficiency === null) return null;
      return {
        station,
        combinedEfficiency: pumpEfficiency * electricEfficiency,
      };
    })
    .filter((item): item is { station: PumpStation; combinedEfficiency: number } => Boolean(item));
  if (stationCandidates.length) {
    const averageEfficiency = stationCandidates.reduce((sum, item) => sum + item.combinedEfficiency, 0) / stationCandidates.length;
    const lowestEfficiencyStation = [...stationCandidates].sort((left, right) => left.combinedEfficiency - right.combinedEfficiency)[0];
    if (averageEfficiency > 0 && lowestEfficiencyStation.combinedEfficiency < averageEfficiency * 0.95) {
      const deviation = (averageEfficiency - lowestEfficiencyStation.combinedEfficiency) / averageEfficiency;
      pushSuggestion(buildSuggestionItem(
        lowestEfficiencyStation.station.name,
        `缁煎悎鏁堢巼浣庝簬鍏变韩娉电珯鍧囧€?${formatPercent(deviation)}銆俙,
        '妫€鏌ユ车棰戠巼涓庢壃绋嬪尮閰嶆儏鍐碉紝澶嶆牳娉电粍鍒囨崲涓庤礋鑽峰垎閰嶇瓥鐣ャ€?,
        '鏈夊姪浜庡噺灏戞棤鏁堟壃绋嬪拰鍗曚綅鐢佃€椼€?,
        deviation > 0.1 ? '楂? : '涓?,
      ));
    }
  }

  if (!suggestions.length) {
    pushSuggestion(buildSuggestionItem(
      selectedProjects[0]?.name || DEFAULT_ANALYSIS_TARGET,
      historyCount > 0
        ? `褰撳墠鍒嗘瀽鑼冨洿鍏辨湁 ${historyCount} 鏉″巻鍙茶褰曪紝鏁版嵁瀹屾暣鐜?${dataCompletenessRate}%銆俙
        : '褰撳墠鍒嗘瀽鑼冨洿缂哄皯鍙鐢ㄧ殑鍘嗗彶鍒嗘瀽鏍锋湰銆?,
      historyCount > 0 ? '琛ラ綈鍏抽敭鍙傛暟鍙ｅ緞骞剁户缁Н绱巻鍙叉牱鏈紝鍐嶅仛娣卞害浼樺寲鍒嗘瀽銆? : '鍏堣ˉ榻愰」鐩€佺閬撳拰鍘嗗彶鍒嗘瀽鏁版嵁锛屽啀鎵ц娣卞叆璇婃柇銆?,
      '鎻愬崌鍚庣画寤鸿鐨勯噺鍖栫▼搴﹀拰鍙墽琛屾€с€?,
      historyCount > 0 ? '涓? : '楂?,
    ));
  }

  return suggestions.slice(0, 4);
}

function buildHistorySuggestions(history: CalculationHistory, inputSource: JsonRecord, outputSource: JsonRecord) {
  const calcType = history.calcType?.toUpperCase();
  const projectName = history.projectName || DEFAULT_ANALYSIS_TARGET;
  const suggestions: SuggestionItem[] = [];

  const pushSuggestion = (item: SuggestionItem | null) => {
    if (!item) return;
    const key = `${item.target}-${item.reason}-${item.action}`;
    if (suggestions.some((current) => `${current.target}-${current.reason}-${current.action}` === key)) return;
    suggestions.push(item);
  };

  if (calcType === 'HYDRAULIC') {
    const endPressure = toFiniteNumber(outputSource.endStationInPressure);
    const totalHead = toFiniteNumber(outputSource.totalHead);
    const frictionLoss = toFiniteNumber(outputSource.frictionHeadLoss);
    const frictionRatio = totalHead && frictionLoss !== null && totalHead > 0 ? frictionLoss / totalHead : null;
    const reynoldsNumber = toFiniteNumber(outputSource.reynoldsNumber);
    const flowRegime = pickFirstString(outputSource, ['flowRegime', 'regime']);

    if (endPressure !== null && endPressure <= 0) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `鏈珯杩涚珯鍘嬪ご涓?${formatFieldValue(endPressure)}锛屽綋鍓嶅伐鍐垫棤娉曚繚璇佹湯绔欐鍘嬨€俙,
        '浼樺厛澶嶆牳棣栫珯杩涚珯鍘嬪ご銆佹车鎵▼鍜屾部绋嬪弬鏁帮紝鍐嶉噸鏂版墽琛屾湰娆℃按鍔涜绠椼€?,
        '鎭㈠鏈珯姝ｅ帇鍚庡啀鏍℃牳宸ュ喌鍙鎬э紝閬垮厤涓嶅彲琛屽伐鍐电洿鎺ヨ繘鍏ヨ繍琛屻€?,
        '楂?,
      ));
    }

    if (frictionRatio !== null && frictionRatio >= 0.7) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `鎽╅樆鎹熷け鍗犳€绘壃绋?${formatPercent(frictionRatio)}锛屾部绋嬪帇闄嶅亸楂樸€俙,
        '澶嶆牳绠￠亾绮楃硻搴︺€侀暱搴﹀彛寰勫拰褰撳墠娴侀噺璁惧畾锛屽繀瑕佹椂鎷嗗垎宄板€煎伐鍐靛悗閲嶇畻銆?,
        '鏈夊姪浜庡洖鏀堕儴鍒嗘壃绋嬭搴﹀苟闄嶄綆鍘嬮檷椋庨櫓銆?,
        frictionRatio >= 0.85 ? '楂? : '涓?,
      ));
    }

    if (reynoldsNumber !== null && reynoldsNumber < 4000) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `闆疯鏁颁负 ${formatFieldValue(reynoldsNumber)}锛屽綋鍓嶆祦鎬佹帴杩戞垨澶勪簬闈炲厖鍒嗘箥娴佺姸鎬併€俙,
        '缁撳悎娴侀噺銆佺矘搴﹀拰绠″緞鍙傛暟澶嶆牳褰撳墠宸ュ喌锛岀‘璁ゆā鍨嬭緭鍏ユ槸鍚︿笌鐜板満宸ュ喌涓€鑷淬€?,
        `鍙伩鍏嶅湪 ${flowRegime || '褰撳墠'} 娴佹€佷笅璇垽鎽╅樆涓庡帇鍔涚粨鏋溿€俙,
        '涓?,
      ));
    }

    if (!suggestions.length) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        '褰撳墠姘村姏鍒嗘瀽缁撴灉鏁翠綋鍙敤锛屽缓璁户缁洿缁曞帇鍔涗笌鎽╅樆鍋氳秼鍔胯窡韪€?,
        '鎸佺画璺熻釜鏈珯杩涚珯鍘嬪ご銆佹€绘壃绋嬪拰鎽╅樆鎹熷け鍙樺寲锛屽苟鎸夊懆鏈熷绠椼€?,
        '鏈夊姪浜庢彁鍓嶅彂鐜板帇闄嶆姮鍗囪秼鍔裤€?,
        '涓?,
      ));
    }
  } else if (calcType === 'OPTIMIZATION') {
    const feasible = outputSource.isFeasible === false ? false : outputSource.isFeasible === true ? true : null;
    const endPressure = toFiniteNumber(outputSource.endStationInPressure);
    const totalCost = toFiniteNumber(outputSource.totalCost);
    const totalEnergy = toFiniteNumber(outputSource.totalEnergyConsumption);
    const totalPressureDrop = toFiniteNumber(outputSource.totalPressureDrop);
    const pump480Num = toFiniteNumber(outputSource.pump480Num);
    const pump375Num = toFiniteNumber(outputSource.pump375Num);

    if (feasible === false) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `褰撳墠鎺ㄨ崘娉电粍鍚堜笉鍙${endPressure !== null ? `锛屾湯绔欒繘绔欏帇澶翠粎 ${formatFieldValue(endPressure)}` : ''}銆俙,
        `缁撳悎褰撳墠娉电粍鍚?{pump480Num !== null || pump375Num !== null ? `锛?80 鍨?${pump480Num ?? 0} 鍙帮紝375 鍨?${pump375Num ?? 0} 鍙帮級` : ''}閲嶆柊绾︽潫娴侀噺涓庡帇鍔涘悗鍐嶆墽琛屼紭鍖栥€俙,
        '鍏堢瓫鍑哄彲琛岀粍鍚堬紝鍐嶅鑳借€楀拰鎴愭湰鍋氫簩娆′紭鍖栵紝閬垮厤鏃犳晥璋冨害璇曠畻銆?,
        '楂?,
      ));
    }

    if (feasible === true && totalEnergy !== null) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `褰撳墠浼樺寲鏂规鍙锛屽勾鑳借€楃害 ${formatFieldValue(totalEnergy)}${totalCost !== null ? `锛屾€绘垚鏈害 ${formatFieldValue(totalCost)}` : ''}銆俙,
        '浼樺厛钀藉湴褰撳墠鍙娉电粍鍚堬紝骞剁粨鍚堢數浠枫€佸伐浣滃ぉ鏁板拰鏈珯鍘嬪姏鍋氱粡娴庢€у鏍搞€?,
        '鍦ㄦ弧瓒冲帇鍔涚害鏉熺殑鍓嶆彁涓嬬户缁帇闄嶇患鍚堣繍琛屾垚鏈€?,
        '涓?,
      ));
    }

    if (totalPressureDrop !== null && totalPressureDrop > 0) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `鏈浼樺寲缁撴灉鎬诲帇闄嶄负 ${formatFieldValue(totalPressureDrop)}銆俙,
        '瀵归珮鍘嬮檷宸ュ喌鍗曠嫭寤虹珛鐩戞祴鍙ｅ緞锛岃仈鍔ㄥ鏍哥矖绯欏害銆佹祦閲忓拰鎵▼閰嶇疆銆?,
        '鍙噺灏戝悗缁噸澶嶄紭鍖栦腑鐢卞帇闄嶆姮鍗囧甫鏉ョ殑鍋忓樊銆?,
        '涓?,
      ));
    }
  } else if (calcType === 'SENSITIVITY') {
    const fullOutput = parseJsonRecord(history.outputResult);
    const variableType = pickFirstString(fullOutput, ['variableType', 'sensitiveVariableType'])
      || pickFirstString(inputSource, ['variableType', 'sensitiveVariableType']);
    const coefficient = pickRecordValue(fullOutput, ['sensitivityCoefficient', 'coefficient']);
    const maxImpact = pickRecordValue(fullOutput, ['maxImpactAmplitude', 'maxImpact', 'maximumImpact']);
    const ranking = pickRecordValue(fullOutput, ['ranking', 'rank']);
    const details = buildSensitivityDetailRows(fullOutput);

    pushSuggestion(buildSuggestionItem(
      projectName,
      `${variableType ? `${variableType} ` : ''}鏁忔劅鎬х粨鏋滃凡鐢熸垚${coefficient !== undefined ? `锛屾晱鎰熺郴鏁颁负 ${formatFieldValue(coefficient)}` : ''}${maxImpact !== undefined ? `锛屾渶澶у奖鍝嶅箙搴︿负 ${formatFieldValue(maxImpact)}` : ''}銆俙,
      `浼樺厛璺熻釜${ranking !== undefined ? `鎺掑悕 ${formatFieldValue(ranking)} 鐨刞 : '楂樻晱鎰?}鍙橀噺锛屽苟澶嶆牳鍏剁幇鍦烘祴閲忓€间笌璁＄畻鍏ュ弬鍙ｅ緞銆俙,
      '鍙紭鍏堥攣瀹氱湡姝ｅ奖鍝嶅帇鍔涖€佹懇闃诲拰娴佹€佸彉鍖栫殑鍏抽敭鍙傛暟銆?,
      '涓?,
    ));

    if (details.length) {
      pushSuggestion(buildSuggestionItem(
        projectName,
        `褰撳墠宸插緱鍒?${details.length} 缁勫彉鍖栨瘮渚嬩笅鐨勫帇鍔?鎽╅樆/娴佹€佹槑缁嗐€俙,
        '灏嗗彉鍖栨瘮渚嬩笌鍘嬪姏銆佹懇闃绘槑缁嗚仈鍔ㄥ缓鎴愮洃鎺ч槇鍊硷紝浼樺厛瀵规嫄鐐瑰彉鍖栧尯闂村仛澶嶇畻銆?,
        '鍚庣画澶嶇畻鏃跺彲鐩存帴鑱氱劍楂樺奖鍝嶅尯闂达紝鍑忓皯鍏ㄩ噺璇曠畻娆℃暟銆?,
        '涓?,
      ));
    }
  } else {
    pushSuggestion(buildSuggestionItem(
      projectName,
      '璇ュ巻鍙茶褰曠己灏戜笓椤硅瘖鏂被鍨嬶紝鏆傛棤娉曠洿鎺ョ粰鍑洪拡瀵规€т紭鍖栧姩浣溿€?,
      '鍏堝洖鏀炬湰娆＄湡瀹炶緭鍏ュ弬鏁板拰杈撳嚭缁撴灉锛屽啀鍐冲畾鏄惁閲嶈窇姘村姏銆佷紭鍖栨垨鏁忔劅鎬у垎鏋愩€?,
      '淇濊瘉鍚庣画寤鸿寤虹珛鍦ㄧ湡瀹炶绠楃粨鏋滆€屼笉鏄憳瑕佹枃鏈箣涓娿€?,
      '涓?,
    ));
  }

  if (history.remark?.trim()) {
    pushSuggestion(buildSuggestionItem(
      projectName,
      '璇ヨ褰曢檮甯︿汉宸ュ娉紝闇€瑕佸拰鏈鐪熷疄璁＄畻缁撴灉涓€璧风撼鍏ラ棴鐜鐞嗐€?,
      `璺熻釜澶囨敞浜嬮」锛?{history.remark.trim()}`,
      '琛ュ厖鐜板満鍙嶉鍚庡舰鎴愬缃褰曪紝骞朵笌鏈鍙傛暟鍙婄粨鏋滃仛鍏宠仈鐣欐。銆?,
      '涓?,
    ));
  }

  return suggestions.slice(0, 4);
}

function buildWorkbenchFallbackRisks(params: {
  visibleHistories: CalculationHistory[];
  visiblePipelines: Pipeline[];
  pumpStations: PumpStation[];
}): RiskItem[] {
  const { visibleHistories, visiblePipelines, pumpStations } = params;
  const items: RiskItem[] = [];
  const seen = new Set<string>();

  const pushRisk = (item: RiskItem | null) => {
    if (!item) return;
    const key = `${item.target}-${item.riskType}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const failedByProject = visibleHistories.reduce<Map<string, number>>((acc, history) => {
    if (history.status !== 2) return acc;
    const key = history.projectName?.trim() || '鏈懡鍚嶉」鐩?;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  [...failedByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .forEach(([projectName, count]) => {
      pushRisk(buildRiskItem(
        projectName,
        '璁＄畻澶辫触',
        '楂?,
        `褰撳墠鍒嗘瀽鑼冨洿鍐呭叡鏈?${count} 鏉″巻鍙茶褰曟墽琛屽け璐ワ紝璇存槑鍙傛暟鎴栨湇鍔＄姸鎬佸瓨鍦ㄤ笉绋冲畾鍥犵礌銆俙,
        '浼樺厛澶嶆牳杈撳叆鍙傛暟銆佽绠楁湇鍔＄姸鎬佸拰鐩稿叧渚濊禆銆?,
      ));
    });

  visibleHistories.slice(0, 20).forEach((history) => {
    const output = parseJsonRecord(history.outputResult);
    const outputSource = getHistoryOutputSource(history, output);
    const target = history.projectName?.trim() || '鏈懡鍚嶉」鐩?;

    if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) {
      pushRisk(buildRiskItem(
        target,
        '鏈珯鍘嬪姏涓嶈冻',
        '楂?,
        `鏈珯杩涚珯鍘嬪ご涓?${formatFieldValue(outputSource.endStationInPressure)}锛屽凡浣庝簬鍙宸ュ喌闃堝€笺€俙,
        '妫€鏌ラ绔欒繘绔欏帇澶淬€佹车鎵▼鍜屾部绋嬫懇闃诲弬鏁般€?,
      ));
    }

    if (outputSource.isFeasible === false) {
      pushRisk(buildRiskItem(
        target,
        '鏂规涓嶅彲琛?,
        '楂?,
        '鍘嗗彶浼樺寲缁撴灉鏄剧ず褰撳墠娉垫満缁勫悎涓嶅彲琛岋紝鏃犳硶婊¤冻鏈珯鍘嬪姏绾︽潫銆?,
        '璋冩暣娉垫満缁勫悎鎴栭噸鏂拌瀹氳繍琛屾祦閲忓悗鍐嶈绠椼€?,
      ));
    }

    if (
      typeof outputSource.frictionHeadLoss === 'number' &&
      typeof outputSource.totalHead === 'number' &&
      outputSource.totalHead > 0 &&
      outputSource.frictionHeadLoss / outputSource.totalHead > 0.7
    ) {
      const ratio = outputSource.frictionHeadLoss / outputSource.totalHead;
      pushRisk(buildRiskItem(
        target,
        '鍘嬮檷鍋忛珮',
        ratio > 0.85 ? '楂? : '涓?,
        `鎽╅樆鎹熷け鍗犳€绘壃绋?${formatPercent(ratio)}锛屽綋鍓嶆壃绋嬪埄鐢ㄧ巼鍋忎綆銆俙,
        '妫€鏌ュ眬閮ㄩ樆鍔涖€佺閬撳伐鍐靛拰褰撳墠璐熻嵎鍒嗛厤銆?,
      ));
    }
  });

  if (visiblePipelines.length > 1) {
    const averageThroughput = visiblePipelines.reduce((sum, item) => sum + item.throughput, 0) / visiblePipelines.length;
    visiblePipelines
      .filter((item) => averageThroughput > 0 && item.throughput > averageThroughput * 1.15)
      .sort((a, b) => b.throughput - a.throughput)
      .slice(0, 2)
      .forEach((item) => {
        pushRisk(buildRiskItem(
          item.name,
          '璐熻嵎鍋忛珮',
          item.throughput > averageThroughput * 1.35 ? '楂? : '涓?,
          `璁捐杈撻噺 ${formatNumber(item.throughput)} 楂樹簬褰撳墠鑼冨洿鍧囧€?${formatNumber(averageThroughput)}銆俙,
          '妫€鏌ヨ礋鑽峰垎閰嶄笌娌跨嚎鍘嬮檷鏄惁鍖归厤銆?,
        ));
      });
  }

  if (pumpStations.length > 1) {
    const averageEfficiency = pumpStations.reduce((sum, item) => sum + item.pumpEfficiency, 0) / pumpStations.length;
    pumpStations
      .filter((item) => averageEfficiency > 0 && item.pumpEfficiency < averageEfficiency * 0.92)
      .sort((a, b) => a.pumpEfficiency - b.pumpEfficiency)
      .slice(0, 2)
      .forEach((item) => {
        const gap = averageEfficiency - item.pumpEfficiency;
        pushRisk(buildRiskItem(
          item.name,
          '鏁堢巼涓嬮檷',
          gap > averageEfficiency * 0.12 ? '楂? : '涓?,
          `娉垫晥鐜?${formatFieldValue(item.pumpEfficiency)} 浣庝簬褰撳墠鑼冨洿鍧囧€?${formatFieldValue(averageEfficiency)}銆俙,
          '鎺掓煡璁惧鐘舵€併€佸惎鍋滅瓥鐣ュ拰杩愯鐐规槸鍚﹀亸绂婚珮鏁堝尯闂淬€?,
        ));
      });
  }

  return items.slice(0, 6);
}

function buildHistoryPreview(history: CalculationHistory): PreviewRecord {
  const input = parseJsonRecord(history.inputParams);
  const output = parseJsonRecord(history.outputResult);
  const archivedResult: ReportResult = {
    source: 'history',
    highlights: toLines(output.highlights),
    summary: toLines(output.summary),
    risks: normalizeRiskList(output.risks),
    suggestions: normalizeSuggestionList(output.suggestions),
    conclusion: pickFirstString(output, ['conclusion']) || '',
    rawText: pickFirstString(output, ['rawText', 'raw_text']) || '',
    report: normalizeDynamicReport(output.report),
  };
  const archivedProjectNames = Array.isArray(input.projectNames)
    ? input.projectNames.map((item) => String(item)).filter(Boolean)
    : [];
  const archivedTitle = pickFirstString(input, ['title']) || pickFirstString(output, ['title']);
  const archivedTypeLabel = pickFirstString(input, ['reportTypeLabel']) || getHistoryTypeLabel(history);
  const archivedRangeLabel = pickFirstString(input, ['rangeLabel']) || '鍗曟璁＄畻璁板綍';
  const archivedIntelligenceLabel = pickFirstString(input, ['intelligenceLabel']) || '鍘嗗彶鍥炴斁';
  const archivedSourceLabel = pickFirstString(input, ['sourceLabel']) || '鏈嶅姟绔巻鍙茶褰?;
  const archivedOutputStyle = pickFirstString(input, ['outputStyle']);
  const archivedOutputStyleLabel = pickFirstString(input, ['outputStyleLabel']) || getOutputStyleLabel(archivedOutputStyle);
  const archivedOutputFormat = pickFirstString(input, ['outputFormat']);

  if (archivedTitle && (archivedResult.report || archivedResult.summary.length || archivedResult.conclusion)) {
    return {
      id: `history-preview-${history.id}`,
      title: archivedTitle,
      typeLabel: archivedTypeLabel,
      createdAt: history.createTime || new Date().toISOString(),
      rangeLabel: archivedRangeLabel,
      intelligenceLabel: archivedIntelligenceLabel,
      projectNames: archivedProjectNames.length ? archivedProjectNames : [history.projectName || '鏈懡鍚嶉」鐩?],
      outputStyle:
        archivedOutputStyle === 'simple' || archivedOutputStyle === 'professional' || archivedOutputStyle === 'presentation'
          ? archivedOutputStyle
          : undefined,
      outputStyleLabel: archivedOutputStyleLabel || undefined,
      outputFormat: archivedOutputFormat === 'pdf' || archivedOutputFormat === 'docx' ? archivedOutputFormat : 'markdown',
      sourceLabel: archivedSourceLabel,
      result: archivedResult,
    };
  }

  const inputSource = getHistoryInputSource(history, input);
  const outputSource = getHistoryOutputSource(history, output);
  const typeLabel = getHistoryTypeLabel(history);
  const projectName = history.projectName || '鏈懡鍚嶉」鐩?;
  const statusLabel = getHistoryStatusLabel(history.status);

  const summary = [
    `${projectName} 鐨?{typeLabel}璁板綍褰撳墠鐘舵€佷负${statusLabel}锛岀敓鎴愭椂闂?${formatTime(history.createTime)}銆俙,
    history.calcDurationFormatted
      ? `鏈璁＄畻鑰楁椂 ${history.calcDurationFormatted}銆俙
      : typeof history.calcDuration === 'number'
        ? `鏈璁＄畻鑰楁椂 ${history.calcDuration} ms銆俙
        : '鏈璁板綍鏈繑鍥炶绠楄€楁椂銆?,
    ...buildMetricLines(inputSource, 2).map((item) => `鍏抽敭鍏ュ弬锛?{item}`),
    ...buildMetricLines(outputSource, 2).map((item) => `鍏抽敭缁撴灉锛?{item}`),
  ].slice(0, 4);

  const risks: RiskItem[] = [];
  if (history.status === 2) {
    risks.push(buildRiskItem(
      projectName,
      '璁＄畻澶辫触',
      '楂?,
      history.errorMessage?.trim() || '璇ヨ褰曟墽琛屽け璐ワ紝璇锋鏌ヨ绠楁湇鍔＄姸鎬佷笌杈撳叆鍙傛暟銆?,
      '妫€鏌ヨ緭鍏ュ弬鏁般€佽绠楁湇鍔＄姸鎬佸拰涓婃父渚濊禆鍚庨噸鏂拌绠椼€?,
    ));
  }
  if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) {
    risks.push(buildRiskItem(
      projectName,
      '鏈珯鍘嬪姏涓嶈冻',
      '楂?,
      '鏈珯杩涚珯鍘嬪ご灏忎簬绛変簬 0锛屽綋鍓嶈緭閫佸伐鍐靛瓨鍦ㄤ笉鍙椋庨櫓銆?,
      '浼樺厛澶嶆牳棣栫珯杩涚珯鍘嬪ご銆佹车鎵▼鍜屾部绋嬫懇闃诲弬鏁般€?,
    ));
  }
  if (outputSource.isFeasible === false) {
    risks.push(buildRiskItem(
      projectName,
      '鏂规涓嶅彲琛?,
      '楂?,
      '浼樺寲缁撴灉鏄剧ず褰撳墠娉垫満缁勫悎涓嶅彲琛岋紝鏃犳硶婊¤冻鏈珯鍘嬪姏绾︽潫銆?,
      '璋冩暣娉垫満缁勫悎鎴栬繍琛屾祦閲忓悗閲嶆柊鎵ц浼樺寲璁＄畻銆?,
    ));
  }
  if (
    typeof outputSource.frictionHeadLoss === 'number' &&
    typeof outputSource.totalHead === 'number' &&
    outputSource.totalHead > 0 &&
    outputSource.frictionHeadLoss / outputSource.totalHead > 0.7
  ) {
    const ratio = outputSource.frictionHeadLoss / outputSource.totalHead;
    risks.push(buildRiskItem(
      projectName,
      '鍘嬮檷鍋忛珮',
      ratio > 0.85 ? '楂? : '涓?,
      `鎽╅樆鎹熷け鍗犳€绘壃绋?${formatPercent(ratio)}锛屽綋鍓嶈兘鑰楀拰鎵▼鍒╃敤鐜囬渶瑕侀噸鐐瑰鏍搞€俙,
      '妫€鏌ユ懇闃诲弬鏁般€佸眬閮ㄩ樆鍔涘拰褰撳墠杈撻€佽礋鑽锋槸鍚﹀尮閰嶃€?,
    ));
  }

  const conclusion = history.status === 2
    ? `璇?{typeLabel}璁板綍鎵ц澶辫触锛屽缓璁慨姝ｅ弬鏁版垨鎭㈠鏈嶅姟鍚庨噸鏂拌绠椼€俙
    : history.remark?.trim() || `璇?{typeLabel}璁板綍宸插畬鎴愶紝鍙洿鎺ラ瑙堢粨鏋滄垨瀵煎嚭褰掓。銆俙;

  const rawSections = [
    history.remark?.trim() ? `澶囨敞\n${history.remark.trim()}` : '',
    Object.keys(input).length ? `杈撳叆鍙傛暟\n${JSON.stringify(input, null, 2)}` : '',
    Object.keys(output).length ? `杈撳嚭缁撴灉\n${JSON.stringify(output, null, 2)}` : '',
  ].filter(Boolean);
  const rawText = rawSections.join('\n\n');
  const suggestions = buildHistorySuggestions(history, inputSource, outputSource);
  const structuredReport = buildHistoryStructuredReport(
    history,
    inputSource,
    outputSource,
    summary,
    risks.slice(0, 6),
    suggestions,
    conclusion,
    rawText,
  );

  return {
    id: `history-preview-${history.id}`,
    title: `${projectName} ${typeLabel}`,
    typeLabel,
    createdAt: history.createTime || new Date().toISOString(),
    rangeLabel: '鍗曟璁＄畻璁板綍',
    intelligenceLabel: '鍘嗗彶鍥炴斁',
    projectNames: [projectName],
    outputFormat: 'markdown',
    sourceLabel: '鏈嶅姟绔巻鍙茶褰?,
    result: {
      source: 'history',
      highlights: summary.slice(0, 3),
      summary,
      risks: risks.slice(0, 6),
      suggestions,
      conclusion,
      rawText,
      report: structuredReport,
    },
  };
}


async function fetchAllPagedList<T>(requestPage: (pageNum: number, pageSize: number) => Promise<R<PageResult<T>>>) {
  const result: T[] = [];
  let pageNum = 1;
  let total = Number.POSITIVE_INFINITY;
  while (result.length < total && pageNum <= 20) {
    const response = await requestPage(pageNum, 100);
    const page = response.data;
    const list = Array.isArray(page?.list) ? page.list : [];
    total = typeof page?.total === 'number' ? page.total : list.length;
    result.push(...list);
    if (list.length < 100) break;
    pageNum += 1;
  }
  return result;
}

function dynamicSectionToMarkdown(section: DynamicReportSectionPayload) {
  const lines = [`## ${section.title}`];
  if (section.summary) {
    lines.push('', section.summary);
  }

  if (section.kind === 'metrics') {
    lines.push(
      '',
      ...(section.metrics.length
        ? section.metrics.map((item) => `- ${item.label}锛?{item.value}${item.note ? `锛?{item.note}锛塦 : ''}`)
        : ['- 鏆傛棤']),
    );
    return lines;
  }

  if (section.kind === 'table' && section.table) {
    lines.push('');
    if (section.table.columns.length) {
      lines.push(`| ${section.table.columns.map((item) => escapeMarkdownTableCell(item)).join(' | ')} |`);
      lines.push(`| ${section.table.columns.map(() => '---').join(' | ')} |`);
      if (section.table.rows.length) {
        lines.push(
          ...section.table.rows.map(
            (row) => `| ${row.map((cell) => escapeMarkdownTableCell(cell)).join(' | ')} |`,
          ),
        );
      } else {
        lines.push('| 鏆傛棤鏁版嵁 |');
      }
    } else {
      lines.push('- 鏆傛棤鏁版嵁');
    }
    return lines;
  }

  if (section.kind === 'markdown' || section.kind === 'callout') {
    lines.push('', section.content || '鏆傛棤鍐呭');
    return lines;
  }

  lines.push(
    '',
    ...(section.items.length
      ? section.items.flatMap((item) => (item.title ? [`- ${item.title}锛?{item.content}`] : [`- ${item.content}`]))
      : ['- 鏆傛棤']),
  );
  return lines;
}

function downloadMarkdown(preview: PreviewRecord) {
  if (preview.result.report?.sections?.length) {
    const report = preview.result.report;
    const content = [
      `# ${report.title || preview.title}`,
      '',
      `- 鐢熸垚鏃堕棿锛?{formatTime(preview.createdAt)}`,
      `- 鍒嗘瀽鑼冨洿锛?{preview.rangeLabel}`,
      `- 鏅鸿兘绛夌骇锛?{preview.intelligenceLabel}`,
      `- 瑕嗙洊椤圭洰锛?{preview.projectNames.join('銆?) || '鏈€夋嫨椤圭洰'}`,
      `- 杈撳嚭鏍煎紡锛?{preview.outputFormat}`,
      `- 鏉ユ簮锛?{preview.sourceLabel}`,
      ...(report.abstract ? ['', report.abstract] : []),
      ...report.sections.flatMap((section) => ['', ...dynamicSectionToMarkdown(section)]),
      ...(preview.result.rawText
        ? [
            '',
            '## 鍘熷璁＄畻鏁版嵁',
            '```text',
            preview.result.rawText,
            '```',
          ]
        : []),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${preview.title.replace(/[\\/:*?"<>|]/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return;
  }

  const content = [
    `# ${preview.title}`,
    '',
    `- 鐢熸垚鏃堕棿锛?{formatTime(preview.createdAt)}`,
    `- 鍒嗘瀽鑼冨洿锛?{preview.rangeLabel}`,
    `- 鏅鸿兘绛夌骇锛?{preview.intelligenceLabel}`,
    `- 瑕嗙洊椤圭洰锛?{preview.projectNames.join('銆?) || '鏈€夋嫨椤圭洰'}`,
    `- 杈撳嚭鏍煎紡锛?{preview.outputFormat}`,
    `- 鏉ユ簮锛?{preview.sourceLabel}`,
    '',
    '## 鏅鸿兘鎽樿',
    ...(preview.result.summary.length ? preview.result.summary.map((item) => `- ${item}`) : ['- 鏆傛棤']),
    '',
    '## 椋庨櫓鍒楄〃',
    ...(preview.result.risks.length
      ? [
          '| 椋庨櫓瀵硅薄 | 椋庨櫓绫诲瀷 | 绛夌骇 | 鍘熷洜 | 寤鸿 |',
          '| --- | --- | --- | --- | --- |',
          ...preview.result.risks.map((item) => `| ${escapeMarkdownTableCell(item.target)} | ${escapeMarkdownTableCell(item.riskType)} | ${item.level} | ${escapeMarkdownTableCell(item.reason)} | ${escapeMarkdownTableCell(item.suggestion)} |`),
        ]
      : ['- 鏆傛棤']),
    '',
    '## 浼樺寲寤鸿',
    ...(preview.result.suggestions.length
      ? preview.result.suggestions.flatMap((item, index) => ([
          `### 浼樺厛寤鸿 ${index + 1}`,
          `瀵硅薄锛?{item.target}`,
          `鍘熷洜锛?{item.reason}`,
          `鎺柦锛?{item.action}`,
          `棰勬湡锛?{item.expected}`,
          `浼樺厛绾э細${item.priority}`,
          '',
        ]))
      : ['- 鏆傛棤']),
    '',
    '## 鎶ュ憡缁撹',
    preview.result.conclusion || '鏆傛棤',
    ...(preview.result.rawText
      ? [
          '',
          '## 鍘熷璁＄畻鏁版嵁',
          '```text',
          preview.result.rawText,
          '```',
        ]
      : []),
  ].join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${preview.title.replace(/[\\/:*?"<>|]/g, '-')}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}


function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePercent(value: number) {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function averageMetric<T>(items: T[], getter: (item: T) => number | null) {
  const values = items
    .map(getter)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeChangePercent(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '?';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatSignedCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '?';
  const normalized = Math.round(value);
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized}`;
}

function getTrendValueClass(value: number | null, positiveGood: boolean) {
  if (value === null || !Number.isFinite(value) || value === 0) return 'text-slate-100';
  const isGood = positiveGood ? value > 0 : value < 0;
  return isGood ? 'text-emerald-300' : 'text-rose-300';
}

function getHealthValueClass(score: number | null) {
  if (score === null) return 'text-slate-100';
  if (score >= 85) return 'text-emerald-300';
  if (score >= 70) return 'text-amber-300';
  return 'text-rose-300';
}

function getHistoryRiskLevel(history: CalculationHistory) {
  const outputSource = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
  const pumpEfficiency =
    toFiniteNumber(outputSource.pumpEfficiency) ??
    toFiniteNumber(outputSource.electricEfficiency) ??
    toFiniteNumber(outputSource.motorEfficiency);
  const normalizedEfficiency = pumpEfficiency !== null ? normalizePercent(pumpEfficiency) : null;
  if (history.status === 2) return 'high';
  if (outputSource.isFeasible === false) return 'high';
  if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) return 'high';
  if (normalizedEfficiency !== null && normalizedEfficiency < 45) return 'high';
  if (isHistoryAbnormal(history)) return 'abnormal';
  return 'normal';
}

function getHistoryEnergyMetric(history: CalculationHistory) {
  const outputSource = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
  return (
    toFiniteNumber(outputSource.totalEnergyConsumption) ??
    toFiniteNumber(outputSource.energyConsumption) ??
    toFiniteNumber(outputSource.frictionHeadLoss)
  );
}

function getHistoryEfficiencyMetric(history: CalculationHistory) {
  const inputSource = getHistoryInputSource(history, parseJsonRecord(history.inputParams));
  const outputSource = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
  const pumpEfficiency =
    toFiniteNumber(outputSource.pumpEfficiency) ??
    toFiniteNumber(inputSource.pumpEfficiency);
  const electricEfficiency =
    toFiniteNumber(outputSource.electricEfficiency) ??
    toFiniteNumber(outputSource.motorEfficiency) ??
    toFiniteNumber(inputSource.electricEfficiency) ??
    toFiniteNumber(inputSource.motorEfficiency);

  if (pumpEfficiency !== null) {
    const normalizedPump = normalizePercent(pumpEfficiency);
    if (electricEfficiency !== null) {
      return (normalizedPump * normalizePercent(electricEfficiency)) / 100;
    }
    return normalizedPump;
  }

  const totalHead = toFiniteNumber(outputSource.totalHead);
  const frictionHeadLoss = toFiniteNumber(outputSource.frictionHeadLoss);
  if (totalHead !== null && frictionHeadLoss !== null && totalHead > 0) {
    return Math.max(0, ((totalHead - frictionHeadLoss) / totalHead) * 100);
  }

  return null;
}

function getComparisonPeriod(rangePreset: RangePreset, customRange: DateRangeValue) {
  if (rangePreset === 'custom' && customRange) {
    const currentStart = customRange[0].startOf('day');
    const currentEnd = customRange[1].endOf('day');
    const days = currentEnd.startOf('day').diff(currentStart.startOf('day'), 'day') + 1;
    const previousEnd = currentStart.subtract(1, 'day').endOf('day');
    const previousStart = previousEnd.subtract(days - 1, 'day').startOf('day');
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  if (rangePreset === '7d' || rangePreset === '30d' || rangePreset === '90d') {
    const days = rangePreset === '7d' ? 7 : rangePreset === '30d' ? 30 : 90;
    const currentEnd = dayjs().endOf('day');
    const currentStart = dayjs().subtract(days - 1, 'day').startOf('day');
    const previousEnd = currentStart.subtract(1, 'day').endOf('day');
    const previousStart = previousEnd.subtract(days - 1, 'day').startOf('day');
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  if (rangePreset === 'year') {
    const currentStart = dayjs().startOf('year');
    const currentEnd = dayjs().endOf('day');
    const previousStart = currentStart.subtract(1, 'year').startOf('year');
    const previousEnd = currentStart.subtract(1, 'year').endOf('year');
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  const currentEnd = dayjs().endOf('day');
  const currentStart = currentEnd.subtract(29, 'day').startOf('day');
  const previousEnd = currentStart.subtract(1, 'day').endOf('day');
  const previousStart = previousEnd.subtract(29, 'day').startOf('day');
  return { currentStart, currentEnd, previousStart, previousEnd };
}

function renderStatus(status: HistoryItem['status']) {
  if (status === 'completed') return <Tag color="green">宸插畬鎴?/Tag>;
  if (status === 'running') return <Tag color="blue">鐢熸垚涓?/Tag>;
  return <Tag color="red">澶辫触</Tag>;
}

export default function ReportPreview() {  const savedTemplate = useMemo(() => readStorage<Record<string, unknown> | null>(TEMPLATE_KEY, null), []);
  const resolvedTheme = useThemeStore((state) => state.resolved);
  const savedCustomRange = useMemo(() => {
    const raw = savedTemplate?.customRange;
    if (!Array.isArray(raw) || raw.length !== 2) return null;
    const start = dayjs(String(raw[0]));
    const end = dayjs(String(raw[1]));
    return start.isValid() && end.isValid() ? [start, end] as [Dayjs, Dayjs] : null;
  }, [savedTemplate]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pumpStations, setPumpStations] = useState<PumpStation[]>([]);
  const [histories, setHistories] = useState<CalculationHistory[]>([]);
  const [analysisCount, setAnalysisCount] = useState<number>(() => readStorage(COUNT_KEY, 0));
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>(
    Array.isArray(savedTemplate?.selectedProjectIds) ? (savedTemplate.selectedProjectIds as number[]) : [],
  );
  const [reportType, setReportType] = useState<ReportType>((savedTemplate?.reportType as ReportType) ?? 'AI_REPORT');
  const [rangePreset, setRangePreset] = useState<RangePreset>((savedTemplate?.rangePreset as RangePreset) ?? '30d');
  const [customRange, setCustomRange] = useState<DateRangeValue>(savedCustomRange);
  const [intelligenceLevel, setIntelligenceLevel] = useState<IntelligenceLevel>((savedTemplate?.intelligenceLevel as IntelligenceLevel) ?? 'enhanced');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>((savedTemplate?.outputFormat as OutputFormat) ?? 'markdown');
  const [enableSummary, setEnableSummary] = useState(savedTemplate?.enableSummary !== false);
  const [enableRisk, setEnableRisk] = useState(savedTemplate?.enableRisk !== false);
  const [enableSuggestions, setEnableSuggestions] = useState(savedTemplate?.enableSuggestions !== false);
  const [enableConclusion, setEnableConclusion] = useState(savedTemplate?.enableConclusion !== false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [activePreview, setActivePreview] = useState<PreviewRecord | LocalReportRecord | null>(null);

  const loadData = useCallback(async (mode: 'initial' | 'refresh') => {
    mode === 'initial' ? setLoading(true) : setRefreshing(true);
    try {
      const [projectResult, historyResult, pumpResult] = await Promise.allSettled([
        projectApi.list(),
        fetchAllPagedList<CalculationHistory>((pageNum, pageSize) => calculationHistoryApi.page({ pageNum, pageSize })),
        pumpStationApi.list(),
      ]);
      const nextProjects = projectResult.status === 'fulfilled' ? (projectResult.value.data ?? []) : [];
      const nextHistories = historyResult.status === 'fulfilled' ? historyResult.value : [];
      const nextPumpStations = pumpResult.status === 'fulfilled' ? (pumpResult.value.data ?? []) : [];
      setProjects([...nextProjects].sort((a, b) => a.proId - b.proId));
      setHistories([...nextHistories].sort((a, b) => dayjs(b.createTime).valueOf() - dayjs(a.createTime).valueOf()));
      setPumpStations(nextPumpStations);
      const pipelineResults = await Promise.allSettled(nextProjects.map((item) => pipelineApi.listByProject(item.proId)));
      setPipelines(pipelineResults.flatMap((item) => (item.status === 'fulfilled' ? item.value.data ?? [] : [])));
      setSelectedProjectIds((current) => {
        const available = new Set(nextProjects.map((item) => item.proId));
        const filtered = current.filter((id) => available.has(id));
        return filtered.length ? filtered : nextProjects.map((item) => item.proId);
      });
    } catch {
      message.error('鏅鸿兘鎶ュ憡涓績鏁版嵁鍔犺浇澶辫触');
    } finally {
      mode === 'initial' ? setLoading(false) : setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  useEffect(() => {
    writeStorage(COUNT_KEY, analysisCount);
  }, [analysisCount]);

  const rangeWindow = useMemo(() => getRangeWindow(rangePreset, customRange), [rangePreset, customRange]);
  const rangeLabel = useMemo(() => getRangeLabel(rangePreset, customRange), [rangePreset, customRange]);
  const comparisonLabel = useMemo(() => getComparisonLabel(rangePreset, customRange), [rangePreset, customRange]);
  const selectedSet = useMemo(() => new Set(selectedProjectIds), [selectedProjectIds]);
  const selectedProjects = useMemo(() => projects.filter((item) => selectedSet.has(item.proId)), [projects, selectedSet]);
  const visiblePipelines = useMemo(() => pipelines.filter((item) => selectedSet.has(item.proId)), [pipelines, selectedSet]);
  const selectedHistoriesAll = useMemo(() => histories.filter((item) => selectedSet.has(item.projectId ?? -1)), [histories, selectedSet]);
  const visibleHistories = useMemo(
    () => histories.filter((item) => selectedSet.has(item.projectId ?? -1) && inWindow(item.createTime, rangeWindow.start, rangeWindow.end)),
    [histories, rangeWindow.end, rangeWindow.start, selectedSet],
  );
  const abnormalHistories = useMemo(() => visibleHistories.filter((item) => isHistoryAbnormal(item)), [visibleHistories]);

  const snapshot = useMemo(() => {
    const projectCompleteness = getCollectionCompleteness(selectedProjects, ['number', 'name', 'responsible']);
    const pipelineCompleteness = getCollectionCompleteness(visiblePipelines, ['name', 'length', 'diameter', 'throughput', 'startAltitude', 'endAltitude']);
    const pumpStationCompleteness = getCollectionCompleteness(pumpStations, ['name', 'pumpEfficiency', 'electricEfficiency', 'zmi480Lift', 'zmi375Lift']);
    const historyCompleteness = getHistoryCompleteness(visibleHistories);
    const dataCompletenessTotal = projectCompleteness.total + pipelineCompleteness.total + pumpStationCompleteness.total + historyCompleteness.total;
    const dataCompletenessFilled = projectCompleteness.filled + pipelineCompleteness.filled + pumpStationCompleteness.filled + historyCompleteness.filled;
    const dataCompletenessRate = dataCompletenessTotal ? Math.round((dataCompletenessFilled / dataCompletenessTotal) * 100) : 0;
    const abnormalHistoryCount = abnormalHistories.length;
    const highRiskHistories = visibleHistories.filter((item) => getHistoryRiskLevel(item) === 'high');
    const highRiskCount = highRiskHistories.length;
    const analysisObjectCount = visibleHistories.length || visiblePipelines.length || selectedProjects.length;
    const abnormalRate = visibleHistories.length ? abnormalHistoryCount / visibleHistories.length : 0;
    const highRiskRate = visibleHistories.length ? highRiskCount / visibleHistories.length : 0;
    const healthScore = visibleHistories.length
      ? clampScore(100 - abnormalRate * 60 - highRiskRate * 95)
      : null;
    const comparisonPeriod = getComparisonPeriod(rangePreset, customRange);
    const previousHistories = selectedHistoriesAll.filter((item) => inWindow(item.createTime, comparisonPeriod.previousStart, comparisonPeriod.previousEnd));
    const energyChangePercent = computeChangePercent(
      averageMetric(visibleHistories, (item) => getHistoryEnergyMetric(item)),
      averageMetric(previousHistories, (item) => getHistoryEnergyMetric(item)),
    );
    const efficiencyChangePercent = computeChangePercent(
      averageMetric(visibleHistories, (item) => getHistoryEfficiencyMetric(item)),
      averageMetric(previousHistories, (item) => getHistoryEfficiencyMetric(item)),
    );
    const previousRiskCount = previousHistories.filter((item) => getHistoryRiskLevel(item) === 'high').length;

    return {
      projectCount: selectedProjects.length,
      pipelineCount: visiblePipelines.length,
      pumpStationCount: pumpStations.length,
      historyCount: visibleHistories.length,
      analysisObjectCount,
      failedHistoryCount: visibleHistories.filter((item) => item.status === 2).length,
      abnormalHistoryCount,
      highRiskCount,
      dataCompletenessRate,
      abnormalRate: visibleHistories.length ? Math.round(abnormalRate * 100) : 0,
      highRiskRate: visibleHistories.length ? Math.round(highRiskRate * 100) : 0,
      healthScore,
      todayHistoryCount: visibleHistories.filter((item) => dayjs(item.createTime).isSame(dayjs(), 'day')).length,
      latestHistoryTime: visibleHistories[0]?.createTime,
      latestAbnormalTime: abnormalHistories[0]?.createTime,
      comparisonLabel,
      currentRangeLabel: `${comparisonPeriod.currentStart.format('MM-DD')} ? ${comparisonPeriod.currentEnd.format('MM-DD')}`,
      previousRangeLabel: `${comparisonPeriod.previousStart.format('MM-DD')} ? ${comparisonPeriod.previousEnd.format('MM-DD')}`,
      currentSampleCount: visibleHistories.length,
      previousSampleCount: previousHistories.length,
      energyChangePercent,
      efficiencyChangePercent,
      riskCountChange: highRiskCount - previousRiskCount,
      previousRiskCount,
    };
  }, [abnormalHistories, comparisonLabel, customRange, pumpStations, rangePreset, selectedHistoriesAll, selectedProjects, visibleHistories, visiblePipelines]);

  const overviewCards = useMemo(() => ([
    {
      label: '???????',
      value: snapshot.analysisObjectCount,
      hint: `??????? ${snapshot.historyCount} ?????????`,
      valueClassName: 'text-white',
    },
    {
      label: '?????',
      value: snapshot.abnormalHistoryCount,
      hint: '??????????????????',
      valueClassName: snapshot.abnormalHistoryCount > 0 ? 'text-amber-300' : 'text-emerald-300',
    },
    {
      label: '??????',
      value: snapshot.highRiskCount,
      hint: '?????????????????',
      valueClassName: snapshot.highRiskCount > 0 ? 'text-rose-300' : 'text-emerald-300',
    },
    {
      label: '??????',
      value: snapshot.healthScore !== null ? `${snapshot.healthScore} ?` : '?',
      hint: snapshot.healthScore !== null ? '???????????????' : '???????????????',
      valueClassName: getHealthValueClass(snapshot.healthScore),
    },
  ]), [snapshot.abnormalHistoryCount, snapshot.analysisObjectCount, snapshot.healthScore, snapshot.highRiskCount, snapshot.historyCount]);

  const trendCards = useMemo(() => ([
    {
      label: '????????',
      value: formatSignedPercent(snapshot.energyChangePercent),
      hint: snapshot.previousSampleCount ? `???? ${snapshot.currentSampleCount} ??????? ${snapshot.previousSampleCount} ?` : '???????????????',
      valueClassName: getTrendValueClass(snapshot.energyChangePercent, false),
    },
    {
      label: '????????',
      value: formatSignedPercent(snapshot.efficiencyChangePercent),
      hint: snapshot.previousSampleCount ? '?????????????' : '???????????????',
      valueClassName: getTrendValueClass(snapshot.efficiencyChangePercent, true),
    },
    {
      label: '??????',
      value: formatSignedCount(snapshot.riskCountChange),
      hint: `??????? ${snapshot.highRiskCount} ????? ${snapshot.previousRiskCount} ?`,
      valueClassName: getTrendValueClass(snapshot.riskCountChange, false),
    },
  ]), [snapshot.currentSampleCount, snapshot.efficiencyChangePercent, snapshot.energyChangePercent, snapshot.highRiskCount, snapshot.previousRiskCount, snapshot.previousSampleCount, snapshot.riskCountChange]);

  const saveTemplate = useCallback(() => {
    writeStorage(TEMPLATE_KEY, {
      selectedProjectIds,
      reportType,
      rangePreset,
      customRange: customRange ? customRange.map((item) => item.toISOString()) : null,
      intelligenceLevel,
      outputFormat,
      enableSummary,
      enableRisk,
      enableSuggestions,
      enableConclusion,
    });
    message.success('褰撳墠閰嶇疆宸蹭繚瀛樹负妯℃澘');
  }, [customRange, enableConclusion, enableRisk, enableSuggestions, enableSummary, intelligenceLevel, outputFormat, rangePreset, reportType, selectedProjectIds]);

  const runAnalysis = useCallback(async () => {
    if (!selectedProjects.length) {
      message.warning('璇疯嚦灏戦€夋嫨涓€涓」鐩?);
      return null;
    }

    const projectInsights = buildProjectInsights(selectedProjects, visiblePipelines, visibleHistories);
    const projectContextLines = buildProjectContextLines(projectInsights);
    const pumpStationContextLines = buildPumpStationContextLines(pumpStations);
    const fallbackRisks = enableRisk
      ? [...buildAnalysisRisks(projectInsights), ...buildWorkbenchFallbackRisks({ visibleHistories, visiblePipelines, pumpStations })].slice(0, 6)
      : [];
    const fallbackSuggestions = enableSuggestions
      ? buildAnalysisSuggestions(
          projectInsights,
          pumpStations,
          selectedProjects,
          snapshot.historyCount,
          snapshot.dataCompletenessRate,
        )
      : [];

    const fallback: ReportResult = {
      source: 'fallback',
      highlights: [
        `鍒嗘瀽瀵硅薄 ${snapshot.analysisObjectCount} 涓猔,
        `寮傚父璁板綍 ${snapshot.abnormalHistoryCount} 鏉,
        `楂橀闄╄褰?${snapshot.highRiskCount} 鏉,
      ].slice(0, 3),
      summary: enableSummary
        ? [
            `鏈鍒嗘瀽渚濇嵁瑕嗙洊 ${snapshot.projectCount} 涓」鐩€?{snapshot.pipelineCount} 鏉＄閬撱€?{snapshot.pumpStationCount} 搴ф车绔欍€俙,
            `褰撳墠鏍锋湰姹犵撼鍏?${snapshot.historyCount} 鏉¤褰曪紝璇嗗埆寮傚父 ${snapshot.abnormalHistoryCount} 鏉★紝鏁版嵁瀹屾暣鐜?${snapshot.dataCompletenessRate}%銆俙,
            `姣斿鍛ㄦ湡涓?${snapshot.comparisonLabel}锛屾渶杩戝紓甯告椂闂?${formatTime(snapshot.latestAbnormalTime)}銆俙,
          ]
        : [],
      risks: fallbackRisks,
      suggestions: fallbackSuggestions,
      conclusion: enableConclusion ? '绯荤粺宸茬粡鍏峰鏅鸿兘鎶ュ憡鍩虹鑳藉姏锛屼絾姝ｅ紡缁撹浠嶅缓璁粨鍚堟洿澶氬巻鍙叉牱鏈拰鐜板満宸ュ喌澶嶆牳銆? : '',
      rawText: '',
      report: null,
    };

    setAnalysing(true);
    let result = fallback;
    try {
      const requestPayload: DynamicReportRequestPayload = {
        selected_project_ids: selectedProjects.map((item) => item.proId),
        project_names: selectedProjects.map((item) => item.name),
        report_type: reportType,
        report_type_label: REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label,
        range_preset: rangePreset,
        range_label: rangeLabel,
        custom_start: customRange?.[0]?.format('YYYY-MM-DD'),
        custom_end: customRange?.[1]?.format('YYYY-MM-DD'),
        intelligence_level: intelligenceLevel,
        output_format: outputFormat,
        include_summary: enableSummary,
        include_risk: enableRisk,
        include_suggestions: enableSuggestions,
        include_conclusion: enableConclusion,
        analysis_object: 'project',
        output_style: intelligenceLevel === 'expert' ? 'professional' : intelligenceLevel === 'enhanced' ? 'presentation' : 'simple',
        focuses: [
          enableSummary ? '鎽樿' : '',
          enableRisk ? '椋庨櫓' : '',
          enableSuggestions ? '寤鸿' : '',
          reportType === 'ENERGY_DIAGNOSIS' ? '鑳借€楁按骞? : '',
          reportType === 'RISK_REVIEW' ? '寮傚父璇嗗埆' : '',
        ].filter(Boolean),
        user_prompt: [
          projectContextLines.length ? `椤圭洰鐢诲儚锛?{projectContextLines.join('锛?)}` : '',
          pumpStationContextLines.length ? `娉电珯鐢诲儚锛?{pumpStationContextLines.join('锛?)}` : '',
          fallbackSuggestions.length
            ? `鏈湴寤鸿鍙傝€冿細${fallbackSuggestions.map((item, index) => `寤鸿${index + 1} 瀵硅薄=${item.target} 鍘熷洜=${item.reason} 鎺柦=${item.action}`).join('锛?)}`
            : '',
        ].filter(Boolean).join('\n'),
      };

      const generatedReport = normalizeDynamicReport(await agentApi.generateDynamicReport(requestPayload));
      if (generatedReport) {
        const normalizedRisks = normalizeRiskList(generatedReport.risks);
        const normalizedSuggestions = normalizeSuggestionList(generatedReport.suggestions);
        result = {
          source: generatedReport.source === 'rules' ? 'fallback' : 'ai',
          highlights: generatedReport.highlights.length ? generatedReport.highlights.slice(0, 6) : fallback.highlights,
          summary: enableSummary ? (generatedReport.summary.length ? generatedReport.summary.slice(0, 6) : fallback.summary) : [],
          risks: enableRisk ? (normalizedRisks.length ? normalizedRisks : fallback.risks) : [],
          suggestions: enableSuggestions ? (normalizedSuggestions.length ? normalizedSuggestions : fallback.suggestions) : [],
          conclusion: enableConclusion ? (generatedReport.conclusion || fallback.conclusion) : '',
          rawText: generatedReport.raw_text || '',
          report: generatedReport,
        };
      } else {
        message.warning('鍔ㄦ€佹姤鍛婃帴鍙ｆ湭杩斿洖鍙В鏋愬唴瀹癸紝宸插洖閫€鍒版湰鍦板垎鏋?);
      }
    } catch {
      message.warning('鍔ㄦ€佹姤鍛婃湇鍔℃殏涓嶅彲鐢紝宸插洖閫€鍒版湰鍦板垎鏋?);
    } finally {
      setAnalysing(false);
    }

    if (!result.report) {
      return null;
    }

    const preview: PreviewRecord = {
      id: `preview-${Date.now()}`,
      title: `${selectedProjects.map((item) => item.name).join('銆?)} ${REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label ?? '鏅鸿兘鍒嗘瀽鎶ュ憡'}`,
      typeLabel: REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label ?? '鏅鸿兘鍒嗘瀽鎶ュ憡',
      createdAt: new Date().toISOString(),
      rangeLabel,
      intelligenceLabel: INTELLIGENCE_OPTIONS.find((item) => item.value === intelligenceLevel)?.label ?? '澧炲己',
      projectNames: selectedProjects.map((item) => item.name),
      outputStyle: intelligenceLevel === 'expert' ? 'professional' : intelligenceLevel === 'enhanced' ? 'presentation' : 'simple',
      outputStyleLabel: getOutputStyleLabel(
        intelligenceLevel === 'expert' ? 'professional' : intelligenceLevel === 'enhanced' ? 'presentation' : 'simple',
      ),
      outputFormat,
      sourceLabel: result.report?.source === 'hybrid' ? '瑙勫垯 + AI 鍔ㄦ€佺敓鎴? : result.source === 'ai' ? 'AI 缁撴瀯鍖栬緭鍑? : '瑙勫垯鍥為€€鍒嗘瀽',
      result,
    };
    setActivePreview(preview);
    setAnalysisCount((current) => current + 1);
    return preview;
  }, [customRange, enableConclusion, enableRisk, enableSuggestions, enableSummary, intelligenceLevel, outputFormat, pumpStations, rangeLabel, rangePreset, reportType, selectedProjects, snapshot.abnormalHistoryCount, snapshot.analysisObjectCount, snapshot.comparisonLabel, snapshot.dataCompletenessRate, snapshot.failedHistoryCount, snapshot.highRiskCount, snapshot.historyCount, snapshot.latestAbnormalTime, snapshot.pipelineCount, snapshot.projectCount, snapshot.pumpStationCount, visibleHistories, visiblePipelines]);

  const generateReport = useCallback(async () => {
    const preview = activePreview ?? (await runAnalysis());
    if (!preview) return;
    setActivePreview(preview);
    message.success('???????????????????');
  }, [activePreview, runAnalysis]);

  if (loading) {
    return <AnimatedPage className="flex min-h-[520px] items-center justify-center"><Spin size="large" /></AnimatedPage>;
  }
  return (
    <AnimatedPage className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-6 text-slate-100 md:px-6">
      {false ? <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),linear-gradient(145deg,#0f172a_0%,#111827_50%,#020617_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.4)] md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100"><RobotOutlined />鏅鸿兘鎶ュ憡涓績</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">AI 鎶ュ憡宸ヤ綔鍙?/h1>
            <p className="mt-3 text-base leading-7 text-slate-300">鍩轰簬椤圭洰銆佺閬撱€佸叡浜车绔欏拰鍘嗗彶鍒嗘瀽璁板綍锛岃嚜鍔ㄧ敓鎴愭憳瑕併€侀闄┿€佸缓璁拰鎶ュ憡缁撹銆?/p>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void loadData('refresh')}>鍒锋柊鏁版嵁</Button>
            <Button icon={<SaveOutlined />} onClick={saveTemplate}>淇濆瓨妯℃澘</Button>
            <Button type="primary" icon={<RobotOutlined />} loading={analysing} onClick={() => void runAnalysis()}>寮€濮?AI 鍒嗘瀽</Button>
            <Button type="primary" ghost icon={<FileTextOutlined />} onClick={() => void generateReport()}>鐢熸垚鏅鸿兘鎶ュ憡</Button>
          </Space>
        </div>
      </section> : null}

      {false ? (
        <>
      <section className="grid gap-4">
        <div className="rounded-[28px] border border-white/10 bg-[#08111f]/92 p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xl font-semibold text-white">????????</div>
              <div className="mt-1 text-sm text-slate-400">?????????????????????</div>
            </div>
            <div className="text-sm text-slate-400">?????{rangeLabel}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/12 bg-white/6 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.24)] backdrop-blur">
                <div className="text-sm text-slate-300">{item.label}</div>
                <div className={`mt-3 text-3xl font-semibold ${item.valueClassName}`}>{item.value}</div>
                <div className="mt-2 text-sm text-slate-400">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#08111f]/92 p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xl font-semibold text-white">????????</div>
              <div className="mt-1 text-sm text-slate-400">?????????????????????????????????</div>
            </div>
            <div className="text-sm text-slate-400">{snapshot.currentRangeLabel} vs {snapshot.previousRangeLabel}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {trendCards.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/12 bg-white/6 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.24)] backdrop-blur">
                <div className="text-sm text-slate-300">{item.label}</div>
                <div className={`mt-3 text-3xl font-semibold ${item.valueClassName}`}>{item.value}</div>
                <div className="mt-2 text-sm text-slate-400">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#0b1220]/92 p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-white">鐢熸垚鏅鸿兘鎶ュ憡</div>
              <div className="mt-1 text-sm text-slate-400">閫夋嫨椤圭洰銆佸垎鏋愯寖鍥淬€佹櫤鑳界瓑绾у拰杈撳嚭妯″潡銆?/div>
            </div>
            <Tag color="blue">{selectedProjects.length} 涓」鐩凡绾冲叆鍒嗘瀽</Tag>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm text-slate-300">閫夋嫨椤圭洰</div>
                <Select mode="multiple" value={selectedProjectIds} onChange={setSelectedProjectIds} maxTagCount="responsive" style={{ width: '100%' }} options={projects.map((item) => ({ label: `${item.number || '-'} ${item.name}`, value: item.proId }))} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">鎶ュ憡绫诲瀷</div>
                <Select style={{ width: '100%' }} value={reportType} onChange={setReportType} options={REPORT_TYPE_OPTIONS} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">鍒嗘瀽鑼冨洿</div>
                <Select style={{ width: '100%' }} value={rangePreset} onChange={setRangePreset} options={RANGE_OPTIONS} />
              </div>
              {rangePreset === 'custom' ? (
                <div>
                  <div className="mb-2 text-sm text-slate-300">鑷畾涔夋椂闂磋寖鍥?/div>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={customRange}
                    onChange={(value) => {
                      const nextValue = value as [Dayjs | null, Dayjs | null] | null;
                      if (!nextValue || !nextValue[0] || !nextValue[1]) {
                        setCustomRange(null);
                        return;
                      }
                      setCustomRange([nextValue[0], nextValue[1]]);
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm text-slate-300">鏅鸿兘绛夌骇</div>
                <Select style={{ width: '100%' }} value={intelligenceLevel} onChange={setIntelligenceLevel} options={INTELLIGENCE_OPTIONS} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">杈撳嚭鏍煎紡</div>
                <Select style={{ width: '100%' }} value={outputFormat} onChange={setOutputFormat} options={OUTPUT_OPTIONS} />
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                <div className="mb-3 text-sm font-medium text-white">AI 鍔熻兘寮€鍏?/div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between"><span>鏅鸿兘鎽樿</span><Switch checked={enableSummary} onChange={setEnableSummary} /></div>
                  <div className="flex items-center justify-between"><span>椋庨櫓鎻愮ず</span><Switch checked={enableRisk} onChange={setEnableRisk} /></div>
                  <div className="flex items-center justify-between"><span>浼樺寲寤鸿</span><Switch checked={enableSuggestions} onChange={setEnableSuggestions} /></div>
                  <div className="flex items-center justify-between"><span>鑷姩缁撹</span><Switch checked={enableConclusion} onChange={setEnableConclusion} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#09101d]/92 p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
          <div className="mb-4 text-lg font-semibold text-white">AI ????</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4"><div className="text-sm text-slate-400">??????</div><div className="mt-2 text-2xl font-semibold text-white">{snapshot.currentSampleCount}</div></div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4"><div className="text-sm text-slate-400">?????</div><div className="mt-2 text-2xl font-semibold text-white">{snapshot.previousSampleCount}</div></div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4"><div className="text-sm text-slate-400">????</div><div className="mt-2 text-2xl font-semibold text-amber-300">{snapshot.analysisObjectCount ? `${snapshot.abnormalRate}%` : '?'}</div></div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4"><div className="text-sm text-slate-400">?????</div><div className="mt-2 text-2xl font-semibold text-rose-300">{snapshot.analysisObjectCount ? `${snapshot.highRiskRate}%` : '?'}</div></div>
          </div>
          <div className="mt-4 rounded-[24px] border border-cyan-300/15 bg-cyan-400/8 p-4 text-sm leading-7 text-slate-300">?????{rangeLabel}??? {snapshot.analysisObjectCount} ?????????? {snapshot.abnormalHistoryCount} ????? {snapshot.highRiskCount} ??????? {snapshot.healthScore !== null ? `${snapshot.healthScore} ?` : '?????'}?????????? {formatSignedPercent(snapshot.energyChangePercent)}??? {formatSignedPercent(snapshot.efficiencyChangePercent)}????? {formatSignedCount(snapshot.riskCountChange)}?</div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0b1220_0%,#0f172a_100%)] p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-semibold text-white">AI 鍒嗘瀽缁撴灉鍖?/div>
            <div className="mt-1 text-sm text-slate-400">鍏堢湅鎽樿銆侀闄╁拰寤鸿锛屽啀鍐冲畾鏄惁鐢熸垚鎶ュ憡銆?/div>
          </div>
          {activePreview ? <Button icon={<DownloadOutlined />} onClick={() => downloadMarkdown(activePreview!)}>瀵煎嚭鎽樿</Button> : null}
        </div>
        {activePreview ? (
          <PreviewContent preview={activePreview!} />
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/10 px-6 py-16 text-center">
            <div className="mx-auto max-w-md">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-200"><RobotOutlined style={{ fontSize: 28 }} /></div>
              <div className="text-xl font-semibold text-white">绛夊緟 AI 鍒嗘瀽</div>
              <div className="mt-3 text-sm leading-7 text-slate-400">鐐瑰嚮鈥滃紑濮?AI 鍒嗘瀽鈥濆悗锛岃繖閲屼細鏄剧ず鏅鸿兘鎽樿銆侀闄╂彁绀恒€佷紭鍖栧缓璁拰鎶ュ憡缁撹銆?/div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,17,31,0.96)_0%,rgba(9,18,34,0.96)_100%)] p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xl font-semibold text-white">鍘嗗彶鎶ュ憡绠＄悊鍖?/div>
              <Tag color="cyan">{historyItems.length} 鏉?/Tag>
            </div>
            <div className="mt-1 text-sm text-slate-400">杩欓噷闆嗕腑鏌ョ湅宸插綊妗ｆ姤鍛婏紝鏀寔棰勮銆佸鍑恒€佸垹闄ゅ拰绛涢€夈€?/div>
          </div>
          <Space wrap>
            {HISTORY_FILTER_OPTIONS.map((item) => <Button key={item.value} size="small" type={historyFilter === item.value ? 'primary' : 'default'} onClick={() => setHistoryFilter(item.value)}>{item.label}</Button>)}
            {historyItems.length ? (
              <Popconfirm
                title="娓呯┖褰撳墠绛涢€夌粨鏋滐紵"
                description={`灏嗗垹闄?${currentHistoryStats.localIds.length} 鏉℃湰鍦?AI 鎶ュ憡鍜?${currentHistoryStats.serverIds.length} 鏉℃湇鍔＄璁板綍锛屽垹闄ゅ悗涓嶅彲鎭㈠銆俙}
                okText="娓呯┖"
                cancelText="鍙栨秷"
                onConfirm={() => void handleClearCurrentHistory()}
              >
                <Button danger icon={<DeleteOutlined />} loading={clearingCurrentList}>
                  娓呯┖褰撳墠鍒楄〃
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        </div>
        {historyItems.length ? (
          <div className="grid gap-4">
            {historyItems.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-white/8 bg-white/5 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-white">{item.title}</div>
                      <Tag color={item.kind === 'ai' ? 'blue' : 'default'}>{item.kind === 'ai' ? 'AI鎶ュ憡' : '鏅€氭姤鍛?}</Tag>
                      {renderStatus(item.status)}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{formatTime(item.time)}</div>
                    <div className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</div>
                  </div>
                  <Space wrap>
                    {item.preview ? <Button icon={<FileSearchOutlined />} onClick={() => openPreview(item.preview!)}>棰勮</Button> : null}
                    {item.preview ? <Button icon={<DownloadOutlined />} onClick={() => downloadMarkdown(item.preview!)}>瀵煎嚭</Button> : null}
                    <Popconfirm
                      title={item.preview ? '鍒犻櫎杩欐潯鏈湴 AI 鎶ュ憡锛? : '鍒犻櫎杩欐潯鏈嶅姟绔巻鍙茶褰曪紵'}
                      description={item.preview ? '鍒犻櫎鍚庡皢浠庡綋鍓嶆祻瑙堝櫒鏈湴瀛樺偍涓Щ闄ゃ€? : '鍒犻櫎鍚庡皢浠庢暟鎹簱鍘嗗彶璁板綍涓Щ闄わ紝涓斾笉鍙仮澶嶃€?}
                      okText="鍒犻櫎"
                      cancelText="鍙栨秷"
                      onConfirm={() => void handleDeleteHistoryItem(item)}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={deletingIdSet.has(item.id)}>
                        鍒犻櫎
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-cyan-300/20 bg-cyan-400/5 px-6 py-12">
            <Empty description="鍘嗗彶鎶ュ憡绠＄悊鍖哄綋鍓嶈繕娌℃湁鍙睍绀虹殑鎶ュ憡銆傚厛鐐瑰嚮涓婃柟鈥滅敓鎴愭櫤鑳芥姤鍛娾€濓紝鐢熸垚鍚庝細鑷姩杩涘叆杩欓噷銆? image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </section>
        </>
      ) : null}
      <section className="report-light-surface overflow-hidden rounded-[30px] border border-cyan-300/20 bg-[linear-gradient(180deg,#08111f_0%,#0b1220_45%,#07101d_100%)] p-6 shadow-[0_30px_90px_rgba(2,8,23,0.42)] md:p-8">
        <div className="flex flex-col gap-4 border-b border-cyan-200/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <FileSearchOutlined />
              鍘嗗彶鎶ュ憡鍖?
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-3xl font-semibold tracking-tight text-white">鎶ュ憡鍘嗗彶妗ｆ</div>
              <Tag color="cyan">{historyItems.length} 鏉?/Tag>
            </div>
            <div className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              杩欓噷鍗曠嫭灞曠ず宸茬粡鐢熸垚骞跺綊妗ｇ殑鍘嗗彶鎶ュ憡锛屾敮鎸侀瑙堛€佸鍑恒€佸垹闄ゅ拰绛涢€夈€傛柊鐢熸垚鐨勬姤鍛婁細鑷姩杩涘叆杩欓噷銆?
            </div>
          </div>
          <Space wrap>
            {HISTORY_FILTER_OPTIONS.map((item) => (
              <Button key={item.value} size="small" type={historyFilter === item.value ? 'primary' : 'default'} onClick={() => setHistoryFilter(item.value)}>
                {item.label}
              </Button>
            ))}
            {historyItems.length ? (
              <Popconfirm
                title="娓呯┖褰撳墠绛涢€夌粨鏋滐紵"
                description={`灏嗗垹闄?${currentHistoryStats.localIds.length} 鏉℃湰鍦版姤鍛婂拰 ${currentHistoryStats.serverIds.length} 鏉℃暟鎹簱璁板綍锛屽垹闄ゅ悗涓嶅彲鎭㈠銆俙}
                okText="娓呯┖"
                cancelText="鍙栨秷"
                onConfirm={() => void handleClearCurrentHistory()}
              >
                <Button danger icon={<DeleteOutlined />} loading={clearingCurrentList}>
                  娓呯┖褰撳墠鍒楄〃
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        </div>
        {historyItems.length ? (
          <div className="mt-6 grid gap-4">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className={`relative overflow-hidden rounded-[24px] border bg-white/5 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.24)] ${
                  item.preview ? getOutputStyleMeta(item.preview!.outputStyle, item.preview!.outputStyleLabel).cardClassName : 'border-white/8'
                }`}
              >
                {item.preview ? (
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getOutputStyleMeta(item.preview!.outputStyle, item.preview!.outputStyleLabel).stripeClassName}`} />
                ) : null}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-white">{item.title}</div>
                      <Tag color={item.kind === 'ai' ? 'blue' : 'default'}>{item.kind === 'ai' ? 'AI 鎶ュ憡' : '鏅€氭姤鍛?}</Tag>
                      {item.outputStyleLabel ? <Tag color="geekblue">{item.outputStyleLabel}</Tag> : null}
                      {renderStatus(item.status)}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{formatTime(item.time)}</div>
                    {item.preview ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getOutputStyleMeta(item.preview!.outputStyle, item.preview!.outputStyleLabel).chips.map((chip) => (
                          <span
                            key={chip}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              getOutputStyleMeta(item.preview!.outputStyle, item.preview!.outputStyleLabel).badgeClassName
                            }`}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</div>
                  </div>
                  <Space wrap>
                    {item.preview ? (
                      <Button icon={<FileSearchOutlined />} onClick={() => openPreview(item.preview!)}>
                        棰勮
                      </Button>
                    ) : null}
                    {item.preview ? (
                      <Button icon={<DownloadOutlined />} onClick={() => downloadMarkdown(item.preview!)}>
                        瀵煎嚭
                      </Button>
                    ) : null}
                    <Popconfirm
                      title={item.preview ? '鍒犻櫎杩欐潯鏈湴鎶ュ憡锛? : '鍒犻櫎杩欐潯鏁版嵁搴撳巻鍙茶褰曪紵'}
                      description={item.preview ? '鍒犻櫎鍚庝細浠庡綋鍓嶆祻瑙堝櫒鏈湴璁板綍涓Щ闄ゃ€? : '鍒犻櫎鍚庝細浠庢暟鎹簱鍘嗗彶璁板綍涓Щ闄わ紝涓斾笉鍙仮澶嶃€?}
                      okText="鍒犻櫎"
                      cancelText="鍙栨秷"
                      onConfirm={() => void handleDeleteHistoryItem(item)}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={deletingIdSet.has(item.id)}>
                        鍒犻櫎
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-cyan-300/20 bg-cyan-400/5 px-6 py-14">
            <Empty
              description="鍘嗗彶鎶ュ憡鍖哄綋鍓嶈繕娌℃湁鍙睍绀虹殑鎶ュ憡銆傜偣鍑讳笂鏂光€滅敓鎴愭櫤鑳芥姤鍛娾€濆悗锛屾姤鍛婁細鑷姩淇濆瓨鍒拌繖閲屻€?
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </section>
    </AnimatedPage>
  );
}



