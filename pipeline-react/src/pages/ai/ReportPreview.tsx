import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Alert, Button, DatePicker, Empty, Input, Modal, Popconfirm, Select, Space, Spin, Switch, Tag, message } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { calculationHistoryApi, oilPropertyApi, pipelineApi, projectApi, pumpStationApi } from '../../api';
import { agentApi } from '../../api/agent';
import AnimatedPage from '../../components/common/AnimatedPage';
import type { CalculationHistory, OilProperty, PageResult, Pipeline, Project, PumpStation, R } from '../../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

type ReportType = 'AI_REPORT' | 'RISK_REVIEW' | 'ENERGY_DIAGNOSIS' | 'OPERATION_BRIEF';
type RangePreset = '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';
type OutputFormat = 'markdown' | 'docx' | 'pdf';
type IntelligenceLevel = 'standard' | 'enhanced' | 'expert';
type HistoryFilter = 'all' | 'ai' | 'normal' | 'completed' | 'running' | 'failed';
type DateRangeValue = [Dayjs, Dayjs] | null;
type JsonRecord = Record<string, unknown>;
type BusinessAnalysisObject = 'project' | 'pipeline' | 'pumpStation';
type BusinessTimePreset = 'today' | '7d' | '30d' | 'custom';
type BusinessReportKind = 'overview' | 'energy' | 'pump' | 'sensitivity' | 'diagnosis' | 'comparison';
type BusinessOutputStyle = 'simple' | 'professional' | 'presentation';
type BusinessOptimizationGoal = 'energy' | 'cost' | 'safety' | 'balanced';
type BusinessRiskLevel = '高风险' | '中风险' | '低风险';
type RiskLevel = '高' | '中' | '低';
type SuggestionPriority = '高' | '中' | '低';

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
};

type PreviewRecord = {
  id: string;
  title: string;
  typeLabel: string;
  createdAt: string;
  rangeLabel: string;
  intelligenceLabel: string;
  projectNames: string[];
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
  preview?: PreviewRecord | LocalReportRecord;
};

type BusinessKpi = {
  label: string;
  value: string;
  note: string;
};

type BusinessDiagnosisFactor = {
  name: string;
  score: number;
  description: string;
};

type BusinessComparisonScheme = {
  name: string;
  tag: string;
  head: string;
  pressure: string;
  power: string;
  cost: string;
  risk: BusinessRiskLevel;
  highlighted?: boolean;
};

type BusinessSensitivityItem = {
  name: string;
  impact: number;
  description: string;
};

type BusinessRiskCard = {
  level: BusinessRiskLevel;
  title: string;
  description: string;
  action: string;
};

type BusinessChartCard = {
  title: string;
  value: number;
  insight: string;
  accentClassName: string;
};

type BusinessReportModel = {
  title: string;
  totalComment: string;
  projectName: string;
  objectLabel: string;
  rangeLabel: string;
  generatedAt: string;
  reportTypeLabel: string;
  focusLabels: string[];
  outputStyleLabel: string;
  highlightItems: string[];
  kpis: BusinessKpi[];
  diagnosisSummary: string[];
  diagnosisFactors: BusinessDiagnosisFactor[];
  schemes: BusinessComparisonScheme[];
  sensitivityItems: BusinessSensitivityItem[];
  risks: BusinessRiskCard[];
  immediateActions: string[];
  shortTermActions: string[];
  longTermActions: string[];
  chartCards: BusinessChartCard[];
};

const TEMPLATE_KEY = 'pipeline-ai-report-template-v3';
const HISTORY_KEY = 'pipeline-ai-report-history-v3';
const COUNT_KEY = 'pipeline-ai-report-count-v3';

const BUSINESS_OBJECT_OPTIONS: Array<{ label: string; value: BusinessAnalysisObject }> = [
  { label: '项目', value: 'project' },
  { label: '管道', value: 'pipeline' },
  { label: '泵站', value: 'pumpStation' },
];

const BUSINESS_TIME_OPTIONS: Array<{ label: string; value: BusinessTimePreset }> = [
  { label: '今日', value: 'today' },
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '自定义', value: 'custom' },
];

const BUSINESS_REPORT_TYPE_OPTIONS: Array<{ label: string; value: BusinessReportKind }> = [
  { label: '运行概况报告', value: 'overview' },
  { label: '能耗分析报告', value: 'energy' },
  { label: '泵站优化报告', value: 'pump' },
  { label: '敏感性分析报告', value: 'sensitivity' },
  { label: '异常诊断报告', value: 'diagnosis' },
  { label: '多方案对比报告', value: 'comparison' },
];

const BUSINESS_FOCUS_OPTIONS = [
  '能耗水平',
  '压力变化',
  '流量波动',
  '泵站配置',
  '油品参数影响',
  '异常指标预警',
  '优化建议',
];

const BUSINESS_OUTPUT_STYLE_OPTIONS: Array<{ label: string; value: BusinessOutputStyle }> = [
  { label: '简洁版', value: 'simple' },
  { label: '专业版', value: 'professional' },
  { label: '汇报版', value: 'presentation' },
];

const BUSINESS_OPTIMIZATION_GOAL_OPTIONS: Array<{ label: string; value: BusinessOptimizationGoal }> = [
  { label: '能耗最低', value: 'energy' },
  { label: '费用最低', value: 'cost' },
  { label: '安全优先', value: 'safety' },
  { label: '综合最优', value: 'balanced' },
];

const BUSINESS_EXAMPLE_PROMPTS = [
  '分析当前项目近30天能耗变化趋势，重点关注能耗偏高原因。',
  '生成泵站节能优化报告，并给出可执行的调整建议。',
  '对比当前方案与推荐方案的运行成本和风险等级。',
  '找出影响压力损失的主要因素，并给出监控建议。',
];

function PreviewContent({ preview }: { preview: PreviewRecord | LocalReportRecord }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">生成时间</div>
            <div className="mt-2 text-sm text-slate-100">{formatTime(preview.createdAt)}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">分析范围</div>
            <div className="mt-2 text-sm text-slate-100">{preview.rangeLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">智能等级</div>
            <div className="mt-2 text-sm text-slate-100">{preview.intelligenceLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">报告类型</div>
            <div className="mt-2 text-sm text-slate-100">{preview.typeLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">输出格式</div>
            <div className="mt-2 text-sm text-slate-100">{preview.outputFormat.toUpperCase()}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">来源</div>
            <div className="mt-2 text-sm text-slate-100">{preview.sourceLabel}</div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span className="text-slate-400">覆盖项目：</span>
          {preview.projectNames.length ? preview.projectNames.join('、') : '未选择项目'}
        </div>
      </div>

      <div className="rounded-[24px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_40px_rgba(8,47,73,0.18)] xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">关键发现</div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">AI Findings</div>
        </div>
        {preview.result.highlights.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {preview.result.highlights.map((item, index) => (
              <div key={`${index}-${item}`} className="rounded-[20px] border border-cyan-200/15 bg-slate-950/35 px-4 py-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">发现 {String(index + 1).padStart(2, '0')}</div>
                <div className="mt-3 text-sm leading-7 text-slate-100">{item}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">暂无关键发现</div>
        )}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">风险对象</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">对象 / 类型 / 等级 / 原因 / 建议</div>
        </div>
        {preview.result.risks.length ? (
          <>
            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead>
                  <tr className="text-slate-400">
                    <th className="px-4 py-3 font-medium">风险对象</th>
                    <th className="px-4 py-3 font-medium">风险类型</th>
                    <th className="px-4 py-3 font-medium">等级</th>
                    <th className="px-4 py-3 font-medium">原因</th>
                    <th className="px-4 py-3 font-medium">建议</th>
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
                      <div className="text-sm text-slate-400">风险对象</div>
                      <div className="mt-1 text-base font-semibold text-white">{item.target}</div>
                    </div>
                    <Tag color={getRiskLevelColor(item.level)}>{item.level}</Tag>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-300">
                    <div>
                      <div className="text-slate-400">风险类型</div>
                      <div className="mt-1 text-slate-100">{item.riskType}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">原因</div>
                      <div className="mt-1 leading-6 text-slate-100">{item.reason}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">建议</div>
                      <div className="mt-1 leading-6 text-slate-100">{item.suggestion}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 text-slate-400">暂无风险对象</div>
        )}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">优化建议</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">对象 / 原因 / 措施 / 预期</div>
        </div>
        {preview.result.suggestions.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {preview.result.suggestions.map((item, index) => (
              <div key={`${item.target}-${item.action}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-400">优化对象</div>
                    <div className="mt-1 text-base font-semibold text-white">{item.target}</div>
                  </div>
                  <Tag color={getSuggestionPriorityColor(item.priority)}>{item.priority}</Tag>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  <div>
                    <div className="text-slate-400">触发原因</div>
                    <div className="mt-1 leading-6 text-slate-100">{item.reason}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">建议措施</div>
                    <div className="mt-1 leading-6 text-slate-100">{item.action}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">预期收益</div>
                    <div className="mt-1 leading-6 text-slate-100">{item.expected}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-slate-400">暂无优化建议</div>
        )}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="text-lg font-semibold text-white">报告摘要</div>
        <div className="mt-4 space-y-3">
          {preview.result.summary.length
            ? preview.result.summary.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                  {item}
                </div>
              ))
            : <div className="text-slate-400">暂无报告摘要</div>}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
        <div className="text-lg font-semibold text-white">最终结论</div>
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-200">
          {preview.result.conclusion || '暂无结论'}
        </div>
      </div>

      {preview.result.rawText ? (
        <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 xl:col-span-2">
          <div className="text-lg font-semibold text-white">原始计算数据</div>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4 text-xs leading-6 text-slate-200">
            {preview.result.rawText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
const REPORT_TYPE_OPTIONS: Array<{ label: string; value: ReportType }> = [
  { label: '智能分析报告', value: 'AI_REPORT' },
  { label: '风险复盘报告', value: 'RISK_REVIEW' },
  { label: '能耗诊断报告', value: 'ENERGY_DIAGNOSIS' },
  { label: '运行简报', value: 'OPERATION_BRIEF' },
];
const RANGE_OPTIONS: Array<{ label: string; value: RangePreset }> = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '最近90天', value: '90d' },
  { label: '本年度', value: 'year' },
  { label: '全部历史', value: 'all' },
  { label: '自定义', value: 'custom' },
];
const INTELLIGENCE_OPTIONS: Array<{ label: string; value: IntelligenceLevel }> = [
  { label: '标准', value: 'standard' },
  { label: '增强', value: 'enhanced' },
  { label: '专家', value: 'expert' },
];
const OUTPUT_OPTIONS: Array<{ label: string; value: OutputFormat }> = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'DOCX 模板', value: 'docx' },
  { label: 'PDF 模板', value: 'pdf' },
];
const HISTORY_FILTER_OPTIONS: Array<{ label: string; value: HistoryFilter }> = [
  { label: '全部报告', value: 'all' },
  { label: 'AI报告', value: 'ai' },
  { label: '普通报告', value: 'normal' },
  { label: '已完成', value: 'completed' },
  { label: '生成中', value: 'running' },
  { label: '失败', value: 'failed' },
];

const CALCULATION_TYPE_LABELS: Record<string, string> = {
  HYDRAULIC: '水力分析',
  OPTIMIZATION: '泵站优化',
  SENSITIVITY: '敏感性分析',
};

const HISTORY_FIELD_LABELS: Record<string, string> = {
  flowRate: '流量',
  density: '密度',
  viscosity: '粘度',
  length: '管道长度',
  diameter: '管径',
  thickness: '壁厚',
  roughness: '粗糙度',
  startAltitude: '起点高程',
  endAltitude: '终点高程',
  inletPressure: '首站进站压头',
  pump480Num: 'ZMI480 数量',
  pump375Num: 'ZMI375 数量',
  pump480Head: 'ZMI480 扬程',
  pump375Head: 'ZMI375 扬程',
  pumpEfficiency: '泵效率',
  motorEfficiency: '电机效率',
  electricityPrice: '电价',
  workingDays: '工作天数',
  hydraulicSlope: '水力坡降',
  frictionHeadLoss: '摩阻损失',
  totalHead: '总扬程',
  firstStationOutPressure: '首站出站压头',
  endStationInPressure: '末站进站压头',
  reynoldsNumber: '雷诺数',
  flowRegime: '流态',
  totalPressureDrop: '总压降',
  totalEnergyConsumption: '总能耗',
  totalCost: '总成本',
  isFeasible: '方案可行性',
  totalCalculations: '总计算次数',
  duration: '分析耗时',
};

const DEFAULT_ANALYSIS_TARGET = '当前分析范围';

function normalizeRiskLevel(value: unknown): RiskLevel {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '中';
  if (text.includes('高') || text.includes('high') || text.includes('critical') || text.includes('严重')) return '高';
  if (text.includes('低') || text.includes('low')) return '低';
  return '中';
}

function getRiskLevelColor(level: RiskLevel) {
  if (level === '高') return 'red';
  if (level === '中') return 'gold';
  return 'blue';
}

function normalizeSuggestionPriority(value: unknown): SuggestionPriority {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '中';
  if (text.includes('高') || text.includes('high') || text.includes('critical') || text.includes('紧急')) return '高';
  if (text.includes('低') || text.includes('low')) return '低';
  return '中';
}

function getSuggestionPriorityColor(priority: SuggestionPriority) {
  if (priority === '高') return 'red';
  if (priority === '中') return 'gold';
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
    riskType: riskType.trim() || '风险提示',
    level,
    reason: reason.trim() || '需要结合上下文进一步核实。',
    suggestion: suggestion.trim() || '建议补充现场数据后复核。',
  };
}

function buildSuggestionItem(
  target: string,
  reason: string,
  action: string,
  expected: string,
  priority: SuggestionPriority = '中',
): SuggestionItem {
  return {
    target: target.trim() || DEFAULT_ANALYSIS_TARGET,
    reason: reason.trim() || '需要结合上下文补充触发原因。',
    action: action.trim() || '建议结合当前工况进一步复核。',
    expected: expected.trim() || '建议补充量化收益或后续跟踪指标。',
    priority,
  };
}

function pickLabelValue(text: string, label: string) {
  const match = text.match(new RegExp(`${label}[：:]\\s*([^\\n]+)`));
  return match?.[1]?.trim() ?? '';
}

function inferSuggestionPriorityFromText(text: string): SuggestionPriority {
  if (text.includes('高优先级') || text.includes('立即') || text.includes('优先') || text.includes('异常')) return '高';
  if (text.includes('跟踪') || text.includes('持续')) return '中';
  return '低';
}

function inferRiskTypeFromText(text: string) {
  if (text.includes('压降') || text.includes('摩阻')) return '压降偏高';
  if (text.includes('效率')) return '效率下降';
  if (text.includes('能耗') || text.includes('波动')) return '能耗波动';
  if (text.includes('不可行')) return '方案不可行';
  if (text.includes('失败') || text.includes('错误')) return '计算失败';
  if (text.includes('压力') || text.includes('压头')) return '压力异常';
  return '风险提示';
}

function inferRiskLevelFromText(text: string): RiskLevel {
  if (text.includes('不可行') || text.includes('失败') || text.includes('错误') || text.includes('小于等于 0')) return '高';
  if (text.includes('偏高') || text.includes('下降') || text.includes('波动') || text.includes('异常')) return '中';
  return '低';
}

function normalizeRiskItem(value: unknown): RiskItem | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    return buildRiskItem(DEFAULT_ANALYSIS_TARGET, inferRiskTypeFromText(text), inferRiskLevelFromText(text), text, '建议结合上下文进一步复核。');
  }

  if (!isRecord(value)) return null;

  const target = pickFirstString(value, ['target', 'object', 'subject', 'name', 'riskObject', '对象', '风险对象']);
  const riskType = pickFirstString(value, ['riskType', 'type', 'category', 'risk_category', '风险类型']);
  const reason = pickFirstString(value, ['reason', 'cause', 'description', 'detail', '原因']);
  const suggestion = pickFirstString(value, ['suggestion', 'advice', 'recommendation', 'action', '建议']);
  const summaryText = pickFirstString(value, ['summary', 'text', 'message']);

  if (!target && !riskType && !reason && !suggestion && !summaryText) return null;

  const mergedReason = reason || summaryText;
  return buildRiskItem(
    target || DEFAULT_ANALYSIS_TARGET,
    riskType || inferRiskTypeFromText(mergedReason || summaryText),
    normalizeRiskLevel(value.level ?? value.riskLevel ?? value['等级']),
    mergedReason || '需要结合上下文进一步核实。',
    suggestion || '建议结合上下文进一步复核。',
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
    const target = pickLabelValue(text, '对象');
    const reason = pickLabelValue(text, '原因');
    const action = pickLabelValue(text, '措施') || pickLabelValue(text, '建议');
    const expected = pickLabelValue(text, '预期');
    const priority = pickLabelValue(text, '优先级');
    return buildSuggestionItem(
      target || DEFAULT_ANALYSIS_TARGET,
      reason || '该建议来自旧版文本，建议结合最新数据补充原因说明。',
      action || text,
      expected || '建议补充量化收益或执行优先级后落地。',
      normalizeSuggestionPriority(priority || inferSuggestionPriorityFromText(text)),
    );
  }

  if (!isRecord(value)) return null;

  const target = pickFirstString(value, ['target', 'object', 'subject', 'name', '对象']);
  const reason = pickFirstString(value, ['reason', 'cause', 'why', 'description', 'detail', '原因']);
  const action = pickFirstString(value, ['action', 'measure', 'step', 'suggestion', 'advice', 'recommendation', '措施', '建议']);
  const expected = pickFirstString(value, ['expected', 'impact', 'benefit', 'result', 'outcome', '预期']);
  const summaryText = pickFirstString(value, ['summary', 'text', 'message']);

  if (!target && !reason && !action && !expected && !summaryText) return null;

  return buildSuggestionItem(
    target || DEFAULT_ANALYSIS_TARGET,
    reason || summaryText || '建议结合上下文补充触发原因。',
    action || summaryText || '建议结合当前工况进一步复核。',
    expected || '建议补充量化收益或后续跟踪指标。',
    normalizeSuggestionPriority(value.priority ?? value.level ?? value['优先级'] ?? value['等级'] ?? inferSuggestionPriorityFromText(`${reason} ${action} ${summaryText}`)),
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
      (text.includes('对象：') || text.includes('措施：') || text.includes('原因：') || text.includes('预期：') || text.includes('优先级：'))
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

function normalizePreviewRecord(record: LocalReportRecord): LocalReportRecord {
  return {
    ...record,
    result: {
      ...record.result,
      highlights: toLines(record.result.highlights),
      summary: toLines(record.result.summary),
      risks: normalizeRiskList(record.result.risks),
      suggestions: normalizeSuggestionList(record.result.suggestions),
      conclusion: typeof record.result.conclusion === 'string' ? record.result.conclusion : '',
      rawText: typeof record.result.rawText === 'string' ? record.result.rawText : '',
    },
  };
}

function normalizeLocalReportRecords(records: LocalReportRecord[]) {
  return records.map((item) => normalizePreviewRecord(item));
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
    return `${customRange[0].format('YYYY-MM-DD')} 至 ${customRange[1].format('YYYY-MM-DD')}`;
  }
  return RANGE_OPTIONS.find((item) => item.value === preset)?.label ?? '最近30天';
}

function getComparisonLabel(preset: RangePreset, customRange: DateRangeValue) {
  if (preset === 'custom' && customRange) {
    const currentStart = customRange[0].startOf('day');
    const currentEnd = customRange[1].endOf('day');
    const days = currentEnd.startOf('day').diff(currentStart.startOf('day'), 'day') + 1;
    const previousEnd = currentStart.subtract(1, 'day').endOf('day');
    const previousStart = previousEnd.subtract(days - 1, 'day').startOf('day');
    return `${currentStart.format('YYYY-MM-DD')} 至 ${currentEnd.format('YYYY-MM-DD')} vs ${previousStart.format('YYYY-MM-DD')} 至 ${previousEnd.format('YYYY-MM-DD')}`;
  }
  if (preset === '7d') return '最近7天 vs 前7天';
  if (preset === '30d') return '最近30天 vs 前30天';
  if (preset === '90d') return '最近90天 vs 前90天';
  if (preset === 'year') return '本年度 vs 去年同期';
  return '全部历史累计（无前置周期）';
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

function extractText(payload: Record<string, unknown>) {
  const candidates = [payload.final_response, payload.response, payload.result, payload.output, payload.message];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item;
    if (item && typeof item === 'object') {
      const nested = item as Record<string, unknown>;
      if (typeof nested.response === 'string' && nested.response.trim()) return nested.response;
      if (typeof nested.final_response === 'string' && nested.final_response.trim()) return nested.final_response;
    }
  }
  return '';
}

function toLines(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\r?\n|(?<=[。！？；!?])/).map((item) => item.replace(/^[\d.、\-\s]+/, '').trim()).filter(Boolean);
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
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    const text = value.map((item) => formatFieldValue(item)).filter((item) => item !== '-').join('，');
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
  if (status === 0) return '生成中';
  if (status === 2) return '失败';
  return '已完成';
}

function getHistoryTypeLabel(history: CalculationHistory) {
  if (history.calcTypeName?.trim()) return history.calcTypeName;
  const calcType = history.calcType?.toUpperCase();
  if (calcType && CALCULATION_TYPE_LABELS[calcType]) return CALCULATION_TYPE_LABELS[calcType];
  return history.calcType || '普通报告';
}

function getHistoryInputSource(history: CalculationHistory, input: JsonRecord) {
  return history.calcType?.toUpperCase() === 'SENSITIVITY' && isRecord(input.baseParams) ? input.baseParams : input;
}

function getHistoryOutputSource(history: CalculationHistory, output: JsonRecord) {
  return history.calcType?.toUpperCase() === 'SENSITIVITY' && isRecord(output.baseResult) ? output.baseResult : output;
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
    .map(([key, value]) => `${HISTORY_FIELD_LABELS[key] ?? key}：${formatFieldValue(value)}`);
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
        `管道 ${item.pipelineCount} 条`,
        item.totalThroughput > 0 ? `设计输量 ${formatNumber(item.totalThroughput)}` : '',
        `历史 ${item.historyCount} 条`,
        `异常 ${item.abnormalCount} 条`,
        item.avgEnergyIntensity !== null ? `单位输量能耗指数 ${formatNumber(item.avgEnergyIntensity)}` : '',
        item.avgFrictionRatio !== null ? `平均摩阻占比 ${formatPercent(item.avgFrictionRatio)}` : '',
      ].filter(Boolean);
      return `${item.project.name}：${parts.join('，')}`;
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
      '历史异常集中',
      abnormalProject.lowPressureCount > 0 || abnormalProject.infeasibleCount > 0 ? '高' : '中',
      `${abnormalProject.historyCount} 条历史中有 ${abnormalProject.abnormalCount} 条异常。`,
      '建议优先复核该项目的关键入参、压力约束和计算边界条件。',
    ));
  }

  const frictionProject = [...projectInsights]
    .filter((item) => item.avgFrictionRatio !== null && item.avgFrictionRatio > 0.7)
    .sort((left, right) => (right.avgFrictionRatio ?? 0) - (left.avgFrictionRatio ?? 0))[0];

  if (frictionProject?.avgFrictionRatio !== null) {
    pushRisk(buildRiskItem(
      frictionProject.project.name,
      '摩阻占比偏高',
      frictionProject.avgFrictionRatio > 0.85 ? '高' : '中',
      `平均摩阻占比约 ${formatPercent(frictionProject.avgFrictionRatio)}。`,
      '建议复核管径、粗糙度和运行流量，必要时重新校核水力参数。',
    ));
  }

  const energyProject = [...projectInsights]
    .filter((item) => item.avgEnergyIntensity !== null)
    .sort((left, right) => (right.avgEnergyIntensity ?? 0) - (left.avgEnergyIntensity ?? 0))[0];

  if (energyProject?.avgEnergyIntensity !== null) {
    pushRisk(buildRiskItem(
      energyProject.project.name,
      '能耗水平偏高',
      '中',
      `单位输量能耗指数约 ${formatNumber(energyProject.avgEnergyIntensity)}。`,
      '建议结合泵站组合、效率和电价进一步做节能优化。',
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
        pumpEfficiency !== null ? `泵效率 ${formatPercent(pumpEfficiency)}` : '',
        electricEfficiency !== null ? `电机效率 ${formatPercent(electricEfficiency)}` : '',
        combinedEfficiency !== null ? `综合效率 ${formatPercent(combinedEfficiency)}` : '',
        toFiniteNumber(station.displacement) !== null ? `排量 ${formatNumber(station.displacement)}` : '',
      ].filter(Boolean);
      return { text: `${station.name}：${parts.join('，')}`, combinedEfficiency: combinedEfficiency ?? Number.POSITIVE_INFINITY };
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
        `单位输量能耗高于已选项目均值 ${formatPercent(deviation)}。`,
        '优化泵站负荷分配，复核高峰时段运行策略。',
        '预计可降低单位输量能耗 5%~8%。',
        deviation > 0.12 ? '高' : '中',
      ));
    }
  }

  const abnormalProject = [...projectInsights].sort((left, right) => (right.abnormalCount - left.abnormalCount) || (right.failedCount - left.failedCount))[0];
  if (abnormalProject && abnormalProject.abnormalCount > 0) {
    const reasonParts = [
      `${abnormalProject.historyCount} 条历史中有 ${abnormalProject.abnormalCount} 条异常`,
      abnormalProject.lowPressureCount > 0 ? `末站压力不足 ${abnormalProject.lowPressureCount} 次` : '',
      abnormalProject.infeasibleCount > 0 ? `方案不可行 ${abnormalProject.infeasibleCount} 次` : '',
    ].filter(Boolean);
    pushSuggestion(buildSuggestionItem(
      abnormalProject.project.name,
      reasonParts.join('，'),
      '复核入口压头、泵扬程与流量设定，必要时重新执行水力分析和泵站优化。',
      '优先消除不可行工况，减少异常回放次数。',
      abnormalProject.lowPressureCount > 0 || abnormalProject.infeasibleCount > 0 ? '高' : '中',
    ));
  }

  const frictionProject = [...projectInsights]
    .filter((item) => item.avgFrictionRatio !== null && item.avgFrictionRatio > 0.7)
    .sort((left, right) => (right.avgFrictionRatio ?? 0) - (left.avgFrictionRatio ?? 0))[0];
  if (frictionProject) {
    pushSuggestion(buildSuggestionItem(
      frictionProject.project.name,
      `平均摩阻损失占总扬程 ${formatPercent(frictionProject.avgFrictionRatio ?? 0)}，沿程压降偏高。`,
      '复核管道粗糙度、清管计划和当前输量设置，必要时拆分峰值工况。',
      '有助于回收部分扬程裕度并降低沿程损失。',
      (frictionProject.avgFrictionRatio ?? 0) > 0.85 ? '高' : '中',
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
        `综合效率低于共享泵站均值 ${formatPercent(deviation)}。`,
        '检查泵频率与扬程匹配情况，复核泵组切换与负荷分配策略。',
        '有助于减少无效扬程和单位电耗。',
        deviation > 0.1 ? '高' : '中',
      ));
    }
  }

  if (!suggestions.length) {
    pushSuggestion(buildSuggestionItem(
      selectedProjects[0]?.name || DEFAULT_ANALYSIS_TARGET,
      historyCount > 0
        ? `当前分析范围共有 ${historyCount} 条历史记录，数据完整率 ${dataCompletenessRate}%。`
        : '当前分析范围缺少可复用的历史分析样本。',
      historyCount > 0 ? '补齐关键参数口径并继续积累历史样本，再做深度优化分析。' : '先补齐项目、管道和历史分析数据，再执行深入诊断。',
      '提升后续建议的量化程度和可执行性。',
      historyCount > 0 ? '中' : '高',
    ));
  }

  return suggestions.slice(0, 4);
}

function buildHistorySuggestions(history: CalculationHistory, outputSource: JsonRecord) {
  const calcType = history.calcType?.toUpperCase();
  const projectName = history.projectName || DEFAULT_ANALYSIS_TARGET;
  const suggestions: SuggestionItem[] = [];

  if (calcType === 'HYDRAULIC') {
    if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) {
      suggestions.push(buildSuggestionItem(
        projectName,
        '末站进站压头小于等于 0，当前输送工况存在不可行风险。',
        '优先复核首站进站压头、泵扬程和沿程摩阻参数。',
        '恢复末站正压后可重新校核工况可行性。',
        '高',
      ));
    } else {
      suggestions.push(buildSuggestionItem(
        projectName,
        '当前水力分析已形成有效结果，仍需持续跟踪末站压力与摩阻损失。',
        '结合末站进站压头和摩阻损失持续复核当前输送工况。',
        '有助于提前发现压降抬升趋势。',
        '中',
      ));
    }
  } else if (calcType === 'OPTIMIZATION') {
    if (outputSource.isFeasible === false) {
      suggestions.push(buildSuggestionItem(
        projectName,
        '当前泵机组合未满足末站压力约束，优化结果不可行。',
        '调整泵机组合或运行流量后重新执行优化计算。',
        '优先筛出可行方案，减少无效调度试算。',
        '高',
      ));
    } else {
      suggestions.push(buildSuggestionItem(
        projectName,
        '当前优化记录已给出可行泵机组合，具备继续压缩电耗的基础。',
        '优先落地当前可行泵机组合，并结合电价继续校核总成本。',
        '在满足末站压力前提下降低综合运行成本。',
        '中',
      ));
    }
  } else if (calcType === 'SENSITIVITY') {
    suggestions.push(buildSuggestionItem(
      projectName,
      '敏感性分析已识别关键变量，后续优化应优先围绕高敏感参数展开。',
      '优先关注敏感度排名靠前的变量，并复核其现场测量值。',
      '可提升参数校核效率并减少重复试算。',
      '中',
    ));
  } else {
    suggestions.push(buildSuggestionItem(
      projectName,
      '该历史记录缺少可直接执行的专项优化动作，需要先回放关键入参与结果。',
      '结合原始入参与输出结果复核该历史记录，并按需重新计算。',
      '为后续形成专项整改建议提供依据。',
      '中',
    ));
  }

  if (history.remark?.trim()) {
    suggestions.push(buildSuggestionItem(
      projectName,
      '该记录附带人工备注，需要纳入后续跟踪。',
      `跟踪备注事项：${history.remark.trim()}`,
      '补齐现场反馈后可形成闭环处置记录。',
      '中',
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
    const key = history.projectName?.trim() || '未命名项目';
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  [...failedByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .forEach(([projectName, count]) => {
      pushRisk(buildRiskItem(
        projectName,
        '计算失败',
        '高',
        `当前分析范围内共有 ${count} 条历史记录执行失败，说明参数或服务状态存在不稳定因素。`,
        '优先复核输入参数、计算服务状态和相关依赖。',
      ));
    });

  visibleHistories.slice(0, 20).forEach((history) => {
    const output = parseJsonRecord(history.outputResult);
    const outputSource = getHistoryOutputSource(history, output);
    const target = history.projectName?.trim() || '未命名项目';

    if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) {
      pushRisk(buildRiskItem(
        target,
        '末站压力不足',
        '高',
        `末站进站压头为 ${formatFieldValue(outputSource.endStationInPressure)}，已低于可行工况阈值。`,
        '检查首站进站压头、泵扬程和沿程摩阻参数。',
      ));
    }

    if (outputSource.isFeasible === false) {
      pushRisk(buildRiskItem(
        target,
        '方案不可行',
        '高',
        '历史优化结果显示当前泵机组合不可行，无法满足末站压力约束。',
        '调整泵机组合或重新设定运行流量后再计算。',
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
        '压降偏高',
        ratio > 0.85 ? '高' : '中',
        `摩阻损失占总扬程 ${formatPercent(ratio)}，当前扬程利用率偏低。`,
        '检查局部阻力、管道工况和当前负荷分配。',
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
          '负荷偏高',
          item.throughput > averageThroughput * 1.35 ? '高' : '中',
          `设计输量 ${formatNumber(item.throughput)} 高于当前范围均值 ${formatNumber(averageThroughput)}。`,
          '检查负荷分配与沿线压降是否匹配。',
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
          '效率下降',
          gap > averageEfficiency * 0.12 ? '高' : '中',
          `泵效率 ${formatFieldValue(item.pumpEfficiency)} 低于当前范围均值 ${formatFieldValue(averageEfficiency)}。`,
          '排查设备状态、启停策略和运行点是否偏离高效区间。',
        ));
      });
  }

  return items.slice(0, 6);
}

function buildHistoryPreview(history: CalculationHistory): PreviewRecord {
  const input = parseJsonRecord(history.inputParams);
  const output = parseJsonRecord(history.outputResult);
  const inputSource = getHistoryInputSource(history, input);
  const outputSource = getHistoryOutputSource(history, output);
  const typeLabel = getHistoryTypeLabel(history);
  const projectName = history.projectName || '未命名项目';
  const statusLabel = getHistoryStatusLabel(history.status);

  const summary = [
    `${projectName} 的${typeLabel}记录当前状态为${statusLabel}，生成时间 ${formatTime(history.createTime)}。`,
    history.calcDurationFormatted
      ? `本次计算耗时 ${history.calcDurationFormatted}。`
      : typeof history.calcDuration === 'number'
        ? `本次计算耗时 ${history.calcDuration} ms。`
        : '本次记录未返回计算耗时。',
    ...buildMetricLines(inputSource, 2).map((item) => `关键入参：${item}`),
    ...buildMetricLines(outputSource, 2).map((item) => `关键结果：${item}`),
  ].slice(0, 4);

  const risks: RiskItem[] = [];
  if (history.status === 2) {
    risks.push(buildRiskItem(
      projectName,
      '计算失败',
      '高',
      history.errorMessage?.trim() || '该记录执行失败，请检查计算服务状态与输入参数。',
      '检查输入参数、计算服务状态和上游依赖后重新计算。',
    ));
  }
  if (typeof outputSource.endStationInPressure === 'number' && outputSource.endStationInPressure <= 0) {
    risks.push(buildRiskItem(
      projectName,
      '末站压力不足',
      '高',
      '末站进站压头小于等于 0，当前输送工况存在不可行风险。',
      '优先复核首站进站压头、泵扬程和沿程摩阻参数。',
    ));
  }
  if (outputSource.isFeasible === false) {
    risks.push(buildRiskItem(
      projectName,
      '方案不可行',
      '高',
      '优化结果显示当前泵机组合不可行，无法满足末站压力约束。',
      '调整泵机组合或运行流量后重新执行优化计算。',
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
      '压降偏高',
      ratio > 0.85 ? '高' : '中',
      `摩阻损失占总扬程 ${formatPercent(ratio)}，当前能耗和扬程利用率需要重点复核。`,
      '检查摩阻参数、局部阻力和当前输送负荷是否匹配。',
    ));
  }

  const conclusion = history.status === 2
    ? `该${typeLabel}记录执行失败，建议修正参数或恢复服务后重新计算。`
    : history.remark?.trim() || `该${typeLabel}记录已完成，可直接预览结果或导出归档。`;

  const rawSections = [
    history.remark?.trim() ? `备注\n${history.remark.trim()}` : '',
    Object.keys(input).length ? `输入参数\n${JSON.stringify(input, null, 2)}` : '',
    Object.keys(output).length ? `输出结果\n${JSON.stringify(output, null, 2)}` : '',
  ].filter(Boolean);

  return {
    id: `history-preview-${history.id}`,
    title: `${projectName} ${typeLabel}`,
    typeLabel,
    createdAt: history.createTime || new Date().toISOString(),
    rangeLabel: '单次计算记录',
    intelligenceLabel: '历史回放',
    projectNames: [projectName],
    outputFormat: 'markdown',
    sourceLabel: '服务端历史记录',
    result: {
      source: 'history',
      highlights: summary.slice(0, 3),
      summary,
      risks: risks.slice(0, 6),
      suggestions: buildHistorySuggestions(history, outputSource),
      conclusion,
      rawText: rawSections.join('\n\n'),
    },
  };
}

function parseAiResult(rawText: string, fallback: ReportResult): ReportResult {
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as Record<string, unknown>;
    const highlights = toLines(parsed.highlights ?? parsed.keyFindings ?? parsed.findings);
    const summary = toLines(parsed.summary);
    const risks = normalizeRiskList(parsed.risks ?? parsed.riskList ?? parsed.risk_list);
    const suggestions = normalizeSuggestionList(
      parsed.suggestions ?? parsed.suggestionList ?? parsed.suggestion_list ?? parsed.recommendations ?? parsed.recommendation_list,
    );
    const hasSpecificSuggestionTarget = suggestions.some((item) => item.target !== DEFAULT_ANALYSIS_TARGET);
    return {
      source: 'ai',
      highlights: highlights.length ? highlights.slice(0, 6) : fallback.highlights,
      summary: summary.length ? summary.slice(0, 4) : fallback.summary,
      risks: risks.length ? risks : fallback.risks,
      suggestions: suggestions.length && hasSpecificSuggestionTarget ? suggestions : fallback.suggestions,
      conclusion: typeof parsed.conclusion === 'string' && parsed.conclusion.trim() ? parsed.conclusion.trim() : fallback.conclusion,
      rawText,
    };
  } catch {
    return { ...fallback, source: 'fallback', rawText };
  }
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

function downloadMarkdown(preview: PreviewRecord) {
  const content = [
    `# ${preview.title}`,
    '',
    `- 生成时间：${formatTime(preview.createdAt)}`,
    `- 分析范围：${preview.rangeLabel}`,
    `- 智能等级：${preview.intelligenceLabel}`,
    `- 覆盖项目：${preview.projectNames.join('、') || '未选择项目'}`,
    `- 输出格式：${preview.outputFormat}`,
    `- 来源：${preview.sourceLabel}`,
    '',
    '## 智能摘要',
    ...(preview.result.summary.length ? preview.result.summary.map((item) => `- ${item}`) : ['- 暂无']),
    '',
    '## 风险列表',
    ...(preview.result.risks.length
      ? [
          '| 风险对象 | 风险类型 | 等级 | 原因 | 建议 |',
          '| --- | --- | --- | --- | --- |',
          ...preview.result.risks.map((item) => `| ${escapeMarkdownTableCell(item.target)} | ${escapeMarkdownTableCell(item.riskType)} | ${item.level} | ${escapeMarkdownTableCell(item.reason)} | ${escapeMarkdownTableCell(item.suggestion)} |`),
        ]
      : ['- 暂无']),
    '',
    '## 优化建议',
    ...(preview.result.suggestions.length
      ? preview.result.suggestions.flatMap((item, index) => ([
          `### 优先建议 ${index + 1}`,
          `对象：${item.target}`,
          `原因：${item.reason}`,
          `措施：${item.action}`,
          `预期：${item.expected}`,
          `优先级：${item.priority}`,
          '',
        ]))
      : ['- 暂无']),
    '',
    '## 报告结论',
    preview.result.conclusion || '暂无',
    ...(preview.result.rawText
      ? [
          '',
          '## 原始计算数据',
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

function getBusinessRangeWindow(preset: BusinessTimePreset, customRange: DateRangeValue) {
  if (preset === 'custom') {
    return { start: customRange?.[0]?.startOf('day') ?? null, end: customRange?.[1]?.endOf('day') ?? null };
  }
  if (preset === 'today') {
    return { start: dayjs().startOf('day'), end: dayjs().endOf('day') };
  }
  const days = preset === '7d' ? 7 : 30;
  return { start: dayjs().subtract(days - 1, 'day').startOf('day'), end: dayjs().endOf('day') };
}

function getBusinessRangeLabel(preset: BusinessTimePreset, customRange: DateRangeValue) {
  if (preset === 'custom' && customRange) {
    return `${customRange[0].format('YYYY-MM-DD')} 至 ${customRange[1].format('YYYY-MM-DD')}`;
  }
  if (preset === 'today') return '今日';
  if (preset === '7d') return '近7天';
  return '近30天';
}

function pickRecordNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const directValue = toFiniteNumber(record[key]);
    if (directValue !== null) return directValue;
    const nestedValue = record[key];
    if (isRecord(nestedValue)) {
      const nestedCandidates = Object.values(nestedValue)
        .map((item) => toFiniteNumber(item))
        .filter((item): item is number => item !== null);
      if (nestedCandidates.length) return nestedCandidates[0];
    }
  }
  return null;
}

function formatBusinessMetric(value: number | null, unit: string, digits = 1) {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(digits)} ${unit}`.trim();
}

function getBarWidthPercent(value: number, maxValue: number) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) return '8%';
  return `${Math.max(8, Math.min(100, Math.round((value / maxValue) * 100)))}%`;
}

function getBusinessRiskColor(level: BusinessRiskLevel) {
  if (level === '高风险') return 'red';
  if (level === '中风险') return 'gold';
  return 'blue';
}

function getBusinessRiskBadgeClass(level: BusinessRiskLevel) {
  if (level === '高风险') return 'border-red-400/25 bg-red-500/10 text-red-200';
  if (level === '中风险') return 'border-amber-400/25 bg-amber-500/10 text-amber-200';
  return 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200';
}

function renderStatus(status: HistoryItem['status']) {
  if (status === 'completed') return <Tag color="green">已完成</Tag>;
  if (status === 'running') return <Tag color="blue">生成中</Tag>;
  return <Tag color="red">失败</Tag>;
}

export default function ReportPreview() {  const savedTemplate = useMemo(() => readStorage<Record<string, unknown> | null>(TEMPLATE_KEY, null), []);
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
  const [oilProperties, setOilProperties] = useState<OilProperty[]>([]);
  const [histories, setHistories] = useState<CalculationHistory[]>([]);
  const [localReports, setLocalReports] = useState<LocalReportRecord[]>(() => normalizeLocalReportRecords(readStorage(HISTORY_KEY, [] as LocalReportRecord[])));
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
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [clearingCurrentList, setClearingCurrentList] = useState(false);
  const [activePreview, setActivePreview] = useState<PreviewRecord | LocalReportRecord | null>(null);
  const [previewModalRecord, setPreviewModalRecord] = useState<PreviewRecord | LocalReportRecord | null>(null);
  const [businessProjectId, setBusinessProjectId] = useState<number>();
  const [businessAnalysisObject, setBusinessAnalysisObject] = useState<BusinessAnalysisObject>('project');
  const [businessPipelineId, setBusinessPipelineId] = useState<number>();
  const [businessPumpScope, setBusinessPumpScope] = useState<'all' | 'custom'>('all');
  const [businessPumpStationIds, setBusinessPumpStationIds] = useState<number[]>([]);
  const [businessOilId, setBusinessOilId] = useState<number>();
  const [businessTimePreset, setBusinessTimePreset] = useState<BusinessTimePreset>('30d');
  const [businessCustomRange, setBusinessCustomRange] = useState<DateRangeValue>(null);
  const [businessReportType, setBusinessReportType] = useState<BusinessReportKind>('energy');
  const [businessFocuses, setBusinessFocuses] = useState<string[]>(['能耗水平', '优化建议']);
  const [businessOutputStyle, setBusinessOutputStyle] = useState<BusinessOutputStyle>('professional');
  const [businessTargetThroughput, setBusinessTargetThroughput] = useState('');
  const [businessMinPressure, setBusinessMinPressure] = useState('');
  const [businessOptimizationGoal, setBusinessOptimizationGoal] = useState<BusinessOptimizationGoal>('balanced');
  const [businessAllowPumpAdjust, setBusinessAllowPumpAdjust] = useState(true);
  const [businessRemark, setBusinessRemark] = useState('');
  const [businessPrompt, setBusinessPrompt] = useState('例如：分析 A 项目近30天管道运行情况，重点关注能耗偏高原因，并给出泵站优化建议。');
  const [businessReport, setBusinessReport] = useState<BusinessReportModel | null>(null);
  const [businessGenerating, setBusinessGenerating] = useState(false);

  const loadData = useCallback(async (mode: 'initial' | 'refresh') => {
    mode === 'initial' ? setLoading(true) : setRefreshing(true);
    try {
      const [projectResult, historyResult, pumpResult, oilResult] = await Promise.allSettled([
        projectApi.list(),
        fetchAllPagedList<CalculationHistory>((pageNum, pageSize) => calculationHistoryApi.page({ pageNum, pageSize })),
        pumpStationApi.list(),
        oilPropertyApi.list(),
      ]);
      const nextProjects = projectResult.status === 'fulfilled' ? (projectResult.value.data ?? []) : [];
      const nextHistories = historyResult.status === 'fulfilled' ? historyResult.value : [];
      const nextPumpStations = pumpResult.status === 'fulfilled' ? (pumpResult.value.data ?? []) : [];
      const nextOilProperties = oilResult.status === 'fulfilled' ? (oilResult.value.data ?? []) : [];
      setProjects([...nextProjects].sort((a, b) => a.proId - b.proId));
      setHistories([...nextHistories].sort((a, b) => dayjs(b.createTime).valueOf() - dayjs(a.createTime).valueOf()));
      setPumpStations(nextPumpStations);
      setOilProperties(nextOilProperties);
      const pipelineResults = await Promise.allSettled(nextProjects.map((item) => pipelineApi.listByProject(item.proId)));
      setPipelines(pipelineResults.flatMap((item) => (item.status === 'fulfilled' ? item.value.data ?? [] : [])));
      setSelectedProjectIds((current) => {
        const available = new Set(nextProjects.map((item) => item.proId));
        const filtered = current.filter((id) => available.has(id));
        return filtered.length ? filtered : nextProjects.map((item) => item.proId);
      });
    } catch {
      message.error('智能报告中心数据加载失败');
    } finally {
      mode === 'initial' ? setLoading(false) : setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  useEffect(() => {
    writeStorage(HISTORY_KEY, localReports);
  }, [localReports]);

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
  const projectInsights = useMemo(() => buildProjectInsights(selectedProjects, visiblePipelines, visibleHistories), [selectedProjects, visiblePipelines, visibleHistories]);
  const projectContextLines = useMemo(() => buildProjectContextLines(projectInsights), [projectInsights]);
  const pumpStationContextLines = useMemo(() => buildPumpStationContextLines(pumpStations), [pumpStations]);

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

  const businessProjectOptions = useMemo(() => (selectedProjects.length ? selectedProjects : projects), [projects, selectedProjects]);
  const businessRangeWindow = useMemo(() => getBusinessRangeWindow(businessTimePreset, businessCustomRange), [businessCustomRange, businessTimePreset]);
  const businessRangeLabel = useMemo(() => getBusinessRangeLabel(businessTimePreset, businessCustomRange), [businessCustomRange, businessTimePreset]);
  const businessSelectedProject = useMemo(() => businessProjectOptions.find((item) => item.proId === businessProjectId) ?? null, [businessProjectId, businessProjectOptions]);
  const businessPipelines = useMemo(
    () => pipelines.filter((item) => (businessProjectId ? item.proId === businessProjectId : true)),
    [businessProjectId, pipelines],
  );
  const businessSelectedPipeline = useMemo(() => businessPipelines.find((item) => item.id === businessPipelineId) ?? null, [businessPipelineId, businessPipelines]);
  const businessSelectedOil = useMemo(() => oilProperties.find((item) => item.id === businessOilId) ?? null, [businessOilId, oilProperties]);
  const businessVisiblePumpStations = useMemo(() => {
    if (businessPumpScope === 'all') return pumpStations;
    const selectedIdSet = new Set(businessPumpStationIds);
    return pumpStations.filter((item) => selectedIdSet.has(item.id));
  }, [businessPumpScope, businessPumpStationIds, pumpStations]);
  const businessHistories = useMemo(
    () => histories.filter((item) => (!businessProjectId || item.projectId === businessProjectId) && inWindow(item.createTime, businessRangeWindow.start, businessRangeWindow.end)),
    [businessProjectId, businessRangeWindow.end, businessRangeWindow.start, histories],
  );

  useEffect(() => {
    if (!businessProjectOptions.length) {
      setBusinessProjectId(undefined);
      return;
    }
    if (!businessProjectId || !businessProjectOptions.some((item) => item.proId === businessProjectId)) {
      setBusinessProjectId(businessProjectOptions[0].proId);
    }
  }, [businessProjectId, businessProjectOptions]);

  useEffect(() => {
    if (!businessPipelines.length) {
      setBusinessPipelineId(undefined);
      return;
    }
    if (!businessPipelineId || !businessPipelines.some((item) => item.id === businessPipelineId)) {
      setBusinessPipelineId(businessPipelines[0].id);
    }
  }, [businessPipelineId, businessPipelines]);

  useEffect(() => {
    if (!oilProperties.length) {
      setBusinessOilId(undefined);
      return;
    }
    if (!businessOilId || !oilProperties.some((item) => item.id === businessOilId)) {
      setBusinessOilId(oilProperties[0].id);
    }
  }, [businessOilId, oilProperties]);

  useEffect(() => {
    if (businessPumpScope === 'all') return;
    const availableIdSet = new Set(pumpStations.map((item) => item.id));
    const nextIds = businessPumpStationIds.filter((id) => availableIdSet.has(id));
    if (nextIds.length !== businessPumpStationIds.length) {
      setBusinessPumpStationIds(nextIds);
      return;
    }
    if (!nextIds.length && pumpStations.length) {
      setBusinessPumpStationIds(pumpStations.slice(0, Math.min(2, pumpStations.length)).map((item) => item.id));
    }
  }, [businessPumpScope, businessPumpStationIds, pumpStations]);

  useEffect(() => {
    if (!businessSelectedPipeline || businessTargetThroughput.trim()) return;
    setBusinessTargetThroughput(String(businessSelectedPipeline.throughput ?? ''));
  }, [businessSelectedPipeline, businessTargetThroughput]);

  const resetBusinessReportBuilder = useCallback(() => {
    setBusinessAnalysisObject('project');
    setBusinessProjectId(businessProjectOptions[0]?.proId);
    setBusinessPipelineId(undefined);
    setBusinessPumpScope('all');
    setBusinessPumpStationIds([]);
    setBusinessOilId(oilProperties[0]?.id);
    setBusinessTimePreset('30d');
    setBusinessCustomRange(null);
    setBusinessReportType('energy');
    setBusinessFocuses(['能耗水平', '优化建议']);
    setBusinessOutputStyle('professional');
    setBusinessTargetThroughput('');
    setBusinessMinPressure('');
    setBusinessOptimizationGoal('balanced');
    setBusinessAllowPumpAdjust(true);
    setBusinessRemark('');
    setBusinessPrompt('例如：分析 A 项目近30天管道运行情况，重点关注能耗偏高原因，并给出泵站优化建议。');
    setBusinessReport(null);
  }, [businessProjectOptions, oilProperties]);

  const handleGenerateBusinessReport = useCallback(() => {
    if (!businessSelectedProject) {
      message.warning('请先选择所属项目');
      return;
    }

    setBusinessGenerating(true);
    try {
      const targetThroughput = toFiniteNumber(businessTargetThroughput);
      const minPressure = toFiniteNumber(businessMinPressure);
      const flowValues = businessHistories
        .map((history) => {
          const inputSource = getHistoryInputSource(history, parseJsonRecord(history.inputParams));
          return pickRecordNumber(inputSource, ['flowRate', 'throughput', 'flow']);
        })
        .filter((item): item is number => item !== null);
      const avgFlow = targetThroughput ?? averageMetric(flowValues, (item) => item) ?? businessSelectedPipeline?.throughput ?? null;
      const avgPressure = averageMetric(businessHistories, (history) => {
        const outputSource = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
        return pickRecordNumber(outputSource, ['endStationInPressure', 'firstStationOutPressure', 'outletPressure', 'pressure']);
      }) ?? minPressure ?? null;
      const avgHead = averageMetric(businessHistories, (history) => {
        const outputSource = getHistoryOutputSource(history, parseJsonRecord(history.outputResult));
        return pickRecordNumber(outputSource, ['totalHead', 'totalPressureDrop', 'frictionHeadLoss']);
      }) ?? (businessSelectedPipeline ? Math.abs((businessSelectedPipeline.startAltitude ?? 0) - (businessSelectedPipeline.endAltitude ?? 0)) + 180 : null);
      const avgEnergy = averageMetric(businessHistories, (history) => getHistoryEnergyMetric(history))
        ?? (avgFlow !== null ? Number((avgFlow * 0.18).toFixed(2)) : null);
      const avgEfficiency = averageMetric(businessHistories, (history) => getHistoryEfficiencyMetric(history))
        ?? (businessVisiblePumpStations.length
          ? businessVisiblePumpStations.reduce((sum, item) => sum + item.pumpEfficiency, 0) / businessVisiblePumpStations.length
          : null);
      const avgCost = avgEnergy !== null ? Number((avgEnergy * 0.76).toFixed(2)) : null;
      const abnormalCount = businessHistories.filter((item) => isHistoryAbnormal(item)).length;
      const highRiskCount = businessHistories.filter((item) => getHistoryRiskLevel(item) === 'high').length;
      const abnormalRate = businessHistories.length ? abnormalCount / businessHistories.length : 0;
      const viscosity = businessSelectedOil?.viscosity ?? null;
      const density = businessSelectedOil?.density ?? null;
      const flowVolatility = flowValues.length > 1 && avgFlow
        ? (Math.max(...flowValues) - Math.min(...flowValues)) / Math.max(avgFlow, 1)
        : 0.06;
      const pumpEfficiencyAverage = businessVisiblePumpStations.length
        ? businessVisiblePumpStations.reduce((sum, item) => sum + item.pumpEfficiency, 0) / businessVisiblePumpStations.length
        : avgEfficiency;
      const roughnessAverage = businessPipelines.length
        ? averageMetric(businessPipelines, (item) => toFiniteNumber(item.roughness ?? null))
        : null;
      const objectLabel = businessAnalysisObject === 'project'
        ? `${businessSelectedProject.name} / 全部对象`
        : businessAnalysisObject === 'pipeline'
          ? `${businessSelectedPipeline?.name ?? '未指定管道'} / ${businessPumpScope === 'all' ? '全部泵站' : '指定泵站'}`
          : `${businessPumpScope === 'all' ? '全部泵站' : businessVisiblePumpStations.map((item) => item.name).join('、') || '指定泵站'}`;
      const reportTypeLabel = BUSINESS_REPORT_TYPE_OPTIONS.find((item) => item.value === businessReportType)?.label ?? '智能报告';
      const outputStyleLabel = BUSINESS_OUTPUT_STYLE_OPTIONS.find((item) => item.value === businessOutputStyle)?.label ?? '专业版';
      const highlightItems = [
        abnormalRate > 0.18 ? '本周期存在较明显异常波动，建议优先核查异常样本。' : '本周期整体运行基本稳定，核心指标未出现明显失稳。',
        avgEnergy !== null ? `单位能耗指标约 ${avgEnergy.toFixed(1)}，${avgEnergy > 220 ? '处于偏高区间。' : '处于可控区间。'}` : '当前缺少足够能耗样本，建议补齐历史记录。',
        viscosity !== null ? `油品粘度约 ${viscosity.toFixed(1)} cP，对沿程压损${viscosity > 18 ? '影响较大。' : '影响可控。'}` : '当前未关联油品参数，建议补充油品属性。',
        businessAllowPumpAdjust ? '建议优先从泵站启停组合和负荷分配入手做优化。' : '当前不允许调整泵站组合，优化空间主要来自运行参数校核。',
      ].slice(0, 4);
      const diagnosisFactors = [
        {
          name: '油品粘度',
          score: clampScore(Math.min(100, ((viscosity ?? 10) / 24) * 100)),
          description: viscosity !== null ? `当前粘度 ${viscosity.toFixed(1)} cP，粘度越高越容易抬升摩阻损失。`
            : '当前未配置油品粘度，建议补充介质参数。',
        },
        {
          name: '泵站组合',
          score: clampScore(Math.min(100, ((100 - (pumpEfficiencyAverage ?? 75)) / 35) * 100)),
          description: pumpEfficiencyAverage !== null ? `泵站平均泵效约 ${(pumpEfficiencyAverage).toFixed(1)}%，存在继续优化配置空间。`
            : '当前缺少泵效数据，建议补录泵站效率。',
        },
        {
          name: '流量波动',
          score: clampScore(flowVolatility * 100),
          description: `流量波动幅度约 ${(flowVolatility * 100).toFixed(1)}%，波动越大越容易放大运行偏差。`,
        },
        {
          name: '管道粗糙度',
          score: clampScore(Math.min(100, ((roughnessAverage ?? 0.03) / 0.08) * 100)),
          description: roughnessAverage !== null ? `当前平均粗糙度约 ${roughnessAverage.toFixed(4)}，建议与设计值复核。`
            : '当前未加载粗糙度参数，建议补充管段数据。',
        },
      ].sort((left, right) => right.score - left.score);
      const schemes: BusinessComparisonScheme[] = [
        {
          name: '当前方案',
          tag: '基线',
          head: formatBusinessMetric(avgHead, 'm'),
          pressure: formatBusinessMetric(avgPressure, 'MPa', 2),
          power: formatBusinessMetric(avgEnergy, 'kWh'),
          cost: formatBusinessMetric(avgCost, '元'),
          risk: highRiskCount > 0 ? '高风险' : abnormalCount > 0 ? '中风险' : '低风险',
        },
        {
          name: '推荐方案',
          tag: '推荐',
          head: formatBusinessMetric(avgHead !== null ? avgHead * 0.96 : null, 'm'),
          pressure: formatBusinessMetric(avgPressure !== null ? Math.max(avgPressure * 1.02, minPressure ?? avgPressure) : null, 'MPa', 2),
          power: formatBusinessMetric(avgEnergy !== null ? avgEnergy * 0.92 : null, 'kWh'),
          cost: formatBusinessMetric(avgCost !== null ? avgCost * 0.91 : null, '元'),
          risk: '中风险',
          highlighted: true,
        },
        {
          name: '节能优先方案',
          tag: '节能',
          head: formatBusinessMetric(avgHead !== null ? avgHead * 0.93 : null, 'm'),
          pressure: formatBusinessMetric(avgPressure !== null ? avgPressure * 0.97 : null, 'MPa', 2),
          power: formatBusinessMetric(avgEnergy !== null ? avgEnergy * 0.87 : null, 'kWh'),
          cost: formatBusinessMetric(avgCost !== null ? avgCost * 0.85 : null, '元'),
          risk: '中风险',
        },
        {
          name: '安全优先方案',
          tag: '安全',
          head: formatBusinessMetric(avgHead !== null ? avgHead * 1.08 : null, 'm'),
          pressure: formatBusinessMetric(avgPressure !== null ? Math.max(avgPressure * 1.08, (minPressure ?? avgPressure) + 0.1) : null, 'MPa', 2),
          power: formatBusinessMetric(avgEnergy !== null ? avgEnergy * 1.05 : null, 'kWh'),
          cost: formatBusinessMetric(avgCost !== null ? avgCost * 1.07 : null, '元'),
          risk: '低风险',
        },
      ];
      const sensitivityItems: BusinessSensitivityItem[] = [
        {
          name: '油品粘度',
          impact: clampScore(Math.min(100, ((viscosity ?? 10) / 22) * 100)),
          description: '直接影响沿程摩阻与泵站负荷，是当前最关键的敏感变量之一。',
        },
        {
          name: '输量设定',
          impact: clampScore(Math.min(100, Math.max(35, flowVolatility * 180))),
          description: '输量变化会同步改变压损和单位能耗，需要重点关注峰谷切换工况。',
        },
        {
          name: '泵站效率',
          impact: clampScore(Math.min(100, ((100 - (pumpEfficiencyAverage ?? 75)) / 28) * 100)),
          description: '泵效下降会快速推高电耗，建议持续跟踪高负荷泵站效率曲线。',
        },
        {
          name: '出口压力约束',
          impact: clampScore(minPressure !== null && avgPressure !== null && avgPressure > 0 ? (minPressure / avgPressure) * 100 : 48),
          description: '压力约束越紧，优化空间越小，需要在节能与安全之间平衡。',
        },
      ].sort((left, right) => right.impact - left.impact);
      const risks: BusinessRiskCard[] = [
        {
          level: minPressure !== null && avgPressure !== null && avgPressure < minPressure ? '高风险' : highRiskCount > 0 ? '高风险' : '中风险',
          title: '压力约束风险',
          description: minPressure !== null && avgPressure !== null
            ? `当前平均压力约 ${avgPressure.toFixed(2)} MPa，约束下限为 ${minPressure.toFixed(2)} MPa。`
            : '当前压力约束未明确，建议补充最低出口压力以形成可执行判断。',
          action: '优先校核目标输量、首站出站压力和泵站组合，避免末站压力不足。',
        },
        {
          level: avgEnergy !== null && avgEnergy > 220 ? '高风险' : avgEnergy !== null && avgEnergy > 160 ? '中风险' : '低风险',
          title: '高能耗风险',
          description: avgEnergy !== null ? `当前能耗指标约 ${avgEnergy.toFixed(1)}，需要结合电价和效率判断经济性。` : '当前能耗样本不足，无法形成稳定基准。',
          action: '建议按时段拆分电耗，并对高能耗时段的泵站负荷进行专项排查。',
        },
        {
          level: pumpEfficiencyAverage !== null && pumpEfficiencyAverage < 68 ? '中风险' : '低风险',
          title: '泵站低效率运行风险',
          description: pumpEfficiencyAverage !== null ? `当前泵站平均泵效约 ${pumpEfficiencyAverage.toFixed(1)}%。` : '当前缺少泵效数据，无法完成泵站效率评估。',
          action: '结合启停频次和扬程配置，筛查长期低效率运行的泵站。',
        },
      ];
      const immediateActions = [
        businessAllowPumpAdjust ? '调整泵站启停组合，优先降低高负荷泵站持续满载运行时间。' : '在现有泵站组合不变前提下，先复核目标输量与压力边界条件。',
        '优先监测油品粘度、末站压力和单位能耗三个关键指标。',
        highRiskCount > 0 ? '对高风险历史样本做逐条复盘，确认是否存在参数录入异常。' : '继续保持当前运行窗口，并建立高风险阈值预警。 ',
      ];
      const shortTermActions = [
        '对高能耗时段做专项排查，核对泵站负荷分配与电耗变化曲线。',
        '复核关键管段压力损失与粗糙度参数，校准模型输入口径。',
        businessFocuses.includes('敏感性分析结果') ? '结合敏感性结果建立重点变量监控列表。' : '将关键变量纳入日常运行报表，形成趋势跟踪。',
      ];
      const longTermActions = [
        '建立历史能耗基准模型，形成项目级运行基线和偏差识别规则。',
        '针对不同油品工况沉淀推荐策略，实现分介质的优化建议模板。',
        '打通历史计算、项目主数据和报告中心，形成闭环归档与追踪机制。',
      ];
      const chartCards: BusinessChartCard[] = [
        {
          title: '能耗趋势图',
          value: Math.max(12, avgEnergy ?? 36),
          insight: avgEnergy !== null ? `当前能耗指数 ${avgEnergy.toFixed(1)}，建议重点对比上周期变化。` : '暂无稳定能耗样本，建议补齐历史数据。',
          accentClassName: 'from-cyan-400 to-blue-500',
        },
        {
          title: '压力变化图',
          value: Math.max(12, (avgPressure ?? 1.2) * 35),
          insight: avgPressure !== null ? `平均压力约 ${avgPressure.toFixed(2)} MPa，可用于判断约束余量。` : '当前压力数据不足，建议联动水力分析结果。',
          accentClassName: 'from-emerald-400 to-teal-500',
        },
        {
          title: '方案对比图',
          value: Math.max(12, avgCost ?? 40),
          insight: '当前方案、推荐方案与安全方案可直接对比成本和风险等级。',
          accentClassName: 'from-amber-400 to-orange-500',
        },
        {
          title: '敏感性排序图',
          value: Math.max(12, sensitivityItems[0]?.impact ?? 55),
          insight: `最敏感变量为 ${sensitivityItems[0]?.name ?? '油品粘度'}。`,
          accentClassName: 'from-fuchsia-400 to-pink-500',
        },
        {
          title: '风险分布图',
          value: Math.max(12, Math.max(highRiskCount * 24, abnormalCount * 16, 20)),
          insight: `当前识别高风险 ${highRiskCount} 条，异常 ${abnormalCount} 条。`,
          accentClassName: 'from-rose-400 to-red-500',
        },
      ];

      setBusinessReport({
        title: `${businessSelectedProject.name}${businessReportType === 'energy' ? '管道能耗智能分析报告' : reportTypeLabel}`,
        totalComment: `本次分析认为：${abnormalRate > 0.18 ? '当前系统存在异常波动，' : '当前系统运行总体稳定，'}${avgEnergy !== null && avgEnergy > 180 ? '但能耗偏高，' : '能耗总体可控，'}建议优先${businessAllowPumpAdjust ? '优化泵站组合并关注油品粘度变化。' : '复核运行边界并关注关键参数波动。'}`,
        projectName: businessSelectedProject.name,
        objectLabel,
        rangeLabel: businessRangeLabel,
        generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
        reportTypeLabel,
        focusLabels: businessFocuses.length ? businessFocuses : ['能耗水平', '优化建议'],
        outputStyleLabel,
        highlightItems,
        kpis: [
          { label: '平均流量', value: formatBusinessMetric(avgFlow, 'm3/h'), note: targetThroughput !== null ? '已结合目标输量约束' : '基于历史样本估算' },
          { label: '平均压力', value: formatBusinessMetric(avgPressure, 'MPa', 2), note: minPressure !== null ? `最低出口压力约束 ${minPressure.toFixed(2)} MPa` : '建议补充压力约束' },
          { label: '总扬程', value: formatBusinessMetric(avgHead, 'm'), note: businessSelectedPipeline ? `分析对象：${businessSelectedPipeline.name}` : '按当前项目汇总' },
          { label: '单位能耗', value: formatBusinessMetric(avgEnergy, 'kWh'), note: businessOptimizationGoal === 'energy' ? '当前以节能优先为目标' : '用于方案经济性对比' },
          { label: '运行费用', value: formatBusinessMetric(avgCost, '元'), note: '按综合电耗估算' },
          { label: '油品参数', value: density !== null || viscosity !== null ? `${density?.toFixed(0) ?? '-'} kg/m3 / ${viscosity?.toFixed(1) ?? '-'} cP` : '-', note: businessSelectedOil ? businessSelectedOil.name : '未选择油品' },
        ],
        diagnosisSummary: [
          `当前分析样本 ${businessHistories.length} 条，异常 ${abnormalCount} 条，高风险 ${highRiskCount} 条。`,
          `影响能耗的主要因素排序：${diagnosisFactors.slice(0, 4).map((item) => item.name).join(' > ')}。`,
          businessRemark.trim() ? `备注限制：${businessRemark.trim()}` : '当前未填写其他限制，报告按常规运行边界生成。',
          businessPrompt.trim() ? `报告需求：${businessPrompt.trim()}` : '当前未填写额外自然语言要求。',
        ].slice(0, 4),
        diagnosisFactors,
        schemes,
        sensitivityItems,
        risks,
        immediateActions,
        shortTermActions,
        longTermActions,
        chartCards,
      });
      message.success('智能报告已生成');
    } finally {
      setBusinessGenerating(false);
    }
  }, [
    businessAllowPumpAdjust,
    businessAnalysisObject,
    businessFocuses,
    businessHistories,
    businessMinPressure,
    businessOptimizationGoal,
    businessOutputStyle,
    businessPipelines,
    businessPrompt,
    businessRangeLabel,
    businessRemark,
    businessReportType,
    businessSelectedOil,
    businessSelectedPipeline,
    businessSelectedProject,
    businessTargetThroughput,
    businessVisiblePumpStations,
  ]);

  const handleExportBusinessReport = useCallback(() => {
    if (!businessReport) {
      message.warning('请先生成智能报告');
      return;
    }

    const content = [
      `# ${businessReport.title}`,
      '',
      `- 项目名称：${businessReport.projectName}`,
      `- 分析对象：${businessReport.objectLabel}`,
      `- 时间范围：${businessReport.rangeLabel}`,
      `- 生成时间：${businessReport.generatedAt}`,
      `- 报告类型：${businessReport.reportTypeLabel}`,
      `- 输出风格：${businessReport.outputStyleLabel}`,
      `- 分析重点：${businessReport.focusLabels.join('、')}`,
      '',
      '## AI分析摘要',
      businessReport.totalComment,
      ...businessReport.highlightItems.map((item) => `- ${item}`),
      '',
      '## 运行概况',
      ...businessReport.kpis.map((item) => `- ${item.label}：${item.value}（${item.note}）`),
      '',
      '## 问题诊断',
      ...businessReport.diagnosisSummary.map((item) => `- ${item}`),
      '',
      '## 方案对比',
      '| 方案 | 标签 | 总扬程 | 压力 | 电耗 | 费用 | 风险等级 |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...businessReport.schemes.map((item) => `| ${item.name} | ${item.tag} | ${item.head} | ${item.pressure} | ${item.power} | ${item.cost} | ${item.risk} |`),
      '',
      '## 敏感性分析结果',
      ...businessReport.sensitivityItems.map((item) => `- ${item.name}：影响程度 ${item.impact}，${item.description}`),
      '',
      '## 风险预警',
      ...businessReport.risks.map((item) => `- ${item.level} / ${item.title}：${item.description} 建议：${item.action}`),
      '',
      '## 优化建议',
      '### 立即可执行',
      ...businessReport.immediateActions.map((item) => `- ${item}`),
      '',
      '### 短期建议',
      ...businessReport.shortTermActions.map((item) => `- ${item}`),
      '',
      '### 长期建议',
      ...businessReport.longTermActions.map((item) => `- ${item}`),
      '',
      '## 图表分析',
      ...businessReport.chartCards.map((item) => `- ${item.title}：${item.insight}`),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${businessReport.title.replace(/[\\/:*?"<>|]/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [businessReport]);

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
    message.success('当前配置已保存为模板');
  }, [customRange, enableConclusion, enableRisk, enableSuggestions, enableSummary, intelligenceLevel, outputFormat, rangePreset, reportType, selectedProjectIds]);

  const runAnalysis = useCallback(async () => {
    if (!selectedProjects.length) {
      message.warning('请至少选择一个项目');
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
      highlights: [],
      summary: enableSummary ? [`本次分析覆盖 ${snapshot.projectCount} 个项目、${snapshot.pipelineCount} 条管道、${snapshot.pumpStationCount} 座共享泵站。`, `已纳入 ${snapshot.historyCount} 条历史记录，其中失败记录 ${snapshot.failedHistoryCount} 条。`] : [],
      risks: fallbackRisks,
      suggestions: fallbackSuggestions,
      conclusion: enableConclusion ? '系统已经具备智能报告基础能力，但正式结论仍建议结合更多历史样本和现场工况复核。' : '',
      rawText: '',
    };

    fallback.summary = enableSummary
      ? [
          `本次分析依据覆盖 ${snapshot.projectCount} 个项目、${snapshot.pipelineCount} 条管道、${snapshot.pumpStationCount} 座泵站。`,
          `当前样本池纳入 ${snapshot.historyCount} 条记录，识别异常 ${snapshot.abnormalHistoryCount} 条，数据完整率 ${snapshot.dataCompletenessRate}%。`,
          `比对周期为 ${snapshot.comparisonLabel}，最近异常时间 ${formatTime(snapshot.latestAbnormalTime)}。`,
        ]
      : [];
    fallback.highlights = [
      `分析对象 ${snapshot.analysisObjectCount} 个`,
      `异常记录 ${snapshot.abnormalHistoryCount} 条`,
      `高风险记录 ${snapshot.highRiskCount} 条`,
    ].slice(0, 3);
    fallback.risks = fallbackRisks;
    fallback.suggestions = fallbackSuggestions;

    setAnalysing(true);
    let result = fallback;
    try {
      const prompt = [
        '你是管道能耗分析系统的报告助手。',
        '请严格输出 JSON，格式为 {"summary":["..."],"risks":[{"target":"风险对象","riskType":"风险类型","level":"高/中/低","reason":"原因","suggestion":"建议"}],"suggestions":[{"target":"对象","reason":"原因","action":"措施","expected":"预期","priority":"高/中/低"}],"conclusion":"..."}。',
        '风险提示必须写成风险列表，逐条具体到对象，不要写成段落；如果没有明确风险，risks 返回空数组。',
        '优化建议必须与具体对象绑定，不要输出泛化建议。每条 suggestions 都要明确对象、原因、措施、预期和优先级；对象可以是项目、管道、共享泵站或当前分析范围。',
        '原因只能引用当前提供的数据和对象，不要编造未提供的天数、趋势或现场事件。',
        `报告类型：${REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label ?? '智能分析报告'}`,
        `分析范围：${rangeLabel}`,
        `智能等级：${INTELLIGENCE_OPTIONS.find((item) => item.value === intelligenceLevel)?.label ?? '增强'}`,
        `项目数量：${snapshot.projectCount}，管道数量：${snapshot.pipelineCount}，共享泵站数量：${snapshot.pumpStationCount}，历史记录数量：${snapshot.historyCount}，失败历史数量：${snapshot.failedHistoryCount}`,
        `项目列表：${selectedProjects.map((item) => `${item.number || '-'} ${item.name}`).join('；')}`,
        `分析依据快照：覆盖项目 ${snapshot.projectCount}，覆盖管道 ${snapshot.pipelineCount}，覆盖泵站 ${snapshot.pumpStationCount}，记录总量 ${snapshot.historyCount}，异常记录 ${snapshot.abnormalHistoryCount}，数据完整率 ${snapshot.dataCompletenessRate}% ，最近异常时间 ${formatTime(snapshot.latestAbnormalTime)}，比对周期 ${snapshot.comparisonLabel}`,
        `项目画像：${projectContextLines.length ? projectContextLines.join('；') : '暂无项目画像'}`,
        `泵站画像：${pumpStationContextLines.length ? pumpStationContextLines.join('；') : '暂无泵站画像'}`,
        `本地对象绑定建议参考：${fallbackSuggestions.length ? fallbackSuggestions.map((item, index) => `优先建议 ${index + 1}：对象=${item.target}；原因=${item.reason}；措施=${item.action}；预期=${item.expected}；优先级=${item.priority}`).join('；') : '暂无'}`,
        `候选风险对象：${[
          ...selectedProjects.map((item) => item.name),
          ...visiblePipelines.slice(0, 6).map((item) => item.name),
          ...pumpStations.slice(0, 6).map((item) => item.name),
        ].join('；')}`,
      ].join('\n');
      const response = await agentApi.chat(prompt, `report-workbench-${Date.now()}`);
      const rawText = extractText(response);
      result = rawText ? parseAiResult(rawText, fallback) : fallback;
      if (!rawText) message.warning('AI 未返回可解析内容，已回退到本地分析');
    } catch {
      message.warning('AI 服务暂不可用，已回退到本地分析');
    } finally {
      setAnalysing(false);
    }

    const preview: PreviewRecord = {
      id: `preview-${Date.now()}`,
      title: `${selectedProjects.map((item) => item.name).join('、')} ${REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label ?? '智能分析报告'}`,
      typeLabel: REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label ?? '智能分析报告',
      createdAt: new Date().toISOString(),
      rangeLabel,
      intelligenceLabel: INTELLIGENCE_OPTIONS.find((item) => item.value === intelligenceLevel)?.label ?? '增强',
      projectNames: selectedProjects.map((item) => item.name),
      outputFormat,
      sourceLabel: result.source === 'ai' ? 'AI 结构化输出' : '规则回退分析',
      result,
    };
    setActivePreview(preview);
    setAnalysisCount((current) => current + 1);
    return preview;
  }, [enableConclusion, enableRisk, enableSuggestions, enableSummary, intelligenceLevel, outputFormat, projectContextLines, projectInsights, pumpStationContextLines, pumpStations, rangeLabel, reportType, selectedProjects, snapshot.abnormalHistoryCount, snapshot.comparisonLabel, snapshot.dataCompletenessRate, snapshot.failedHistoryCount, snapshot.historyCount, snapshot.latestAbnormalTime, snapshot.pipelineCount, snapshot.projectCount, snapshot.pumpStationCount, visibleHistories, visiblePipelines]);

  const generateReport = useCallback(async () => {
    const preview = activePreview ?? (await runAnalysis());
    if (!preview) return;
    const record: LocalReportRecord = { ...preview, id: `local-${Date.now()}`, selectedProjectIds: [...selectedProjectIds] };
    setLocalReports((current) => [record, ...current].slice(0, 30));
    setActivePreview(record);
    message.success('已加入历史报告区');
  }, [activePreview, runAnalysis, selectedProjectIds]);

  const openPreview = useCallback((preview: PreviewRecord | LocalReportRecord) => {
    setActivePreview(preview);
    setPreviewModalRecord(preview);
  }, []);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const localItems = localReports
      .filter((item) => item.selectedProjectIds.some((id) => selectedSet.has(id)))
      .map((item) => ({
        id: item.id,
        source: 'local' as const,
        kind: 'ai' as const,
        status: 'completed' as const,
        title: item.title,
        time: item.createdAt,
        summary: item.result.conclusion || item.result.summary[0] || '已生成智能报告。',
        preview: item,
      }));
    const serverItems = visibleHistories.map((item) => ({
      id: `history-${item.id}`,
      source: 'server' as const,
      historyId: item.id,
      kind: `${item.calcTypeName ?? ''} ${item.calcType ?? ''}`.toUpperCase().includes('AI') ? 'ai' as const : 'normal' as const,
      status: item.status === 0 ? 'running' as const : item.status === 2 ? 'failed' as const : 'completed' as const,
      title: `${item.projectName || '未命名项目'} ${item.calcTypeName || item.calcType || '历史分析'}`,
      time: item.createTime || new Date().toISOString(),
      summary: item.errorMessage || item.remark || '来自服务端历史记录。',
      preview: buildHistoryPreview(item),
    }));
    return [...localItems, ...serverItems].sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf()).filter((item) => {
      if (historyFilter === 'all') return true;
      if (historyFilter === 'ai') return item.kind === 'ai';
      if (historyFilter === 'normal') return item.kind === 'normal';
      return item.status === historyFilter;
    });
  }, [historyFilter, localReports, selectedSet, visibleHistories]);

  const currentHistoryStats = useMemo(() => ({
    localIds: historyItems.filter((item) => item.id.startsWith('local-')).map((item) => item.id),
    serverIds: historyItems
      .map((item) => (item.id.startsWith('history-') ? Number(item.id.replace(/^history-/, '')) : Number.NaN))
      .filter((item) => Number.isFinite(item)),
  }), [historyItems]);

  const deletingIdSet = useMemo(() => new Set(deletingIds), [deletingIds]);

  const removeDeletedPreviewRecords = useCallback((deletedPreviewIds: string[]) => {
    if (!deletedPreviewIds.length) return;
    setActivePreview((current) => (current && deletedPreviewIds.includes(current.id) ? null : current));
    setPreviewModalRecord((current) => (current && deletedPreviewIds.includes(current.id) ? null : current));
  }, []);

  const handleDeleteHistoryItem = useCallback(async (item: HistoryItem) => {
    setDeletingIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
    try {
      if (item.id.startsWith('local-')) {
        setLocalReports((current) => current.filter((report) => report.id !== item.id));
        removeDeletedPreviewRecords([item.id]);
        message.success('已删除本地 AI 报告');
        return;
      }

      const historyId = Number(item.id.replace(/^history-/, ''));
      if (!Number.isFinite(historyId)) {
        throw new Error('历史记录 ID 无效');
      }

      await calculationHistoryApi.delete(historyId);
      setHistories((current) => current.filter((history) => history.id !== historyId));
      removeDeletedPreviewRecords([`history-preview-${historyId}`]);
      message.success('已删除服务端历史记录');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== item.id));
    }
  }, [removeDeletedPreviewRecords]);

  const handleClearCurrentHistory = useCallback(async () => {
    if (!currentHistoryStats.localIds.length && !currentHistoryStats.serverIds.length) {
      return;
    }

    setClearingCurrentList(true);
    try {
      const deletedPreviewIds = [
        ...currentHistoryStats.localIds,
        ...currentHistoryStats.serverIds.map((id) => `history-preview-${id}`),
      ];
      if (currentHistoryStats.serverIds.length) {
        await calculationHistoryApi.batchDelete(currentHistoryStats.serverIds);
      }
      if (currentHistoryStats.localIds.length) {
        setLocalReports((current) => current.filter((report) => !currentHistoryStats.localIds.includes(report.id)));
      }
      if (currentHistoryStats.serverIds.length) {
        setHistories((current) => current.filter((history) => !currentHistoryStats.serverIds.includes(history.id)));
      }
      removeDeletedPreviewRecords(deletedPreviewIds);

      const deletedParts: string[] = [];
      if (currentHistoryStats.localIds.length) deletedParts.push(`${currentHistoryStats.localIds.length} 条本地 AI 报告`);
      if (currentHistoryStats.serverIds.length) deletedParts.push(`${currentHistoryStats.serverIds.length} 条服务端记录`);
      message.success(`已清空${deletedParts.join('、')}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批量删除失败');
    } finally {
      setClearingCurrentList(false);
    }
  }, [currentHistoryStats.localIds, currentHistoryStats.serverIds, removeDeletedPreviewRecords]);

  if (loading) {
    return <AnimatedPage className="flex min-h-[520px] items-center justify-center"><Spin size="large" /></AnimatedPage>;
  }
  return (
    <AnimatedPage className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-6 text-slate-100 md:px-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),linear-gradient(145deg,#0f172a_0%,#111827_50%,#020617_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.4)] md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100"><RobotOutlined />智能报告中心</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">AI 报告工作台</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">基于项目、管道、共享泵站和历史分析记录，自动生成摘要、风险、建议和报告结论。</p>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void loadData('refresh')}>刷新数据</Button>
            <Button icon={<SaveOutlined />} onClick={saveTemplate}>保存模板</Button>
            <Button type="primary" icon={<RobotOutlined />} loading={analysing} onClick={() => void runAnalysis()}>开始 AI 分析</Button>
            <Button type="primary" ghost icon={<FileTextOutlined />} onClick={() => void generateReport()}>生成智能报告</Button>
          </Space>
        </div>
        <div className="mt-6">
          <Alert type="info" showIcon message="安全说明" description="前端不会存储 API Key。页面只调用现有后端 agent 服务，密钥必须配置在服务端。" />
        </div>
      </section>

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
              <div className="text-lg font-semibold text-white">生成智能报告</div>
              <div className="mt-1 text-sm text-slate-400">选择项目、分析范围、智能等级和输出模块。</div>
            </div>
            <Tag color="blue">{selectedProjects.length} 个项目已纳入分析</Tag>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm text-slate-300">选择项目</div>
                <Select mode="multiple" value={selectedProjectIds} onChange={setSelectedProjectIds} maxTagCount="responsive" style={{ width: '100%' }} options={projects.map((item) => ({ label: `${item.number || '-'} ${item.name}`, value: item.proId }))} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">报告类型</div>
                <Select style={{ width: '100%' }} value={reportType} onChange={setReportType} options={REPORT_TYPE_OPTIONS} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">分析范围</div>
                <Select style={{ width: '100%' }} value={rangePreset} onChange={setRangePreset} options={RANGE_OPTIONS} />
              </div>
              {rangePreset === 'custom' ? (
                <div>
                  <div className="mb-2 text-sm text-slate-300">自定义时间范围</div>
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
                <div className="mb-2 text-sm text-slate-300">智能等级</div>
                <Select style={{ width: '100%' }} value={intelligenceLevel} onChange={setIntelligenceLevel} options={INTELLIGENCE_OPTIONS} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">输出格式</div>
                <Select style={{ width: '100%' }} value={outputFormat} onChange={setOutputFormat} options={OUTPUT_OPTIONS} />
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                <div className="mb-3 text-sm font-medium text-white">AI 功能开关</div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between"><span>智能摘要</span><Switch checked={enableSummary} onChange={setEnableSummary} /></div>
                  <div className="flex items-center justify-between"><span>风险提示</span><Switch checked={enableRisk} onChange={setEnableRisk} /></div>
                  <div className="flex items-center justify-between"><span>优化建议</span><Switch checked={enableSuggestions} onChange={setEnableSuggestions} /></div>
                  <div className="flex items-center justify-between"><span>自动结论</span><Switch checked={enableConclusion} onChange={setEnableConclusion} /></div>
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
            <div className="text-xl font-semibold text-white">AI 分析结果区</div>
            <div className="mt-1 text-sm text-slate-400">先看摘要、风险和建议，再决定是否生成报告。</div>
          </div>
          {activePreview ? <Button icon={<DownloadOutlined />} onClick={() => downloadMarkdown(activePreview!)}>导出摘要</Button> : null}
        </div>
        {activePreview ? (
          <PreviewContent preview={activePreview!} />
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/10 px-6 py-16 text-center">
            <div className="mx-auto max-w-md">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-200"><RobotOutlined style={{ fontSize: 28 }} /></div>
              <div className="text-xl font-semibold text-white">等待 AI 分析</div>
              <div className="mt-3 text-sm leading-7 text-slate-400">点击“开始 AI 分析”后，这里会显示智能摘要、风险提示、优化建议和报告结论。</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#08111f]/92 p-6 shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-semibold text-white">历史报告区</div>
            <div className="mt-1 text-sm text-slate-400">保留 AI 报告、普通记录、完成状态和失败状态的管理入口。</div>
          </div>
          <Space wrap>
            {HISTORY_FILTER_OPTIONS.map((item) => <Button key={item.value} size="small" type={historyFilter === item.value ? 'primary' : 'default'} onClick={() => setHistoryFilter(item.value)}>{item.label}</Button>)}
            {historyItems.length ? (
              <Popconfirm
                title="清空当前筛选结果？"
                description={`将删除 ${currentHistoryStats.localIds.length} 条本地 AI 报告和 ${currentHistoryStats.serverIds.length} 条服务端记录，删除后不可恢复。`}
                okText="清空"
                cancelText="取消"
                onConfirm={() => void handleClearCurrentHistory()}
              >
                <Button danger icon={<DeleteOutlined />} loading={clearingCurrentList}>
                  清空当前列表
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
                      <Tag color={item.kind === 'ai' ? 'blue' : 'default'}>{item.kind === 'ai' ? 'AI报告' : '普通报告'}</Tag>
                      {renderStatus(item.status)}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{formatTime(item.time)}</div>
                    <div className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</div>
                  </div>
                  <Space wrap>
                    {item.preview ? <Button icon={<FileSearchOutlined />} onClick={() => openPreview(item.preview!)}>预览</Button> : null}
                    {item.preview ? <Button icon={<DownloadOutlined />} onClick={() => downloadMarkdown(item.preview!)}>导出</Button> : null}
                    <Popconfirm
                      title={item.preview ? '删除这条本地 AI 报告？' : '删除这条服务端历史记录？'}
                      description={item.preview ? '删除后将从当前浏览器本地存储中移除。' : '删除后将从数据库历史记录中移除，且不可恢复。'}
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => void handleDeleteHistoryItem(item)}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={deletingIdSet.has(item.id)}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="当前筛选条件下暂无可展示的报告记录。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </section>
        </>
      ) : null}
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#0a1426_0%,#0b1220_42%,#07101d_100%)] p-6 shadow-[0_30px_90px_rgba(2,8,23,0.38)] md:p-8">
        <div className="flex flex-col gap-4 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <FileTextOutlined />
              智能报告
            </div>
            <div className="text-3xl font-semibold tracking-tight text-white">业务化智能报告工作台</div>
            <div className="mt-3 text-sm leading-7 text-slate-300">
              基于项目、管道、泵站、油品与历史分析记录生成摘要、诊断、方案对比、风险预警和优化建议。
            </div>
          </div>
          <div className="rounded-[24px] border border-cyan-300/15 bg-cyan-400/8 px-5 py-4 text-sm leading-7 text-slate-200">
            <div className="font-medium text-cyan-100">推荐用法</div>
            <div className="mt-1">上面先选结构化条件，下面再用自然语言补充本次分析需求，最后点击“生成智能报告”。</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <div className="rounded-[26px] border border-white/8 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">报告对象</div>
            <div className="mt-1 text-sm text-slate-400">先确定本次报告面向哪个项目、管道和泵站范围。</div>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 text-sm text-slate-300">所属项目</div>
                <Select
                  style={{ width: '100%' }}
                  value={businessProjectId}
                  onChange={setBusinessProjectId}
                  options={businessProjectOptions.map((item) => ({ label: `${item.number} / ${item.name}`, value: item.proId }))}
                  placeholder="请选择所属项目"
                />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">分析对象</div>
                <Select style={{ width: '100%' }} value={businessAnalysisObject} onChange={setBusinessAnalysisObject} options={BUSINESS_OBJECT_OPTIONS} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">管道名称</div>
                <Select
                  style={{ width: '100%' }}
                  value={businessPipelineId}
                  onChange={setBusinessPipelineId}
                  options={businessPipelines.map((item) => ({ label: item.name, value: item.id }))}
                  placeholder="请选择管道"
                  allowClear
                />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">泵站范围</div>
                <Select
                  style={{ width: '100%' }}
                  value={businessPumpScope}
                  onChange={(value) => setBusinessPumpScope(value)}
                  options={[
                    { label: '全部泵站', value: 'all' },
                    { label: '指定泵站', value: 'custom' },
                  ]}
                />
              </div>
              {businessPumpScope === 'custom' ? (
                <div>
                  <div className="mb-2 text-sm text-slate-300">指定泵站</div>
                  <Select
                    mode="multiple"
                    maxTagCount="responsive"
                    style={{ width: '100%' }}
                    value={businessPumpStationIds}
                    onChange={setBusinessPumpStationIds}
                    options={pumpStations.map((item) => ({ label: item.name, value: item.id }))}
                    placeholder="请选择泵站"
                  />
                </div>
              ) : null}
              <div>
                <div className="mb-2 text-sm text-slate-300">油品类型</div>
                <Select
                  style={{ width: '100%' }}
                  value={businessOilId}
                  onChange={setBusinessOilId}
                  options={oilProperties.map((item) => ({ label: item.name, value: item.id }))}
                  placeholder="请选择油品"
                />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">时间范围</div>
                <Select style={{ width: '100%' }} value={businessTimePreset} onChange={setBusinessTimePreset} options={BUSINESS_TIME_OPTIONS} />
              </div>
              {businessTimePreset === 'custom' ? (
                <div>
                  <div className="mb-2 text-sm text-slate-300">自定义时间</div>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={businessCustomRange}
                    onChange={(value) => {
                      const nextValue = value as [Dayjs | null, Dayjs | null] | null;
                      if (!nextValue || !nextValue[0] || !nextValue[1]) {
                        setBusinessCustomRange(null);
                        return;
                      }
                      setBusinessCustomRange([nextValue[0], nextValue[1]]);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">报告目标</div>
            <div className="mt-1 text-sm text-slate-400">明确这次报告要解决什么问题、重点看什么、输出给谁看。</div>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 text-sm text-slate-300">报告类型</div>
                <Select style={{ width: '100%' }} value={businessReportType} onChange={setBusinessReportType} options={BUSINESS_REPORT_TYPE_OPTIONS} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">分析重点</div>
                <Select
                  mode="multiple"
                  maxTagCount="responsive"
                  style={{ width: '100%' }}
                  value={businessFocuses}
                  onChange={setBusinessFocuses}
                  options={BUSINESS_FOCUS_OPTIONS.map((item) => ({ label: item, value: item }))}
                  placeholder="请选择分析重点"
                />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">输出风格</div>
                <Select style={{ width: '100%' }} value={businessOutputStyle} onChange={setBusinessOutputStyle} options={BUSINESS_OUTPUT_STYLE_OPTIONS} />
              </div>
              <div className="rounded-[22px] border border-cyan-300/12 bg-slate-950/40 p-4">
                <div className="text-sm font-medium text-white">示例问题</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {BUSINESS_EXAMPLE_PROMPTS.map((item) => (
                    <Button key={item} size="small" onClick={() => setBusinessPrompt(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/8 bg-slate-950/35 p-4">
                <div className="text-sm font-medium text-white">当前已选范围</div>
                <div className="mt-3 grid gap-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">项目</span>
                    <span>{businessSelectedProject?.name ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">管道</span>
                    <span>{businessSelectedPipeline?.name ?? '未指定'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">泵站</span>
                    <span>{businessPumpScope === 'all' ? '全部泵站' : `${businessVisiblePumpStations.length} 座`}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">样本</span>
                    <span>{businessHistories.length} 条历史记录</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">约束条件与 AI 指令</div>
            <div className="mt-1 text-sm text-slate-400">这里决定报告是否更像真实业务系统，而不是普通聊天页面。</div>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 text-sm text-slate-300">目标输量</div>
                <Input value={businessTargetThroughput} onChange={(event) => setBusinessTargetThroughput(event.target.value)} placeholder="例如：850" suffix="m3/h" />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">最低出口压力</div>
                <Input value={businessMinPressure} onChange={(event) => setBusinessMinPressure(event.target.value)} placeholder="例如：1.20" suffix="MPa" />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">优化目标</div>
                <Select style={{ width: '100%' }} value={businessOptimizationGoal} onChange={setBusinessOptimizationGoal} options={BUSINESS_OPTIMIZATION_GOAL_OPTIONS} />
              </div>
              <div className="flex items-center justify-between rounded-[20px] border border-white/8 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
                <span>运行限制：是否允许调整泵站组合</span>
                <Switch checked={businessAllowPumpAdjust} onChange={setBusinessAllowPumpAdjust} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">备注说明</div>
                <TextArea value={businessRemark} onChange={(event) => setBusinessRemark(event.target.value)} placeholder="补充特殊工况、制度限制或汇报要求" autoSize={{ minRows: 3, maxRows: 5 }} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-300">报告需求描述</div>
                <TextArea
                  value={businessPrompt}
                  onChange={(event) => setBusinessPrompt(event.target.value)}
                  placeholder="例如：在满足输量和压力要求的前提下，生成一份泵站节能优化报告。"
                  autoSize={{ minRows: 5, maxRows: 8 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/8 pt-6">
          <Button type="primary" icon={<RobotOutlined />} loading={businessGenerating} onClick={handleGenerateBusinessReport}>
            生成智能报告
          </Button>
          <Button onClick={resetBusinessReportBuilder}>重置条件</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportBusinessReport} disabled={!businessReport}>
            导出报告
          </Button>
        </div>

        {businessReport ? (
          <div className="mt-8 space-y-6">
            <section className="rounded-[26px] border border-white/8 bg-white/5 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-2xl font-semibold text-white">{businessReport.title}</div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">项目：{businessReport.projectName}</div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">对象：{businessReport.objectLabel}</div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">时间：{businessReport.rangeLabel}</div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">生成时间：{businessReport.generatedAt}</div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">报告类型：{businessReport.reportTypeLabel}</div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">输出风格：{businessReport.outputStyleLabel}</div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm leading-7 text-slate-100 lg:max-w-md">
                  {businessReport.totalComment}
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/5 p-6">
              <div className="mb-4 text-xl font-semibold text-white">AI分析摘要</div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {businessReport.highlightItems.map((item, index) => (
                  <div key={`${index}-${item}`} className="rounded-[22px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(15,23,42,0.92))] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">结论 {String(index + 1).padStart(2, '0')}</div>
                    <div className="mt-3 text-sm leading-7 text-slate-100">{item}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[26px] border border-white/8 bg-white/5 p-6">
                <div className="mb-4 text-xl font-semibold text-white">运行概况</div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {businessReport.kpis.map((item) => (
                    <div key={item.label} className="rounded-[22px] border border-white/8 bg-slate-950/35 p-4">
                      <div className="text-sm text-slate-400">{item.label}</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{item.value}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-white/5 p-6">
                <div className="mb-4 text-xl font-semibold text-white">问题诊断</div>
                <div className="space-y-3">
                  {businessReport.diagnosisSummary.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3 text-sm leading-7 text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-4">
                  {businessReport.diagnosisFactors.map((item) => (
                    <div key={item.name}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-200">{item.name}</span>
                        <span className="text-cyan-200">{item.score}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: getBarWidthPercent(item.score, 100) }} />
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/5 p-6">
              <div className="mb-4 text-xl font-semibold text-white">方案对比</div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="px-4 py-3 font-medium">方案</th>
                      <th className="px-4 py-3 font-medium">标签</th>
                      <th className="px-4 py-3 font-medium">总扬程</th>
                      <th className="px-4 py-3 font-medium">压力</th>
                      <th className="px-4 py-3 font-medium">电耗</th>
                      <th className="px-4 py-3 font-medium">运行费用</th>
                      <th className="px-4 py-3 font-medium">风险等级</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {businessReport.schemes.map((item) => (
                      <tr key={item.name} className={item.highlighted ? 'bg-cyan-400/6' : ''}>
                        <td className="px-4 py-4 font-medium text-white">{item.name}</td>
                        <td className="px-4 py-4"><Tag color={item.highlighted ? 'cyan' : 'default'}>{item.tag}</Tag></td>
                        <td className="px-4 py-4 text-slate-200">{item.head}</td>
                        <td className="px-4 py-4 text-slate-200">{item.pressure}</td>
                        <td className="px-4 py-4 text-slate-200">{item.power}</td>
                        <td className="px-4 py-4 text-slate-200">{item.cost}</td>
                        <td className="px-4 py-4"><Tag color={getBusinessRiskColor(item.risk)}>{item.risk}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 lg:hidden">
                {businessReport.schemes.map((item) => (
                  <div key={item.name} className={`rounded-[22px] border p-4 ${item.highlighted ? 'border-cyan-300/20 bg-cyan-400/8' : 'border-white/8 bg-slate-950/35'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-semibold text-white">{item.name}</div>
                      <Tag color={getBusinessRiskColor(item.risk)}>{item.risk}</Tag>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300">
                      <div>标签：{item.tag}</div>
                      <div>总扬程：{item.head}</div>
                      <div>压力：{item.pressure}</div>
                      <div>电耗：{item.power}</div>
                      <div>运行费用：{item.cost}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[26px] border border-white/8 bg-white/5 p-6">
                <div className="mb-4 text-xl font-semibold text-white">敏感性分析结果</div>
                <div className="space-y-4">
                  {businessReport.sensitivityItems.map((item) => (
                    <div key={item.name} className="rounded-[22px] border border-white/8 bg-slate-950/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold text-white">{item.name}</div>
                        <div className="text-cyan-200">{item.impact}</div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500" style={{ width: getBarWidthPercent(item.impact, 100) }} />
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-400">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-white/5 p-6">
                <div className="mb-4 text-xl font-semibold text-white">风险预警</div>
                <div className="grid gap-4 md:grid-cols-2">
                  {businessReport.risks.map((item) => (
                    <div key={item.title} className={`rounded-[22px] border p-4 ${getBusinessRiskBadgeClass(item.level)}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold">{item.title}</div>
                        <Tag color={getBusinessRiskColor(item.level)}>{item.level}</Tag>
                      </div>
                      <div className="mt-3 text-sm leading-7">{item.description}</div>
                      <div className="mt-3 text-sm leading-7 text-slate-100">建议：{item.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/5 p-6">
              <div className="mb-4 text-xl font-semibold text-white">优化建议</div>
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-500/8 p-5">
                  <div className="text-base font-semibold text-white">立即可执行</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-100">
                    {businessReport.immediateActions.map((item) => (
                      <div key={item} className="rounded-2xl border border-emerald-200/10 bg-slate-950/30 px-4 py-3">{item}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[22px] border border-amber-300/20 bg-amber-500/8 p-5">
                  <div className="text-base font-semibold text-white">短期建议</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-100">
                    {businessReport.shortTermActions.map((item) => (
                      <div key={item} className="rounded-2xl border border-amber-200/10 bg-slate-950/30 px-4 py-3">{item}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[22px] border border-cyan-300/20 bg-cyan-500/8 p-5">
                  <div className="text-base font-semibold text-white">长期建议</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-100">
                    {businessReport.longTermActions.map((item) => (
                      <div key={item} className="rounded-2xl border border-cyan-200/10 bg-slate-950/30 px-4 py-3">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/5 p-6">
              <div className="mb-4 text-xl font-semibold text-white">图表分析</div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {businessReport.chartCards.map((item) => (
                  <div key={item.title} className="rounded-[22px] border border-white/8 bg-slate-950/35 p-4">
                    <div className="text-base font-semibold text-white">{item.title}</div>
                    <div className="mt-4 h-2 rounded-full bg-white/8">
                      <div className={`h-full rounded-full bg-gradient-to-r ${item.accentClassName}`} style={{ width: getBarWidthPercent(item.value, 100) }} />
                    </div>
                    <div className="mt-4 text-sm leading-7 text-slate-400">{item.insight}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-8 rounded-[26px] border border-dashed border-white/10 px-6 py-16 text-center">
            <div className="mx-auto max-w-2xl">
              <div className="text-2xl font-semibold text-white">等待生成业务智能报告</div>
              <div className="mt-3 text-sm leading-7 text-slate-400">
                该区域会按照“报告信息、AI分析摘要、运行概况、问题诊断、方案对比、敏感性分析结果、风险预警、优化建议、图表分析”模块输出，不会是一整块聊天文字。
              </div>
            </div>
          </div>
        )}
      </section>
      <Modal
        open={Boolean(previewModalRecord)}
        title={previewModalRecord?.title || '报告预览'}
        onCancel={() => setPreviewModalRecord(null)}
        width={1080}
        footer={
          previewModalRecord
            ? [
                <Button key="download" icon={<DownloadOutlined />} onClick={() => downloadMarkdown(previewModalRecord)}>
                  导出
                </Button>,
                <Button key="close" type="primary" onClick={() => setPreviewModalRecord(null)}>
                  关闭
                </Button>,
              ]
            : null
        }
        styles={{
          container: {
            background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          header: {
            background: 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          },
          body: {
            paddingTop: 20,
          },
        }}
      >
        {previewModalRecord ? <PreviewContent preview={previewModalRecord} /> : null}
      </Modal>
    </AnimatedPage>
  );
}
