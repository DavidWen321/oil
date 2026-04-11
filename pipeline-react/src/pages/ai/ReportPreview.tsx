import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { EChartsOption } from 'echarts';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import { calculationHistoryApi, projectApi } from '../../api';
import { agentApi } from '../../api/agent';
import AnimatedPage from '../../components/common/AnimatedPage';
import Chart from '../../components/common/Chart';
import {
  SENSITIVITY_REPORT_PAGE_COPY,
  type SensitivitySmartReportPayload,
} from '../../components/reporting/sensitivityReportSchema';
import { useCalculationLinkStore } from '../../stores/calculationLinkStore';
import type { CalculationHistory, PageResult, Project, R, SaveReportRequest } from '../../types';
import type { DynamicReportResponsePayload } from '../../types/agent';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

type ReportType = 'AI_REPORT' | 'RISK_REVIEW' | 'ENERGY_DIAGNOSIS' | 'OPERATION_BRIEF';

type HistoryRow = CalculationHistory & {
  key: number;
};

type HistoryTableRow = HistoryRow & {
  projectNumber: string;
  responsible: string;
  calcTypeLabel: string;
  updateTimeText: string;
};

type AiReportHistoryRow = HistoryTableRow & {
  reportTitle: string;
  reportAbstract: string;
};

type DetailMetricTone = 'blue' | 'cyan' | 'green' | 'amber' | 'purple';

type DetailMetricCardItem = {
  label: string;
  value: string;
  tone?: DetailMetricTone;
  span?: number;
};

type DetailMetricCardRenderOptions = {
  equalWidth?: boolean;
  singleLine?: boolean;
  compact?: boolean;
  minColumnWidth?: number;
  minHeight?: number;
  valueFontSize?: CSSProperties['fontSize'];
};

type SensitivityDetailRow = {
  key: string;
  variableName: string;
  changePercent: string;
  endStationPressure: string;
  frictionHeadLoss: string;
  flowRegime: string;
  hydraulicSlope: string;
  reynoldsNumber: string;
};

type HydraulicReportSnapshot = {
  projectName?: string | null;
  generatedAt?: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

type OptimizationReportSnapshot = {
  projectName?: string | null;
  generatedAt?: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

type SensitivityReportSnapshot = {
  projectName?: string | null;
  generatedAt?: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

type DetailPreviewState =
  | {
      mode: 'history';
      row: HistoryTableRow;
    }
  | {
      mode: 'generated';
      report: DynamicReportResponsePayload;
    }
  | null;

const ALL_CALC_TYPE_OPTION = '__ALL_CALC_TYPE__';

const REPORT_TYPE_OPTIONS: Array<{ label: string; value: ReportType }> = [
  { label: '智能报告', value: 'AI_REPORT' },
  { label: '风险复核', value: 'RISK_REVIEW' },
  { label: '能耗诊断', value: 'ENERGY_DIAGNOSIS' },
  { label: '运行简报', value: 'OPERATION_BRIEF' },
];

const ARCHIVED_REPORT_TYPES = new Set<ReportType>([
  'AI_REPORT',
  'RISK_REVIEW',
  'ENERGY_DIAGNOSIS',
  'OPERATION_BRIEF',
]);

const CALC_TYPE_LABELS: Record<string, string> = {
  HYDRAULIC: '水力分析',
  OPTIMIZATION: '泵站优化',
  SENSITIVITY: '敏感性分析',
  AI_REPORT: '智能报告',
  RISK_REVIEW: '风险复核',
  ENERGY_DIAGNOSIS: '能耗诊断',
  OPERATION_BRIEF: '运行简报',
};

const HYDRAULIC_REPORT_CORE_SENTENCE =
  '用真实水力计算结果做基础，用图表展示压头和扬程变化，再让 API 对雷诺数、流态、摩阻损失、总扬程和末站进站压头进行解释、判断和建议。';

const SENSITIVITY_REPORT_CORE_SENTENCE =
  '基于真实敏感性计算结果，重点分析变量变化对压力、摩阻损失和流态的影响程度，用排名图、趋势图和风险结论告诉用户哪个变量最值得重点控制。';

const OPTIMIZATION_REPORT_CORE_SENTENCE =
  '基于真实优化结果，围绕推荐泵组合的可行性、压力保障能力、能耗水平和总成本进行解释和判断，告诉用户这个方案为什么被选中、能不能用、值不值得用。';

const cardStyle: CSSProperties = {
  borderRadius: 20,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
};

const tableCardBodyStyle: CSSProperties = {
  padding: 0,
  overflow: 'hidden',
};

const tableHeaderCellStyle: CSSProperties = {
  background: '#edf4ff',
  color: '#7c8aa5',
  fontSize: 14,
  fontWeight: 600,
  padding: '14px 16px',
  borderBottom: '1px solid #e3edf9',
};

const tableCellStyle: CSSProperties = {
  padding: '18px 16px',
  color: '#334155',
  fontSize: 14,
  borderBottom: '1px solid #eef2f7',
  verticalAlign: 'top',
};

const detailSectionStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
};

const detailSectionBodyStyle: CSSProperties = {
  padding: 20,
};

const detailMetricToneMap: Record<
  DetailMetricTone,
  { background: string; border: string; label: string; value: string }
> = {
  blue: {
    background: 'linear-gradient(135deg, rgba(236, 245, 255, 0.98), rgba(243, 248, 255, 0.95))',
    border: 'rgba(196, 219, 255, 0.95)',
    label: '#4e86f7',
    value: '#1e3a8a',
  },
  cyan: {
    background: 'linear-gradient(135deg, rgba(235, 250, 255, 0.98), rgba(243, 252, 255, 0.95))',
    border: 'rgba(191, 236, 247, 0.95)',
    label: '#17a2c2',
    value: '#155e75',
  },
  green: {
    background: 'linear-gradient(135deg, rgba(237, 252, 245, 0.98), rgba(246, 255, 250, 0.95))',
    border: 'rgba(194, 240, 218, 0.95)',
    label: '#12b981',
    value: '#166534',
  },
  amber: {
    background: 'linear-gradient(135deg, rgba(255, 247, 230, 0.98), rgba(255, 252, 242, 0.95))',
    border: 'rgba(250, 226, 173, 0.95)',
    label: '#f59e0b',
    value: '#92400e',
  },
  purple: {
    background: 'linear-gradient(135deg, rgba(247, 240, 255, 0.98), rgba(252, 248, 255, 0.95))',
    border: 'rgba(225, 210, 255, 0.95)',
    label: '#a855f7',
    value: '#6b21a8',
  },
};

type MetricCardTone = {
  accent: string;
  accentSoft: string;
  iconBackground: string;
  iconColor: string;
  panelBackground: string;
  panelBorder: string;
};

const metricCardTones: MetricCardTone[] = [
  {
    accent: '#77A7FF',
    accentSoft: 'rgba(119, 167, 255, 0.45)',
    iconBackground: 'linear-gradient(135deg, rgba(224, 236, 255, 0.95), rgba(238, 244, 255, 0.88))',
    iconColor: '#4E86F7',
    panelBackground: 'rgba(231, 241, 255, 0.92)',
    panelBorder: 'rgba(195, 217, 255, 0.9)',
  },
  {
    accent: '#55CDE2',
    accentSoft: 'rgba(85, 205, 226, 0.42)',
    iconBackground: 'linear-gradient(135deg, rgba(223, 247, 251, 0.95), rgba(237, 252, 255, 0.88))',
    iconColor: '#18B6D2',
    panelBackground: 'rgba(229, 250, 255, 0.9)',
    panelBorder: 'rgba(193, 237, 245, 0.92)',
  },
  {
    accent: '#7ADEBA',
    accentSoft: 'rgba(122, 222, 186, 0.42)',
    iconBackground: 'linear-gradient(135deg, rgba(228, 251, 242, 0.95), rgba(242, 255, 248, 0.9))',
    iconColor: '#1CCF8A',
    panelBackground: 'rgba(234, 254, 245, 0.9)',
    panelBorder: 'rgba(198, 241, 223, 0.92)',
  },
  {
    accent: '#FFCC72',
    accentSoft: 'rgba(255, 204, 114, 0.42)',
    iconBackground: 'linear-gradient(135deg, rgba(255, 245, 214, 0.96), rgba(255, 250, 236, 0.9))',
    iconColor: '#F59E0B',
    panelBackground: 'rgba(255, 250, 229, 0.92)',
    panelBorder: 'rgba(250, 227, 164, 0.94)',
  },
];

function MetricBars({ color }: { color: string }) {
  const heights = [24, 34, 28, 46];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 4 }}>
      {heights.map((height, index) => (
        <span
          key={`${color}-${height}`}
          style={{
            width: 8,
            height,
            borderRadius: 999,
            background: color,
            opacity: 0.35 + index * 0.15,
          }}
        />
      ))}
    </div>
  );
}

type MetricCardProps = {
  icon: ReactNode;
  statistic: ReactElement<{ title?: ReactNode; value?: ReactNode }>;
  tone: MetricCardTone;
};

function MetricCard({ icon, statistic, tone }: MetricCardProps) {
  return (
    <Card
      style={{
        ...cardStyle,
        height: '100%',
        border: '1px solid rgba(226, 232, 240, 0.9)',
      }}
      bodyStyle={{ padding: 24 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#7c8aa5',
              letterSpacing: '0.02em',
            }}
          >
            {statistic.props.title}
          </Text>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tone.iconBackground,
              color: tone.iconColor,
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.78)',
              fontSize: 28,
            }}
          >
            {icon}
          </div>
        </div>

        <div
          style={{
            borderRadius: 22,
            border: `1px solid ${tone.panelBorder}`,
            background: `linear-gradient(135deg, rgba(255, 255, 255, 0.96), ${tone.panelBackground})`,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 10px 24px rgba(15, 23, 42, 0.04)',
            padding: '24px 22px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 700,
                lineHeight: 1,
                color: '#0f172a',
                letterSpacing: '-0.04em',
              }}
            >
              {statistic.props.value}
            </div>
            <MetricBars color={tone.accent} />
          </div>

          <div
            style={{
              height: 4,
              marginTop: 18,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${tone.accentSoft}, rgba(255, 255, 255, 0))`,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {[0.48, 0.72, 0.96].map((opacity, index) => (
            <span
              key={`${tone.accent}-${index}`}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: tone.accent,
                opacity,
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

async function fetchAllPagedList<T>(
  requestPage: (pageNum: number, pageSize: number) => Promise<R<PageResult<T>>>,
  pageSize = 100,
  maxPages = 20,
) {
  const records: T[] = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const response = await requestPage(pageNum, pageSize);
    const pageData = response.data;
    const list = Array.isArray(pageData?.list) ? pageData.list : [];
    records.push(...list);
    if (list.length < pageSize || records.length >= Number(pageData?.total ?? list.length)) {
      break;
    }
  }
  return records;
}

function formatTime(value?: string) {
  if (!value) {
    return '-';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
}

function parseJson(value?: string) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item));
}

function getValueByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      return /^\d+$/.test(key) ? current[Number(key)] : undefined;
    }

    if (typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
}

function pickFirstValue(sources: unknown[], paths: string[]): unknown {
  for (const source of sources) {
    for (const path of paths) {
      const value = getValueByPath(source, path);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }
  return undefined;
}

function formatValue(value: unknown, unit?: string) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'number') {
    const normalized = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
    return unit ? `${normalized} ${unit}` : normalized;
  }

  if (typeof value === 'string') {
    return unit && value !== '-' ? `${value} ${unit}` : value;
  }

  return JSON.stringify(value);
}

function toFiniteNumber(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '' || normalized === null || normalized === undefined) {
    return null;
  }
  const next = Number(normalized);
  return Number.isFinite(next) ? next : null;
}

function buildHydraulicSnapshot(input: unknown, output: unknown, projectName?: string | null, generatedAt?: string | null) {
  const inputRecord = asRecord(input);
  const outputRecord = asRecord(output);
  if (!inputRecord || !outputRecord) {
    return null;
  }

  return {
    projectName: projectName ?? null,
    generatedAt: generatedAt ?? null,
    input: inputRecord,
    output: outputRecord,
  } satisfies HydraulicReportSnapshot;
}

function buildHydraulicSnapshotFromHistory(record?: Pick<HistoryTableRow, 'projectName' | 'createTime' | 'inputParams' | 'outputResult'> | null) {
  if (!record) {
    return null;
  }

  const parsedOutput = parseJson(record.outputResult);
  const outputRecord = asRecord(getValueByPath(parsedOutput, 'data')) ?? asRecord(parsedOutput);
  return buildHydraulicSnapshot(parseJson(record.inputParams), outputRecord, record.projectName, record.createTime);
}

function buildHydraulicSnapshotFromLinkedRecord(record?: {
  projectName?: string | null;
  updatedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
} | null) {
  if (!record) {
    return null;
  }

  return buildHydraulicSnapshot(record.input, record.output, record.projectName, record.updatedAt);
}

function extractHydraulicSnapshotFromReport(report: DynamicReportResponsePayload) {
  const metadata = asRecord(report.metadata);
  return buildHydraulicSnapshot(
    getValueByPath(metadata, 'hydraulicSnapshot.input'),
    getValueByPath(metadata, 'hydraulicSnapshot.output'),
    typeof getValueByPath(metadata, 'hydraulicSnapshot.projectName') === 'string'
      ? String(getValueByPath(metadata, 'hydraulicSnapshot.projectName'))
      : null,
    typeof getValueByPath(metadata, 'hydraulicSnapshot.generatedAt') === 'string'
      ? String(getValueByPath(metadata, 'hydraulicSnapshot.generatedAt'))
      : null,
  );
}

function createOptimizationReportSnapshot(
  input: unknown,
  output: unknown,
  projectName?: string | null,
  generatedAt?: string | null,
) {
  const inputRecord = asRecord(input);
  const outputRecord = asRecord(output);
  if (!inputRecord || !outputRecord) {
    return null;
  }

  return {
    projectName: projectName ?? null,
    generatedAt: generatedAt ?? null,
    input: inputRecord,
    output: outputRecord,
  } satisfies OptimizationReportSnapshot;
}

function createOptimizationReportSnapshotFromHistory(
  record?: Pick<HistoryTableRow, 'projectName' | 'createTime' | 'inputParams' | 'outputResult'> | null,
) {
  if (!record) {
    return null;
  }

  const parsedOutput = parseJson(record.outputResult);
  const outputRecord = asRecord(getValueByPath(parsedOutput, 'data')) ?? asRecord(parsedOutput);
  return createOptimizationReportSnapshot(parseJson(record.inputParams), outputRecord, record.projectName, record.createTime);
}

function createOptimizationReportSnapshotFromLinkedRecord(record?: {
  projectName?: string | null;
  updatedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
} | null) {
  if (!record) {
    return null;
  }

  return createOptimizationReportSnapshot(record.input, record.output, record.projectName, record.updatedAt);
}

function extractOptimizationSnapshotFromReport(report: DynamicReportResponsePayload) {
  const metadata = asRecord(report.metadata);
  return createOptimizationReportSnapshot(
    getValueByPath(metadata, 'optimizationSnapshot.input'),
    getValueByPath(metadata, 'optimizationSnapshot.output'),
    typeof getValueByPath(metadata, 'optimizationSnapshot.projectName') === 'string'
      ? String(getValueByPath(metadata, 'optimizationSnapshot.projectName'))
      : null,
    typeof getValueByPath(metadata, 'optimizationSnapshot.generatedAt') === 'string'
      ? String(getValueByPath(metadata, 'optimizationSnapshot.generatedAt'))
      : null,
  );
}

function buildPumpDisplay(sources: unknown[]) {
  const pump480Num = pickFirstValue(sources, ['pump480Num']);
  const pump375Num = pickFirstValue(sources, ['pump375Num']);
  const pump480Head = pickFirstValue(sources, ['pump480Head']);
  const pump375Head = pickFirstValue(sources, ['pump375Head']);

  const parts: string[] = [];
  if (pump480Num !== undefined || pump480Head !== undefined) {
    parts.push(`480 泵 ${formatValue(pump480Num)} 台 / ${formatValue(pump480Head, 'm')}`);
  }
  if (pump375Num !== undefined || pump375Head !== undefined) {
    parts.push(`375 泵 ${formatValue(pump375Num)} 台 / ${formatValue(pump375Head, 'm')}`);
  }

  return parts.length ? parts.join('；') : '-';
}

function buildPumpCountDisplay(sources: unknown[]) {
  const pump480Num = pickFirstValue(sources, ['pump480Num']);
  const pump375Num = pickFirstValue(sources, ['pump375Num']);

  const parts: string[] = [];
  if (pump480Num !== undefined) {
    parts.push(`480 泵 ${formatValue(pump480Num)} 台`);
  }
  if (pump375Num !== undefined) {
    parts.push(`375 泵 ${formatValue(pump375Num)} 台`);
  }

  return parts.length ? parts.join('；') : '-';
}

function buildPumpHeadDisplay(sources: unknown[]) {
  const pump480Head = pickFirstValue(sources, ['pump480Head']);
  const pump375Head = pickFirstValue(sources, ['pump375Head']);

  const parts: string[] = [];
  if (pump480Head !== undefined) {
    parts.push(`480 泵 ${formatValue(pump480Head, 'm')}`);
  }
  if (pump375Head !== undefined) {
    parts.push(`375 泵 ${formatValue(pump375Head, 'm')}`);
  }

  return parts.length ? parts.join('；') : '-';
}

function buildHydraulicElevationDisplay(sources: unknown[]) {
  const startAltitude = formatValue(pickFirstValue(sources, ['startAltitude']), 'm');
  const endAltitude = formatValue(pickFirstValue(sources, ['endAltitude']), 'm');
  return `起点 ${startAltitude} / 终点 ${endAltitude}`;
}

function buildHydraulicPumpParameterDisplay(sources: unknown[]) {
  const pump480Num = pickFirstValue(sources, ['pump480Num']);
  const pump375Num = pickFirstValue(sources, ['pump375Num']);
  const pump480Head = pickFirstValue(sources, ['pump480Head']);
  const pump375Head = pickFirstValue(sources, ['pump375Head']);

  const parts: string[] = [];
  if (pump480Num !== undefined || pump480Head !== undefined) {
    parts.push(`480 泵 ${formatValue(pump480Num)} 台 / ${formatValue(pump480Head, 'm')}`);
  }
  if (pump375Num !== undefined || pump375Head !== undefined) {
    parts.push(`375 泵 ${formatValue(pump375Num)} 台 / ${formatValue(pump375Head, 'm')}`);
  }

  return parts.length ? parts.join('；') : '-';
}

function buildHydraulicUserPrompt() {
  return [
    '请基于真实水力计算结果生成水力分析智能报告，并严格按以下 5 个模块输出：',
    '第一块：报告头，包含标题、项目名、生成时间、分析类型。',
    '第二块：参数表，包含流量、密度、粘度、长度、管径、粗糙度、高程、泵参数。',
    '第三块：结果卡片，包含雷诺数、流态、摩阻损失、水力坡降、总扬程、末站进站压头。',
    '第四块：图表，包含压头变化图、扬程构成图。',
    '第五块：AI分析，包含结果摘要、指标分析、风险判断、运行建议。',
    `最重要的一句话请围绕这层意思展开：${HYDRAULIC_REPORT_CORE_SENTENCE}`,
  ].join('');
}

function buildOptimizationPumpCombination(sources: unknown[]) {
  const pump480Num = toFiniteNumber(pickFirstValue(sources, ['pump480Num']));
  const pump375Num = toFiniteNumber(pickFirstValue(sources, ['pump375Num']));
  const parts: string[] = [];

  if (pump480Num !== null && pump480Num > 0) {
    parts.push(`480 泵 ${pump480Num} 台`);
  }
  if (pump375Num !== null && pump375Num > 0) {
    parts.push(`375 泵 ${pump375Num} 台`);
  }

  return parts.length ? parts.join(' + ') : '当前数据不足以支持进一步判断';
}

function buildOptimizationCurrentCondition(inputPayload: Record<string, unknown>) {
  const sources = [inputPayload];
  const parts = [
    `流量 ${formatValue(pickFirstValue(sources, ['flowRate']), 'm3/h')}`,
    `密度 ${formatValue(pickFirstValue(sources, ['density']), 'kg/m3')}`,
    `管径 ${formatValue(pickFirstValue(sources, ['diameter']), 'mm')}`,
    `首站进站压头 ${formatValue(pickFirstValue(sources, ['inletPressure']), 'm')}`,
  ].filter((item) => !item.includes('-'));

  return parts.length ? parts.join('，') : '当前数据不足以支持进一步判断';
}

function buildOptimizationUserPrompt() {
  return [
    '请基于真实泵站优化结果数据生成泵站优化智能报告，并严格按照以下结构输出：',
    '1. 报告标题。',
    '2. 报告说明，说明本报告基于当前项目泵站优化计算结果自动生成，主要分析推荐泵组合的扬程匹配、末站压头保障、能耗水平、运行成本及整体可行性。',
    '3. 基本信息，包含项目名称、分析类型、生成时间、当前工况说明、数据来源。',
    '4. 核心结果卡片，包含推荐泵组合、总扬程、总压降、末站进站压头、可行性、年能耗、总成本。',
    '5. 图表分析区，至少包含推荐方案核心指标图、能耗与成本图、泵组合说明图。',
    '6. 智能分析正文，固定输出结果摘要、关键指标分析、风险识别、优化建议四块内容。',
    '只能依据输入数据分析，不允许编造不存在的数据；若数据不足，请明确说明“当前数据不足以支持进一步判断”。',
    `最核心的一句话请围绕这层意思展开：${OPTIMIZATION_REPORT_CORE_SENTENCE}`,
  ].join('');
}

function buildSensitivityUserPrompt() {
  return [
    '请基于真实敏感性分析数据生成敏感性分析智能报告，并严格按以下结构输出：',
    '1. 报告标题。',
    '2. 报告说明，说明本报告基于当前项目敏感性分析计算结果自动生成，重点评估不同变化比例下压力、摩阻损失及流态变化情况，并识别关键敏感变量。',
    '3. 基本信息，包含项目名称、分析类型、敏感变量类型、基准工况、生成时间。',
    '4. 核心结果卡片，包含基准结果、最敏感变量、敏感系数、最大影响幅度、影响排名第1名、是否存在明显波动风险。',
    '5. 图表分析区，至少包含敏感系数排名图、变化比例结果趋势图、最大影响幅度对比图。',
    '6. 智能分析正文，固定输出结果摘要、关键变化分析、风险识别、优化建议四块内容。',
    '只能依据输入数据分析，不允许编造不存在的数据；若数据不足，请明确说明当前数据不足以支持进一步判断。',
    `最核心的一句话请围绕这层意思展开：${SENSITIVITY_REPORT_CORE_SENTENCE}`,
  ].join('');
}

function createSensitivityReportSnapshot(
  input: unknown,
  output: unknown,
  projectName?: string | null,
  generatedAt?: string | null,
) {
  const inputRecord = asRecord(input);
  const outputRecord = asRecord(output);
  if (!inputRecord || !outputRecord) {
    return null;
  }

  return {
    projectName: projectName ?? null,
    generatedAt: generatedAt ?? null,
    input: inputRecord,
    output: outputRecord,
  } satisfies SensitivityReportSnapshot;
}

function createSensitivityReportSnapshotFromHistory(
  record?: Pick<HistoryTableRow, 'projectName' | 'createTime' | 'inputParams' | 'outputResult'> | null,
) {
  if (!record) {
    return null;
  }

  const parsedOutput = parseJson(record.outputResult);
  const outputRecord = asRecord(getValueByPath(parsedOutput, 'data')) ?? asRecord(parsedOutput);
  return createSensitivityReportSnapshot(parseJson(record.inputParams), outputRecord, record.projectName, record.createTime);
}

function createSensitivityReportSnapshotFromLinkedRecord(record?: {
  projectName?: string | null;
  updatedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
} | null) {
  if (!record) {
    return null;
  }

  return createSensitivityReportSnapshot(record.input, record.output, record.projectName, record.updatedAt);
}

function extractSensitivityReportSnapshotFromReport(report: DynamicReportResponsePayload) {
  const metadata = asRecord(report.metadata);
  return createSensitivityReportSnapshot(
    getValueByPath(metadata, 'sensitivitySnapshot.input'),
    getValueByPath(metadata, 'sensitivitySnapshot.output'),
    typeof getValueByPath(metadata, 'sensitivitySnapshot.projectName') === 'string'
      ? String(getValueByPath(metadata, 'sensitivitySnapshot.projectName'))
      : null,
    typeof getValueByPath(metadata, 'sensitivitySnapshot.generatedAt') === 'string'
      ? String(getValueByPath(metadata, 'sensitivitySnapshot.generatedAt'))
      : null,
  );
}

function classifySensitivityImpactLevel(value: number | null) {
  if (value === null) {
    return '当前数据不足以支持进一步判断';
  }
  if (value >= 0.8) {
    return '较强';
  }
  if (value >= 0.4) {
    return '中等';
  }
  return '较弱';
}

function toSortedSensitivityRankingRows(output: Record<string, unknown>) {
  return asRecordArray(getValueByPath(output, 'sensitivityRanking')).sort((a, b) => {
    const rankA = toFiniteNumber(a.rank);
    const rankB = toFiniteNumber(b.rank);
    if (rankA !== null && rankB !== null) {
      return rankA - rankB;
    }
    const scoreA = toFiniteNumber(a.sensitivityCoefficient) ?? -Infinity;
    const scoreB = toFiniteNumber(b.sensitivityCoefficient) ?? -Infinity;
    return scoreB - scoreA;
  });
}

function getSensitivityPrimaryVariableResult(output: Record<string, unknown>) {
  const variableResults = asRecordArray(getValueByPath(output, 'variableResults'));
  if (!variableResults.length) {
    return null;
  }

  const rankingRows = toSortedSensitivityRankingRows(output);
  const topRank = rankingRows[0];
  if (!topRank) {
    return variableResults[0];
  }

  return (
    variableResults.find((item) => String(item.variableType ?? '') === String(topRank.variableType ?? '')) ?? variableResults[0]
  );
}

function buildSensitivityBaseCondition(inputPayload: Record<string, unknown>, inputBase: Record<string, unknown> | null) {
  const sources = [inputBase, inputPayload];
  const parts = [
    `流量 ${formatValue(pickFirstValue(sources, ['flowRate']), 'm³/h')}`,
    `密度 ${formatValue(pickFirstValue(sources, ['density']), 'kg/m³')}`,
    `管径 ${formatValue(pickFirstValue(sources, ['diameter']), 'mm')}`,
  ].filter((item) => !item.includes('-'));

  return parts.length ? parts.join('，') : '当前数据不足以支持进一步判断';
}

function evaluateSensitivityRiskLevel(params: {
  sensitivityCoefficient: number | null;
  maxImpactPercent: number | null;
  minEndStationPressure: number | null;
  flowRegimeChanged: boolean;
}) {
  const { sensitivityCoefficient, maxImpactPercent, minEndStationPressure, flowRegimeChanged } = params;
  if (
    (sensitivityCoefficient !== null && sensitivityCoefficient >= 0.8) ||
    (maxImpactPercent !== null && maxImpactPercent >= 20) ||
    (minEndStationPressure !== null && minEndStationPressure < 0) ||
    flowRegimeChanged
  ) {
    return '是（较高）';
  }

  if (
    (sensitivityCoefficient !== null && sensitivityCoefficient >= 0.4) ||
    (maxImpactPercent !== null && maxImpactPercent >= 10)
  ) {
    return '是（中等）';
  }

  return '否（可控）';
}

function buildEfficiencyDisplay(sources: unknown[]) {
  const pumpEfficiency = pickFirstValue(sources, ['pumpEfficiency']);
  const motorEfficiency = pickFirstValue(sources, ['motorEfficiency']);
  const efficiency = pickFirstValue(sources, ['efficiency']);

  const parts: string[] = [];
  if (pumpEfficiency !== undefined) {
    parts.push(`泵效率 ${formatValue(pumpEfficiency)}`);
  }
  if (motorEfficiency !== undefined) {
    parts.push(`电机效率 ${formatValue(motorEfficiency)}`);
  }
  if (!parts.length && efficiency !== undefined) {
    parts.push(formatValue(efficiency));
  }

  return parts.length ? parts.join('；') : '-';
}

function buildSensitiveVariableDisplay(inputPayload: Record<string, unknown> | null, inputBase: Record<string, unknown> | null) {
  const directValue = pickFirstValue([inputPayload, inputBase], [
    'sensitiveVariableType',
    'sensitivityVariableType',
    'variableType',
  ]);

  if (directValue !== undefined) {
    return formatValue(directValue);
  }

  const variables = asRecordArray(getValueByPath(inputPayload, 'variables'));
  if (!variables.length) {
    return '-';
  }

  return variables
    .map((item) => String(item.variableName ?? item.variableType ?? ''))
    .filter(Boolean)
    .join('、') || '-';
}

function hasMeaningfulMetricValue(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === '-' || normalized === '--') {
    return false;
  }

  if (/^起点\s*-\s*\/\s*终点\s*-$/.test(normalized)) {
    return false;
  }

  return true;
}

function filterMetricCards(items: DetailMetricCardItem[]) {
  return items.filter((item) => hasMeaningfulMetricValue(item.value));
}

function getCalcTypeLabel(record: Pick<CalculationHistory, 'calcType' | 'calcTypeName'>) {
  if (record.calcTypeName) {
    return record.calcTypeName;
  }
  if (record.calcType && CALC_TYPE_LABELS[record.calcType]) {
    return CALC_TYPE_LABELS[record.calcType];
  }
  return record.calcType || '未知类型';
}

function isAiReportHistory(record: Pick<CalculationHistory, 'calcType' | 'calcTypeName'>) {
  if (record.calcType && ARCHIVED_REPORT_TYPES.has(record.calcType as ReportType)) {
    return true;
  }

  const typeText = `${record.calcTypeName ?? ''} ${record.calcType ?? ''}`.toUpperCase();
  if (
    typeText.includes('RISK_REVIEW') ||
    typeText.includes('ENERGY_DIAGNOSIS') ||
    typeText.includes('OPERATION_BRIEF')
  ) {
    return true;
  }
  return typeText.includes('REPORT') || typeText.includes('智能报告');
}

function isDynamicReportResponsePayload(value: unknown): value is DynamicReportResponsePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as DynamicReportResponsePayload;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.abstract === 'string' &&
    Array.isArray(candidate.summary) &&
    Array.isArray(candidate.highlights) &&
    Array.isArray(candidate.risks)
  );
}

function extractDynamicReportFromOutput(outputResult?: string) {
  const parsed = parseJson(outputResult);
  if (isDynamicReportResponsePayload(parsed)) {
    return parsed;
  }

  const nestedPayload = asRecord(parsed)?.data;
  return isDynamicReportResponsePayload(nestedPayload) ? nestedPayload : null;
}

function renderSummaryList(items: string[]) {
  if (!items.length) {
    return <Text type="secondary">暂无摘要</Text>;
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {items.map((item, index) => (
        <div key={`${index}-${item}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Tag color="blue" style={{ marginTop: 2 }}>
            {index + 1}
          </Tag>
          <Text>{item}</Text>
        </div>
      ))}
    </Space>
  );
}

function renderHydraulicAiReportContent(report: DynamicReportResponsePayload, snapshot: HydraulicReportSnapshot) {
  const inputSources = [snapshot.input];
  const outputSources = [snapshot.output];
  const startAltitude = toFiniteNumber(pickFirstValue(inputSources, ['startAltitude']));
  const endAltitude = toFiniteNumber(pickFirstValue(inputSources, ['endAltitude']));
  const elevationDiff = startAltitude !== null && endAltitude !== null ? Number((endAltitude - startAltitude).toFixed(2)) : null;

  const headerCards = filterMetricCards([
    { label: '标题', value: report.title || '-', tone: 'blue', span: 6 },
    { label: '项目名', value: snapshot.projectName || '-', tone: 'cyan', span: 6 },
    { label: '生成时间', value: formatTime(snapshot.generatedAt ?? undefined), tone: 'green', span: 6 },
    { label: '分析类型', value: '水力分析', tone: 'purple', span: 6 },
  ]);

  const parameterCards = filterMetricCards([
    { label: '流量', value: formatValue(pickFirstValue(inputSources, ['flowRate']), 'm³/h'), tone: 'blue' },
    { label: '密度', value: formatValue(pickFirstValue(inputSources, ['density']), 'kg/m³'), tone: 'cyan' },
    { label: '粘度', value: formatValue(pickFirstValue(inputSources, ['viscosity'])), tone: 'green' },
    { label: '长度', value: formatValue(pickFirstValue(inputSources, ['length']), 'km'), tone: 'amber' },
    { label: '管径', value: formatValue(pickFirstValue(inputSources, ['diameter']), 'mm'), tone: 'purple' },
    { label: '粗糙度', value: formatValue(pickFirstValue(inputSources, ['roughness'])), tone: 'blue' },
    {
      label: '高程',
      value: `起点 ${formatValue(pickFirstValue(inputSources, ['startAltitude']), 'm')} / 终点 ${formatValue(pickFirstValue(inputSources, ['endAltitude']), 'm')}`,
      tone: 'green',
      span: 12,
    },
    { label: '泵参数', value: buildPumpDisplay(inputSources), tone: 'amber', span: 12 },
  ]);

  const resultCards = filterMetricCards([
    { label: '雷诺数', value: formatValue(pickFirstValue(outputSources, ['reynoldsNumber'])), tone: 'blue' },
    { label: '流态', value: formatValue(pickFirstValue(outputSources, ['flowRegime'])), tone: 'cyan' },
    { label: '摩阻损失', value: formatValue(pickFirstValue(outputSources, ['frictionHeadLoss']), 'm'), tone: 'green' },
    { label: '水力坡降', value: formatValue(pickFirstValue(outputSources, ['hydraulicSlope'])), tone: 'amber' },
    { label: '总扬程', value: formatValue(pickFirstValue(outputSources, ['totalHead']), 'm'), tone: 'purple' },
    { label: '末站进站压头', value: formatValue(pickFirstValue(outputSources, ['endStationInPressure', 'endStationPressure']), 'm'), tone: 'blue' },
  ]);

  const headChangeChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['首站进站压头', '首站出站压头', '末站进站压头'],
    },
    yAxis: {
      type: 'value',
      name: '压头 / 扬程 (m)',
    },
    series: [
      {
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.16 },
        data: [
          toFiniteNumber(pickFirstValue(inputSources, ['inletPressure'])),
          toFiniteNumber(pickFirstValue(outputSources, ['firstStationOutPressure'])),
          toFiniteNumber(pickFirstValue(outputSources, ['endStationInPressure', 'endStationPressure'])),
        ],
      },
    ],
  };

  const headCompositionChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['摩阻损失', '高程差', '总扬程', '末站进站压头'],
    },
    yAxis: {
      type: 'value',
      name: 'm',
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: '#5b8ff9',
        },
        data: [
          toFiniteNumber(pickFirstValue(outputSources, ['frictionHeadLoss'])),
          elevationDiff,
          toFiniteNumber(pickFirstValue(outputSources, ['totalHead'])),
          toFiniteNumber(pickFirstValue(outputSources, ['endStationInPressure', 'endStationPressure'])),
        ],
      },
    ],
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="报告头">
        {renderDetailMetricCards(headerCards, {
          equalWidth: true,
          singleLine: true,
          compact: true,
          minColumnWidth: 180,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="参数表">
        {renderDetailMetricCards(parameterCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 220,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="结果卡片">
        {renderDetailMetricCards(resultCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 180,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="图表">
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card size="small" title="压头变化图">
              <Chart option={headChangeChartOption} height={320} />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card size="small" title="扬程构成图">
              <Chart option={headCompositionChartOption} height={320} />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="AI分析">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="结果摘要">
            {renderSummaryList(report.summary)}
          </Card>

          <Card size="small" title="指标分析">
            {renderSummaryList(report.highlights)}
          </Card>

          <Card size="small" title="风险判断">
            {report.risks.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.risks.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="red">{item.level}</Tag>
                      <Text strong>{item.target}</Text>
                      <Text>{item.riskType}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无风险判断</Text>
            )}
          </Card>

          <Card size="small" title="运行建议">
            {report.suggestions.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.suggestions.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="blue">{item.priority}</Tag>
                      <Text strong>{item.target}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>
                      {item.action}。原因：{item.reason}。预期：{item.expected}
                    </Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无运行建议</Text>
            )}
          </Card>

          <Alert
            type="info"
            showIcon
            message="最重要的一句话"
            description={
              report.conclusion ||
              '用真实水力计算结果做基础，用图表展示压头和扬程变化，再由 AI 对雷诺数、流态、摩阻损失、总扬程和首末站压头给出解释、判断和建议。'
            }
          />
        </Space>
      </Card>
    </Space>
  );
}

void renderHydraulicAiReportContent;

function renderHydraulicAiReportContentV2(report: DynamicReportResponsePayload, snapshot: HydraulicReportSnapshot) {
  const inputSources = [snapshot.input];
  const outputSources = [snapshot.output];
  const startAltitude = toFiniteNumber(pickFirstValue(inputSources, ['startAltitude']));
  const endAltitude = toFiniteNumber(pickFirstValue(inputSources, ['endAltitude']));
  const elevationDiff = startAltitude !== null && endAltitude !== null ? Number((endAltitude - startAltitude).toFixed(2)) : null;
  const summaryItems = report.summary.length ? report.summary : [report.conclusion || report.abstract || HYDRAULIC_REPORT_CORE_SENTENCE];
  const highlightItems = report.highlights.length ? report.highlights : [report.abstract || HYDRAULIC_REPORT_CORE_SENTENCE];

  const headerCards = filterMetricCards([
    { label: '标题', value: report.title || '-', tone: 'blue', span: 6 },
    { label: '项目名', value: snapshot.projectName || '-', tone: 'cyan', span: 6 },
    { label: '生成时间', value: formatTime(snapshot.generatedAt ?? undefined), tone: 'green', span: 6 },
    { label: '分析类型', value: '水力分析', tone: 'purple', span: 6 },
  ]);

  const parameterCards = filterMetricCards([
    { label: '流量', value: formatValue(pickFirstValue(inputSources, ['flowRate']), 'm³/h'), tone: 'blue' },
    { label: '密度', value: formatValue(pickFirstValue(inputSources, ['density']), 'kg/m³'), tone: 'cyan' },
    { label: '粘度', value: formatValue(pickFirstValue(inputSources, ['viscosity'])), tone: 'green' },
    { label: '长度', value: formatValue(pickFirstValue(inputSources, ['length']), 'km'), tone: 'amber' },
    { label: '管径', value: formatValue(pickFirstValue(inputSources, ['diameter']), 'mm'), tone: 'purple' },
    { label: '粗糙度', value: formatValue(pickFirstValue(inputSources, ['roughness'])), tone: 'blue' },
    { label: '高程', value: buildHydraulicElevationDisplay(inputSources), tone: 'green', span: 12 },
    { label: '泵参数', value: buildHydraulicPumpParameterDisplay(inputSources), tone: 'amber', span: 12 },
  ]);

  const resultCards = filterMetricCards([
    { label: '雷诺数', value: formatValue(pickFirstValue(outputSources, ['reynoldsNumber'])), tone: 'blue' },
    { label: '流态', value: formatValue(pickFirstValue(outputSources, ['flowRegime'])), tone: 'cyan' },
    { label: '摩阻损失', value: formatValue(pickFirstValue(outputSources, ['frictionHeadLoss']), 'm'), tone: 'green' },
    { label: '水力坡降', value: formatValue(pickFirstValue(outputSources, ['hydraulicSlope'])), tone: 'amber' },
    { label: '总扬程', value: formatValue(pickFirstValue(outputSources, ['totalHead']), 'm'), tone: 'purple' },
    { label: '末站进站压头', value: formatValue(pickFirstValue(outputSources, ['endStationInPressure', 'endStationPressure']), 'm'), tone: 'blue' },
  ]);

  const headChangeChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['首站进站压头', '首站出站压头', '末站进站压头'],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      name: '压头 / 扬程 (m)',
      nameTextStyle: { color: '#64748b' },
      axisLine: { show: false },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbolSize: 10,
        lineStyle: { width: 3, color: '#4e86f7' },
        itemStyle: { color: '#4e86f7' },
        areaStyle: { color: 'rgba(78, 134, 247, 0.16)' },
        data: [
          toFiniteNumber(pickFirstValue(inputSources, ['inletPressure'])),
          toFiniteNumber(pickFirstValue(outputSources, ['firstStationOutPressure'])),
          toFiniteNumber(pickFirstValue(outputSources, ['endStationInPressure', 'endStationPressure'])),
        ],
      },
    ],
  };

  const headCompositionChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['摩阻损失', '高程差', '总扬程', '末站进站压头'],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      name: 'm',
      nameTextStyle: { color: '#64748b' },
      axisLine: { show: false },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: '#7c6cff',
        },
        data: [
          toFiniteNumber(pickFirstValue(outputSources, ['frictionHeadLoss'])),
          elevationDiff,
          toFiniteNumber(pickFirstValue(outputSources, ['totalHead'])),
          toFiniteNumber(pickFirstValue(outputSources, ['endStationInPressure', 'endStationPressure'])),
        ],
      },
    ],
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="报告头">
        {renderDetailMetricCards(headerCards, {
          equalWidth: true,
          singleLine: true,
          compact: true,
          minColumnWidth: 180,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="参数表">
        {renderDetailMetricCards(parameterCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 220,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="结果卡片">
        {renderDetailMetricCards(resultCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 180,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="图表">
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card size="small" title="压头变化图">
              <Chart option={headChangeChartOption} height={320} />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card size="small" title="扬程构成图">
              <Chart option={headCompositionChartOption} height={320} />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="AI分析">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="结果摘要">
            {renderSummaryList(summaryItems)}
          </Card>

          <Card size="small" title="指标分析">
            {renderSummaryList(highlightItems)}
          </Card>

          <Card size="small" title="风险判断">
            {report.risks.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.risks.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="red">{item.level}</Tag>
                      <Text strong>{item.target}</Text>
                      <Text>{item.riskType}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无风险判断</Text>
            )}
          </Card>

          <Card size="small" title="运行建议">
            {report.suggestions.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.suggestions.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="blue">{item.priority}</Tag>
                      <Text strong>{item.target}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>
                      {item.action}。原因：{item.reason}。预期：{item.expected}
                    </Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无运行建议</Text>
            )}
          </Card>
        </Space>
      </Card>
    </Space>
  );
}

function renderOptimizationAiReportContentV2(
  report: DynamicReportResponsePayload,
  snapshot: OptimizationReportSnapshot,
) {
  const outputSources = [snapshot.output];
  const projectName = snapshot.projectName || '当前项目';
  const generatedAt = formatTime(snapshot.generatedAt ?? undefined);
  const recommendedCombination = buildOptimizationPumpCombination(outputSources);
  const totalHead = toFiniteNumber(pickFirstValue(outputSources, ['totalHead']));
  const totalPressureDrop = toFiniteNumber(pickFirstValue(outputSources, ['totalPressureDrop', 'pressureDrop']));
  const endStationInPressure = toFiniteNumber(
    pickFirstValue(outputSources, ['endStationInPressure', 'terminalInPressure']),
  );
  const totalEnergyConsumption = toFiniteNumber(
    pickFirstValue(outputSources, ['totalEnergyConsumption', 'annualEnergyConsumption', 'energyConsumption']),
  );
  const totalCost = toFiniteNumber(pickFirstValue(outputSources, ['totalCost', 'annualCost']));
  const isFeasibleValue = pickFirstValue(outputSources, ['isFeasible', 'feasible']);
  const isFeasible = typeof isFeasibleValue === 'boolean' ? isFeasibleValue : null;
  const feasibilityText =
    isFeasible === null ? '当前数据不足以支持进一步判断' : isFeasible ? '可行' : '不可行';
  const recommendationText =
    formatValue(pickFirstValue(outputSources, ['description', 'recommendation', 'remark'])) || '当前数据不足以支持进一步判断';
  const currentCondition = buildOptimizationCurrentCondition(snapshot.input);
  const displayTitle =
    report.title && report.title.includes('优化')
      ? report.title
      : `${projectName}泵站运行优化分析报告`;
  const displayDescription =
    report.abstract ||
    '本报告基于当前项目泵站优化计算结果自动生成，主要针对推荐泵组合方案的扬程匹配情况、末站压头保障能力、能耗水平、运行成本及整体可行性进行分析，为泵站运行调度和方案选择提供参考。';

  const summaryItems = report.summary.length
    ? report.summary
    : [
        `本次泵站优化分析基于当前工况参数，对系统运行所需扬程、压降、末站压力以及能耗成本进行了综合评估。`,
        `结果显示，系统推荐泵组合为 ${recommendedCombination}，对应总扬程为 ${formatValue(totalHead, 'm')}，总压降为 ${formatValue(totalPressureDrop, 'm')}，末站进站压头为 ${formatValue(endStationInPressure, 'm')}，方案可行性判定为 ${feasibilityText}。`,
        `同时，该方案年能耗为 ${formatValue(totalEnergyConsumption, 'kWh')}，总成本为 ${formatValue(totalCost, '元')}。整体来看，当前推荐方案能够在满足运行要求的基础上兼顾一定的经济性与实施可行性。`,
      ];

  const keyFindingItems = report.highlights.length
    ? report.highlights
    : [
        `推荐泵组合为 ${recommendedCombination}，反映了系统在当前工况下所需的设备配置水平。`,
        `总扬程 ${formatValue(totalHead, 'm')} 与总压降 ${formatValue(totalPressureDrop, 'm')} 共同决定了推荐方案需要覆盖的能量需求与损失水平。`,
        `末站进站压头为 ${formatValue(endStationInPressure, 'm')}，该指标用于衡量推荐方案对末端压力的保障能力。`,
        `推荐说明为：${recommendationText}。该说明直接反映了当前方案被选中的主要依据。`,
      ];

  const riskFallbackItems = [
    isFeasible === false ? '当前方案可行性不足，说明推荐泵组合无法完全满足系统在当前工况下的运行需求。' : null,
    endStationInPressure !== null && endStationInPressure < 10
      ? '当前推荐方案下末站进站压头偏低，说明系统末端压力裕量有限，后续在工况波动下可能存在风险。'
      : null,
    totalHead !== null && totalHead >= 100
      ? '当前工况下总扬程需求较高，说明泵站需要持续提供较大能量输出，设备可能长期处于较高负荷。'
      : null,
    totalPressureDrop !== null && totalPressureDrop >= 20
      ? '当前总压降较大，说明输送过程中的能量损耗较明显，可能增加泵站负荷并影响运行经济性。'
      : null,
    totalEnergyConsumption !== null && totalEnergyConsumption >= 1000000
      ? '当前推荐方案年能耗较高，长期运行的电力消耗水平较大，可能放大运行成本压力。'
      : null,
    totalCost !== null && totalCost >= 800000
      ? '当前方案总成本偏高，说明虽然方案可能满足技术运行要求，但长期运行经济压力较大。'
      : null,
    !report.risks.length && isFeasible !== false && (endStationInPressure === null || endStationInPressure >= 10)
      ? '综合当前优化结果，推荐方案在扬程匹配、末站压力保障及运行经济性方面整体表现较为稳定，暂未发现明显异常风险。'
      : null,
  ].filter((item): item is string => Boolean(item));

  const suggestionFallbackItems = [
    endStationInPressure !== null && endStationInPressure < 10
      ? '建议进一步校核泵站扬程配置与首站运行参数，必要时通过调整泵组合或优化工况提高末端压力保障能力。'
      : null,
    totalHead !== null && totalHead >= 100
      ? '对于总扬程需求较高的工况，建议重点关注设备实际输出能力与长期稳定运行表现。'
      : null,
    totalPressureDrop !== null && totalPressureDrop >= 20
      ? '建议结合流量、管径、粘度及管道条件进一步分析阻力来源，为降低输送损失提供依据。'
      : null,
    totalEnergyConsumption !== null && totalEnergyConsumption >= 1000000
      ? '建议从泵组合选择、运行时长安排及设备效率等方面进一步优化，以降低长期能源消耗。'
      : null,
    totalCost !== null && totalCost >= 800000
      ? '建议在保证可行性的前提下，对比不同运行方案的能耗与成本表现，优先选择经济性更优的方案。'
      : null,
    '建议将泵站优化结果与水力分析和敏感性分析结果结合使用，在技术满足性、经济合理性和运行稳定性之间进行综合平衡。',
  ].filter((item): item is string => Boolean(item));

  const basicInfoCards = filterMetricCards([
    { label: '项目名称', value: projectName, tone: 'blue', span: 6 },
    { label: '分析类型', value: '泵站优化', tone: 'purple', span: 6 },
    { label: '生成时间', value: generatedAt, tone: 'green', span: 6 },
    { label: '数据来源', value: '系统优化结果', tone: 'amber', span: 6 },
    { label: '当前工况说明', value: currentCondition, tone: 'cyan', span: 12 },
  ]);

  const coreResultCards = filterMetricCards([
    { label: '推荐泵组合', value: recommendedCombination, tone: 'purple', span: 8 },
    { label: '总扬程', value: formatValue(totalHead, 'm'), tone: 'blue', span: 4 },
    { label: '总压降', value: formatValue(totalPressureDrop, 'm'), tone: 'cyan', span: 4 },
    { label: '末站进站压头', value: formatValue(endStationInPressure, 'm'), tone: 'green', span: 4 },
    { label: '可行性', value: feasibilityText, tone: isFeasible === false ? 'amber' : 'green', span: 4 },
    { label: '年能耗', value: formatValue(totalEnergyConsumption, 'kWh'), tone: 'blue', span: 4 },
    { label: '总成本', value: formatValue(totalCost, '元'), tone: 'amber', span: 4 },
  ]);

  const coreMetricsChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['总扬程', '总压降', '末站进站压头'],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      name: 'm',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        itemStyle: { color: '#4e86f7', borderRadius: [10, 10, 0, 0] },
        data: [totalHead, totalPressureDrop, endStationInPressure],
      },
    ],
  };

  const energyCostChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 48, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['年能耗', '总成本'],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'kWh',
        axisLabel: { color: '#64748b' },
        nameTextStyle: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      {
        type: 'value',
        name: '元',
        axisLabel: { color: '#64748b' },
        nameTextStyle: { color: '#64748b' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '年能耗',
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: { color: '#12b981', borderRadius: [10, 10, 0, 0] },
        data: [totalEnergyConsumption, null],
      },
      {
        name: '总成本',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 36,
        itemStyle: { color: '#f59e0b', borderRadius: [10, 10, 0, 0] },
        data: [null, totalCost],
      },
    ],
  };

  const schemeChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['480泵台数', '375泵台数', '可行性'],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      name: '值',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        itemStyle: { color: '#7c6cff', borderRadius: [10, 10, 0, 0] },
        data: [
          toFiniteNumber(pickFirstValue(outputSources, ['pump480Num'])),
          toFiniteNumber(pickFirstValue(outputSources, ['pump375Num'])),
          isFeasible === null ? null : isFeasible ? 1 : 0,
        ],
      },
    ],
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>
          {displayTitle}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {displayDescription}
        </Paragraph>
      </div>

      <Card size="small" title="基本信息">
        {renderDetailMetricCards(basicInfoCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 220,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="核心结果卡片">
        {renderDetailMetricCards(coreResultCards, {
          minColumnWidth: 190,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="图表分析区">
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card size="small" title="推荐方案核心指标图">
              <Chart option={coreMetricsChartOption} height={300} />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card size="small" title="能耗与成本图">
              <Chart option={energyCostChartOption} height={300} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card size="small" title="泵组合说明图">
              <Chart option={schemeChartOption} height={280} />
              <Paragraph style={{ margin: '12px 0 0' }} type="secondary">
                推荐说明：{recommendationText}
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="智能分析正文">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="结果摘要">
            {renderSummaryList(summaryItems)}
          </Card>

          <Card size="small" title="关键指标分析">
            {renderSummaryList(keyFindingItems)}
          </Card>

          <Card size="small" title="风险识别">
            {report.risks.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.risks.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="red">{item.level}</Tag>
                      <Text strong>{item.target}</Text>
                      <Text>{item.riskType}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              renderSummaryList(riskFallbackItems.length ? riskFallbackItems : ['当前数据不足以支持进一步判断。'])
            )}
          </Card>

          <Card size="small" title="优化建议">
            {report.suggestions.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.suggestions.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="blue">{item.priority}</Tag>
                      <Text strong>{item.target}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>
                      {item.action}。原因：{item.reason}。预期：{item.expected}
                    </Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              renderSummaryList(suggestionFallbackItems)
            )}
          </Card>
        </Space>
      </Card>
    </Space>
  );
}

function renderSensitivityAiReportContent(report: DynamicReportResponsePayload, snapshot: SensitivityReportSnapshot) {
  const inputPayload = snapshot.input;
  const inputBase = asRecord(getValueByPath(inputPayload, 'baseParams')) ?? inputPayload;
  const outputPayload = snapshot.output;
  const baseResult = asRecord(getValueByPath(outputPayload, 'baseResult')) ?? outputPayload;
  const variableResults = asRecordArray(getValueByPath(outputPayload, 'variableResults'));
  const rankingRows = toSortedSensitivityRankingRows(outputPayload);
  const primaryVariableResult = getSensitivityPrimaryVariableResult(outputPayload);
  const topRank = rankingRows[0];
  const topVariableName = String(
    topRank?.variableName ??
      primaryVariableResult?.variableName ??
      primaryVariableResult?.variableType ??
      buildSensitiveVariableDisplay(inputPayload, inputBase),
  );
  const topRankNumber = toFiniteNumber(topRank?.rank) ?? 1;
  const sensitivityCoefficient = toFiniteNumber(
    topRank?.sensitivityCoefficient ?? primaryVariableResult?.sensitivityCoefficient,
  );
  const maxImpactPercent =
    toFiniteNumber(primaryVariableResult?.maxImpactPercent) ??
    variableResults.reduce<number | null>((current, item) => {
      const next = toFiniteNumber(item.maxImpactPercent);
      if (next === null) {
        return current;
      }
      if (current === null) {
        return next;
      }
      return Math.max(current, next);
    }, null);
  const pointRows = asRecordArray(primaryVariableResult?.dataPoints).sort((a, b) => {
    const changeA = toFiniteNumber(a.changePercent) ?? 0;
    const changeB = toFiniteNumber(b.changePercent) ?? 0;
    return changeA - changeB;
  });
  const firstPoint = pointRows[0];
  const lastPoint = pointRows[pointRows.length - 1];
  const flowRegimeValues = pointRows
    .map((item) => formatValue(item.flowRegime))
    .filter((item) => item && item !== '-');
  const flowRegimeChanged = new Set(flowRegimeValues).size > 1;
  const minEndStationPressure = pointRows.reduce<number | null>((current, item) => {
    const next = toFiniteNumber(item.endStationPressure);
    if (next === null) {
      return current;
    }
    if (current === null) {
      return next;
    }
    return Math.min(current, next);
  }, null);
  const baseEndStationPressure = toFiniteNumber(
    pickFirstValue([baseResult], ['endStationInPressure', 'endStationPressure', 'terminalInPressure']),
  );
  const baseResultStatus =
    baseEndStationPressure === null
      ? '当前数据不足以支持进一步判断'
      : baseEndStationPressure >= 0
        ? '正常'
        : '存在压力风险';
  const riskLevel = evaluateSensitivityRiskLevel({
    sensitivityCoefficient,
    maxImpactPercent,
    minEndStationPressure,
    flowRegimeChanged,
  });
  const sensitivityImpactLevel = classifySensitivityImpactLevel(sensitivityCoefficient);
  const projectName = snapshot.projectName || '当前项目';
  const displayTitle =
    report.title && report.title.includes('敏感')
      ? report.title
      : `${projectName}关键变量敏感性分析报告`;
  const displayDescription =
    report.abstract ||
    '本报告基于当前项目敏感性分析计算结果自动生成，主要针对所选敏感变量变化对系统运行结果的影响程度进行分析，重点评估不同变化比例下压力、摩阻损失及流态变化情况，并识别对系统运行影响最显著的关键变量。';
  const baseCondition = buildSensitivityBaseCondition(inputPayload, inputBase);
  const variableTypeText = buildSensitiveVariableDisplay(inputPayload, inputBase);

  const pressureTrendText =
    firstPoint && lastPoint
      ? toFiniteNumber(lastPoint.endStationPressure) !== null && toFiniteNumber(firstPoint.endStationPressure) !== null
        ? (toFiniteNumber(lastPoint.endStationPressure) ?? 0) > (toFiniteNumber(firstPoint.endStationPressure) ?? 0)
          ? '整体上升'
          : (toFiniteNumber(lastPoint.endStationPressure) ?? 0) < (toFiniteNumber(firstPoint.endStationPressure) ?? 0)
            ? '整体下降'
            : '变化不明显'
        : '当前数据不足以支持进一步判断'
      : '当前数据不足以支持进一步判断';
  const frictionTrendText =
    firstPoint && lastPoint
      ? toFiniteNumber(lastPoint.frictionHeadLoss) !== null && toFiniteNumber(firstPoint.frictionHeadLoss) !== null
        ? (toFiniteNumber(lastPoint.frictionHeadLoss) ?? 0) > (toFiniteNumber(firstPoint.frictionHeadLoss) ?? 0)
          ? '整体上升'
          : (toFiniteNumber(lastPoint.frictionHeadLoss) ?? 0) < (toFiniteNumber(firstPoint.frictionHeadLoss) ?? 0)
            ? '整体下降'
            : '变化不明显'
        : '当前数据不足以支持进一步判断'
      : '当前数据不足以支持进一步判断';

  const basicInfoCards = filterMetricCards([
    { label: '项目名称', value: projectName, tone: 'blue', span: 6 },
    { label: '分析类型', value: '敏感性分析', tone: 'purple', span: 6 },
    { label: '敏感变量类型', value: variableTypeText, tone: 'cyan', span: 6 },
    { label: '基准工况', value: baseCondition, tone: 'green', span: 12 },
    { label: '生成时间', value: formatTime(snapshot.generatedAt ?? undefined), tone: 'amber', span: 6 },
  ]);

  const coreResultCards = filterMetricCards([
    { label: '基准结果', value: baseResultStatus, tone: 'blue', span: 4 },
    { label: '最敏感变量', value: topVariableName || '-', tone: 'purple', span: 4 },
    { label: '敏感系数', value: formatValue(sensitivityCoefficient), tone: 'cyan', span: 4 },
    { label: '最大影响幅度', value: formatValue(maxImpactPercent, '%'), tone: 'amber', span: 4 },
    { label: '影响排名第 1 名', value: topVariableName || '-', tone: 'green', span: 4 },
    { label: '是否存在明显波动风险', value: riskLevel, tone: 'purple', span: 4 },
  ]);

  const summaryItems = report.summary.length
    ? report.summary
    : [
        `本次敏感性分析以 ${topVariableName} 作为敏感变量，基准工况下系统结果为 ${baseResultStatus}。`,
        `当前变量的敏感系数为 ${formatValue(sensitivityCoefficient)}，最大影响幅度为 ${formatValue(maxImpactPercent, '%')}，在影响程度排序中位列第 ${topRankNumber} 位。`,
        `整体来看，该变量对系统运行结果具有 ${sensitivityImpactLevel} 影响，是评估系统稳定性的重要因素之一。`,
      ];
  const keyFindingItems = report.highlights.length
    ? report.highlights
    : [
        `基准工况为 ${baseCondition}，可作为后续比较不同变化比例结果的参考基础。`,
        `${topVariableName} 的敏感系数为 ${formatValue(sensitivityCoefficient)}，属于${sensitivityImpactLevel}影响，应作为后续运行控制重点关注的参数。`,
        `随着 ${topVariableName} 变化，末站进站压力 ${pressureTrendText}，摩阻损失 ${frictionTrendText}。`,
        flowRegimeChanged ? '不同变化比例下流态发生变化，说明系统存在明显运行状态切换风险。' : '不同变化比例下流态整体稳定，暂未出现明显流态切换。',
      ];
  const riskFallbackItems = [
    sensitivityCoefficient !== null && sensitivityCoefficient >= 0.8
      ? '当前变量敏感系数较高，系统对该变量变化反应明显，应重点加强监测与控制。'
      : null,
    maxImpactPercent !== null && maxImpactPercent >= 20
      ? '当前变量带来的最大影响幅度较大，说明在设定波动范围内系统结果变化明显，存在较高的不稳定风险。'
      : null,
    minEndStationPressure !== null && minEndStationPressure < 0
      ? '部分变化比例下末站进站压力出现低于 0 的情况，说明系统压力稳定性存在明显风险。'
      : null,
    flowRegimeChanged ? '不同变化比例下流态发生变化，说明变量波动可能改变系统流动特征，应重点关注临界区间。' : null,
  ].filter((item): item is string => Boolean(item));
  const suggestionFallbackItems = [
    `建议将 ${topVariableName} 作为运行控制中的重点监测对象，在实际调度和参数管理中优先保证该变量稳定性。`,
    pressureTrendText !== '变化不明显' && pressureTrendText !== '当前数据不足以支持进一步判断'
      ? '建议进一步校核不同工况下的压力分布情况，确保关键节点压力满足运行要求。'
      : null,
    frictionTrendText !== '变化不明显' && frictionTrendText !== '当前数据不足以支持进一步判断'
      ? '建议结合流量、管径、粘度等参数进一步评估阻力增长原因，为优化运行方案提供依据。'
      : null,
    flowRegimeChanged ? '建议在后续分析中增加流态临界区间校核，避免系统在运行波动中进入不稳定状态。' : null,
  ].filter((item): item is string => Boolean(item));

  const rankingChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 24, top: 24, bottom: 24 },
    xAxis: {
      type: 'value',
      name: '敏感系数',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'category',
      data: rankingRows.map((item) => String(item.variableName ?? item.variableType ?? '-')).reverse(),
      axisLabel: { color: '#475569' },
    },
    series: [
      {
        type: 'bar',
        data: rankingRows.map((item) => toFiniteNumber(item.sensitivityCoefficient)).reverse(),
        barMaxWidth: 24,
        itemStyle: { color: '#7c6cff', borderRadius: [0, 8, 8, 0] },
      },
    ],
  };

  const trendChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['末站进站压力', '摩阻损失'],
      top: 0,
      textStyle: { color: '#64748b' },
    },
    grid: { left: 48, right: 48, top: 48, bottom: 32 },
    xAxis: {
      type: 'category',
      name: '变化比例',
      data: pointRows.map((item) => `${formatValue(item.changePercent)}%`),
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '压力',
        axisLabel: { color: '#64748b' },
        nameTextStyle: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      {
        type: 'value',
        name: '摩阻损失',
        axisLabel: { color: '#64748b' },
        nameTextStyle: { color: '#64748b' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '末站进站压力',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#4e86f7' },
        itemStyle: { color: '#4e86f7' },
        data: pointRows.map((item) => toFiniteNumber(item.endStationPressure)),
      },
      {
        name: '摩阻损失',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#12b981' },
        itemStyle: { color: '#12b981' },
        data: pointRows.map((item) => toFiniteNumber(item.frictionHeadLoss)),
      },
    ],
  };

  const impactChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: variableResults.map((item) => String(item.variableName ?? item.variableType ?? '-')),
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      name: '最大影响幅度 (%)',
      axisLabel: { color: '#64748b' },
      nameTextStyle: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 38,
        itemStyle: { color: '#f59e0b', borderRadius: [8, 8, 0, 0] },
        data: variableResults.map((item) => toFiniteNumber(item.maxImpactPercent)),
      },
    ],
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>
          {displayTitle}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {displayDescription}
        </Paragraph>
      </div>

      <Card size="small" title="基本信息">
        {renderDetailMetricCards(basicInfoCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 220,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="核心结果卡片">
        {renderDetailMetricCards(coreResultCards, {
          equalWidth: true,
          singleLine: true,
          compact: true,
          minColumnWidth: 190,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title="图表分析区">
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card size="small" title="敏感系数排名图">
              <Chart option={rankingChartOption} height={300} />
            </Card>
          </Col>
          <Col xs={24} xl={16}>
            <Card size="small" title="变化比例-结果变化趋势图">
              <Chart option={trendChartOption} height={300} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card size="small" title="最大影响幅度对比图">
              <Chart option={impactChartOption} height={280} />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="智能分析正文">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="结果摘要">
            {renderSummaryList(summaryItems)}
          </Card>

          <Card size="small" title="关键变化分析">
            {renderSummaryList(keyFindingItems)}
          </Card>

          <Card size="small" title="风险识别">
            {report.risks.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.risks.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="red">{item.level}</Tag>
                      <Text strong>{item.target}</Text>
                      <Text>{item.riskType}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
                  </div>
                ))}
              </Space>
            ) : riskFallbackItems.length ? (
              renderSummaryList(riskFallbackItems)
            ) : (
              <Text type="secondary">当前数据不足以支持进一步判断</Text>
            )}
          </Card>

          <Card size="small" title="优化建议">
            {report.suggestions.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.suggestions.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="blue">{item.priority}</Tag>
                      <Text strong>{item.target}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>
                      {item.action}。原因：{item.reason}。预期：{item.expected}
                    </Paragraph>
                  </div>
                ))}
              </Space>
            ) : suggestionFallbackItems.length ? (
              renderSummaryList(suggestionFallbackItems)
            ) : (
              <Text type="secondary">当前数据不足以支持进一步判断</Text>
            )}
          </Card>
        </Space>
      </Card>
    </Space>
  );
}

void renderSensitivityAiReportContent;

function renderSensitivityAiReportContentV2(
  report: DynamicReportResponsePayload,
  snapshot: SensitivityReportSnapshot,
) {
  const inputPayload = snapshot.input;
  const inputBase = asRecord(getValueByPath(inputPayload, 'baseParams')) ?? inputPayload;
  const outputPayload = snapshot.output;
  const baseResult = asRecord(getValueByPath(outputPayload, 'baseResult')) ?? outputPayload;
  const variableResults = asRecordArray(getValueByPath(outputPayload, 'variableResults'));
  const rankingRows = toSortedSensitivityRankingRows(outputPayload);
  const primaryVariableResult = getSensitivityPrimaryVariableResult(outputPayload);
  const topRank = rankingRows[0];
  const topVariableName = String(
    topRank?.variableName ??
      primaryVariableResult?.variableName ??
      primaryVariableResult?.variableType ??
      buildSensitiveVariableDisplay(inputPayload, inputBase),
  );
  const topRankNumber = toFiniteNumber(topRank?.rank) ?? 1;
  const sensitivityCoefficient = toFiniteNumber(
    topRank?.sensitivityCoefficient ?? primaryVariableResult?.sensitivityCoefficient,
  );
  const maxImpactPercent =
    toFiniteNumber(primaryVariableResult?.maxImpactPercent) ??
    variableResults.reduce<number | null>((current, item) => {
      const next = toFiniteNumber(item.maxImpactPercent);
      if (next === null) {
        return current;
      }
      if (current === null) {
        return next;
      }
      return Math.max(current, next);
    }, null);
  const pointRows = asRecordArray(primaryVariableResult?.dataPoints).sort((a, b) => {
    const changeA = toFiniteNumber(a.changePercent) ?? 0;
    const changeB = toFiniteNumber(b.changePercent) ?? 0;
    return changeA - changeB;
  });
  const firstPoint = pointRows[0];
  const lastPoint = pointRows[pointRows.length - 1];
  const flowRegimeValues = pointRows
    .map((item) => formatValue(item.flowRegime))
    .filter((item) => item && item !== '-');
  const flowRegimeChanged = new Set(flowRegimeValues).size > 1;
  const minEndStationPressure = pointRows.reduce<number | null>((current, item) => {
    const next = toFiniteNumber(item.endStationPressure);
    if (next === null) {
      return current;
    }
    if (current === null) {
      return next;
    }
    return Math.min(current, next);
  }, null);
  const baseEndStationPressure = toFiniteNumber(
    pickFirstValue([baseResult], ['endStationInPressure', 'endStationPressure', 'terminalInPressure']),
  );
  const baseResultStatus =
    baseEndStationPressure === null ? '当前数据不足以支持进一步判断' : baseEndStationPressure >= 0 ? '正常' : '存在压力风险';
  const riskLevel = evaluateSensitivityRiskLevel({
    sensitivityCoefficient,
    maxImpactPercent,
    minEndStationPressure,
    flowRegimeChanged,
  });
  const sensitivityImpactLevel = classifySensitivityImpactLevel(sensitivityCoefficient);
  const projectName = snapshot.projectName || '当前项目';
  const displayTitle =
    report.title && report.title.includes('敏感')
      ? report.title
      : `${projectName}关键变量敏感性分析报告`;
  const displayDescription = report.abstract || SENSITIVITY_REPORT_PAGE_COPY.defaultDescription;
  const baseCondition = buildSensitivityBaseCondition(inputPayload, inputBase);
  const variableTypeText = buildSensitiveVariableDisplay(inputPayload, inputBase);

  const pressureTrendText =
    firstPoint && lastPoint
      ? toFiniteNumber(lastPoint.endStationPressure) !== null && toFiniteNumber(firstPoint.endStationPressure) !== null
        ? (toFiniteNumber(lastPoint.endStationPressure) ?? 0) > (toFiniteNumber(firstPoint.endStationPressure) ?? 0)
          ? '整体上升'
          : (toFiniteNumber(lastPoint.endStationPressure) ?? 0) < (toFiniteNumber(firstPoint.endStationPressure) ?? 0)
            ? '整体下降'
            : '变化不明显'
        : '当前数据不足以支持进一步判断'
      : '当前数据不足以支持进一步判断';
  const frictionTrendText =
    firstPoint && lastPoint
      ? toFiniteNumber(lastPoint.frictionHeadLoss) !== null && toFiniteNumber(firstPoint.frictionHeadLoss) !== null
        ? (toFiniteNumber(lastPoint.frictionHeadLoss) ?? 0) > (toFiniteNumber(firstPoint.frictionHeadLoss) ?? 0)
          ? '整体上升'
          : (toFiniteNumber(lastPoint.frictionHeadLoss) ?? 0) < (toFiniteNumber(firstPoint.frictionHeadLoss) ?? 0)
            ? '整体下降'
            : '变化不明显'
        : '当前数据不足以支持进一步判断'
      : '当前数据不足以支持进一步判断';

  const summaryItems = report.summary.length
    ? report.summary
    : [
        `本次敏感性分析以 ${topVariableName} 作为敏感变量，基准工况下系统结果为 ${baseResultStatus}。`,
        `当前变量的敏感系数为 ${formatValue(sensitivityCoefficient)}，最大影响幅度为 ${formatValue(maxImpactPercent, '%')}，在影响程度排序中位列第 ${topRankNumber} 位。`,
        `整体来看，该变量对系统运行结果具有 ${sensitivityImpactLevel} 影响，是评估系统稳定性的重要因素之一。`,
      ];
  const keyFindingItems = report.highlights.length
    ? report.highlights
    : [
        `基准工况为 ${baseCondition}，可作为比较不同变化比例结果的参考基础。`,
        `${topVariableName} 的敏感系数为 ${formatValue(sensitivityCoefficient)}，属于${sensitivityImpactLevel}影响，应作为后续运行控制重点关注的参数。`,
        `随着 ${topVariableName} 变化，末站进站压力${pressureTrendText}，摩阻损失${frictionTrendText}。`,
        flowRegimeChanged
          ? '不同变化比例下流态发生变化，说明系统存在明显运行状态切换风险。'
          : '不同变化比例下流态整体稳定，暂未出现明显流态切换。',
      ];
  const riskFallbackItems = [
    sensitivityCoefficient !== null && sensitivityCoefficient >= 0.8
      ? '当前变量敏感系数较高，系统对该变量变化反应明显，应重点加强监测与控制。'
      : null,
    maxImpactPercent !== null && maxImpactPercent >= 20
      ? '当前变量带来的最大影响幅度较大，说明在设定波动范围内系统结果变化明显，存在较高的不稳定风险。'
      : null,
    minEndStationPressure !== null && minEndStationPressure < 0
      ? '部分变化比例下末站进站压力低于 0，说明系统压力稳定性存在明显风险。'
      : null,
    flowRegimeChanged ? '不同变化比例下流态发生变化，变量波动可能改变系统流动特征，应重点关注临界区间。' : null,
  ].filter((item): item is string => Boolean(item));
  const suggestionFallbackItems = [
    `建议将 ${topVariableName} 作为运行控制中的重点监测对象，在实际调度和参数管理中优先保证该变量稳定。`,
    pressureTrendText !== '变化不明显' && pressureTrendText !== '当前数据不足以支持进一步判断'
      ? '建议进一步校核不同工况下的压力分布情况，确保关键节点压力满足运行要求。'
      : null,
    frictionTrendText !== '变化不明显' && frictionTrendText !== '当前数据不足以支持进一步判断'
      ? '建议结合流量、管径、粘度等参数进一步评估阻力增长原因，为优化运行方案提供依据。'
      : null,
    flowRegimeChanged ? '建议在后续分析中增加流态临界区间校核，避免系统在运行波动中进入不稳定状态。' : null,
  ].filter((item): item is string => Boolean(item));

  const reportViewModel: SensitivitySmartReportPayload = {
    title: displayTitle,
    description: displayDescription,
    basicInfo: {
      projectName,
      analysisType: '敏感性分析',
      sensitiveVariableType: variableTypeText,
      baseCondition,
      generatedAt: formatTime(snapshot.generatedAt ?? undefined),
    },
    resultCards: {
      baseResult: baseResultStatus,
      mostSensitiveVariable: topVariableName || '-',
      sensitivityCoefficient: formatValue(sensitivityCoefficient),
      maxImpactPercent: formatValue(maxImpactPercent, '%'),
      impactRanking: `第 ${topRankNumber} 名`,
      riskLevel,
    },
    chartMeta: {
      sensitivityRanking: {
        title: '敏感系数排名图',
        chartType: 'bar-horizontal',
        xField: 'sensitivityCoefficient',
        yFields: ['variableName'],
        description: '展示不同变量的敏感系数，并按影响强弱排序。',
      },
      changeTrend: {
        title: '变化比例-结果变化趋势图',
        chartType: 'line',
        xField: 'changeRateLabel',
        yFields: ['pressure', 'frictionLoss'],
        description: '展示不同变化比例下末站压力与摩阻损失的变化趋势。',
      },
      maxImpact: {
        title: '最大影响幅度对比图',
        chartType: 'bar',
        xField: 'variableName',
        yFields: ['maxImpactPercent'],
        description: '对比各敏感变量带来的最大影响幅度。',
      },
    },
    rankingData: rankingRows.map((item) => ({
      rank: toFiniteNumber(item.rank) ?? 0,
      variableName: String(item.variableName ?? item.variableType ?? '-'),
      sensitivityCoefficient: toFiniteNumber(item.sensitivityCoefficient),
      description: String(item.description ?? ''),
    })),
    trendData: pointRows.map((item) => ({
      changeRateLabel: `${formatValue(item.changePercent)}%`,
      changeRateValue: toFiniteNumber(item.changePercent) ?? 0,
      pressure: toFiniteNumber(item.endStationPressure),
      frictionLoss: toFiniteNumber(item.frictionHeadLoss),
      pressureChangePercent: toFiniteNumber(item.pressureChangePercent),
      frictionChangePercent: toFiniteNumber(item.frictionChangePercent),
      flowState: formatValue(item.flowRegime),
    })),
    impactData: variableResults.map((item) => ({
      variableName: String(item.variableName ?? item.variableType ?? '-'),
      maxImpactPercent: toFiniteNumber(item.maxImpactPercent),
    })),
    analysis: {
      resultSummary: summaryItems,
      keyChangeAnalysis: keyFindingItems,
      riskRecognition: riskFallbackItems.length ? riskFallbackItems : ['当前数据不足以支持进一步判断。'],
      optimizationSuggestions: suggestionFallbackItems.length
        ? suggestionFallbackItems
        : ['当前数据不足以支持进一步判断。'],
    },
  };

  const basicInfoCards = filterMetricCards([
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.projectName, value: reportViewModel.basicInfo.projectName, tone: 'blue', span: 6 },
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.analysisType, value: reportViewModel.basicInfo.analysisType, tone: 'purple', span: 6 },
    {
      label: SENSITIVITY_REPORT_PAGE_COPY.labels.sensitiveVariableType,
      value: reportViewModel.basicInfo.sensitiveVariableType,
      tone: 'cyan',
      span: 6,
    },
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.baseCondition, value: reportViewModel.basicInfo.baseCondition, tone: 'green', span: 12 },
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.generatedAt, value: reportViewModel.basicInfo.generatedAt, tone: 'amber', span: 6 },
  ]);

  const coreResultCards = filterMetricCards([
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.baseResult, value: reportViewModel.resultCards.baseResult, tone: 'blue', span: 4 },
    {
      label: SENSITIVITY_REPORT_PAGE_COPY.labels.mostSensitiveVariable,
      value: reportViewModel.resultCards.mostSensitiveVariable,
      tone: 'purple',
      span: 4,
    },
    {
      label: SENSITIVITY_REPORT_PAGE_COPY.labels.sensitivityCoefficient,
      value: reportViewModel.resultCards.sensitivityCoefficient,
      tone: 'cyan',
      span: 4,
    },
    {
      label: SENSITIVITY_REPORT_PAGE_COPY.labels.maxImpactPercent,
      value: reportViewModel.resultCards.maxImpactPercent,
      tone: 'amber',
      span: 4,
    },
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.impactRanking, value: reportViewModel.resultCards.impactRanking, tone: 'green', span: 4 },
    { label: SENSITIVITY_REPORT_PAGE_COPY.labels.riskLevel, value: reportViewModel.resultCards.riskLevel, tone: 'purple', span: 4 },
  ]);

  const rankingChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 24, top: 24, bottom: 24 },
    xAxis: {
      type: 'value',
      name: SENSITIVITY_REPORT_PAGE_COPY.labels.sensitivityCoefficient,
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'category',
      data: reportViewModel.rankingData.map((item) => item.variableName).reverse(),
      axisLabel: { color: '#475569' },
    },
    series: [
      {
        type: 'bar',
        data: reportViewModel.rankingData.map((item) => item.sensitivityCoefficient).reverse(),
        barMaxWidth: 24,
        itemStyle: { color: '#7c6cff', borderRadius: [0, 8, 8, 0] },
      },
    ],
  };

  const trendChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['末站进站压力', '摩阻损失'],
      top: 0,
      textStyle: { color: '#64748b' },
    },
    grid: { left: 48, right: 48, top: 48, bottom: 32 },
    xAxis: {
      type: 'category',
      name: '变化比例',
      data: reportViewModel.trendData.map((item) => item.changeRateLabel),
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '压力',
        axisLabel: { color: '#64748b' },
        nameTextStyle: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      {
        type: 'value',
        name: '摩阻损失',
        axisLabel: { color: '#64748b' },
        nameTextStyle: { color: '#64748b' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '末站进站压力',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#4e86f7' },
        itemStyle: { color: '#4e86f7' },
        data: reportViewModel.trendData.map((item) => item.pressure),
      },
      {
        name: '摩阻损失',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#12b981' },
        itemStyle: { color: '#12b981' },
        data: reportViewModel.trendData.map((item) => item.frictionLoss),
      },
    ],
  };

  const impactChartOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: reportViewModel.impactData.map((item) => item.variableName),
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      name: '最大影响幅度(%)',
      axisLabel: { color: '#64748b' },
      nameTextStyle: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 38,
        itemStyle: { color: '#f59e0b', borderRadius: [8, 8, 0, 0] },
        data: reportViewModel.impactData.map((item) => item.maxImpactPercent),
      },
    ],
  };

  const trendTableColumns: ColumnsType<(typeof reportViewModel.trendData)[number] & { key: string }> = [
    { title: '变化比例', dataIndex: 'changeRateLabel', key: 'changeRateLabel', width: 120 },
    {
      title: '压力',
      dataIndex: 'pressure',
      key: 'pressure',
      width: 120,
      render: (value: number | null) => formatValue(value),
    },
    {
      title: '压力变化',
      dataIndex: 'pressureChangePercent',
      key: 'pressureChangePercent',
      width: 140,
      render: (value: number | null) => formatValue(value, '%'),
    },
    {
      title: '摩阻损失',
      dataIndex: 'frictionLoss',
      key: 'frictionLoss',
      width: 140,
      render: (value: number | null) => formatValue(value),
    },
    {
      title: '摩阻变化',
      dataIndex: 'frictionChangePercent',
      key: 'frictionChangePercent',
      width: 140,
      render: (value: number | null) => formatValue(value, '%'),
    },
    { title: '流态', dataIndex: 'flowState', key: 'flowState', width: 120 },
  ];

  const trendTableDataSource = reportViewModel.trendData.map((item, index) => ({
    key: `${item.changeRateLabel}-${index}`,
    ...item,
  }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>
          {reportViewModel.title}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {reportViewModel.description}
        </Paragraph>
      </div>

      <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.basicInfo}>
        {renderDetailMetricCards(basicInfoCards, {
          singleLine: true,
          compact: true,
          minColumnWidth: 220,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.coreResults}>
        {renderDetailMetricCards(coreResultCards, {
          equalWidth: true,
          singleLine: true,
          compact: true,
          minColumnWidth: 190,
          minHeight: 88,
          valueFontSize: 'clamp(14px, 1.8vw, 18px)',
        })}
      </Card>

      <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.chartAnalysis}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card size="small" title={reportViewModel.chartMeta.sensitivityRanking.title}>
              <Chart option={rankingChartOption} height={300} />
            </Card>
          </Col>
          <Col xs={24} xl={16}>
            <Card size="small" title={reportViewModel.chartMeta.changeTrend.title}>
              <Chart option={trendChartOption} height={300} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card size="small" title={reportViewModel.chartMeta.maxImpact.title}>
              <Chart option={impactChartOption} height={280} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.trendTable}>
              <Table
                columns={trendTableColumns}
                dataSource={trendTableDataSource}
                size="small"
                pagination={false}
                scroll={{ x: 860 }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.analysis}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.resultSummary}>
            {renderSummaryList(reportViewModel.analysis.resultSummary)}
          </Card>

          <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.keyChangeAnalysis}>
            {renderSummaryList(reportViewModel.analysis.keyChangeAnalysis)}
          </Card>

          <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.riskRecognition}>
            {report.risks.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.risks.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="red">{item.level}</Tag>
                      <Text strong>{item.target}</Text>
                      <Text>{item.riskType}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              renderSummaryList(reportViewModel.analysis.riskRecognition)
            )}
          </Card>

          <Card size="small" title={SENSITIVITY_REPORT_PAGE_COPY.sectionTitles.optimizationSuggestions}>
            {report.suggestions.length ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {report.suggestions.map((item, index) => (
                  <div key={`${item.target}-${index}`}>
                    <Space wrap>
                      <Tag color="blue">{item.priority}</Tag>
                      <Text strong>{item.target}</Text>
                    </Space>
                    <Paragraph style={{ margin: '8px 0 0' }}>
                      {item.action}。原因：{item.reason}。预期：{item.expected}
                    </Paragraph>
                  </div>
                ))}
              </Space>
            ) : (
              renderSummaryList(reportViewModel.analysis.optimizationSuggestions)
            )}
          </Card>
        </Space>
      </Card>
    </Space>
  );
}

function renderReportContent(report: DynamicReportResponsePayload) {
  const sensitivitySnapshot = extractSensitivityReportSnapshotFromReport(report);
  if (sensitivitySnapshot) {
    return renderSensitivityAiReportContentV2(report, sensitivitySnapshot);
  }

  const optimizationSnapshot = extractOptimizationSnapshotFromReport(report);
  if (optimizationSnapshot) {
    return renderOptimizationAiReportContentV2(report, optimizationSnapshot);
  }

  const hydraulicSnapshot = extractHydraulicSnapshotFromReport(report);
  if (hydraulicSnapshot) {
    return renderHydraulicAiReportContentV2(report, hydraulicSnapshot);
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>
          {report.title}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {report.abstract}
        </Paragraph>
      </div>

      <Card size="small" title="摘要">
        {renderSummaryList(report.summary)}
      </Card>

      <Card size="small" title="亮点">
        {renderSummaryList(report.highlights)}
      </Card>

      <Card size="small" title="结论">
        <Paragraph style={{ marginBottom: 0 }}>{report.conclusion || '暂无结论'}</Paragraph>
      </Card>

      {report.risks.length ? (
        <Card size="small" title="风险提示">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {report.risks.map((item, index) => (
              <div key={`${item.target}-${index}`}>
                <Space wrap>
                  <Tag color="red">{item.level}</Tag>
                  <Text strong>{item.target}</Text>
                  <Text>{item.riskType}</Text>
                </Space>
                <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
              </div>
            ))}
          </Space>
        </Card>
      ) : null}

      <Card size="small" title="原始结果">
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {report.raw_text || JSON.stringify(report, null, 2)}
        </pre>
      </Card>
    </Space>
  );
}

function renderDetailMetricCard(item: DetailMetricCardItem, options: DetailMetricCardRenderOptions = {}) {
  const tone = detailMetricToneMap[item.tone ?? 'blue'];
  const singleLine = options.singleLine ?? false;
  const compact = options.compact ?? false;

  return (
    <div
      style={{
        minHeight: options.minHeight ?? 94,
        minWidth: 0,
        borderRadius: 18,
        padding: compact ? '12px 16px' : '14px 16px',
        background: tone.background,
        border: `1px solid ${tone.border}`,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: compact ? 'flex-start' : 'space-between',
        gap: compact ? 6 : 10,
      }}
      title={item.value === '-' ? item.label : `${item.label}: ${item.value}`}
    >
      <div
        style={{
          color: tone.label,
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          lineHeight: 1.4,
          ...(singleLine
            ? {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }
            : {}),
        }}
        title={item.label}
      >
        {item.label}
      </div>
      <div
        style={{
          color: tone.value,
          fontSize: options.valueFontSize ?? 26,
          fontWeight: 700,
          lineHeight: compact ? 1.15 : 1.2,
          minWidth: 0,
          ...(singleLine
            ? {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                wordBreak: 'normal',
              }
            : {
                wordBreak: 'break-word',
              }),
        }}
        title={item.value}
      >
        {item.value}
      </div>
    </div>
  );
}

function renderDetailMetricCards(items: DetailMetricCardItem[], options: DetailMetricCardRenderOptions = {}) {
  const visibleItems = filterMetricCards(items);

  if (!visibleItems.length) {
    return null;
  }

  if (options.equalWidth) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${options.minColumnWidth ?? 180}px, 1fr))`,
          gap: 12,
        }}
      >
        {visibleItems.map((item) => (
          <div key={`${item.label}-${item.value}`} style={{ minWidth: 0 }}>
            {renderDetailMetricCard(item, options)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Row gutter={[12, 12]}>
      {visibleItems.map((item) => (
        <Col xs={24} md={12} xl={item.span ?? 6} key={`${item.label}-${item.value}`}>
          {renderDetailMetricCard(item, options)}
        </Col>
      ))}
    </Row>
  );
}

export default function ReportPreview() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedCalcType, setSelectedCalcType] = useState<string>(ALL_CALC_TYPE_OPTION);
  const [reportType, setReportType] = useState<ReportType>('AI_REPORT');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [report, setReport] = useState<DynamicReportResponsePayload | null>(null);
  const [reportError, setReportError] = useState('');
  const [detailPreview, setDetailPreview] = useState<DetailPreviewState>(null);
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<number[]>([]);
  const [deletingHistoryIds, setDeletingHistoryIds] = useState<number[]>([]);
  const latestHydraulicLink = useCalculationLinkStore((state) => state.latestByType.HYDRAULIC);
  const latestOptimizationLink = useCalculationLinkStore((state) => state.latestByType.OPTIMIZATION);
  const latestSensitivityLink = useCalculationLinkStore((state) => state.latestByType.SENSITIVITY);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectResponse, historyList] = await Promise.all([
        projectApi.list(),
        fetchAllPagedList<CalculationHistory>((pageNum, pageSize) =>
          calculationHistoryApi.page({ pageNum, pageSize }),
        ),
      ]);

      setProjects(projectResponse.data ?? []);
      setHistories(
        historyList
          .map((item) => ({
            ...item,
            key: item.id,
          }))
          .sort((a, b) => dayjs(b.createTime).valueOf() - dayjs(a.createTime).valueOf()),
      );
    } catch {
      message.error('读取智能报告页面数据失败，请稍后重试。');
      setProjects([]);
      setHistories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const projectLookup = useMemo(
    () => new Map(projects.map((project) => [project.proId, project])),
    [projects],
  );

  const calcTypeOptions = useMemo(
    () => [
      { label: '全部类型', value: ALL_CALC_TYPE_OPTION },
      ...Array.from(
        new Map(
          histories
            .map((item) => {
              const value = item.calcType || item.calcTypeName;
              const label = item.calcTypeName || item.calcType || '未知类型';
              return value ? [value, { label, value }] : null;
            })
            .filter((item): item is [string, { label: string; value: string }] => Boolean(item)),
        ).values(),
      ),
    ],
    [histories],
  );

  const filteredHistories = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return histories.filter((item) => {
      const project = projectLookup.get(Number(item.projectId));

      if (normalizedKeyword) {
        const matched = [
          item.projectName,
          project?.number,
          project?.responsible,
          item.userName,
          item.calcTypeName,
          item.calcType,
          item.remark,
          item.errorMessage,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedKeyword));

        if (!matched) {
          return false;
        }
      }

      if (selectedProjectIds.length && !selectedProjectIds.includes(Number(item.projectId))) {
        return false;
      }

      if (selectedCalcType !== ALL_CALC_TYPE_OPTION) {
        const currentCalcType = item.calcType || item.calcTypeName;
        if (currentCalcType !== selectedCalcType) {
          return false;
        }
      }

      if (dateRange) {
        const createdAt = dayjs(item.createTime);
        if (createdAt.isValid()) {
          const [start, end] = dateRange;
          if (createdAt.isBefore(start.startOf('day')) || createdAt.isAfter(end.endOf('day'))) {
            return false;
          }
        }
      }

      return true;
    });
  }, [dateRange, histories, projectLookup, searchKeyword, selectedCalcType, selectedProjectIds]);

  const completedCount = useMemo(
    () => filteredHistories.filter((item) => (item.status ?? 1) === 1 || !item.errorMessage).length,
    [filteredHistories],
  );

  const aiCount = useMemo(
    () => filteredHistories.filter((item) => item.calcType === 'AI_REPORT').length,
    [filteredHistories],
  );

  const allProjectIds = useMemo(() => projects.map((project) => project.proId), [projects]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        label: `${project.name}${project.number ? ` / ${project.number}` : ''}`,
        value: project.proId,
      })),
    [projects],
  );

  const projectSelectionLabel = useMemo(() => {
    if (!selectedProjectIds.length) {
      return '全部项目';
    }

    if (
      allProjectIds.length > 0 &&
      selectedProjectIds.length === allProjectIds.length &&
      allProjectIds.every((projectId) => selectedProjectIds.includes(projectId))
    ) {
      return '全部项目';
    }

    return `已选 ${selectedProjectIds.length} 个项目`;
  }, [allProjectIds, selectedProjectIds]);

  const historyTableRows = useMemo<HistoryTableRow[]>(
    () =>
      filteredHistories
        .filter((item) => item.outputResult)
        .map((item) => {
          const project = projectLookup.get(Number(item.projectId));

          return {
            ...item,
            projectNumber: project?.number || (item.projectId ? String(item.projectId) : '-'),
            responsible: project?.responsible || item.userName || '-',
            calcTypeLabel: getCalcTypeLabel(item),
            updateTimeText: formatTime(item.createTime),
          };
        }),
    [filteredHistories, projectLookup],
  );

  const reportHistoryRows = useMemo<HistoryTableRow[]>(
    () => {
      const normalizedKeyword = searchKeyword.trim().toLowerCase();

      return histories
        .filter((item) => {
          if (!item.outputResult || !isAiReportHistory(item)) {
            return false;
          }

          const project = projectLookup.get(Number(item.projectId));

          if (normalizedKeyword) {
            const matched = [
              item.projectName,
              project?.number,
              project?.responsible,
              item.userName,
              item.calcTypeName,
              item.calcType,
              item.remark,
              item.errorMessage,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedKeyword));

            if (!matched) {
              return false;
            }
          }

          if (selectedProjectIds.length && !selectedProjectIds.includes(Number(item.projectId))) {
            return false;
          }

          if (dateRange) {
            const createdAt = dayjs(item.createTime);
            if (createdAt.isValid()) {
              const [start, end] = dateRange;
              if (createdAt.isBefore(start.startOf('day')) || createdAt.isAfter(end.endOf('day'))) {
                return false;
              }
            }
          }

          return true;
        })
        .map((item) => {
          const project = projectLookup.get(Number(item.projectId));

          return {
            ...item,
            projectNumber: project?.number || (item.projectId ? String(item.projectId) : '-'),
            responsible: project?.responsible || item.userName || '-',
            calcTypeLabel: getCalcTypeLabel(item),
            updateTimeText: formatTime(item.createTime),
          };
        });
    },
    [dateRange, histories, projectLookup, searchKeyword, selectedProjectIds],
  );

  const calculationRecords = useMemo(
    () => historyTableRows.filter((item) => !isAiReportHistory(item)).slice(0, 10),
    [historyTableRows],
  );

  const aiReportRecords = useMemo<AiReportHistoryRow[]>(
    () =>
      reportHistoryRows
        .map((item) => {
          const reportPayload = extractDynamicReportFromOutput(item.outputResult);

          return {
            ...item,
            reportTitle: reportPayload?.title || `${item.projectName || '未命名项目'}智能报告`,
            reportAbstract: reportPayload?.abstract || item.remark || '已归档的智能报告记录',
          };
        }),
    [reportHistoryRows],
  );

  const latestRecords = calculationRecords;

  const selectedHydraulicRecord = useMemo(
    () =>
      calculationRecords.find(
        (record) =>
          selectedHistoryKeys.includes(record.key) &&
          (record.calcType === 'HYDRAULIC' || record.calcTypeLabel.includes('姘村姏')),
      ) ??
      calculationRecords.find((record) => record.calcType === 'HYDRAULIC' || record.calcTypeLabel.includes('姘村姏')),
    [calculationRecords, selectedHistoryKeys],
  );

  const preferredHydraulicSnapshot = useMemo(
    () =>
      buildHydraulicSnapshotFromHistory(selectedHydraulicRecord) ??
      buildHydraulicSnapshotFromLinkedRecord(latestHydraulicLink),
    [latestHydraulicLink, selectedHydraulicRecord],
  );

  const selectedOptimizationRecord = useMemo(
    () =>
      calculationRecords.find(
        (record) =>
          selectedHistoryKeys.includes(record.key) &&
          (record.calcType === 'OPTIMIZATION' || record.calcTypeLabel.includes('优化')),
      ) ??
      (selectedCalcType === 'OPTIMIZATION'
        ? calculationRecords.find((record) => record.calcType === 'OPTIMIZATION' || record.calcTypeLabel.includes('优化'))
        : null),
    [calculationRecords, selectedCalcType, selectedHistoryKeys],
  );

  const preferredOptimizationSnapshot = useMemo(
    () =>
      createOptimizationReportSnapshotFromHistory(selectedOptimizationRecord) ??
      ((selectedOptimizationRecord || selectedCalcType === 'OPTIMIZATION') && latestOptimizationLink
        ? createOptimizationReportSnapshotFromLinkedRecord(latestOptimizationLink)
        : null),
    [latestOptimizationLink, selectedCalcType, selectedOptimizationRecord],
  );

  const selectedSensitivityRecord = useMemo(
    () =>
      calculationRecords.find(
        (record) =>
          selectedHistoryKeys.includes(record.key) &&
          (record.calcType === 'SENSITIVITY' || record.calcTypeLabel.includes('敏感')),
      ) ??
      (selectedCalcType === 'SENSITIVITY'
        ? calculationRecords.find((record) => record.calcType === 'SENSITIVITY' || record.calcTypeLabel.includes('敏感'))
        : null),
    [calculationRecords, selectedCalcType, selectedHistoryKeys],
  );

  const preferredSensitivitySnapshot = useMemo(
    () =>
      createSensitivityReportSnapshotFromHistory(selectedSensitivityRecord) ??
      ((selectedSensitivityRecord || selectedCalcType === 'SENSITIVITY') && latestSensitivityLink
        ? createSensitivityReportSnapshotFromLinkedRecord(latestSensitivityLink)
        : null),
    [latestSensitivityLink, selectedCalcType, selectedSensitivityRecord],
  );

  useEffect(() => {
    setSelectedHistoryKeys((currentKeys) =>
      currentKeys.filter((key) => calculationRecords.some((record) => record.key === key)),
    );
  }, [calculationRecords]);

  const handleDeleteHistory = useCallback(async (record: HistoryTableRow) => {
    const targetId = Number(record.id);
    if (!Number.isFinite(targetId)) {
      message.error('删除失败，记录编号无效。');
      return;
    }

    setDeletingHistoryIds((current) => (current.includes(targetId) ? current : [...current, targetId]));

    try {
      await calculationHistoryApi.delete(targetId);

      setHistories((current) => current.filter((item) => Number(item.id) !== targetId));
      setSelectedHistoryKeys((current) => current.filter((key) => Number(key) !== targetId));
      setDetailPreview((current) =>
        current?.mode === 'history' && Number(current.row.id) === targetId ? null : current,
      );

      message.success('删除成功。');
    } catch {
      message.error('删除失败，请稍后重试。');
    } finally {
      setDeletingHistoryIds((current) => current.filter((item) => item !== targetId));
    }
  }, []);

  const detailPayload = useMemo(() => {
    if (!detailPreview || detailPreview.mode !== 'history') {
      return null;
    }

    return parseJson(detailPreview.row.outputResult) ?? parseJson(detailPreview.row.inputParams);
  }, [detailPreview]);

  const detailReport = useMemo(() => {
    if (detailPreview?.mode === 'generated') {
      return detailPreview.report;
    }
    if (!detailPayload) {
      return null;
    }
    if (isDynamicReportResponsePayload(detailPayload)) {
      return detailPayload;
    }

    const nestedPayload = (detailPayload as { data?: unknown }).data;
    return isDynamicReportResponsePayload(nestedPayload) ? nestedPayload : null;
  }, [detailPayload, detailPreview]);

  const historyInputPayload = useMemo(
    () => (detailPreview?.mode === 'history' ? parseJson(detailPreview.row.inputParams) : null),
    [detailPreview],
  );

  const historyOutputPayload = useMemo(() => {
    if (detailPreview?.mode !== 'history') {
      return null;
    }

    const parsed = parseJson(detailPreview.row.outputResult);
    return asRecord(getValueByPath(parsed, 'data')) ?? asRecord(parsed);
  }, [detailPreview]);

  const historyInputBase = useMemo(
    () => asRecord(getValueByPath(historyInputPayload, 'baseParams')) ?? historyInputPayload,
    [historyInputPayload],
  );

  const sensitivityVariableResults = useMemo(
    () => asRecordArray(getValueByPath(historyOutputPayload, 'variableResults')),
    [historyOutputPayload],
  );

  const sensitivityRankingRows = useMemo(
    () => asRecordArray(getValueByPath(historyOutputPayload, 'sensitivityRanking')),
    [historyOutputPayload],
  );

  const sensitivityDetailRows = useMemo<SensitivityDetailRow[]>(
    () =>
      sensitivityVariableResults.flatMap((result, resultIndex) => {
        const variableName = String(result.variableName ?? result.variableType ?? '敏感变量');
        return asRecordArray(result.dataPoints).map((point, pointIndex) => ({
          key: `${resultIndex}-${pointIndex}`,
          variableName,
          changePercent: formatValue(point.changePercent, '%'),
          endStationPressure: formatValue(point.endStationPressure),
          frictionHeadLoss: formatValue(point.frictionHeadLoss),
          flowRegime: formatValue(point.flowRegime),
          hydraulicSlope: formatValue(point.hydraulicSlope),
          reynoldsNumber: formatValue(point.reynoldsNumber),
        }));
      }),
    [sensitivityVariableResults],
  );

  const inputValueSources = useMemo(
    () => [historyInputBase, historyInputPayload] as unknown[],
    [historyInputBase, historyInputPayload],
  );

  const outputValueSources = useMemo(
    () => [historyOutputPayload] as unknown[],
    [historyOutputPayload],
  );

  const baseResultSources = useMemo(
    () => [asRecord(getValueByPath(historyOutputPayload, 'baseResult')), historyOutputPayload].filter(Boolean) as unknown[],
    [historyOutputPayload],
  );

  const detailInfoCards = useMemo<DetailMetricCardItem[]>(
    () =>
      detailPreview?.mode === 'history'
        ? filterMetricCards([
            { label: '项目名称', value: detailPreview.row.projectName || '-', tone: 'blue', span: 8 },
            { label: '项目编号', value: detailPreview.row.projectNumber || '-', tone: 'cyan', span: 4 },
            { label: '负责人', value: detailPreview.row.responsible || '-', tone: 'green', span: 4 },
            { label: '计算类型', value: detailPreview.row.calcTypeLabel || '-', tone: 'purple', span: 4 },
            { label: '更新时间', value: detailPreview.row.updateTimeText || '-', tone: 'amber', span: 4 },
            { label: '备注', value: detailPreview.row.remark || '-', tone: 'blue', span: 8 },
          ])
        : [],
    [detailPreview],
  );

  const inputMetricCards = useMemo<DetailMetricCardItem[]>(
    () => {
      const startAltitude = formatValue(pickFirstValue(inputValueSources, ['startAltitude', 'startElevation']));
      const endAltitude = formatValue(pickFirstValue(inputValueSources, ['endAltitude', 'endElevation']));

      return filterMetricCards([
        { label: '流量', value: formatValue(pickFirstValue(inputValueSources, ['flowRate', 'throughput', 'flow'])), tone: 'blue' },
        { label: '密度', value: formatValue(pickFirstValue(inputValueSources, ['density'])), tone: 'cyan' },
        { label: '粘度', value: formatValue(pickFirstValue(inputValueSources, ['viscosity'])), tone: 'green' },
        { label: '长度', value: formatValue(pickFirstValue(inputValueSources, ['length', 'pipelineLength'])), tone: 'amber' },
        { label: '管径', value: formatValue(pickFirstValue(inputValueSources, ['diameter', 'pipeDiameter'])), tone: 'purple' },
        { label: '壁厚', value: formatValue(pickFirstValue(inputValueSources, ['thickness', 'wallThickness'])), tone: 'blue' },
        { label: '粗糙度', value: formatValue(pickFirstValue(inputValueSources, ['roughness'])), tone: 'cyan' },
        {
          label: '首站进站压头',
          value: formatValue(pickFirstValue(inputValueSources, ['inletPressure', 'firstStationInPressure', 'stationInPressure'])),
          tone: 'amber',
        },
        { label: '起点高程', value: startAltitude, tone: 'green' },
        { label: '终点高程', value: endAltitude, tone: 'green' },
        { label: '泵数量', value: buildPumpCountDisplay(inputValueSources), tone: 'purple', span: 12 },
        { label: '扬程', value: buildPumpHeadDisplay(inputValueSources), tone: 'purple', span: 12 },
        { label: '效率', value: buildEfficiencyDisplay(inputValueSources), tone: 'blue' },
        { label: '电价', value: formatValue(pickFirstValue(inputValueSources, ['electricityPrice', 'powerPrice']), '元/kWh'), tone: 'cyan' },
        { label: '工作天数', value: formatValue(pickFirstValue(inputValueSources, ['workingDays']), '天'), tone: 'green' },
        { label: '敏感变量类型', value: buildSensitiveVariableDisplay(historyInputPayload, historyInputBase), tone: 'amber' },
      ]);
    },
    [historyInputBase, historyInputPayload, inputValueSources],
  );

  const hydraulicResultCards = useMemo<DetailMetricCardItem[]>(
    () => [
      { label: '雷诺数', value: formatValue(pickFirstValue(outputValueSources, ['reynoldsNumber'])), tone: 'blue' },
      { label: '流态', value: formatValue(pickFirstValue(outputValueSources, ['flowRegime', 'regime'])), tone: 'cyan' },
      { label: '摩阻损失', value: formatValue(pickFirstValue(outputValueSources, ['frictionHeadLoss', 'frictionLoss'])), tone: 'green' },
      { label: '水力坡降', value: formatValue(pickFirstValue(outputValueSources, ['hydraulicSlope', 'slope'])), tone: 'amber' },
      { label: '总扬程', value: formatValue(pickFirstValue(outputValueSources, ['totalHead'])), tone: 'purple' },
      { label: '首站出站压头', value: formatValue(pickFirstValue(outputValueSources, ['firstStationOutPressure', 'outletPressure'])), tone: 'blue' },
      { label: '末站进站压头', value: formatValue(pickFirstValue(outputValueSources, ['endStationInPressure', 'terminalInPressure'])), tone: 'cyan' },
    ],
    [outputValueSources],
  );

  const optimizationResultCards = useMemo<DetailMetricCardItem[]>(
    () => [
      {
        label: '推荐泵组合',
        value:
          formatValue(pickFirstValue(outputValueSources, ['recommendedPumpCombination', 'pumpCombination'])) !== '-'
            ? formatValue(pickFirstValue(outputValueSources, ['recommendedPumpCombination', 'pumpCombination']))
            : buildPumpDisplay(outputValueSources),
        tone: 'purple',
        span: 8,
      },
      { label: '总扬程', value: formatValue(pickFirstValue(outputValueSources, ['totalHead'])), tone: 'blue' },
      { label: '总压降', value: formatValue(pickFirstValue(outputValueSources, ['totalPressureDrop', 'pressureDrop'])), tone: 'cyan' },
      { label: '末站进站压头', value: formatValue(pickFirstValue(outputValueSources, ['endStationInPressure', 'terminalInPressure'])), tone: 'green' },
      { label: '可行性', value: formatValue(pickFirstValue(outputValueSources, ['isFeasible', 'feasible'])), tone: 'amber' },
      { label: '年能耗', value: formatValue(pickFirstValue(outputValueSources, ['totalEnergyConsumption', 'annualEnergyConsumption', 'energyConsumption'])), tone: 'blue' },
      { label: '总成本', value: formatValue(pickFirstValue(outputValueSources, ['totalCost', 'annualCost'])), tone: 'cyan' },
      {
        label: '推荐说明',
        value: formatValue(pickFirstValue(outputValueSources, ['description', 'recommendation', 'remark'])),
        tone: 'purple',
        span: 8,
      },
    ],
    [outputValueSources],
  );

  const sensitivityBaseResultCards = useMemo<DetailMetricCardItem[]>(
    () => [
      { label: '雷诺数', value: formatValue(pickFirstValue(baseResultSources, ['reynoldsNumber'])), tone: 'blue' },
      { label: '流态', value: formatValue(pickFirstValue(baseResultSources, ['flowRegime', 'regime'])), tone: 'cyan' },
      { label: '摩阻损失', value: formatValue(pickFirstValue(baseResultSources, ['frictionHeadLoss', 'frictionLoss'])), tone: 'green' },
      { label: '水力坡降', value: formatValue(pickFirstValue(baseResultSources, ['hydraulicSlope', 'slope'])), tone: 'amber' },
      { label: '总扬程', value: formatValue(pickFirstValue(baseResultSources, ['totalHead'])), tone: 'purple' },
      { label: '首站出站压头', value: formatValue(pickFirstValue(baseResultSources, ['firstStationOutPressure', 'outletPressure'])), tone: 'blue' },
      { label: '末站进站压头', value: formatValue(pickFirstValue(baseResultSources, ['endStationInPressure', 'terminalInPressure'])), tone: 'cyan' },
    ],
    [baseResultSources],
  );

  const sensitivitySummaryCards = useMemo<DetailMetricCardItem[]>(
    () =>
      sensitivityVariableResults.map((item, index) => {
        const rankItem = sensitivityRankingRows.find(
          (rank) => String(rank.variableType ?? '') === String(item.variableType ?? ''),
        );

        return {
          label: `${String(item.variableName ?? item.variableType ?? `变量 ${index + 1}`)} / 排名 ${formatValue(rankItem?.rank)}`,
          value: `敏感系数 ${formatValue(item.sensitivityCoefficient)}，最大影响 ${formatValue(item.maxImpactPercent, '%')}`,
          tone: (['purple', 'blue', 'cyan', 'green'] as DetailMetricTone[])[index % 4],
          span: 8,
        };
      }),
    [sensitivityRankingRows, sensitivityVariableResults],
  );

  const sensitivityDetailColumns = useMemo<ColumnsType<SensitivityDetailRow>>(
    () => [
      { title: '变量', dataIndex: 'variableName', key: 'variableName' },
      { title: '变化比例', dataIndex: 'changePercent', key: 'changePercent', width: 120 },
      { title: '压力', dataIndex: 'endStationPressure', key: 'endStationPressure', width: 120 },
      { title: '摩阻', dataIndex: 'frictionHeadLoss', key: 'frictionHeadLoss', width: 120 },
      { title: '流态', dataIndex: 'flowRegime', key: 'flowRegime', width: 120 },
      { title: '水力坡降', dataIndex: 'hydraulicSlope', key: 'hydraulicSlope', width: 120 },
      { title: '雷诺数', dataIndex: 'reynoldsNumber', key: 'reynoldsNumber', width: 120 },
    ],
    [],
  );

  const currentHistoryCalcType = detailPreview?.mode === 'history' ? String(detailPreview.row.calcType ?? '') : '';
  const isAiReportRecord = detailPreview?.mode === 'history' && isAiReportHistory(detailPreview.row);
  const isHydraulicRecord =
    detailPreview?.mode === 'history' &&
    (currentHistoryCalcType === 'HYDRAULIC' || detailPreview.row.calcTypeLabel.includes('水力'));
  const isOptimizationRecord =
    detailPreview?.mode === 'history' &&
    (currentHistoryCalcType === 'OPTIMIZATION' || detailPreview.row.calcTypeLabel.includes('优化'));
  const isSensitivityRecord =
    detailPreview?.mode === 'history' &&
    (currentHistoryCalcType === 'SENSITIVITY' || detailPreview.row.calcTypeLabel.includes('敏感'));

  const historyColumns = useMemo<ColumnsType<HistoryTableRow>>(
    () => [
      {
        title: '项目名称',
        dataIndex: 'projectName',
        key: 'projectName',
        width: 220,
        onHeaderCell: () => ({ style: tableHeaderCellStyle }),
        onCell: () => ({ style: tableCellStyle }),
        render: (value?: string) => value || '-',
      },
      {
        title: '项目编号',
        dataIndex: 'projectNumber',
        key: 'projectNumber',
        width: 150,
        onHeaderCell: () => ({ style: tableHeaderCellStyle }),
        onCell: () => ({ style: tableCellStyle }),
        render: (value?: string) => value || '-',
      },
      {
        title: '负责人',
        dataIndex: 'responsible',
        key: 'responsible',
        width: 140,
        onHeaderCell: () => ({ style: tableHeaderCellStyle }),
        onCell: () => ({ style: tableCellStyle }),
        render: (value?: string) => value || '-',
      },
      {
        title: '计算类型',
        dataIndex: 'calcTypeLabel',
        key: 'calcTypeLabel',
        width: 150,
        onHeaderCell: () => ({ style: tableHeaderCellStyle }),
        onCell: () => ({ style: tableCellStyle }),
        render: (value?: string) => (
          <Tag
            style={{
              marginInlineEnd: 0,
              borderRadius: 999,
              paddingInline: 10,
              color: '#3b82f6',
              background: '#eaf3ff',
              border: 'none',
            }}
          >
            {value || '-'}
          </Tag>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updateTimeText',
        key: 'updateTimeText',
        width: 180,
        onHeaderCell: () => ({ style: tableHeaderCellStyle }),
        onCell: () => ({ style: tableCellStyle }),
      },
      {
        title: '操作',
        key: 'action',
        width: 132,
        align: 'center',
        onHeaderCell: () => ({ style: tableHeaderCellStyle }),
        onCell: () => ({ style: tableCellStyle }),
        render: (_, record) => (
          <Space size={4}>
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: '#22c1ff', fontSize: 18 }} />}
              onClick={() => setDetailPreview({ mode: 'history', row: record })}
              disabled={deletingHistoryIds.includes(Number(record.id))}
            />
            <Popconfirm
              title="确认删除这条记录？"
              description="删除后不可恢复。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => void handleDeleteHistory(record)}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined style={{ fontSize: 18 }} />}
                loading={deletingHistoryIds.includes(Number(record.id))}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deletingHistoryIds, handleDeleteHistory],
  );

  const handleGenerate = useCallback(async () => {
    const activeProjectIds = selectedProjectIds.length ? selectedProjectIds : allProjectIds;

    if (!activeProjectIds.length) {
      message.warning('暂无可用项目。');
      return;
    }

    setGenerating(true);
    setReport(null);
    setReportError('');

    try {
      const selectedNames = projects
        .filter((project) => activeProjectIds.includes(project.proId))
        .map((project) => project.name);

      const hydraulicPrompt = preferredHydraulicSnapshot
        ? '请基于真实水力计算结果生成水力分析智能报告，按以下结构组织：第一块报告头（标题、项目名、生成时间、分析类型）；第二块参数表（流量、密度、粘度、长度、管径、粗糙度、高程、泵参数）；第三块结果卡片（雷诺数、流态、摩阻损失、水力坡降、总扬程、末站进站压头）；第四块图表（压头变化图、扬程构成图）；第五块 AI 分析（结果摘要、指标分析、风险判断、运行建议）。'
        : undefined;

      const normalizedHydraulicPrompt = preferredHydraulicSnapshot ? buildHydraulicUserPrompt() : hydraulicPrompt;
      const normalizedOptimizationPrompt = preferredOptimizationSnapshot ? buildOptimizationUserPrompt() : undefined;
      const normalizedSensitivityPrompt = preferredSensitivitySnapshot ? buildSensitivityUserPrompt() : undefined;
      const activePrompt = normalizedSensitivityPrompt ?? normalizedOptimizationPrompt ?? normalizedHydraulicPrompt;
      const activeFocuses = preferredSensitivitySnapshot
        ? ['基准结果', '敏感系数', '最大影响幅度', '排名', '压力变化趋势', '摩阻损失变化趋势', '流态变化']
        : preferredHydraulicSnapshot
          ? ['雷诺数', '流态', '摩阻损失', '水力坡降', '总扬程', '末站进站压头']
          : undefined;
      void activeFocuses;
      const result = await agentApi.generateDynamicReport({
        selected_project_ids: activeProjectIds,
        project_names: selectedNames,
        report_type: reportType,
        report_type_label: REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label,
        intelligence_level: 'enhanced',
        output_format: 'markdown',
        include_summary: true,
        include_risk: true,
        include_suggestions: true,
        include_conclusion: true,
        range_preset: dateRange ? 'custom' : 'all',
        custom_start: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
        custom_end: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        focuses: preferredHydraulicSnapshot
          ? ['雷诺数', '流态', '摩阻损失', '水力坡降', '总扬程', '末站进站压头']
          : undefined,
        user_prompt: activePrompt,
      });

      const enrichedReport: DynamicReportResponsePayload = preferredSensitivitySnapshot
        ? {
            ...result,
            metadata: {
              ...(result.metadata ?? {}),
              sensitivitySnapshot: preferredSensitivitySnapshot,
            },
          }
        : preferredOptimizationSnapshot
          ? {
              ...result,
              metadata: {
                ...(result.metadata ?? {}),
                optimizationSnapshot: preferredOptimizationSnapshot,
              },
            }
        : preferredHydraulicSnapshot
          ? {
              ...result,
              metadata: {
                ...(result.metadata ?? {}),
                hydraulicSnapshot: preferredHydraulicSnapshot,
              },
            }
          : result;

      setReport(enrichedReport);
      setDetailPreview({ mode: 'generated', report: enrichedReport });

      const archivePayload: SaveReportRequest = {
        title: enrichedReport.title,
        reportType,
        reportTypeLabel: REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label || '智能报告',
        selectedProjectIds: activeProjectIds,
        projectNames: selectedNames,
        rangeLabel: dateRange
          ? `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}`
          : '全部时间',
        intelligenceLabel: '增强分析',
        outputFormat: 'markdown',
        sourceLabel: '智能报告中心',
        result: {
          source: enrichedReport.source === 'rules' ? 'fallback' : 'ai',
          highlights: enrichedReport.highlights,
          summary: enrichedReport.summary,
          risks: enrichedReport.risks,
          suggestions: enrichedReport.suggestions,
          conclusion: enrichedReport.conclusion,
          rawText: enrichedReport.raw_text,
          report: enrichedReport,
        },
      };

      try {
        const archiveResponse = await calculationHistoryApi.report(archivePayload);
        const archivedHistory = archiveResponse.data;

        if (archivedHistory) {
          setHistories((current) =>
            [{ ...archivedHistory, key: archivedHistory.id }, ...current.filter((item) => item.id !== archivedHistory.id)].sort(
              (a, b) => dayjs(b.createTime).valueOf() - dayjs(a.createTime).valueOf(),
            ),
          );
        }
      } catch (archiveError) {
        const archiveMessage =
          archiveError instanceof Error ? archiveError.message : '智能报告已生成，但归档失败。';
        message.warning(`智能报告已生成，但历史区归档失败：${archiveMessage}`);
      }
      message.success('智能报告生成成功。');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '智能报告生成失败。';
      setReportError(nextMessage);
      message.error(nextMessage);
    } finally {
      setGenerating(false);
    }
  }, [
    allProjectIds,
    dateRange,
    preferredHydraulicSnapshot,
    preferredOptimizationSnapshot,
    preferredSensitivitySnapshot,
    projects,
    reportType,
    selectedProjectIds,
  ]);

  return (
    <AnimatedPage className="min-h-full">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <style>{`
          .report-history-table .ant-table-thead .ant-table-selection-column {
            background: #edf4ff !important;
          }

          .report-history-table .ant-table-thead .ant-table-selection-column::before {
            display: none !important;
          }

          .report-hero-title span + span {
            display: none !important;
          }

          .report-hero-copy {
            display: none !important;
          }
        `}</style>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <Card style={cardStyle} bodyStyle={{ padding: 28 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Title className="report-hero-title" level={2} style={{ margin: 0, lineHeight: 1.1 }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 'clamp(34px, 4vw, 56px)',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    background: 'linear-gradient(90deg, #4a86ff 0%, #7367ff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  智能报告
                </span>
                <span style={{ marginLeft: 8 }}>工作台</span>
              </Title>
              <Paragraph className="report-hero-copy" type="secondary" style={{ margin: 0, maxWidth: 900 }}>
                保留原页面的核心用途：按项目和时间范围生成智能报告，同时查看当前计算历史概览。当前仅修复为可编译可打开版本，不包含你刚刚撤销的“落库并按 reportId 查看”逻辑。
              </Paragraph>
            </Space>
          </Card>

          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                icon={<AppstoreOutlined />}
                tone={metricCardTones[0]}
                statistic={<Statistic title="项目数量" value={projects.length} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                icon={<HistoryOutlined />}
                tone={metricCardTones[1]}
                statistic={<Statistic title="历史记录" value={filteredHistories.length} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                icon={<CheckCircleOutlined />}
                tone={metricCardTones[2]}
                statistic={<Statistic title="已完成记录" value={completedCount} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                icon={<RobotOutlined />}
                tone={metricCardTones[3]}
                statistic={<Statistic title="AI 报告记录" value={aiCount} />}
              />
            </Col>
          </Row>

          <Card style={cardStyle} title="生成条件">
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={12} xl={5}>
                <Input
                  allowClear
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="搜索项目名称或备注..."
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                />
              </Col>
              <Col xs={24} md={12} xl={5}>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="全部项目"
                  value={selectedProjectIds}
                  onChange={(value) => setSelectedProjectIds(value as number[])}
                  options={projectOptions}
                  maxTagCount={0}
                  maxTagPlaceholder={() => projectSelectionLabel}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Col>
              <Col xs={24} md={12} xl={4}>
                <Select
                  style={{ width: '100%' }}
                  value={selectedCalcType}
                  onChange={(value) => setSelectedCalcType(value)}
                  options={calcTypeOptions}
                />
              </Col>
              <Col xs={24} md={12} xl={4}>
                <Select
                  style={{ width: '100%' }}
                  value={reportType}
                  onChange={(value) => setReportType(value)}
                  options={REPORT_TYPE_OPTIONS}
                />
              </Col>
              <Col xs={24} md={24} xl={6}>
                <RangePicker
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={(value) => setDateRange(value as [Dayjs, Dayjs] | null)}
                  placeholder={['起始日期', '截止日期']}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  onClick={() => void handleGenerate()}
                  loading={generating}
                >
                  开始生成智能报告
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setSearchKeyword('');
                    setSelectedProjectIds([]);
                    setSelectedCalcType(ALL_CALC_TYPE_OPTION);
                    setReportType('AI_REPORT');
                    setDateRange(null);
                    setReport(null);
                    setReportError('');
                  }}
                >
                  重置
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
                  刷新
                </Button>
              </Space>
            </div>
          </Card>

          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} xl={24}>
              <Card
                style={{ ...cardStyle, height: '100%' }}
                bodyStyle={tableCardBodyStyle}
                title="计算记录表"
                extra={<Text type="secondary">最近 10 条数据库真实记录</Text>}
              >
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Spin />
                  </div>
                ) : latestRecords.length ? (
                  <Table
                    className="report-history-table"
                    columns={historyColumns}
                    dataSource={latestRecords}
                    rowKey="key"
                    rowSelection={{
                      selectedRowKeys: selectedHistoryKeys,
                      onChange: (keys) => setSelectedHistoryKeys(keys as number[]),
                      columnTitle: (checkboxNode) => (
                        <Space size={6} style={{ whiteSpace: 'nowrap' }}>
                          {checkboxNode}
                          <span style={{ color: '#7c8aa5', fontSize: 14, fontWeight: 600 }}>全选</span>
                        </Space>
                      ),
                      columnWidth: 96,
                    }}
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 980, y: 520 }}
                    size="middle"
                    locale={{
                      emptyText: <Empty description="暂无可展示的计算结果记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                    }}
                  />
                ) : (
                  <Empty description="暂无可展示的计算结果记录" />
                )}
              </Card>
            </Col>

            <Col xs={24} xl={12} style={{ display: 'none' }}>
              <Card
                style={{ ...cardStyle, height: '100%' }}
                title="报告生成结果"
                extra={<FileTextOutlined />}
              >
                {generating ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin />
                    <div style={{ marginTop: 12, color: '#64748b' }}>正在生成智能报告...</div>
                  </div>
                ) : reportError ? (
                  <Alert type="error" showIcon message="生成失败" description={reportError} />
                ) : report ? (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ marginBottom: 8 }}>
                        {report.title}
                      </Title>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {report.abstract}
                      </Paragraph>
                    </div>

                    <Card size="small" title="摘要">
                      {renderSummaryList(report.summary)}
                    </Card>

                    <Card size="small" title="亮点">
                      {renderSummaryList(report.highlights)}
                    </Card>

                    <Card size="small" title="结论">
                      <Paragraph style={{ marginBottom: 0 }}>
                        {report.conclusion || '暂无结论'}
                      </Paragraph>
                    </Card>

                    {report.risks.length ? (
                      <Card size="small" title="风险提示">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          {report.risks.map((item, index) => (
                            <div key={`${item.target}-${index}`}>
                              <Space wrap>
                                <Tag color="red">{item.level}</Tag>
                                <Text strong>{item.target}</Text>
                                <Text>{item.riskType}</Text>
                              </Space>
                              <Paragraph style={{ margin: '8px 0 0' }}>{item.reason}</Paragraph>
                            </div>
                          ))}
                        </Space>
                      </Card>
                    ) : null}

                    <Card size="small" title="原始结果">
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {report.raw_text || JSON.stringify(report, null, 2)}
                      </pre>
                    </Card>
                  </Space>
                ) : (
                  <Empty description="设置条件后生成智能报告，结果会显示在这里" />
                )}
              </Card>
            </Col>
          </Row>

          <Modal
            open={Boolean(detailPreview)}
            footer={null}
            destroyOnClose
            width={960}
            title={
              detailPreview?.mode === 'history'
                ? `${detailPreview.row.projectName || '未命名项目'} / ${detailPreview.row.calcTypeLabel}`
                : '智能报告生成结果'
            }
            onCancel={() => setDetailPreview(null)}
          >
            {detailPreview?.mode === 'history' ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card style={detailSectionStyle} bodyStyle={detailSectionBodyStyle} title="计算基本信息">
                  {renderDetailMetricCards(detailInfoCards, {
                    equalWidth: true,
                    singleLine: true,
                    compact: true,
                    minColumnWidth: 180,
                    minHeight: 88,
                    valueFontSize: 'clamp(14px, 1.8vw, 18px)',
                  })}
                </Card>

                {isAiReportRecord && detailReport ? (
                  renderReportContent(detailReport)
                ) : (
                  <>
                    <Card style={detailSectionStyle} bodyStyle={detailSectionBodyStyle} title="计算入参">
                      {renderDetailMetricCards(inputMetricCards, {
                        singleLine: true,
                        valueFontSize: 'clamp(16px, 1.8vw, 22px)',
                      })}
                    </Card>

                    {isHydraulicRecord ? (
                      <Card style={detailSectionStyle} bodyStyle={detailSectionBodyStyle} title="水力结果">
                        {renderDetailMetricCards(hydraulicResultCards)}
                      </Card>
                    ) : null}

                    {isOptimizationRecord ? (
                      <Card style={detailSectionStyle} bodyStyle={detailSectionBodyStyle} title="优化结果">
                        {renderDetailMetricCards(optimizationResultCards)}
                      </Card>
                    ) : null}

                    {isSensitivityRecord ? (
                      <>
                        <Card style={detailSectionStyle} bodyStyle={detailSectionBodyStyle} title="敏感性结果">
                          <Space direction="vertical" size={20} style={{ width: '100%' }}>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>基准结果</div>
                              {renderDetailMetricCards(sensitivityBaseResultCards)}
                            </div>

                            <div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>敏感系数 / 最大影响 / 排名</div>
                              {sensitivitySummaryCards.length ? (
                                renderDetailMetricCards(sensitivitySummaryCards)
                              ) : (
                                <Empty description="暂无敏感性摘要数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                              )}
                            </div>
                          </Space>
                        </Card>

                        <Card style={detailSectionStyle} bodyStyle={tableCardBodyStyle} title="各变化比例下的压力 / 摩阻 / 流态明细">
                          <Table
                            columns={sensitivityDetailColumns}
                            dataSource={sensitivityDetailRows}
                            rowKey="key"
                            pagination={false}
                            scroll={{ x: 900, y: 360 }}
                            locale={{
                              emptyText: <Empty description="暂无敏感性变化明细" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                            }}
                          />
                        </Card>
                      </>
                    ) : null}

                    {!isHydraulicRecord && !isOptimizationRecord && !isSensitivityRecord ? (
                      <Card style={detailSectionStyle} bodyStyle={detailSectionBodyStyle} title="计算结果">
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: 12,
                            lineHeight: 1.6,
                          }}
                        >
                          {detailPreview.row.outputResult ||
                            detailPreview.row.inputParams ||
                            (detailPayload ? JSON.stringify(detailPayload, null, 2) : '暂无结果数据')}
                        </pre>
                      </Card>
                    ) : null}
                  </>
                )}

                {/*
                  <>
                <Row gutter={[12, 12]}>
                  {[
                    { label: '项目名称', value: detailPreview.row.projectName || '-' },
                    { label: '项目编号', value: detailPreview.row.projectNumber || '-' },
                    { label: '负责人', value: detailPreview.row.responsible || '-' },
                    { label: '计算类型', value: detailPreview.row.calcTypeLabel || '-' },
                    { label: '更新时间', value: detailPreview.row.updateTimeText || '-' },
                    { label: '备注', value: detailPreview.row.remark || '-' },
                  ].map((item) => (
                    <Col xs={24} md={12} key={item.label}>
                      <Card size="small">
                        <Text type="secondary">{item.label}</Text>
                        <div style={{ marginTop: 8, color: '#0f172a', wordBreak: 'break-word' }}>{item.value}</div>
                      </Card>
                    </Col>
                  ))}
                </Row>

                {detailReport ? (
                  renderReportContent(detailReport)
                ) : (
                  <Card size="small" title="原始结果">
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      {detailPreview.row.outputResult ||
                        detailPreview.row.inputParams ||
                        (detailPayload ? JSON.stringify(detailPayload, null, 2) : '暂无结果数据')}
                    </pre>
                  </Card>
                )}
                  </>
                */}
              </Space>
            ) : detailReport ? (
              renderReportContent(detailReport)
            ) : (
              <Empty description="暂无可展示的报告详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Modal>

          <Card
            style={cardStyle}
            bodyStyle={tableCardBodyStyle}
            title="智能报告历史区"
            extra={<Text type="secondary">已归档 {aiReportRecords.length} 条智能报告</Text>}
          >
            {aiReportRecords.length ? (
              <div style={{ padding: 20, background: '#f8fbff' }}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {aiReportRecords.map((record) => {
                    const isDeleting = deletingHistoryIds.includes(Number(record.id));
                    return (
                      <div
                        key={record.key}
                        style={{
                          border: '1px solid #e5edf8',
                          borderRadius: 22,
                          background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
                          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.05)',
                          padding: 24,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 20,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                            <Space wrap size={[8, 8]} style={{ marginBottom: 12 }}>
                              <Tag color="geekblue">{record.calcTypeLabel}</Tag>
                              {record.projectName ? <Tag color="blue">{record.projectName}</Tag> : null}
                            </Space>

                            <div
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                lineHeight: 1.45,
                                color: '#0f172a',
                                wordBreak: 'break-word',
                              }}
                              title={record.reportTitle}
                            >
                              {record.reportTitle}
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                fontSize: 14,
                                lineHeight: 1.85,
                                color: '#64748b',
                                wordBreak: 'break-word',
                              }}
                              title={record.reportAbstract}
                            >
                              {record.reportAbstract}
                            </div>
                            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                              <Space wrap>
                                <Button
                                  icon={<EyeOutlined style={{ color: '#22c1ff' }} />}
                                  onClick={() => setDetailPreview({ mode: 'history', row: record })}
                                  disabled={isDeleting}
                                >
                                  查看
                                </Button>
                                <Popconfirm
                                  title="确认删除这条智能报告？"
                                  description="删除后不可恢复。"
                                  okText="删除"
                                  cancelText="取消"
                                  onConfirm={() => void handleDeleteHistory(record)}
                                >
                                  <Button danger loading={isDeleting} icon={<DeleteOutlined />}>
                                    删除
                                  </Button>
                                </Popconfirm>
                              </Space>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Space>
              </div>
            ) : (
              <div style={{ padding: 40 }}>
                <Empty description="暂无智能报告历史记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Space>
      </div>
    </AnimatedPage>
  );
}
