import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = dirname(__dirname);
const envPath = join(workspaceRoot, 'pipeline-agent', '.env');
const port = Number.parseInt(process.env.PORT ?? '8100', 10);
const reportDir = join(workspaceRoot, 'agent-generated-reports');
const mysqlBin = process.env.MYSQL_BIN || 'D:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe';

mkdirSync(reportDir, { recursive: true });

function loadEnvFile() {
  const values = {};

  try {
    const content = readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      values[key] = value;
    }
  } catch (error) {
    console.error(`[qwen-agent-lite] failed to read env file: ${error}`);
  }

  return values;
}

function getConfig() {
  const fileEnv = loadEnvFile();
  const readValue = (key, fallback = '') => process.env[key] || fileEnv[key] || fallback;

  return {
    apiKey: readValue('OPENAI_API_KEY'),
    apiBase: readValue('OPENAI_API_BASE', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    model: readValue('LLM_MODEL', 'qwen-turbo'),
  };
}

function isPlaceholderKey(value) {
  if (!value) {
    return true;
  }

  const normalized = value.trim();
  return (
    normalized === 'sk-xxx' ||
    normalized === 'sk-your-api-key' ||
    normalized === 'sk-your-openai-key' ||
    normalized.includes('your-api-key')
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,satoken',
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(html);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeSql(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "''");
}

function toPosixPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function readMysqlConfig() {
  const fileEnv = loadEnvFile();
  const readValue = (key, fallback = '') => process.env[key] || fileEnv[key] || fallback;

  return {
    host: readValue('DB_HOST', '127.0.0.1'),
    port: readValue('DB_PORT', '3307'),
    user: readValue('DB_USER', 'root'),
    password: readValue('DB_PASSWORD', 'root'),
    database: readValue('DB_NAME', 'pipeline_cloud'),
  };
}

function runMysql(sql) {
  const config = readMysqlConfig();
  const output = execFileSync(
    mysqlBin,
    [
      `--user=${config.user}`,
      `--host=${config.host}`,
      `--port=${config.port}`,
      `--database=${config.database}`,
      '--default-character-set=utf8mb4',
      '--batch',
      '--raw',
      '--skip-column-names',
      '-e',
      sql,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        MYSQL_PWD: config.password,
      },
      windowsHide: true,
    },
  );

  return output.trim();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value) {
  return isRecord(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (isRecord(value) || Array.isArray(value)) {
      const resolved = resolveTextCandidate(value);
      if (resolved) {
        return resolved;
      }
    }

    return value;
  }
  return null;
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatNumber(value, digits = 3) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return '-';
  }

  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value, digits = 2) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return '-';
  }

  return `${numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}%`;
}

function formatEfficiency(value) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return '-';
  }

  const normalized = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
  return formatPercent(normalized, 2);
}

function formatBoolean(value) {
  if (value === true) {
    return '可行';
  }
  if (value === false) {
    return '不可行';
  }
  return '-';
}

function createTable(title, headers, rows) {
  return normalizeTable({ title, headers, rows });
}

function createAlert(message, level = 'warning') {
  return normalizeAlert({ message, level });
}

const VARIABLE_TYPE_LABELS = {
  FLOW_RATE: '流量',
  DENSITY: '密度',
  VISCOSITY: '黏度',
  DIAMETER: '管径',
  THICKNESS: '壁厚',
  ROUGHNESS: '粗糙度',
  START_ALTITUDE: '起点高程',
  END_ALTITUDE: '终点高程',
  INLET_PRESSURE: '首站进站压头',
  PUMP_480_NUM: 'ZMI480 泵数量',
  PUMP_375_NUM: 'ZMI375 泵数量',
  PUMP_480_HEAD: 'ZMI480 泵扬程',
  PUMP_375_HEAD: 'ZMI375 泵扬程',
};

const FALLBACK_REQUEST_TEXT = '当前运行分析报告需求';
const FALLBACK_BROKEN_TEXT = '原始内容存在乱码，请重新生成报告。';
const FALLBACK_SECTION_TEXT = '当前章节暂无有效内容。';
const FALLBACK_CELL_TEXT = '待补充';

function isBrokenText(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const questionMarks = (normalized.match(/\?/g) || []).length;
  return normalized.includes('�') || questionMarks >= Math.max(2, Math.floor(normalized.length / 4));
}

function sanitizeText(value, fallback = '-') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized || isBrokenText(normalized)) {
    return fallback;
  }

  return normalized;
}

function sanitizeDisplayValue(value, fallback = FALLBACK_CELL_TEXT) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'string') {
    return sanitizeText(value, fallback);
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => sanitizeDisplayValue(item, ''))
      .filter(Boolean)
      .join('、');
    return joined || fallback;
  }

  return fallback;
}

function normalizeTable(table, index = 0) {
  const item = asRecord(table);
  const rawRows = asArray(item.rows).map((row) => (Array.isArray(row) ? row : [row]));
  const maxColumnCount = rawRows.reduce((current, row) => Math.max(current, row.length), 0);
  const providedHeaders = asArray(item.headers)
    .map((header, headerIndex) => sanitizeDisplayValue(header, `列${headerIndex + 1}`))
    .filter(Boolean);
  const headers = providedHeaders.length > 0
    ? providedHeaders
    : Array.from({ length: maxColumnCount }, (_, columnIndex) => `列${columnIndex + 1}`);
  const rows = rawRows.map((row) =>
    headers.map((_, columnIndex) => sanitizeDisplayValue(row[columnIndex], FALLBACK_CELL_TEXT)));

  return {
    title: sanitizeText(item.title, headers.length > 0 ? `表格 ${index + 1}` : ''),
    headers,
    rows,
  };
}

function parseChartAxisValues(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
  }

  const primaryParts = trimmed
    .split(/[\r\n,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (primaryParts.length > 1) {
    return primaryParts;
  }

  return trimmed
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseChartSeriesData(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toNumber(item) ?? 0);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => toNumber(item) ?? 0);
      }
    } catch {}
  }

  const matches = trimmed.match(/-?\d+(?:\.\d+)?/g);
  return Array.isArray(matches) ? matches.map((item) => Number(item)) : [];
}

function normalizeChart(chart, index = 0) {
  const item = asRecord(chart);
  const chartData = asRecord(item.data);
  const xValues = (
    Array.isArray(chartData.x)
      ? chartData.x
      : Array.isArray(chartData.categories)
        ? chartData.categories
        : Array.isArray(chartData.dates)
          ? chartData.dates
          : []
  ).map((value, valueIndex) => sanitizeDisplayValue(value, `项 ${valueIndex + 1}`));
  const series = asArray(chartData.series).map((entry, seriesIndex) => {
    const seriesItem = asRecord(entry);
    return {
      name: sanitizeText(seriesItem.name, `系列 ${seriesIndex + 1}`),
      type: sanitizeText(seriesItem.type, sanitizeText(item.type, 'line')),
      data: Array.isArray(seriesItem.data)
        ? seriesItem.data.map((value) => toNumber(value) ?? 0)
        : [],
    };
  });

  if (xValues.length === 0) {
    xValues.push(
      ...(
        parseChartAxisValues(chartData.x).length > 0
          ? parseChartAxisValues(chartData.x)
          : parseChartAxisValues(chartData.categories).length > 0
            ? parseChartAxisValues(chartData.categories)
            : parseChartAxisValues(chartData.dates)
      ).map((value, valueIndex) => sanitizeDisplayValue(value, `椤?${valueIndex + 1}`)),
    );
  }

  const rawSeries = asArray(chartData.series);
  series.forEach((entry, seriesIndex) => {
    if (entry.data.length === 0) {
      entry.data = parseChartSeriesData(asRecord(rawSeries[seriesIndex]).data);
    }
  });

  return {
    title: sanitizeText(item.title, `图表 ${index + 1}`),
    type: sanitizeText(item.type, 'line'),
    unit: sanitizeText(item.unit, ''),
    data: {
      x: xValues,
      series,
    },
  };
}

function normalizeAlert(alert) {
  const item = asRecord(alert);
  const level = sanitizeText(item.level, 'warning');
  return {
    message: sanitizeText(item.message, FALLBACK_BROKEN_TEXT),
    level: ['success', 'info', 'warning', 'error'].includes(level) ? level : 'warning',
  };
}

function normalizeUnit(unit, variableType = '') {
  const cleaned = sanitizeText(unit, '');
  if (cleaned) {
    return cleaned
      .replaceAll('m?/h', 'm³/h')
      .replaceAll('m?/s', 'm³/s');
  }

  const normalizedType = String(variableType || '').trim().toUpperCase();
  if (normalizedType === 'FLOW_RATE') {
    return 'm³/h';
  }
  return '';
}

function getVariableTypeLabel(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return VARIABLE_TYPE_LABELS[normalized] || sanitizeText(String(value || ''), '-');
}

function getVariableDisplayLabel(variable) {
  const item = asRecord(variable);
  const type = String(pickFirstValue(item.variableType, '') || '').trim().toUpperCase();
  const unit = normalizeUnit(pickFirstValue(item.unit, ''), type);
  const baseLabel = sanitizeText(pickFirstValue(item.variableName, ''), VARIABLE_TYPE_LABELS[type] || getVariableTypeLabel(type));
  return unit ? `${baseLabel} (${unit})` : baseLabel;
}

function getFlowRegimeLabel(result) {
  const item = asRecord(result);
  const raw = sanitizeText(pickFirstValue(item.flowRegime, ''), '');
  if (raw) {
    return raw;
  }

  const reynoldsNumber = toNumber(item.reynoldsNumber);
  if (reynoldsNumber === null) {
    return '未知流态';
  }
  if (reynoldsNumber < 2300) {
    return '层流';
  }
  if (reynoldsNumber < 4000) {
    return '过渡流';
  }
  return '紊流';
}

function buildOptimizationNarrative(result) {
  const item = asRecord(result);
  const raw = sanitizeText(pickFirstValue(item.description, ''), '');
  if (raw) {
    return raw;
  }

  return `推荐方案：ZMI480 开启 ${formatNumber(item.pump480Num, 0)} 台，ZMI375 开启 ${formatNumber(item.pump375Num, 0)} 台，` +
    `末站进站压力 ${formatNumber(item.endStationInPressure, 3)} MPa，年能耗 ${formatNumber(item.totalEnergyConsumption, 3)} kWh，` +
    `预计总成本 ${formatNumber(item.totalCost, 3)} 元。`;
}

function buildSensitivityNarrative(ranking, variable) {
  const rankingRecord = asRecord(ranking);
  const variableRecord = asRecord(variable);
  const raw = sanitizeText(pickFirstValue(rankingRecord.description, ''), '');
  if (raw) {
    return raw;
  }

  const coefficient = Math.abs(toNumber(pickFirstValue(rankingRecord.sensitivityCoefficient, variableRecord.sensitivityCoefficient)) || 0);
  const level = coefficient >= 1 ? '高敏感性' : coefficient >= 0.3 ? '中敏感性' : '低敏感性';
  return `${level}：${getVariableDisplayLabel(variableRecord)} 变化对结果影响显著。`;
}

function createChart(title, type, xValues, series, unit = '') {
  return normalizeChart({
    title,
    type,
    unit,
    data: {
      x: asArray(xValues),
      series: asArray(series),
    },
  });
}

function toPercentValue(value) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return null;
  }
  return Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
}

function toWordHtml(report) {
  return renderReportHtmlV2(report);
}

function getSidecarPaths(filePath) {
  const basePath = String(filePath).replace(/\.[^.]+$/i, '');
  return {
    basePath,
    jsonPath: `${basePath}.json`,
    htmlPath: `${basePath}.html`,
    pdfPath: `${basePath}.pdf`,
  };
}

function toFileUrl(filePath) {
  return `file:///${toPosixPath(filePath)}`;
}

function tryCreatePdfFromHtml(htmlPath, pdfPath) {
  const browserCandidates = [
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];

  for (const browserPath of browserCandidates) {
    if (!existsSync(browserPath)) {
      continue;
    }

    try {
      execFileSync(
        browserPath,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdfPath}`,
          toFileUrl(htmlPath),
        ],
        {
          windowsHide: true,
          timeout: 45000,
        },
      );

      if (existsSync(pdfPath) && statSync(pdfPath).size > 0) {
        return true;
      }
    } catch (error) {
      console.warn(`[qwen-agent-lite] failed to render pdf with ${browserPath}: ${error}`);
    }
  }

  return false;
}

function renderSectionTables(tables) {
  return asArray(tables)
    .map((table) => {
      const headers = asArray(table.headers);
      const rows = asArray(table.rows);
      if (headers.length === 0 || rows.length === 0) {
        return '';
      }

      const title = typeof table.title === 'string' && table.title.trim()
        ? `<div class="table-title">${escapeHtml(table.title)}</div>`
        : '';

      return `${title}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${asArray(row).map((cell) => `<td>${escapeHtml(cell ?? '-')}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    })
    .join('');
}

const EXECUTIVE_METRIC_CONFIG = [
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['雷诺数'],
  },
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['流态'],
  },
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['摩阻损失'],
  },
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['末站进站压头'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['推荐泵组合'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['总扬程'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['年能耗'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['总成本'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['可行性'],
  },
];

function matchesReportKeywords(value, keywords) {
  const normalized = sanitizeText(value, '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function getNormalizedSectionTables(section) {
  return asArray(asRecord(section).tables)
    .map((table, index) => normalizeTable(table, index))
    .filter((table) => asArray(table.headers).length > 0 && asArray(table.rows).length > 0);
}

function findReportSection(sections, keywords) {
  return asArray(sections).find((section) =>
    matchesReportKeywords(asRecord(section).title, keywords)) || null;
}

function findMetricRowInSection(section, metricKeywords) {
  for (const table of getNormalizedSectionTables(section)) {
    for (const row of asArray(table.rows)) {
      if (matchesReportKeywords(asArray(row)[0] || '', metricKeywords)) {
        return asArray(row).map((cell) => sanitizeDisplayValue(cell));
      }
    }
  }

  return null;
}

function buildSensitivityExecutiveRows(section) {
  if (!section) {
    return [];
  }

  const explicitRows = [
    findMetricRowInSection(section, ['首要敏感变量']),
    findMetricRowInSection(section, ['敏感系数']),
    findMetricRowInSection(section, ['最大影响幅度']),
  ].filter(Boolean);

  if (explicitRows.length >= 2) {
    return explicitRows.map((row) => [
      '敏感性',
      row[0] || '敏感性指标',
      row[1] || FALLBACK_CELL_TEXT,
      row[2] || '-',
    ]);
  }

  const rankingTable = getNormalizedSectionTables(section).find((table) =>
    matchesReportKeywords(table.title, ['排名'])
    || asArray(table.headers).some((header) => matchesReportKeywords(header, ['排名', '敏感系数'])));
  const firstRow = asArray(rankingTable?.rows)[0];

  if (!firstRow) {
    return [];
  }

  const cells = asArray(firstRow).map((cell) => sanitizeDisplayValue(cell));
  return [
    ['敏感性', '首要敏感变量', cells[2] || cells[1] || FALLBACK_CELL_TEXT, cells[1] || '-'],
    ['敏感性', '敏感系数', cells[3] || FALLBACK_CELL_TEXT, cells[5] || '-'],
    ['敏感性', '最大影响幅度', cells[4] || FALLBACK_CELL_TEXT, cells[5] || '-'],
  ];
}

function buildExecutiveMetricOverviewTable(report) {
  const sections = asArray(report.sections);
  const summarySection = findReportSection(sections, ['报告摘要', '摘要']);
  const hydraulicSection = findReportSection(sections, ['水力结果', '水力']);
  const optimizationSection = findReportSection(sections, ['优化结果', '优化']);
  const sensitivitySection = findReportSection(sections, ['敏感性结果', '敏感性']);
  const rows = [];
  const seenMetrics = new Set();

  const pushMetricRow = (category, row, fallbackMetric) => {
    if (!row) {
      return;
    }

    const metric = row[0] || fallbackMetric;
    const key = `${category}-${metric}`;
    if (seenMetrics.has(key)) {
      return;
    }

    seenMetrics.add(key);
    rows.push([
      category,
      metric,
      row[1] || FALLBACK_CELL_TEXT,
      row[2] || '-',
    ]);
  };

  EXECUTIVE_METRIC_CONFIG.forEach((item) => {
    const targetSection = item.category === '水力结果'
      ? hydraulicSection
      : optimizationSection;
    pushMetricRow(
      item.category,
      findMetricRowInSection(targetSection, item.metricKeywords)
        || findMetricRowInSection(summarySection, item.metricKeywords),
      item.metricKeywords[0],
    );
  });

  buildSensitivityExecutiveRows(sensitivitySection || summarySection).forEach((row) => {
    const key = `${row[0]}-${row[1]}`;
    if (seenMetrics.has(key)) {
      return;
    }

    seenMetrics.add(key);
    rows.push(row);
  });

  return rows.length > 0
    ? createTable('关键指标总览', ['类别', '指标', '结果', '单位/说明'], rows)
    : null;
}

function renderExecutiveMetricOverview(report) {
  const metricTable = buildExecutiveMetricOverviewTable(report);
  return metricTable ? renderSectionTables([metricTable]) : '';
}

function shouldRenderTablesFirstForSection(title) {
  return matchesReportKeywords(title, ['摘要', '结论', '建议']);
}

function renderReportSectionBody(section) {
  const sectionTitle = sanitizeText(asRecord(section).title, '');
  const tablesFirst = shouldRenderTablesFirstForSection(sectionTitle);
  const contentHtml = section.content
    ? `<p class="section-desc${tablesFirst ? ' summary-note' : ''}">${escapeHtml(section.content || '')}</p>`
    : '';
  const chartsHtml = renderChartSummaries(section.charts);
  const tablesHtml = renderSectionTables(section.tables);
  const alertsHtml = renderSectionAlerts(section.alerts);

  return tablesFirst
    ? `${tablesHtml}${contentHtml}${chartsHtml}${alertsHtml}`
    : `${contentHtml}${chartsHtml}${tablesHtml}${alertsHtml}`;
}

function renderSectionAlerts(alerts) {
  return asArray(alerts)
    .map((alert) => {
      const data = asRecord(alert);
      const message = typeof data.message === 'string' ? data.message.trim() : '';
      if (!message) {
        return '';
      }

      return `<div class="alert">${escapeHtml(message)}</div>`;
    })
    .join('');
}

function renderChartSummaries(charts) {
  return asArray(charts)
    .map((chart) => {
      const item = asRecord(chart);
      const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '趋势图';
      const data = asRecord(item.data);
      const series = asArray(data.series);
      if (series.length === 0) {
        return '';
      }

      const summaries = series
        .map((seriesItem) => {
          const current = asRecord(seriesItem);
          const name = pickFirstValue(current.name, '系列');
          const values = asArray(current.data)
            .slice(0, 6)
            .map((value) => escapeHtml(value))
            .join(' / ');
          return `<li><strong>${escapeHtml(name)}：</strong>${values || '-'}</li>`;
        })
        .join('');

      return `<div class="chart-note">
        <div class="chart-title">${escapeHtml(title)}</div>
        <ul>${summaries}</ul>
      </div>`;
    })
    .join('');
}

function renderReportHtml(report) {
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
  const sections = Array.isArray(report.sections) ? report.sections : [];

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      body { font-family: "Microsoft YaHei", "Segoe UI", sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      main { max-width: 1180px; margin: 0 auto; padding: 40px 24px 64px; }
      h1 { margin: 0 0 8px; font-size: 32px; }
      .meta { color: #64748b; margin-bottom: 28px; }
      .card { background: #fff; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 16px; padding: 24px; margin-bottom: 20px; }
      h2 { margin: 0 0 12px; font-size: 22px; }
      p { line-height: 1.8; white-space: pre-wrap; }
      ul { margin: 0; padding-left: 20px; }
      li { line-height: 1.8; margin: 6px 0; }
      .table-title { margin: 16px 0 8px; font-weight: 600; color: #0f172a; }
      .table-wrap { overflow-x: auto; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 12px; }
      .chart-note { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: #F8FAFC; }
      .chart-title { font-weight: 600; margin-bottom: 8px; }
      .alert { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #FFF7ED; color: #9A3412; }
      table { width: 100%; min-width: 720px; border-collapse: collapse; background: #fff; }
      th, td { padding: 10px 12px; border-bottom: 1px solid rgba(15, 23, 42, 0.08); text-align: left; vertical-align: top; }
      th { background: #f8fafc; font-weight: 600; white-space: nowrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(report.title)}</h1>
      <div class="meta">生成时间：${escapeHtml(report.generate_time || new Date().toISOString())}</div>
      <section class="card">
        <h2>摘要</h2>
        <p>${escapeHtml(report.summary || '')}</p>
      </section>
      ${
        recommendations.length > 0
          ? `<section class="card"><h2>建议</h2><ul>${recommendations
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')}</ul></section>`
          : ''
      }
      ${sections
        .map(
          (section) => `<section class="card">
        <h2>${escapeHtml(section.title || '章节')}</h2>
        <p>${escapeHtml(section.content || '')}</p>
        ${renderChartSummaries(section.charts)}
        ${renderSectionTables(section.tables)}
        ${renderSectionAlerts(section.alerts)}
      </section>`,
        )
        .join('')}
    </main>
  </body>
</html>`;
}

function renderReportHtmlV2(report) {
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
  const sections = Array.isArray(report.sections) ? report.sections : [];
  const chartCount = sections.reduce((count, section) => count + asArray(section.charts).length, 0);
  const tableCount = sections.reduce((count, section) => count + asArray(section.tables).length, 0);
  const alertCount = sections.reduce((count, section) => count + asArray(section.alerts).length, 0);
  const executiveMetricOverview = renderExecutiveMetricOverview(report);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      :root {
        --bg: #eef4f8;
        --ink: #0f172a;
        --muted: #475569;
        --line: rgba(15, 23, 42, 0.10);
        --panel: #ffffff;
        --panel-soft: #f8fbfd;
        --accent: #155e75;
        --accent-soft: #e0f2fe;
        --warm: #fff7ed;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(21, 94, 117, 0.12), transparent 30%),
          linear-gradient(180deg, #f7fafc 0%, var(--bg) 100%);
      }
      main { max-width: 1180px; margin: 0 auto; padding: 40px 24px 72px; }
      .hero {
        padding: 36px;
        border-radius: 28px;
        color: #f8fafc;
        background:
          linear-gradient(135deg, rgba(8, 47, 73, 0.94), rgba(21, 94, 117, 0.92)),
          linear-gradient(120deg, rgba(14, 116, 144, 0.30), transparent);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
      }
      .hero-badge {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 { margin: 14px 0 12px; font-size: 34px; line-height: 1.2; }
      .hero-summary,
      .section-desc {
        margin: 0;
        line-height: 1.9;
        white-space: pre-wrap;
      }
      .hero-summary { color: rgba(241, 245, 249, 0.94); max-width: 860px; }
      .hero-meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-top: 24px;
      }
      .meta-card {
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.12);
      }
      .meta-card span {
        display: block;
        margin-bottom: 8px;
        color: rgba(226, 232, 240, 0.82);
        font-size: 12px;
      }
      .meta-card strong {
        display: block;
        color: #ffffff;
        font-size: 16px;
      }
      .summary-card,
      .section-card {
        margin-top: 22px;
        padding: 24px 26px;
        border-radius: 24px;
        background: var(--panel);
        border: 1px solid var(--line);
        box-shadow: 0 16px 30px rgba(15, 23, 42, 0.05);
      }
      .summary-card h2,
      .section-card h2 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      .section-head {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 14px;
      }
      .section-no {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 700;
      }
      .section-kicker {
        margin: 0 0 4px;
        color: #64748b;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .section-desc { color: var(--muted); }
      .summary-note { margin-top: 14px; }
      .recommendation-list {
        margin: 0;
        padding-left: 22px;
      }
      .recommendation-list li {
        margin: 6px 0;
        line-height: 1.9;
      }
      .table-title {
        margin: 18px 0 10px;
        color: var(--ink);
        font-weight: 700;
      }
      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--panel-soft);
      }
      .chart-note {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 18px;
        background: linear-gradient(180deg, #f8fbfd 0%, #eef7fb 100%);
        border: 1px solid rgba(14, 116, 144, 0.10);
      }
      .chart-title {
        margin-bottom: 8px;
        font-weight: 700;
      }
      .chart-note ul {
        margin: 0;
        padding-left: 18px;
      }
      .alert {
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 14px;
        background: var(--warm);
        border: 1px solid rgba(217, 119, 6, 0.14);
        color: #9a3412;
        line-height: 1.8;
      }
      table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        background: #fff;
      }
      th, td {
        padding: 11px 12px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f1f7fa;
        color: var(--ink);
        font-weight: 700;
        white-space: nowrap;
      }
      tbody tr:nth-child(even) td {
        background: rgba(241, 247, 250, 0.68);
      }
      @media print {
        body { background: #ffffff; }
        main { padding: 0; }
        .hero, .summary-card, .section-card { box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="hero-badge">Pipeline Analysis Report</div>
        <h1>${escapeHtml(report.title)}</h1>
        <p class="hero-summary">${escapeHtml(report.summary || '')}</p>
        <div class="hero-meta">
          <div class="meta-card">
            <span>生成时间</span>
            <strong>${escapeHtml(report.generate_time || new Date().toISOString())}</strong>
          </div>
          <div class="meta-card">
            <span>章节数量</span>
            <strong>${sections.length}</strong>
          </div>
          <div class="meta-card">
            <span>图表 / 表格</span>
            <strong>${chartCount} / ${tableCount}</strong>
          </div>
          <div class="meta-card">
            <span>告警 / 建议</span>
            <strong>${alertCount} / ${recommendations.length}</strong>
          </div>
        </div>
      </section>

      <section class="summary-card">
        <h2>报告摘要</h2>
        ${executiveMetricOverview}
        ${report.summary ? `<p class="section-desc${executiveMetricOverview ? ' summary-note' : ''}">${escapeHtml(report.summary || '')}</p>` : ''}
      </section>

      ${
        recommendations.length > 0
          ? `<section class="summary-card"><h2>重点建议</h2><ul class="recommendation-list">${recommendations
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')}</ul></section>`
          : ''
      }

      ${sections
        .map(
          (section, index) => `<section class="section-card">
        <div class="section-head">
          <div class="section-no">${String(index + 1).padStart(2, '0')}</div>
          <div>
            <p class="section-kicker">Section ${String(index + 1).padStart(2, '0')}</p>
            <h2>${escapeHtml(section.title || '章节')}</h2>
          </div>
        </div>
        ${renderReportSectionBody(section)}
      </section>`,
        )
        .join('')}
    </main>
  </body>
</html>`;
}

function renderExcelHtml(report) {
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
  const sections = Array.isArray(report.sections) ? report.sections : [];

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <meta name="ProgId" content="Excel.Sheet" />
    <meta name="Generator" content="Qwen Agent Lite" />
    <style>
      body { font-family: "Microsoft YaHei", Arial, sans-serif; color: #111827; }
      h1 { font-size: 22pt; }
      h2 { font-size: 15pt; margin-top: 24px; }
      p { white-space: pre-wrap; line-height: 1.6; }
      table { border-collapse: collapse; margin: 12px 0 18px; min-width: 960px; }
      th, td { border: 1px solid #CBD5E1; padding: 6px 10px; text-align: left; vertical-align: top; }
      th { background: #E2E8F0; font-weight: 700; }
      .meta { color: #475569; margin-bottom: 16px; }
      .table-title { font-weight: 700; margin-top: 10px; }
      ul { margin: 0 0 12px 20px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="meta">生成时间：${escapeHtml(report.generate_time || new Date().toISOString())}</div>
    <h2>摘要</h2>
    <p>${escapeHtml(report.summary || '')}</p>
    ${
      recommendations.length > 0
        ? `<h2>建议</h2><ul>${recommendations
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('')}</ul>`
        : ''
    }
    ${sections
      .map((section) => {
        const tables = asArray(section.tables)
          .map((table) => {
            const headers = asArray(table.headers);
            const rows = asArray(table.rows);
            if (headers.length === 0 || rows.length === 0) {
              return '';
            }

            const tableTitle = typeof table.title === 'string' && table.title.trim()
              ? `<div class="table-title">${escapeHtml(table.title)}</div>`
              : '';

            return `${tableTitle}
            <table>
              <thead>
                <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${rows.map((row) => `<tr>${asArray(row).map((cell) => `<td>${escapeHtml(cell ?? '-')}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>`;
          })
          .join('');

        return `
          <h2>${escapeHtml(section.title || 'Section')}</h2>
          ${section.content ? `<p>${escapeHtml(section.content)}</p>` : ''}
          ${tables}`;
      })
      .join('')}
  </body>
</html>`;
}

function persistReportFiles(report) {
  const baseName = `agent_report_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const wordPath = join(reportDir, `${baseName}.doc`);
  const sidecarPaths = getSidecarPaths(wordPath);

  writeFileSync(wordPath, toWordHtml(report), 'utf8');
  writeFileSync(sidecarPaths.htmlPath, renderReportHtmlV2(report), 'utf8');
  writeFileSync(sidecarPaths.jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const hasPdf = tryCreatePdfFromHtml(sidecarPaths.htmlPath, sidecarPaths.pdfPath);
  const pdfFileName = hasPdf ? `${baseName}.pdf` : null;

  return {
    filePath: toPosixPath(wordPath),
    fileName: `${baseName}.doc`,
    fileSize: statSync(wordPath).size,
    jsonPath: toPosixPath(sidecarPaths.jsonPath),
    htmlPath: toPosixPath(sidecarPaths.htmlPath),
    pdfPath: hasPdf ? toPosixPath(sidecarPaths.pdfPath) : null,
    pdfFileName,
  };
}

function getLocalReportCount() {
  if (!existsSync(reportDir)) {
    return 0;
  }

  return readdirSync(reportDir).filter((fileName) =>
    /^agent_report_.*\.json$/i.test(String(fileName))).length;
}

function insertReportRecord(report, fileInfo, contextMeta = {}) {
  const reportNo = `AIRPT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const projectId = Number.isFinite(Number(contextMeta.projectId)) ? Number(contextMeta.projectId) : 0;
  const historyIds = Array.isArray(contextMeta.historyIds) && contextMeta.historyIds.length > 0
    ? contextMeta.historyIds.join(',')
    : null;
  const sql = `
INSERT INTO t_analysis_report
  (pro_id, report_no, report_type, report_title, report_summary,
   file_name, file_path, file_format, file_size, history_ids, status, create_by)
VALUES
  (${projectId}, '${escapeSql(reportNo)}', 'AI_REPORT', '${escapeSql(report.title)}', '${escapeSql(report.summary || '')}',
   '${escapeSql(fileInfo.fileName)}', '${escapeSql(fileInfo.filePath)}', 'DOC', ${Number(fileInfo.fileSize) || 0}, ${historyIds ? `'${escapeSql(historyIds)}'` : 'NULL'}, 1, 'agent');
SELECT LAST_INSERT_ID();
`;

  const output = runMysql(sql).split(/\r?\n/).filter(Boolean);
  const insertedId = Number.parseInt(output[output.length - 1] || '', 10);
  if (!Number.isFinite(insertedId)) {
    throw new Error('Failed to persist generated report metadata.');
  }

  return insertedId;
}

function queryReportRecord(reportId) {
  const sql = `
SELECT JSON_OBJECT(
  'id', id,
  'proId', pro_id,
  'reportNo', report_no,
  'reportType', report_type,
  'reportTitle', report_title,
  'reportSummary', report_summary,
  'fileName', file_name,
  'filePath', file_path,
  'fileFormat', file_format,
  'fileSize', file_size,
  'status', status,
  'createBy', create_by,
  'createTime', DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%s')
)
FROM t_analysis_report
WHERE id = ${Number(reportId)};
`;

  const output = runMysql(sql);
  if (!output) {
    return null;
  }

  return JSON.parse(output);
}

function loadPersistedReport(reportId) {
  const record = queryReportRecord(reportId);
  if (!record?.filePath) {
    return null;
  }

  const { jsonPath } = getSidecarPaths(record.filePath);
  const content = readFileSync(jsonPath, 'utf8');
  const fallbackRequest = sanitizeText(
    record.reportTitle || record.reportNo || FALLBACK_REQUEST_TEXT,
    FALLBACK_REQUEST_TEXT,
  );

  return {
    record,
    report: ensureDraftReportStructure(normalizeReport(JSON.parse(content), fallbackRequest), fallbackRequest),
  };
}

function deleteReportRecord(reportId) {
  runMysql(`DELETE FROM t_analysis_report WHERE id = ${Number(reportId)};`);
}

function deletePersistedReport(reportId) {
  const record = queryReportRecord(reportId);
  if (!record) {
    return null;
  }

  const wordPath = record.filePath || '';
  const { jsonPath, htmlPath, pdfPath } = getSidecarPaths(wordPath);

  if (wordPath && existsSync(wordPath)) {
    unlinkSync(wordPath);
  }
  if (jsonPath && existsSync(jsonPath)) {
    unlinkSync(jsonPath);
  }
  if (htmlPath && existsSync(htmlPath)) {
    unlinkSync(htmlPath);
  }
  if (pdfPath && existsSync(pdfPath)) {
    unlinkSync(pdfPath);
  }

  deleteReportRecord(reportId);
  return record;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

function normalizeReport(parsed, userRequest) {
  const safeUserRequest = sanitizeText(userRequest, FALLBACK_REQUEST_TEXT);
  const sections = Array.isArray(parsed?.sections)
    ? parsed.sections
        .filter((section) => section && typeof section === 'object')
        .map((section, index) => ({
          title:
            sanitizeText(section.title, `Section ${index + 1}`),
          content:
            sanitizeText(section.content, FALLBACK_SECTION_TEXT),
          charts: Array.isArray(section.charts)
            ? section.charts.map((chart, chartIndex) => normalizeChart(chart, chartIndex))
            : [],
          tables: Array.isArray(section.tables)
            ? section.tables.map((table, tableIndex) => normalizeTable(table, tableIndex))
            : [],
          alerts: Array.isArray(section.alerts)
            ? section.alerts.map((alert) => normalizeAlert(alert))
            : [],
        }))
    : [];

  const fallbackContent =
    sanitizeText(
      typeof parsed === 'string' ? parsed : '',
      'The model returned an empty response. Please refine the request and try again.',
    );

  return {
    title:
      sanitizeText(parsed?.title, `运行分析报告：${safeUserRequest.slice(0, 40)}`),
    generate_time: new Date().toISOString(),
    summary:
      sanitizeText(parsed?.summary, fallbackContent.slice(0, 240)),
    recommendations: Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
          .map((item) => sanitizeText(item, ''))
          .filter(Boolean)
      : [],
    sections:
      sections.length > 0
        ? sections
        : [
            {
              title: 'Overview',
              content: sanitizeText(fallbackContent, FALLBACK_SECTION_TEXT),
              charts: [],
              tables: [],
              alerts: [],
            },
          ],
  };
}

function parseJsonRecord(value) {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {}
  }

  return {};
}

function resolveTextCandidate(value) {
  if (typeof value === 'string') {
    return sanitizeText(value, '');
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveTextCandidate(item);
      if (resolved) {
        return resolved;
      }
    }
    return '';
  }

  if (isRecord(value)) {
    return pickFirstText(
      value.project_name,
      value.projectName,
      value.name,
      value.label,
      value.text,
      value.title,
      value.value,
    );
  }

  return '';
}

function pickFirstText(...values) {
  for (const value of values) {
    const resolved = resolveTextCandidate(value);
    if (resolved) {
      return resolved;
    }
  }

  return '';
}

function normalizeHistorySnapshot(snapshot) {
  const item = asRecord(snapshot);
  if (Object.keys(item).length === 0) {
    return null;
  }

  return {
    ...item,
    input: parseJsonRecord(item.input),
    output: parseJsonRecord(item.output),
    projectName: pickFirstText(item.projectName, item.project_name, asRecord(item.project).name),
  };
}

function normalizeHistoryCollection(histories) {
  const item = asRecord(histories);
  return {
    hydraulic: normalizeHistorySnapshot(item.hydraulic),
    optimization: normalizeHistorySnapshot(item.optimization),
    sensitivity: normalizeHistorySnapshot(item.sensitivity),
  };
}

function normalizePercentNumber(value) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return null;
  }

  return Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
}

function getHistoryBaseParams(snapshot) {
  const input = parseJsonRecord(snapshot?.input);
  return asRecord(isRecord(input.baseParams) ? input.baseParams : input);
}

function getSensitivityVariables(snapshot) {
  const input = parseJsonRecord(snapshot?.input);
  return asArray(input.variables).map((item) => asRecord(item));
}

function splitRecommendationText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  return text
    .split(/[；;。\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildInputSection(histories) {
  const hydraulicParams = getHistoryBaseParams(histories.hydraulic);
  const optimizationParams = getHistoryBaseParams(histories.optimization);
  const sensitivityParams = getHistoryBaseParams(histories.sensitivity);
  const availability = [
    isRecord(histories.hydraulic) ? 1 : 0,
    isRecord(histories.optimization) ? 1 : 0,
    isRecord(histories.sensitivity) ? 1 : 0,
  ];
  const sensitivityVariables = getSensitivityVariables(histories.sensitivity)
    .map((item) => getVariableDisplayLabel(item))
    .filter(Boolean)
    .join('、');

  const merged = {
    flowRate: pickFirstValue(hydraulicParams.flowRate, optimizationParams.flowRate, sensitivityParams.flowRate),
    density: pickFirstValue(hydraulicParams.density, optimizationParams.density, sensitivityParams.density),
    viscosity: pickFirstValue(hydraulicParams.viscosity, optimizationParams.viscosity, sensitivityParams.viscosity),
    length: pickFirstValue(hydraulicParams.length, optimizationParams.length, sensitivityParams.length),
    diameter: pickFirstValue(hydraulicParams.diameter, optimizationParams.diameter, sensitivityParams.diameter),
    thickness: pickFirstValue(hydraulicParams.thickness, optimizationParams.thickness, sensitivityParams.thickness),
    roughness: pickFirstValue(hydraulicParams.roughness, optimizationParams.roughness, sensitivityParams.roughness),
    startAltitude: pickFirstValue(hydraulicParams.startAltitude, optimizationParams.startAltitude, sensitivityParams.startAltitude),
    endAltitude: pickFirstValue(hydraulicParams.endAltitude, optimizationParams.endAltitude, sensitivityParams.endAltitude),
    inletPressure: pickFirstValue(hydraulicParams.inletPressure, optimizationParams.inletPressure, sensitivityParams.inletPressure),
    pump480Num: pickFirstValue(hydraulicParams.pump480Num, sensitivityParams.pump480Num),
    pump375Num: pickFirstValue(hydraulicParams.pump375Num, sensitivityParams.pump375Num),
    pump480Head: pickFirstValue(hydraulicParams.pump480Head, optimizationParams.pump480Head, sensitivityParams.pump480Head),
    pump375Head: pickFirstValue(hydraulicParams.pump375Head, optimizationParams.pump375Head, sensitivityParams.pump375Head),
    pumpEfficiency: optimizationParams.pumpEfficiency,
    motorEfficiency: optimizationParams.motorEfficiency,
    electricityPrice: optimizationParams.electricityPrice,
    workingDays: optimizationParams.workingDays,
    sensitivityVariables,
  };

  return {
    title: '运行概览',
    content:
      '本节汇总报告关联的计算输入、分析范围和最近一次可用计算结果覆盖情况，用于快速确认报告依据是否完整。',
    charts: [
      createChart('计算结果覆盖情况', 'bar', ['水力分析', '泵站优化', '敏感性分析'], [
        { name: '已关联结果', data: availability },
      ]),
    ],
    tables: [
      createTable('计算入参汇总表', ['参数', '数值', '单位'], [
        ['流量', formatNumber(merged.flowRate, 3), 'm³/h'],
        ['密度', formatNumber(merged.density, 3), 'kg/m³'],
        ['粘度', formatNumber(merged.viscosity, 6), 'm²/s'],
        ['长度', formatNumber(merged.length, 3), 'km'],
        ['管径', formatNumber(merged.diameter, 3), 'mm'],
        ['壁厚', formatNumber(merged.thickness, 3), 'mm'],
        ['粗糙度', formatNumber(merged.roughness, 6), 'm'],
        ['起点高程', formatNumber(merged.startAltitude, 3), 'm'],
        ['终点高程', formatNumber(merged.endAltitude, 3), 'm'],
        ['首站进站压头', formatNumber(merged.inletPressure, 3), 'm'],
        ['ZMI480 泵数量', formatNumber(merged.pump480Num, 0), '台'],
        ['ZMI375 泵数量', formatNumber(merged.pump375Num, 0), '台'],
        ['ZMI480 泵扬程', formatNumber(merged.pump480Head, 3), 'm'],
        ['ZMI375 泵扬程', formatNumber(merged.pump375Head, 3), 'm'],
        ['泵效率', formatEfficiency(merged.pumpEfficiency), '%'],
        ['电机效率', formatEfficiency(merged.motorEfficiency), '%'],
        ['电价', formatNumber(merged.electricityPrice, 4), '元/kWh'],
        ['工作天数', formatNumber(merged.workingDays, 0), '天'],
        ['敏感变量类型', merged.sensitivityVariables || '-', '-'],
      ]),
      createTable('计算结果覆盖检查表', ['模块', '状态'], [
        ['水力分析', availability[0] ? '已关联' : '缺失'],
        ['泵站优化', availability[1] ? '已关联' : '缺失'],
        ['敏感性分析', availability[2] ? '已关联' : '缺失'],
      ]),
    ],
    alerts: availability.every((item) => item === 1)
      ? []
      : [createAlert('当前报告存在缺失的计算结果模块，相关章节会保留占位并提示补算。')],
  };
}

function buildHydraulicSection(histories) {
  const hasHydraulic = isRecord(histories.hydraulic);
  const hasOptimization = isRecord(histories.optimization);
  const hydraulic = asRecord(hasHydraulic ? histories.hydraulic.output : {});
  const optimization = asRecord(hasOptimization ? histories.optimization.output : {});
  const comparisonSeries = [];

  if (hasHydraulic) {
    comparisonSeries.push({
      name: '当前工况',
      data: [
        toNumber(hydraulic.endStationInPressure) ?? 0,
        toNumber(hydraulic.frictionHeadLoss) ?? 0,
        toNumber(hydraulic.totalHead) ?? 0,
      ],
    });
  }

  if (hasOptimization) {
    comparisonSeries.push({
      name: '优化方案',
      data: [
        toNumber(optimization.endStationInPressure) ?? 0,
        toNumber(optimization.totalPressureDrop) ?? 0,
        toNumber(optimization.totalHead) ?? 0,
      ],
    });
  }

  return {
    title: '能耗分析',
    content:
      '本节聚焦末站压头、摩阻/压降、总扬程、年能耗与总成本等关键输送指标，用于判断当前工况与优化方案的能耗表现。',
    tables: [
      createTable('水力结果表', ['指标', '结果', '单位'], [
        ['雷诺数', formatNumber(hydraulic.reynoldsNumber, 3), '-'],
        ['流态', getFlowRegimeLabel(hydraulic), '-'],
        ['摩阻损失', formatNumber(hydraulic.frictionHeadLoss, 3), 'm'],
        ['水力坡降', formatNumber(hydraulic.hydraulicSlope, 6), '-'],
        ['总扬程', formatNumber(hydraulic.totalHead, 3), 'm'],
        ['首站出站压头', formatNumber(hydraulic.firstStationOutPressure, 3), 'MPa'],
        ['末站进站压头', formatNumber(hydraulic.endStationInPressure, 3), 'MPa'],
      ]),
      createTable('能耗与成本结果表', ['指标', '结果', '单位'], [
        ['推荐泵组合', `ZMI480 × ${formatNumber(optimization.pump480Num, 0)} + ZMI375 × ${formatNumber(optimization.pump375Num, 0)}`, '-'],
        ['总压降', formatNumber(optimization.totalPressureDrop, 3), 'm'],
        ['年能耗', formatNumber(optimization.totalEnergyConsumption, 3), 'kWh'],
        ['总成本', formatNumber(optimization.totalCost, 3), '元'],
        ['方案可行性', formatBoolean(optimization.isFeasible), '-'],
      ]),
    ],
    charts: comparisonSeries.length > 0
      ? [
          createChart('关键输送指标对比', 'bar', ['末站进站压头', '沿线压降/摩阻', '总扬程'], comparisonSeries),
        ]
      : [],
    alerts: [
      ...(!hasHydraulic ? [createAlert('未读取到最近一次水力分析历史，本节结果以 "-" 占位。')] : []),
      ...(!hasOptimization ? [createAlert('未读取到最近一次泵站优化历史，能耗与成本对比项将使用占位值。')] : []),
    ],
  };
}

function buildOptimizationSection(histories) {
  const hasOptimization = isRecord(histories.optimization);
  const result = asRecord(hasOptimization ? histories.optimization.output : {});
  const params = getHistoryBaseParams(histories.optimization);
  const recommendedCombo = `ZMI480 × ${formatNumber(result.pump480Num, 0)} + ZMI375 × ${formatNumber(result.pump375Num, 0)}`;
  const pumpEfficiencyPercent = toPercentValue(params.pumpEfficiency);
  const motorEfficiencyPercent = toPercentValue(params.motorEfficiency);
  const alerts = [];

  if (!hasOptimization) {
    alerts.push(createAlert('未读取到最近一次泵站优化历史，本节结果以 "-" 占位。'));
  }
  if (pumpEfficiencyPercent !== null && pumpEfficiencyPercent < 80) {
    alerts.push(createAlert(`当前录入的泵效率约为 ${formatNumber(pumpEfficiencyPercent, 2)}%，存在进一步校核或优化空间。`));
  }
  if (motorEfficiencyPercent !== null && motorEfficiencyPercent < 85) {
    alerts.push(createAlert(`当前录入的电机效率约为 ${formatNumber(motorEfficiencyPercent, 2)}%，建议核查设备状态与负载匹配度。`));
  }

  return {
    title: '泵站效率',
    content:
      '本节展示泵组台数、泵/电机效率、推荐泵组合和调度可行性，用于评估泵站运行效率和设备组合匹配程度。',
    charts: [
      createChart('泵组配置与效率概览', 'bar', ['ZMI480 台数', 'ZMI375 台数', '泵效率(%)', '电机效率(%)'], [
        {
          name: '推荐方案',
          data: [
            toNumber(result.pump480Num) ?? 0,
            toNumber(result.pump375Num) ?? 0,
            pumpEfficiencyPercent ?? 0,
            motorEfficiencyPercent ?? 0,
          ],
        },
      ]),
    ],
    tables: [
      createTable('优化结果表', ['指标', '结果', '单位'], [
        ['推荐泵组合', recommendedCombo, '-'],
        ['总扬程', formatNumber(result.totalHead, 3), 'm'],
        ['总压降', formatNumber(result.totalPressureDrop, 3), 'm'],
        ['末站进站压头', formatNumber(result.endStationInPressure, 3), 'MPa'],
        ['可行性', formatBoolean(result.isFeasible), '-'],
        ['年能耗', formatNumber(result.totalEnergyConsumption, 3), 'kWh'],
        ['总成本', formatNumber(result.totalCost, 3), '元'],
        ['推荐说明', buildOptimizationNarrative(result), '-'],
      ]),
      createTable('泵站效率与配置表', ['指标', '结果', '单位'], [
        ['泵效率', formatNumber(pumpEfficiencyPercent, 2), '%'],
        ['电机效率', formatNumber(motorEfficiencyPercent, 2), '%'],
        ['ZMI480 泵扬程', formatNumber(params.pump480Head, 3), 'm'],
        ['ZMI375 泵扬程', formatNumber(params.pump375Head, 3), 'm'],
        ['工作天数', formatNumber(params.workingDays, 0), '天'],
        ['电价', formatNumber(params.electricityPrice, 4), '元/kWh'],
      ]),
    ],
    alerts,
  };
}

function buildSensitivitySection(histories) {
  const hasSensitivity = isRecord(histories.sensitivity);
  const result = asRecord(hasSensitivity ? histories.sensitivity.output : {});
  const baseResult = asRecord(result.baseResult);

  const rankingMap = new Map();
  asArray(result.sensitivityRanking).forEach((item) => {
    const ranking = asRecord(item);
    const key = pickFirstValue(ranking.variableType, ranking.variableName);
    if (key) {
      rankingMap.set(String(key), ranking);
    }
  });

  const summaryRows = [];
  const rankingRows = [];
  const detailRows = [];
  const seenRankingKeys = new Set();

  asArray(result.variableResults).forEach((item) => {
    const variable = asRecord(item);
    const ranking =
      rankingMap.get(String(pickFirstValue(variable.variableType, ''))) ||
      rankingMap.get(String(pickFirstValue(variable.variableName, ''))) ||
      {};
    const variableLabel = getVariableDisplayLabel(variable);
    const variableType = getVariableTypeLabel(variable.variableType);
    const fullVariableLabel = variableLabel;
    const points = asArray(variable.dataPoints);
    const rankingKey = String(pickFirstValue(variable.variableType, variable.variableName, fullVariableLabel));
    const rankingCoefficient = pickFirstValue(
      ranking.sensitivityCoefficient,
      variable.sensitivityCoefficient,
      '-',
    );

    summaryRows.push([
      variableType,
      fullVariableLabel,
      formatNumber(variable.baseValue, 6),
      formatNumber(variable.sensitivityCoefficient, 6),
      formatPercent(variable.maxImpactPercent, 2),
      pickFirstValue(variable.trend, '-'),
    ]);

    if (!seenRankingKeys.has(rankingKey)) {
      seenRankingKeys.add(rankingKey);
      rankingRows.push([
        formatNumber(ranking.rank, 0),
        variableType,
        fullVariableLabel,
        formatNumber(rankingCoefficient, 6),
        buildSensitivityNarrative(ranking, variable),
      ]);
    }

    if (points.length === 0) {
      return;
    }

    points.forEach((point) => {
      const detail = asRecord(point);
      detailRows.push([
        variableType,
        fullVariableLabel,
        formatPercent(detail.changePercent, 2),
        formatNumber(detail.variableValue, 6),
        formatNumber(detail.endStationPressure, 3),
        formatPercent(detail.pressureChangePercent, 2),
        formatNumber(detail.frictionHeadLoss, 3),
        formatPercent(detail.frictionChangePercent, 2),
        formatNumber(detail.hydraulicSlope, 6),
        formatNumber(detail.reynoldsNumber, 3),
        getFlowRegimeLabel(detail),
      ]);
    });
  });

  asArray(result.sensitivityRanking).forEach((item) => {
    const ranking = asRecord(item);
    const rankingKey = String(
      pickFirstValue(ranking.variableType, ranking.variableName, randomUUID()),
    );
    if (seenRankingKeys.has(rankingKey)) {
      return;
    }
    seenRankingKeys.add(rankingKey);
    rankingRows.push([
      formatNumber(ranking.rank, 0),
      getVariableTypeLabel(ranking.variableType),
      getVariableDisplayLabel(ranking),
      formatNumber(ranking.sensitivityCoefficient, 6),
      buildSensitivityNarrative(ranking, ranking),
    ]);
  });

  const topVariable = asRecord(asArray(result.variableResults)[0]);
  const topVariableLabel = getVariableDisplayLabel(topVariable);
  const topPoints = asArray(topVariable.dataPoints);
  const sensitivityCharts = topPoints.length > 0
    ? [
        createChart(
          `${topVariableLabel} 变化对压力/摩阻的影响`,
          'line',
          topPoints.map((point) => formatPercent(asRecord(point).changePercent, 2)),
          [
            {
              name: '末站进站压头',
              data: topPoints.map((point) => toNumber(asRecord(point).endStationPressure) ?? 0),
            },
            {
              name: '摩阻损失',
              data: topPoints.map((point) => toNumber(asRecord(point).frictionHeadLoss) ?? 0),
            },
          ],
        ),
      ]
    : [];
  const riskAlerts = [];
  const firstRanking = asRecord(asArray(result.sensitivityRanking)[0]);
  const topCoefficient = toNumber(firstRanking.sensitivityCoefficient);
  const endStationPressure = toNumber(baseResult.endStationInPressure);

  if (!hasSensitivity) {
    riskAlerts.push(createAlert('未读取到最近一次敏感性分析历史，本节结果以 "-" 占位。'));
  }
  if (endStationPressure !== null && endStationPressure < 2) {
    riskAlerts.push(createAlert(`末站进站压头仅 ${formatNumber(endStationPressure, 3)} MPa，建议复核安全裕度和高负荷时段调度。`));
  }
  if (topCoefficient !== null && Math.abs(topCoefficient) >= 0.3) {
    riskAlerts.push(createAlert(`敏感性排名第一的变量 ${getVariableDisplayLabel(firstRanking)} 对结果影响较大，建议列入重点监控。`));
  }

  return {
    title: '异常与风险',
    content:
      '本节结合敏感性分析结果识别压力、摩阻和关键变量波动风险，并给出异常关注点与重点监控对象。',
    charts: sensitivityCharts,
    tables: [
      createTable('敏感性基准结果表', ['指标', '结果', '单位'], [
        ['雷诺数', formatNumber(baseResult.reynoldsNumber, 3), '-'],
        ['流态', getFlowRegimeLabel(baseResult), '-'],
        ['摩阻损失', formatNumber(baseResult.frictionHeadLoss, 3), 'm'],
        ['水力坡降', formatNumber(baseResult.hydraulicSlope, 6), '-'],
        ['总扬程', formatNumber(baseResult.totalHead, 3), 'm'],
        ['末站进站压头', formatNumber(baseResult.endStationInPressure, 3), 'MPa'],
      ]),
      createTable('敏感性汇总表', [
        '敏感变量类型',
        '敏感变量',
        '基准值',
        '敏感系数',
        '最大影响幅度(%)',
        '趋势',
      ], summaryRows),
      createTable('敏感性排名表', [
        '排名',
        '敏感变量类型',
        '敏感变量',
        '敏感系数',
        '说明',
      ], rankingRows),
      createTable('敏感性变化比例明细表', [
        '敏感变量类型',
        '敏感变量',
        '变化比例(%)',
        '变量值',
        '末站进站压头(MPa)',
        '压力变化率(%)',
        '摩阻损失(m)',
        '摩阻变化率(%)',
        '水力坡降',
        '雷诺数',
        '流态',
      ], detailRows),
    ],
    alerts: riskAlerts,
  };
}

function legacyBuildRiskAlerts(histories) {
  const alerts = [];
  const hydraulicResult = asRecord(isRecord(histories.hydraulic) ? histories.hydraulic.output : {});
  const optimizationResult = asRecord(isRecord(histories.optimization) ? histories.optimization.output : {});
  const sensitivityResult = asRecord(isRecord(histories.sensitivity) ? histories.sensitivity.output : {});
  const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);

  const endPressure = toNumber(hydraulicResult.endStationInPressure);
  if (endPressure !== null && endPressure < 2) {
    alerts.push(createAlert(`末站进站压头为 ${formatNumber(endPressure, 3)} MPa，处于需要重点复核的区间。`));
  }

  if (optimizationResult.isFeasible === false) {
    alerts.push(createAlert('当前推荐泵组方案不可行，需回退运行方案并补充约束条件。'));
  }

  const topCoefficient = toNumber(firstRanking.sensitivityCoefficient);
  if (topCoefficient !== null && Math.abs(topCoefficient) >= 0.3) {
    alerts.push(createAlert(`敏感性排名首位变量为 ${getVariableDisplayLabel(firstRanking)}` +
      `，敏感系数 ${formatNumber(topCoefficient, 6)}，建议纳入重点波动监控。`));
  }

  return alerts;
}

function buildMetricSummarySection(histories, projectName, userRequest) {
  const hydraulicResult = asRecord(isRecord(histories.hydraulic) ? histories.hydraulic.output : {});
  const optimizationResult = asRecord(isRecord(histories.optimization) ? histories.optimization.output : {});
  const sensitivityResult = asRecord(isRecord(histories.sensitivity) ? histories.sensitivity.output : {});
  const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);
  const riskAlerts = buildRiskAlerts(histories);

  return {
    title: '核心指标摘要与结论',
    content:
      `${buildStructuredSummary(histories) || '当前缺少完整的计算历史，报告已按可用结果生成结构化摘要。'} ` +
      `${riskAlerts.length > 0 ? '综合判断：当前运行总体可控，但需重点关注告警项与高敏感变量。' : '综合判断：当前运行总体平稳，建议按优化建议逐项落地。'}`,
    charts: [
      createChart('关键指标概览（成本/能耗已做缩放）', 'bar', ['末站压头(MPa)', '摩阻损失(m)', '年能耗(×1000 kWh)', '总成本(×10000 元)'], [
        {
          name: projectName || userRequest.slice(0, 12) || '当前项目',
          data: [
            toNumber(hydraulicResult.endStationInPressure) ?? 0,
            toNumber(hydraulicResult.frictionHeadLoss) ?? 0,
            (toNumber(optimizationResult.totalEnergyConsumption) ?? 0) / 1000,
            (toNumber(optimizationResult.totalCost) ?? 0) / 10000,
          ],
        },
      ]),
    ],
    tables: [
      createTable('关键指标摘要表', ['指标', '数值', '单位'], [
        ['项目', projectName || '-', '-'],
        ['末站进站压头', formatNumber(hydraulicResult.endStationInPressure, 3), 'MPa'],
        ['摩阻损失', formatNumber(hydraulicResult.frictionHeadLoss, 3), 'm'],
        ['总扬程', formatNumber(hydraulicResult.totalHead, 3), 'm'],
        ['年能耗', formatNumber(optimizationResult.totalEnergyConsumption, 3), 'kWh'],
        ['总成本', formatNumber(optimizationResult.totalCost, 3), '元'],
        ['推荐泵组合', `ZMI480 × ${formatNumber(optimizationResult.pump480Num, 0)} + ZMI375 × ${formatNumber(optimizationResult.pump375Num, 0)}`, '-'],
        ['首要敏感变量', getVariableDisplayLabel(firstRanking), '-'],
        ['敏感系数', formatNumber(firstRanking.sensitivityCoefficient, 6), '-'],
      ]),
    ],
    alerts: riskAlerts.slice(0, 3),
  };
}

function buildRecommendationSection(histories, recommendations) {
  const hydraulicResult = asRecord(isRecord(histories.hydraulic) ? histories.hydraulic.output : {});
  const sensitivityResult = asRecord(isRecord(histories.sensitivity) ? histories.sensitivity.output : {});
  const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);
  const defaultRecommendations = recommendations.length > 0
    ? recommendations
    : ['补齐最近一次计算历史后重新生成报告，以获得更可靠的优化建议。'];

  const actionRows = defaultRecommendations.slice(0, 4).map((item, index) => [
    item,
    index === 0 ? '高' : index === 1 ? '中高' : '中',
    index === 0
      ? '优先改善末站压力和能耗指标'
      : index === 1
        ? '优化泵组调度，降低不必要扬程'
        : '提升运行稳定性并降低波动风险',
    getVariableDisplayLabel(firstRanking) === '-'
      ? '需结合现场约束复核'
      : `重点关注 ${getVariableDisplayLabel(firstRanking)}`,
  ]);

  return {
    title: '优化建议',
    content:
      '本节汇总可直接执行的优化动作，并给出优先级、预期收益和落地时需要关注的风险提示。',
    charts: [
      createChart('建议执行优先级', 'bar', defaultRecommendations.slice(0, 4).map((_, index) => `建议 ${index + 1}`), [
        {
          name: '优先级',
          data: defaultRecommendations.slice(0, 4).map((_, index) => (index === 0 ? 5 : index === 1 ? 4 : 3)),
        },
      ]),
    ],
    tables: [
      createTable('优化建议执行清单', ['建议事项', '优先级', '预期收益', '风险提示'], actionRows),
      createTable('落地复核项', ['复核项', '当前值', '建议动作'], [
        ['末站进站压头', formatNumber(hydraulicResult.endStationInPressure, 3), '确认高负荷时段是否仍满足安全裕度'],
        ['首要敏感变量', getVariableDisplayLabel(firstRanking), '纳入重点监测与调度联动'],
        ['泵组方案', recommendations[0] || '按当前组合运行', '结合电价与工况安排切换窗口'],
      ]),
    ],
    alerts: [
      createAlert('优化建议需要结合现场调度窗口、设备状态和安全边界联合执行。'),
    ],
  };
}

function legacyBuildStructuredSummary(histories) {
  const parts = [];

  if (isRecord(histories.hydraulic)) {
    const result = asRecord(histories.hydraulic.output);
    parts.push(
      `水力结果显示雷诺数为 ${formatNumber(result.reynoldsNumber, 3)}，流态为 ${getFlowRegimeLabel(result)}，摩阻损失 ${formatNumber(result.frictionHeadLoss, 3)} m，末站进站压头 ${formatNumber(result.endStationInPressure, 3)} MPa。`,
    );
  }

  if (isRecord(histories.optimization)) {
    const result = asRecord(histories.optimization.output);
    parts.push(
      `优化结果推荐泵组合为 ZMI480 × ${formatNumber(result.pump480Num, 0)} + ZMI375 × ${formatNumber(result.pump375Num, 0)}，总扬程 ${formatNumber(result.totalHead, 3)} m，总成本 ${formatNumber(result.totalCost, 3)} 元，方案${formatBoolean(result.isFeasible)}。`,
    );
  }

  if (isRecord(histories.sensitivity)) {
    const result = asRecord(histories.sensitivity.output);
    const firstRanking = asRecord(asArray(result.sensitivityRanking)[0]);
    parts.push(
      `敏感性分析中排名第一的变量为 ${getVariableDisplayLabel(firstRanking)}，敏感系数 ${formatNumber(firstRanking.sensitivityCoefficient, 6)}。`,
    );
  }

  return parts.join('');
}

function legacyBuildStructuredRecommendations(histories) {
  const recommendations = [];

  if (isRecord(histories.optimization)) {
    const optimizationResult = asRecord(histories.optimization.output);
    recommendations.push(...splitRecommendationText(buildOptimizationNarrative(optimizationResult)).slice(0, 2));
  }

  if (isRecord(histories.sensitivity)) {
    const sensitivityResult = asRecord(histories.sensitivity.output);
    const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);
    const variableName = getVariableDisplayLabel(firstRanking);
    if (variableName && variableName !== '-') {
      recommendations.push(`优先关注 ${variableName} 的波动，它对末站压力和摩阻变化影响最明显。`);
    }
  }

  if (isRecord(histories.hydraulic)) {
    const hydraulicResult = asRecord(histories.hydraulic.output);
    recommendations.push(
      `持续复核末站进站压头 ${formatNumber(hydraulicResult.endStationInPressure, 3)} MPa 与现场控制下限之间的安全裕度。`,
    );
  }

  const fallbackRecommendations = [
    '结合高负荷时段重新核查泵组切换策略，避免无效扬程带来的额外能耗。',
    '将末站进站压头与摩阻损失纳入班次级监控，发现偏离后及时调整输送方案。',
    '针对敏感性排名靠前的变量建立阈值预警，优先处置对压力与摩阻影响最大的波动源。',
  ];

  const normalized = recommendations.filter(Boolean);
  for (const item of fallbackRecommendations) {
    if (normalized.length >= 4) {
      break;
    }
    normalized.push(item);
  }

  return normalized.slice(0, 4);
}

function getMergedCalculationInputs(histories) {
  const hydraulicParams = getHistoryBaseParams(histories.hydraulic);
  const optimizationParams = getHistoryBaseParams(histories.optimization);
  const sensitivityParams = getHistoryBaseParams(histories.sensitivity);
  const sensitivityVariables = getSensitivityVariables(histories.sensitivity);

  return {
    flowRate: pickFirstValue(hydraulicParams.flowRate, optimizationParams.flowRate, sensitivityParams.flowRate),
    density: pickFirstValue(hydraulicParams.density, optimizationParams.density, sensitivityParams.density),
    viscosity: pickFirstValue(hydraulicParams.viscosity, optimizationParams.viscosity, sensitivityParams.viscosity),
    length: pickFirstValue(hydraulicParams.length, optimizationParams.length, sensitivityParams.length),
    diameter: pickFirstValue(hydraulicParams.diameter, optimizationParams.diameter, sensitivityParams.diameter),
    thickness: pickFirstValue(hydraulicParams.thickness, optimizationParams.thickness, sensitivityParams.thickness),
    roughness: pickFirstValue(hydraulicParams.roughness, optimizationParams.roughness, sensitivityParams.roughness),
    startAltitude: pickFirstValue(hydraulicParams.startAltitude, optimizationParams.startAltitude, sensitivityParams.startAltitude),
    endAltitude: pickFirstValue(hydraulicParams.endAltitude, optimizationParams.endAltitude, sensitivityParams.endAltitude),
    inletPressure: pickFirstValue(hydraulicParams.inletPressure, optimizationParams.inletPressure, sensitivityParams.inletPressure),
    pump480Num: pickFirstValue(hydraulicParams.pump480Num, sensitivityParams.pump480Num),
    pump375Num: pickFirstValue(hydraulicParams.pump375Num, sensitivityParams.pump375Num),
    pump480Head: pickFirstValue(hydraulicParams.pump480Head, optimizationParams.pump480Head, sensitivityParams.pump480Head),
    pump375Head: pickFirstValue(hydraulicParams.pump375Head, optimizationParams.pump375Head, sensitivityParams.pump375Head),
    pumpEfficiency: pickFirstValue(optimizationParams.pumpEfficiency, hydraulicParams.pumpEfficiency),
    motorEfficiency: pickFirstValue(optimizationParams.motorEfficiency, hydraulicParams.motorEfficiency),
    electricityPrice: pickFirstValue(optimizationParams.electricityPrice, hydraulicParams.electricityPrice),
    workingDays: pickFirstValue(optimizationParams.workingDays, hydraulicParams.workingDays),
    sensitivityVariables,
  };
}

function legacyGetRecommendedPumpCombination(result) {
  return `ZMI480 × ${formatNumber(result.pump480Num, 0)}，ZMI375 × ${formatNumber(result.pump375Num, 0)}`;
}

function legacyBuildExecutiveSection(histories, projectName, userRequest, recommendations) {
  const hydraulicResult = asRecord(isRecord(histories.hydraulic) ? histories.hydraulic.output : {});
  const optimizationResult = asRecord(isRecord(histories.optimization) ? histories.optimization.output : {});
  const sensitivityResult = asRecord(isRecord(histories.sensitivity) ? histories.sensitivity.output : {});
  const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);
  const riskAlerts = buildRiskAlerts(histories);

  return {
    title: '报告摘要',
    content:
      `${buildStructuredSummary(histories) || '当前报告基于最近一次计算记录自动生成。'} ` +
      `${recommendations.length > 0 ? '报告已经同步整理出可执行建议，并在文末给出优先级。' : '当前缺少完整优化建议，请结合计算结果进一步复核。'}`,
    charts: [
      createChart('关键指标速览', 'bar', ['末站进站压头', '摩阻损失', '总扬程', '年能耗(÷1000)', '总成本(÷10000)'], [
        {
          name: projectName || sanitizeText(userRequest, '当前项目'),
          data: [
            toNumber(hydraulicResult.endStationInPressure) ?? 0,
            toNumber(hydraulicResult.frictionHeadLoss) ?? 0,
            toNumber(hydraulicResult.totalHead) ?? 0,
            (toNumber(optimizationResult.totalEnergyConsumption) ?? 0) / 1000,
            (toNumber(optimizationResult.totalCost) ?? 0) / 10000,
          ],
        },
      ]),
    ],
    tables: [
      createTable('摘要总览', ['项目', '内容'], [
        ['项目名称', projectName || '-'],
        ['报告主题', sanitizeText(userRequest, FALLBACK_REQUEST_TEXT)],
        ['关键结论', buildStructuredSummary(histories) || '-'],
        ['首要敏感变量', getVariableDisplayLabel(firstRanking)],
        ['推荐泵组合', getRecommendedPumpCombination(optimizationResult)],
      ]),
    ],
    alerts: riskAlerts.slice(0, 3),
  };
}

function buildDetailedInputSection(histories) {
  const merged = getMergedCalculationInputs(histories);
  const sensitivityRows = merged.sensitivityVariables.length > 0
    ? merged.sensitivityVariables.map((item) => [
        getVariableTypeLabel(item.variableType),
        getVariableDisplayLabel(item),
        sanitizeText(item.unit, '-'),
      ])
    : [['-', '-', '-']];
  const availability = [
    isRecord(histories.hydraulic) ? 1 : 0,
    isRecord(histories.optimization) ? 1 : 0,
    isRecord(histories.sensitivity) ? 1 : 0,
  ];

  return {
    title: '一、计算入参',
    content: '本节集中展示报告生成所依据的流体参数、管道参数、泵站运行参数以及敏感性变量配置，便于复核计算边界与前提条件。',
    charts: [
      createChart('计算上下文覆盖情况', 'bar', ['水力分析', '优化计算', '敏感性分析'], [
        { name: '已关联记录', data: availability },
      ]),
    ],
    tables: [
      createTable('流体与管道参数', ['字段', '数值', '单位'], [
        ['流量', formatNumber(merged.flowRate, 3), 'm³/h'],
        ['密度', formatNumber(merged.density, 3), 'kg/m³'],
        ['粘度', formatNumber(merged.viscosity, 6), 'm²/s'],
        ['长度', formatNumber(merged.length, 3), 'km'],
        ['管径', formatNumber(merged.diameter, 3), 'mm'],
        ['壁厚', formatNumber(merged.thickness, 3), 'mm'],
        ['粗糙度', formatNumber(merged.roughness, 6), 'm'],
        ['起点高程', formatNumber(merged.startAltitude, 3), 'm'],
        ['终点高程', formatNumber(merged.endAltitude, 3), 'm'],
      ]),
      createTable('站场与运行参数', ['字段', '数值', '单位'], [
        ['首站进站压头', formatNumber(merged.inletPressure, 3), 'm'],
        ['ZMI480 泵数量', formatNumber(merged.pump480Num, 0), '台'],
        ['ZMI375 泵数量', formatNumber(merged.pump375Num, 0), '台'],
        ['ZMI480 扬程', formatNumber(merged.pump480Head, 3), 'm'],
        ['ZMI375 扬程', formatNumber(merged.pump375Head, 3), 'm'],
        ['泵效率', formatEfficiency(merged.pumpEfficiency), '%'],
        ['电机效率', formatEfficiency(merged.motorEfficiency), '%'],
        ['电价', formatNumber(merged.electricityPrice, 4), '元/kWh'],
        ['工作天数', formatNumber(merged.workingDays, 0), '天'],
      ]),
      createTable('敏感变量类型', ['变量类型', '变量名称', '单位'], sensitivityRows),
    ],
    alerts: availability.every((item) => item === 1)
      ? []
      : [createAlert('当前报告缺少部分计算模块记录，已按现有可用数据生成；建议先补齐最近一次水力、优化和敏感性计算。')],
  };
}

function buildDetailedHydraulicSection(histories) {
  const hasHydraulic = isRecord(histories.hydraulic);
  const result = asRecord(hasHydraulic ? histories.hydraulic.output : {});
  const alerts = [];

  if (!hasHydraulic) {
    alerts.push(createAlert('未读取到最近一次水力分析记录，本节将以占位值展示。'));
  }

  return {
    title: '二、水力结果',
    content: '本节展示水力计算的核心输出，包括雷诺数、流态、摩阻损失、水力坡降以及站场压头结果，用于判断当前输送工况是否满足设计与运行要求。',
    charts: [
      createChart('水力关键指标', 'bar', ['摩阻损失', '总扬程', '首站出站压头', '末站进站压头'], [
        {
          name: '当前工况',
          data: [
            toNumber(result.frictionHeadLoss) ?? 0,
            toNumber(result.totalHead) ?? 0,
            toNumber(result.firstStationOutPressure) ?? 0,
            toNumber(result.endStationInPressure) ?? 0,
          ],
        },
      ]),
    ],
    tables: [
      createTable('水力计算结果表', ['字段', '结果', '单位'], [
        ['雷诺数', formatNumber(result.reynoldsNumber, 3), '-'],
        ['流态', getFlowRegimeLabel(result), '-'],
        ['摩阻损失', formatNumber(result.frictionHeadLoss, 3), 'm'],
        ['水力坡降', formatNumber(result.hydraulicSlope, 6), '-'],
        ['总扬程', formatNumber(result.totalHead, 3), 'm'],
        ['首站出站压头', formatNumber(result.firstStationOutPressure, 3), 'MPa'],
        ['末站进站压头', formatNumber(result.endStationInPressure, 3), 'MPa'],
      ]),
    ],
    alerts,
  };
}

function buildDetailedOptimizationSection(histories) {
  const hasOptimization = isRecord(histories.optimization);
  const result = asRecord(hasOptimization ? histories.optimization.output : {});
  const alerts = [];

  if (!hasOptimization) {
    alerts.push(createAlert('未读取到最近一次优化计算记录，本节将以占位值展示。'));
  }

  if (result.isFeasible === false) {
    alerts.push(createAlert('当前推荐泵组合判定为不可行，请优先回看约束条件和目标流量设置。'));
  }

  return {
    title: '三、优化结果',
    content: '本节集中展示泵站优化计算输出，包括推荐泵组合、总扬程、总压降、末站进站压头、可行性、年能耗、总成本以及推荐说明。',
    charts: [
      createChart('优化方案关键指标', 'bar', ['总扬程', '总压降', '末站进站压头'], [
        {
          name: '优化结果',
          data: [
            toNumber(result.totalHead) ?? 0,
            toNumber(result.totalPressureDrop) ?? 0,
            toNumber(result.endStationInPressure) ?? 0,
          ],
        },
      ]),
      createChart('年度能耗与成本概览', 'bar', ['年能耗(÷1000)', '总成本(÷10000)'], [
        {
          name: '年度指标',
          data: [
            (toNumber(result.totalEnergyConsumption) ?? 0) / 1000,
            (toNumber(result.totalCost) ?? 0) / 10000,
          ],
        },
      ]),
    ],
    tables: [
      createTable('优化计算结果表', ['字段', '结果', '单位'], [
        ['推荐泵组合', getRecommendedPumpCombination(result), '-'],
        ['总扬程', formatNumber(result.totalHead, 3), 'm'],
        ['总压降', formatNumber(result.totalPressureDrop, 3), 'm'],
        ['末站进站压头', formatNumber(result.endStationInPressure, 3), 'MPa'],
        ['可行性', formatBoolean(result.isFeasible), '-'],
        ['年能耗', formatNumber(result.totalEnergyConsumption, 3), 'kWh'],
        ['总成本', formatNumber(result.totalCost, 3), '元'],
        ['推荐说明', buildOptimizationNarrative(result), '-'],
      ]),
    ],
    alerts,
  };
}

function buildDetailedSensitivitySection(histories) {
  const hasSensitivity = isRecord(histories.sensitivity);
  const result = asRecord(hasSensitivity ? histories.sensitivity.output : {});
  const baseResult = asRecord(result.baseResult);
  const rankingMap = new Map();
  const variableMetaMap = new Map();
  const rankingRows = [];
  const detailRows = [];
  const seenRankingKeys = new Set();

  asArray(result.sensitivityRanking).forEach((item) => {
    const ranking = asRecord(item);
    const key = String(pickFirstValue(ranking.variableType, ranking.variableName, ''));
    if (key) {
      rankingMap.set(key, ranking);
    }
  });

  asArray(result.variableResults).forEach((item) => {
    const variable = asRecord(item);
    const key = String(pickFirstValue(variable.variableType, variable.variableName, ''));
    const ranking = rankingMap.get(key) || rankingMap.get(String(pickFirstValue(variable.variableName, ''))) || {};
    const variableLabel = getVariableDisplayLabel(variable);
    const variableTypeLabel = getVariableTypeLabel(variable.variableType);

    if (key) {
      variableMetaMap.set(key, {
        variableTypeLabel,
        variableLabel,
        maxImpactPercent: pickFirstValue(variable.maxImpactPercent, '-'),
        trend: pickFirstValue(variable.trend, '-'),
      });
    }

    if (!seenRankingKeys.has(key)) {
      seenRankingKeys.add(key);
      rankingRows.push([
        formatNumber(pickFirstValue(ranking.rank, '-'), 0),
        variableTypeLabel,
        variableLabel,
        formatNumber(pickFirstValue(ranking.sensitivityCoefficient, variable.sensitivityCoefficient, '-'), 6),
        formatPercent(pickFirstValue(variable.maxImpactPercent, '-'), 2),
        pickFirstValue(variable.trend, '-'),
        buildSensitivityNarrative(ranking, variable),
      ]);
    }

    asArray(variable.dataPoints).forEach((point) => {
      const detail = asRecord(point);
      detailRows.push([
        variableTypeLabel,
        variableLabel,
        formatPercent(detail.changePercent, 2),
        formatNumber(detail.variableValue, 6),
        formatNumber(detail.endStationPressure, 3),
        formatPercent(detail.pressureChangePercent, 2),
        formatNumber(detail.frictionHeadLoss, 3),
        formatPercent(detail.frictionChangePercent, 2),
        getFlowRegimeLabel(detail),
      ]);
    });
  });

  asArray(result.sensitivityRanking).forEach((item) => {
    const ranking = asRecord(item);
    const key = String(pickFirstValue(ranking.variableType, ranking.variableName, randomUUID()));
    if (seenRankingKeys.has(key)) {
      return;
    }
    seenRankingKeys.add(key);
    const meta = asRecord(variableMetaMap.get(key));
    rankingRows.push([
      formatNumber(ranking.rank, 0),
      getVariableTypeLabel(ranking.variableType),
      getVariableDisplayLabel(ranking),
      formatNumber(ranking.sensitivityCoefficient, 6),
      formatPercent(meta.maxImpactPercent, 2),
      pickFirstValue(meta.trend, '-'),
      buildSensitivityNarrative(ranking, ranking),
    ]);
  });

  const topVariable = asRecord(asArray(result.variableResults)[0]);
  const topVariableLabel = getVariableDisplayLabel(topVariable);
  const topPoints = asArray(topVariable.dataPoints);
  const firstRanking = asRecord(asArray(result.sensitivityRanking)[0]);
  const topCoefficient = toNumber(firstRanking.sensitivityCoefficient);
  const alerts = [];

  if (!hasSensitivity) {
    alerts.push(createAlert('未读取到最近一次敏感性分析记录，本节将以占位值展示。'));
  }

  if (topCoefficient !== null && Math.abs(topCoefficient) >= 0.3) {
    alerts.push(createAlert(`当前最敏感变量为 ${getVariableDisplayLabel(firstRanking)}，敏感系数 ${formatNumber(topCoefficient, 6)}，建议纳入重点监测。`));
  }

  return {
    title: '四、敏感性结果',
    content: '本节汇总敏感性分析的基准结果、敏感系数、最大影响幅度、变量排名以及各变化比例下的压力、摩阻和流态明细。',
    charts: topPoints.length > 0
      ? [
          createChart(`${topVariableLabel} 对压力与摩阻的影响`, 'line', topPoints.map((point) => formatPercent(asRecord(point).changePercent, 2)), [
            {
              name: '末站进站压头',
              data: topPoints.map((point) => toNumber(asRecord(point).endStationPressure) ?? 0),
            },
            {
              name: '摩阻损失',
              data: topPoints.map((point) => toNumber(asRecord(point).frictionHeadLoss) ?? 0),
            },
          ]),
        ]
      : [],
    tables: [
      createTable('基准结果表', ['字段', '结果', '单位'], [
        ['基准雷诺数', formatNumber(baseResult.reynoldsNumber, 3), '-'],
        ['基准流态', getFlowRegimeLabel(baseResult), '-'],
        ['基准摩阻损失', formatNumber(baseResult.frictionHeadLoss, 3), 'm'],
        ['基准水力坡降', formatNumber(baseResult.hydraulicSlope, 6), '-'],
        ['基准总扬程', formatNumber(baseResult.totalHead, 3), 'm'],
        ['基准末站进站压头', formatNumber(baseResult.endStationInPressure, 3), 'MPa'],
      ]),
      createTable('敏感性排名表', ['排名', '变量类型', '变量名称', '敏感系数', '最大影响幅度', '趋势', '说明'], rankingRows.length > 0 ? rankingRows : [['-', '-', '-', '-', '-', '-', '-']]),
      createTable('各变化比例明细', ['变量类型', '变量名称', '变化比例', '变量值', '末站进站压头', '压力变化率', '摩阻损失', '摩阻变化率', '流态'], detailRows.length > 0 ? detailRows : [['-', '-', '-', '-', '-', '-', '-', '-', '-']]),
    ],
    alerts,
  };
}

function legacyBuildDetailedRecommendationSection(histories, recommendations) {
  const hydraulicResult = asRecord(isRecord(histories.hydraulic) ? histories.hydraulic.output : {});
  const optimizationResult = asRecord(isRecord(histories.optimization) ? histories.optimization.output : {});
  const sensitivityResult = asRecord(isRecord(histories.sensitivity) ? histories.sensitivity.output : {});
  const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);
  const defaultRecommendations = recommendations.length > 0
    ? recommendations
    : ['建议先补齐最近一次水力、优化和敏感性分析结果，再生成正式报告。'];

  return {
    title: '五、结论与建议',
    content: '本节给出报告结论、执行建议以及落地前需要复核的关键指标，便于形成后续调度和优化动作。',
    charts: [
      createChart('建议优先级', 'bar', defaultRecommendations.map((_, index) => `建议 ${index + 1}`), [
        {
          name: '优先级',
          data: defaultRecommendations.map((_, index) => (index === 0 ? 5 : index === 1 ? 4 : 3)),
        },
      ]),
    ],
    tables: [
      createTable('执行建议清单', ['建议事项', '优先级', '对应关注点'], defaultRecommendations.map((item, index) => [
        item,
        index === 0 ? '高' : index === 1 ? '中高' : '中',
        index === 0
          ? '优先改善末站进站压头与总压降'
          : index === 1
            ? '结合泵站方案降低能耗与总成本'
            : '持续跟踪高敏感变量与流态变化',
      ])),
      createTable('复核要点', ['字段', '当前结果', '建议动作'], [
        ['末站进站压头', formatNumber(hydraulicResult.endStationInPressure, 3), '确认高负荷时段是否仍满足安全裕度'],
        ['推荐泵组合', getRecommendedPumpCombination(optimizationResult), '结合现场调度窗口安排切换验证'],
        ['总成本', formatNumber(optimizationResult.totalCost, 3), '与当前方案进行年度成本对比'],
        ['首要敏感变量', getVariableDisplayLabel(firstRanking), '纳入重点监测并设置预警阈值'],
      ]),
    ],
    alerts: buildRiskAlerts(histories),
  };
}

function legacyBuildStructuredReport(userRequest, reportContext) {
  const context = asRecord(reportContext);
  const histories = asRecord(context.latest_histories);
  const requestedProject = asRecord(context.requested_project);
  const recommendations = buildStructuredRecommendations(histories);
  const projectName = sanitizeText(pickFirstValue(
    requestedProject.project_name,
    asRecord(histories.hydraulic).projectName,
    asRecord(histories.optimization).projectName,
    asRecord(histories.sensitivity).projectName,
  ), '');
  const safeUserRequest = sanitizeText(userRequest, FALLBACK_REQUEST_TEXT);
  const sections = [
    buildExecutiveSection(histories, projectName, safeUserRequest, recommendations),
    buildDetailedInputSection(histories),
    buildDetailedHydraulicSection(histories),
    buildDetailedOptimizationSection(histories),
    buildDetailedSensitivitySection(histories),
    buildDetailedRecommendationSection(histories, recommendations),
  ].filter(Boolean);

  return normalizeReport({
    title: projectName ? `${projectName}运行分析报告` : `运行分析报告：${safeUserRequest.slice(0, 24)}`,
    summary: buildStructuredSummary(histories),
    recommendations,
    sections,
  }, safeUserRequest);
}

const SMART_HISTORY_MODULES = [
  { key: 'hydraulic', label: '水力分析' },
  { key: 'optimization', label: '优化计算' },
  { key: 'sensitivity', label: '敏感性分析' },
];

function getRecommendedPumpCombination(result) {
  const pump480 = formatNumber(result.pump480Num, 0);
  const pump375 = formatNumber(result.pump375Num, 0);
  if (pump480 === '-' && pump375 === '-') {
    return '-';
  }

  return `ZMI480 × ${pump480} + ZMI375 × ${pump375}`;
}

function getMissingHistoryLabels(histories) {
  return SMART_HISTORY_MODULES
    .filter(({ key }) => !isRecord(histories[key]))
    .map(({ label }) => label);
}

function getPrimarySensitivityRecord(histories) {
  const sensitivitySnapshot = asRecord(histories.sensitivity);
  const sensitivityResult = asRecord(sensitivitySnapshot.output);
  const firstRanking = asRecord(asArray(sensitivityResult.sensitivityRanking)[0]);
  const variableResults = asArray(sensitivityResult.variableResults).map((item) => asRecord(item));
  const matchedVariable = variableResults.find((item) => {
    const variableType = String(pickFirstValue(item.variableType, '') || '');
    const rankingType = String(pickFirstValue(firstRanking.variableType, '') || '');
    const variableName = String(pickFirstValue(item.variableName, '') || '');
    const rankingName = String(pickFirstValue(firstRanking.variableName, '') || '');
    return (variableType && variableType === rankingType) || (variableName && variableName === rankingName);
  }) || asRecord(variableResults[0]);

  return {
    ranking: firstRanking,
    variable: matchedVariable,
  };
}

function getFrictionSharePercent(result) {
  const frictionLoss = toNumber(result.frictionHeadLoss);
  const totalHead = toNumber(result.totalHead);
  if (frictionLoss === null || totalHead === null || totalHead <= 0) {
    return null;
  }

  return (frictionLoss / totalHead) * 100;
}

function getSensitivityLevelLabel(value) {
  const coefficient = Math.abs(toNumber(value) || 0);
  if (coefficient >= 1) {
    return '高敏感';
  }
  if (coefficient >= 0.3) {
    return '中敏感';
  }
  return '低敏感';
}

function getOverallRiskScore(histories) {
  const missingLabels = getMissingHistoryLabels(histories);
  const hydraulicResult = asRecord(asRecord(histories.hydraulic).output);
  const optimizationResult = asRecord(asRecord(histories.optimization).output);
  const mergedParams = getMergedCalculationInputs(histories);
  const { ranking: firstRanking } = getPrimarySensitivityRecord(histories);
  const frictionShare = getFrictionSharePercent(hydraulicResult);
  const endPressure = toNumber(pickFirstValue(
    optimizationResult.endStationInPressure,
    hydraulicResult.endStationInPressure,
  ));
  const topCoefficient = Math.abs(toNumber(firstRanking.sensitivityCoefficient) || 0);
  const pumpEfficiencyPercent = normalizePercentNumber(mergedParams.pumpEfficiency);
  const motorEfficiencyPercent = normalizePercentNumber(mergedParams.motorEfficiency);

  let score = missingLabels.length * 18;
  if (optimizationResult.isFeasible === false) {
    score += 35;
  }
  if (endPressure !== null && endPressure < 2) {
    score += 20;
  }
  if (frictionShare !== null && frictionShare >= 65) {
    score += 12;
  }
  if (topCoefficient >= 1) {
    score += 18;
  } else if (topCoefficient >= 0.3) {
    score += 10;
  }
  if ((pumpEfficiencyPercent !== null && pumpEfficiencyPercent < 75)
    || (motorEfficiencyPercent !== null && motorEfficiencyPercent < 90)) {
    score += 8;
  }

  return score;
}

function getRiskLevelLabel(histories) {
  const score = getOverallRiskScore(histories);
  if (score >= 55) {
    return '高';
  }
  if (score >= 28) {
    return '中';
  }
  return '低';
}

function buildRiskSummaryText(histories) {
  const missingLabels = getMissingHistoryLabels(histories);
  const hydraulicResult = asRecord(asRecord(histories.hydraulic).output);
  const optimizationResult = asRecord(asRecord(histories.optimization).output);
  const { ranking: firstRanking } = getPrimarySensitivityRecord(histories);
  const frictionShare = getFrictionSharePercent(hydraulicResult);
  const endPressure = toNumber(pickFirstValue(
    optimizationResult.endStationInPressure,
    hydraulicResult.endStationInPressure,
  ));
  const topCoefficient = Math.abs(toNumber(firstRanking.sensitivityCoefficient) || 0);
  const reasons = [];

  if (missingLabels.length > 0) {
    reasons.push(`缺少${missingLabels.join('、')}结果`);
  }
  if (optimizationResult.isFeasible === false) {
    reasons.push('优化方案当前不可行');
  }
  if (endPressure !== null && endPressure < 2) {
    reasons.push('末站进站压头安全裕度偏紧');
  }
  if (frictionShare !== null && frictionShare >= 65) {
    reasons.push(`摩阻损失占总扬程 ${formatNumber(frictionShare, 1)}%`);
  }
  if (topCoefficient >= 1) {
    reasons.push('首要敏感变量影响显著');
  } else if (topCoefficient >= 0.3) {
    reasons.push('存在中高敏感变量');
  }

  const riskLabel = getRiskLevelLabel(histories);
  return reasons.length > 0
    ? `${riskLabel}风险：${reasons.slice(0, 3).join('；')}`
    : `${riskLabel}风险：当前未发现突出预警项`;
}

function buildHydraulicInsightText(histories) {
  if (!isRecord(histories.hydraulic)) {
    return '未获取最新水力分析结果';
  }

  const result = asRecord(histories.hydraulic.output);
  const parts = [];
  const frictionShare = getFrictionSharePercent(result);
  const endPressure = toNumber(result.endStationInPressure);

  parts.push(`当前流态为 ${getFlowRegimeLabel(result)}`);
  if (toNumber(result.reynoldsNumber) !== null) {
    parts.push(`雷诺数 ${formatNumber(result.reynoldsNumber, 3)}`);
  }
  if (frictionShare !== null) {
    parts.push(
      frictionShare >= 65
        ? `摩阻损失主导，总占比约 ${formatNumber(frictionShare, 1)}%`
        : `摩阻损失占总扬程约 ${formatNumber(frictionShare, 1)}%`,
    );
  }
  if (endPressure !== null) {
    parts.push(`末站进站压头 ${formatNumber(endPressure, 3)} MPa`);
  }

  return parts.join('，');
}

function buildOptimizationInsightText(histories) {
  if (!isRecord(histories.optimization)) {
    return '未获取最新优化结果';
  }

  const result = asRecord(histories.optimization.output);
  const parts = [];
  if (result.isFeasible === true) {
    parts.push('推荐方案可行');
  } else if (result.isFeasible === false) {
    parts.push('推荐方案不可行');
  } else {
    parts.push('可行性待复核');
  }

  const combo = getRecommendedPumpCombination(result);
  if (combo !== '-') {
    parts.push(`推荐泵组合 ${combo}`);
  }
  if (toNumber(result.totalEnergyConsumption) !== null) {
    parts.push(`年能耗 ${formatNumber(result.totalEnergyConsumption, 3)} kWh`);
  }
  if (toNumber(result.totalCost) !== null) {
    parts.push(`总成本 ${formatNumber(result.totalCost, 3)} 元`);
  }

  return parts.join('，');
}

function buildSensitivityInsightText(histories) {
  if (!isRecord(histories.sensitivity)) {
    return '未获取最新敏感性分析结果';
  }

  const { ranking: firstRanking, variable } = getPrimarySensitivityRecord(histories);
  const variableName = getVariableDisplayLabel(firstRanking);
  const coefficient = toNumber(firstRanking.sensitivityCoefficient);
  const maxImpactPercent = toNumber(pickFirstValue(variable.maxImpactPercent, firstRanking.maxImpactPercent));
  const parts = [`首要敏感变量为 ${variableName}`];

  if (coefficient !== null) {
    parts.push(`敏感系数 ${formatNumber(coefficient, 6)}，属于${getSensitivityLevelLabel(coefficient)}`);
  }
  if (maxImpactPercent !== null) {
    parts.push(`最大影响幅度 ${formatPercent(maxImpactPercent, 2)}`);
  }

  return parts.join('，');
}

function getRecommendationPriority(score) {
  if (score >= 95) {
    return { label: '最高', value: 5 };
  }
  if (score >= 85) {
    return { label: '高', value: 4 };
  }
  if (score >= 70) {
    return { label: '中高', value: 3 };
  }
  return { label: '中', value: 2 };
}

function buildSensitivityRecommendationText(variableName) {
  if (!variableName || variableName === '-') {
    return '将关键敏感变量纳入重点监测并设置预警阈值';
  }
  if (variableName.includes('流量')) {
    return '将流量纳入重点稳控对象，优先盯防高负荷时段波动';
  }
  if (variableName.includes('粘度')) {
    return '关注油品粘度变化，在温度或介质切换时复核输送工况';
  }
  if (variableName.includes('密度')) {
    return '关注介质密度变化，避免压头和能耗估算出现系统偏差';
  }
  if (variableName.includes('粗糙')) {
    return '结合清管与管道状态检查，控制粗糙度增长带来的摩阻抬升';
  }
  if (variableName.includes('压力') || variableName.includes('压头')) {
    return '围绕首站进站压头设置预警阈值，及时修正调度策略';
  }
  return `将${variableName}纳入重点监测并设置预警阈值`;
}

function buildSmartRecommendationItems(histories) {
  const items = [];
  const addedKeys = new Set();
  const hydraulicResult = asRecord(asRecord(histories.hydraulic).output);
  const optimizationResult = asRecord(asRecord(histories.optimization).output);
  const mergedParams = getMergedCalculationInputs(histories);
  const missingLabels = getMissingHistoryLabels(histories);
  const frictionShare = getFrictionSharePercent(hydraulicResult);
  const endPressure = toNumber(pickFirstValue(
    optimizationResult.endStationInPressure,
    hydraulicResult.endStationInPressure,
  ));
  const { ranking: firstRanking } = getPrimarySensitivityRecord(histories);
  const topVariableName = getVariableDisplayLabel(firstRanking);
  const topCoefficient = Math.abs(toNumber(firstRanking.sensitivityCoefficient) || 0);
  const pumpEfficiencyPercent = normalizePercentNumber(mergedParams.pumpEfficiency);
  const motorEfficiencyPercent = normalizePercentNumber(mergedParams.motorEfficiency);

  const addItem = (key, text, basis, impact, score) => {
    if (!text || addedKeys.has(key)) {
      return;
    }
    addedKeys.add(key);
    const priority = getRecommendationPriority(score);
    items.push({
      key,
      text,
      basis,
      impact,
      score,
      priorityLabel: priority.label,
      priorityValue: priority.value,
    });
  };

  if (missingLabels.length > 0) {
    addItem(
      'complete-context',
      `补齐${missingLabels.join('、')}结果后再输出正式结论`,
      `当前报告缺少 ${missingLabels.join('、')} 计算记录`,
      '减少占位值和缺项对正式决策的干扰',
      100,
    );
  }

  if (optimizationResult.isFeasible === false) {
    addItem(
      'infeasible-scheme',
      '当前优化方案判定为不可行，先回退约束条件并重新计算',
      '优化结果可行性 = 否',
      '优先消除方案落地风险，避免错误调度',
      98,
    );
  } else if (optimizationResult.isFeasible === true) {
    addItem(
      'validate-scheme',
      `按推荐泵组合 ${getRecommendedPumpCombination(optimizationResult)} 组织试运行复核`,
      '优化结果已判定为可行',
      '验证末站压头、年能耗和总成本能否同步达标',
      88,
    );
  }

  if (endPressure !== null && endPressure < 2) {
    addItem(
      'pressure-margin',
      '优先复核末站进站压头与现场控制下限之间的安全裕度',
      `当前末站进站压头为 ${formatNumber(endPressure, 3)} MPa`,
      '避免压头不足带来的运行风险和调度返工',
      92,
    );
  }

  if (frictionShare !== null && frictionShare >= 65) {
    addItem(
      'friction-dominant',
      `摩阻损失已占总扬程 ${formatNumber(frictionShare, 1)}%，优先核查流量设定、粗糙度与清管计划`,
      '当前输送工况呈现明显摩阻主导特征',
      '有机会直接降低无效扬程和额外能耗',
      84,
    );
  }

  if ((pumpEfficiencyPercent !== null && pumpEfficiencyPercent < 75)
    || (motorEfficiencyPercent !== null && motorEfficiencyPercent < 90)) {
    addItem(
      'equipment-efficiency',
      '泵效或电机效率偏低，建议排查设备效率并优化启停策略',
      `泵效率 ${formatNumber(pumpEfficiencyPercent, 2)}%，电机效率 ${formatNumber(motorEfficiencyPercent, 2)}%`,
      '降低单位能耗和年度运行成本',
      78,
    );
  }

  if (topVariableName && topVariableName !== '-' && topCoefficient >= 0.3) {
    addItem(
      'sensitivity-control',
      buildSensitivityRecommendationText(topVariableName),
      `首要敏感变量为 ${topVariableName}，敏感系数 ${formatNumber(topCoefficient, 6)}`,
      '提前控制最容易放大压力和摩阻波动的因素',
      topCoefficient >= 1 ? 90 : 82,
    );
  }

  addItem(
    'routine-review',
    '将末站压头、摩阻损失和泵组切换点纳入班次级复盘',
    '当前报告已形成结构化水力、优化和敏感性结果',
    '让分析结论与现场调度动作形成闭环',
    72,
  );

  return items
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

function buildRiskAlerts(histories) {
  const alerts = [];
  const missingLabels = getMissingHistoryLabels(histories);
  const hydraulicResult = asRecord(asRecord(histories.hydraulic).output);
  const optimizationResult = asRecord(asRecord(histories.optimization).output);
  const { ranking: firstRanking } = getPrimarySensitivityRecord(histories);
  const frictionShare = getFrictionSharePercent(hydraulicResult);
  const endPressure = toNumber(pickFirstValue(
    optimizationResult.endStationInPressure,
    hydraulicResult.endStationInPressure,
  ));
  const topCoefficient = Math.abs(toNumber(firstRanking.sensitivityCoefficient) || 0);

  if (missingLabels.length > 0) {
    alerts.push(createAlert(`当前报告缺少 ${missingLabels.join('、')} 结果，部分结论基于已获取数据生成。`));
  }
  if (optimizationResult.isFeasible === false) {
    alerts.push(createAlert('当前推荐泵组方案判定为不可行，建议优先回看优化约束条件和目标工况设置。'));
  }
  if (endPressure !== null && endPressure < 2) {
    alerts.push(createAlert(`末站进站压头为 ${formatNumber(endPressure, 3)} MPa，建议重点复核安全裕度和高负荷时段调度。`));
  }
  if (frictionShare !== null && frictionShare >= 65) {
    alerts.push(createAlert(`摩阻损失占总扬程约 ${formatNumber(frictionShare, 1)}%，当前工况存在较明显的无效扬程消耗。`));
  }
  if (topCoefficient >= 0.3) {
    alerts.push(createAlert(`首要敏感变量为 ${getVariableDisplayLabel(firstRanking)}，建议纳入重点监测并设置预警阈值。`));
  }

  return alerts.slice(0, 4);
}

function buildStructuredSummary(histories) {
  const parts = [];
  const missingLabels = getMissingHistoryLabels(histories);

  if (missingLabels.length === 0) {
    parts.push('当前已获取完整的水力、优化和敏感性结果。');
  } else {
    parts.push(`当前缺少 ${missingLabels.join('、')} 结果，以下结论基于已获取数据生成。`);
  }

  parts.push(buildHydraulicInsightText(histories));
  parts.push(buildOptimizationInsightText(histories));
  parts.push(buildSensitivityInsightText(histories));
  parts.push(`综合判断为 ${buildRiskSummaryText(histories)}。`);

  return parts.filter(Boolean).join(' ');
}

function buildStructuredRecommendations(histories) {
  return buildSmartRecommendationItems(histories).map((item) => item.text);
}

function buildExecutiveSection(histories, projectName, userRequest, recommendationItems) {
  const normalizedItems = Array.isArray(recommendationItems) && recommendationItems.length > 0
    ? recommendationItems
    : buildSmartRecommendationItems(histories);
  const recommendations = normalizedItems.map((item) => item.text);
  const hydraulicResult = asRecord(asRecord(histories.hydraulic).output);
  const optimizationResult = asRecord(asRecord(histories.optimization).output);
  const { ranking: firstRanking } = getPrimarySensitivityRecord(histories);
  const riskAlerts = buildRiskAlerts(histories);

  return {
    title: '报告摘要',
    content:
      `${buildStructuredSummary(histories)} ` +
      `${normalizedItems[0]?.text ? `当前首要执行动作为：${normalizedItems[0].text}。` : ''}`,
    charts: [
      createChart('关键指标速览', 'bar', ['末站进站压头', '摩阻损失', '总扬程', '年能耗(÷1000)', '总成本(÷10000)'], [
        {
          name: projectName || sanitizeText(userRequest, '当前项目'),
          data: [
            toNumber(hydraulicResult.endStationInPressure) ?? 0,
            toNumber(hydraulicResult.frictionHeadLoss) ?? 0,
            toNumber(hydraulicResult.totalHead) ?? 0,
            (toNumber(optimizationResult.totalEnergyConsumption) ?? 0) / 1000,
            (toNumber(optimizationResult.totalCost) ?? 0) / 10000,
          ],
        },
      ]),
    ],
    tables: [
      createTable('摘要总览', ['项目', '内容'], [
        ['项目名称', projectName || '-'],
        ['报告主题', sanitizeText(userRequest, FALLBACK_REQUEST_TEXT)],
        ['数据完整性', getMissingHistoryLabels(histories).length > 0 ? `缺少 ${getMissingHistoryLabels(histories).join('、')}` : '水力、优化和敏感性结果齐全'],
        ['综合风险判断', buildRiskSummaryText(histories)],
        ['水力判断', buildHydraulicInsightText(histories)],
        ['优化判断', buildOptimizationInsightText(histories)],
        ['敏感性判断', buildSensitivityInsightText(histories)],
        ['首要执行动作', recommendations[0] || '-'],
        ['推荐泵组合', getRecommendedPumpCombination(optimizationResult)],
        ['首要敏感变量', getVariableDisplayLabel(firstRanking)],
      ]),
    ],
    alerts: riskAlerts.slice(0, 3),
  };
}

function buildDetailedRecommendationSection(histories, recommendationItems) {
  const normalizedItems = Array.isArray(recommendationItems) && recommendationItems.length > 0
    ? recommendationItems
    : buildSmartRecommendationItems(histories);
  const hydraulicResult = asRecord(asRecord(histories.hydraulic).output);
  const optimizationResult = asRecord(asRecord(histories.optimization).output);
  const { ranking: firstRanking } = getPrimarySensitivityRecord(histories);

  return {
    title: '五、结论与建议',
    content: `本节围绕综合风险判断 ${buildRiskSummaryText(histories)}，给出优先级排序后的执行建议与复核重点。`,
    charts: [
      createChart('建议优先级', 'bar', normalizedItems.map((_, index) => `建议 ${index + 1}`), [
        {
          name: '优先级',
          data: normalizedItems.map((item) => item.priorityValue),
        },
      ]),
    ],
    tables: [
      createTable('执行建议清单', ['建议事项', '优先级', '触发依据', '预期收益'], normalizedItems.map((item) => [
        item.text,
        item.priorityLabel,
        item.basis,
        item.impact,
      ])),
      createTable('复核要点', ['字段', '当前结果', '建议动作'], [
        ['数据完整性', getMissingHistoryLabels(histories).length > 0 ? `缺少 ${getMissingHistoryLabels(histories).join('、')}` : '结果完整', '优先补齐缺失模块并重新生成正式报告'],
        ['末站进站压头', formatNumber(hydraulicResult.endStationInPressure, 3), '确认高负荷时段是否仍满足安全裕度'],
        ['推荐泵组合', getRecommendedPumpCombination(optimizationResult), '结合现场调度窗口安排切换验证'],
        ['总成本', formatNumber(optimizationResult.totalCost, 3), '与当前方案进行年度成本对比'],
        ['首要敏感变量', getVariableDisplayLabel(firstRanking), '纳入重点监测并设置预警阈值'],
      ]),
    ],
    alerts: buildRiskAlerts(histories),
  };
}

function getContextProjectName(reportContext, histories = null) {
  const context = asRecord(reportContext);
  const requestedProject = asRecord(context.requested_project);
  const normalizedHistories = histories ? histories : normalizeHistoryCollection(context.latest_histories);

  return pickFirstText(
    requestedProject.project_name,
    requestedProject.projectName,
    requestedProject.name,
    asRecord(normalizedHistories.hydraulic).projectName,
    asRecord(normalizedHistories.optimization).projectName,
    asRecord(normalizedHistories.sensitivity).projectName,
  );
}

function buildStructuredReport(userRequest, reportContext) {
  const context = asRecord(reportContext);
  const histories = normalizeHistoryCollection(context.latest_histories);
  const projectName = getContextProjectName(context, histories);
  const safeUserRequest = sanitizeText(userRequest, FALLBACK_REQUEST_TEXT);
  const recommendationItems = buildSmartRecommendationItems(histories);
  const recommendations = recommendationItems.map((item) => item.text);
  const sections = [
    buildExecutiveSection(histories, projectName, safeUserRequest, recommendationItems),
    buildDetailedInputSection(histories),
    buildDetailedHydraulicSection(histories),
    buildDetailedOptimizationSection(histories),
    buildDetailedSensitivitySection(histories),
    buildDetailedRecommendationSection(histories, recommendationItems),
  ].filter(Boolean);

  return normalizeReport({
    title: projectName ? `${projectName}运行分析报告` : `运行分析报告：${safeUserRequest.slice(0, 24)}`,
    summary: buildStructuredSummary(histories),
    recommendations,
    sections,
  }, safeUserRequest);
}

function legacyExtractContextMeta(reportContext) {
  const context = asRecord(reportContext);
  const histories = normalizeHistoryCollection(context.latest_histories);
  const requestedProject = asRecord(context.requested_project);
  const historyIds = ['hydraulic', 'optimization', 'sensitivity']
    .map((key) => toNumber(asRecord(histories[key]).id))
    .filter((value) => value !== null && value > 0);

  return {
    projectId: pickFirstValue(
      toNumber(requestedProject.project_id),
      toNumber(requestedProject.projectId),
      toNumber(asRecord(histories.hydraulic).projectId),
      toNumber(asRecord(histories.optimization).projectId),
      toNumber(asRecord(histories.sensitivity).projectId),
    ),
    historyIds,
  };
}

function ensureDraftReportStructure(report, userRequest) {
  const safeUserRequest = sanitizeText(userRequest, FALLBACK_REQUEST_TEXT);
  const existingSections = Array.isArray(report.sections) ? report.sections : [];
  const existingTitles = new Set(
    existingSections
      .map((section) => (typeof section.title === 'string' ? section.title.trim() : ''))
      .filter(Boolean),
  );
  const hasStructuredCoverage = [
    '核心指标摘要与结论',
    '运行概览',
    '能耗分析',
    '泵站效率',
    '异常与风险',
    '优化建议',
  ].every((title) => existingTitles.has(title));
  const hasDetailedStructuredCoverage = [
    '报告摘要',
    '一、计算入参',
    '二、水力结果',
    '三、优化结果',
    '四、敏感性结果',
    '五、结论与建议',
  ].every((title) => existingTitles.has(title));

  const sectionContents = existingSections
    .map((section) => (typeof section.content === 'string' ? section.content.trim() : ''))
    .filter(Boolean);
  const recommendations = Array.isArray(report.recommendations) && report.recommendations.length > 0
    ? report.recommendations
    : [
        '补齐计算上下文后再次生成报告，以获得更准确的压力、能耗和优化结论。',
        '优先关注高能耗时段的泵组切换策略，避免无效扬程。',
        '将风险项转化为监测阈值，形成日常巡检闭环。',
      ];
  const summaryText = sanitizeText(
    report.summary,
    `${safeUserRequest}。当前为通用 AI 草稿，请结合实际运行数据进一步校核。`,
  );
  const safeRequestDescription = sanitizeText(
    safeUserRequest,
    '当前报告需求描述存在乱码，请重新填写并生成。',
  );
  const fallbackSections = [
    {
      title: '核心指标摘要与结论',
      content: summaryText,
      charts: [],
      tables: [
        createTable('摘要检查表', ['项目', '内容'], [
          ['报告主题', safeRequestDescription],
          ['章节数量', formatNumber(existingSections.length, 0)],
          ['建议数量', formatNumber(recommendations.length, 0)],
          ['交付结论', '已生成结构化 AI 报告草稿'],
        ]),
      ],
      alerts: [],
    },
    {
      title: '运行概览',
      content: sectionContents[0] || summaryText,
      charts: [],
      tables: [
        createTable('报告范围', ['维度', '说明'], [
          ['运行概况', '概括当前输送工况、报告目标和关注重点'],
          ['数据来源', '当前草稿主要基于提示词和 AI 生成内容'],
          ['建议动作', '补充项目、压力、流量和泵组实际数据后重新生成'],
        ]),
      ],
      alerts: [],
    },
    {
      title: '能耗分析',
      content: sectionContents[1] || '当前缺少结构化能耗上下文，建议补充计算历史后生成更可靠的指标对比。',
      charts: [
        createChart('关注维度优先级', 'bar', ['运行概览', '能耗分析', '泵站效率', '异常与风险', '优化建议'], [
          { name: '关注强度', data: [3, 5, 4, 4, 5] },
        ]),
      ],
      tables: [
        createTable('能耗分析清单', ['分析维度', '当前状态', '建议'], [
          ['单位能耗', '待结合实际数据校核', '补充历史数据后生成趋势对比'],
          ['扬程匹配', '待校核', '结合泵组方案检查是否存在过剩扬程'],
          ['成本影响', '待校核', '联动电价与工况评估调度窗口'],
        ]),
      ],
      alerts: [],
    },
    {
      title: '泵站效率',
      content: sectionContents[2] || '当前草稿尚未拿到泵组效率与组合参数，建议补充泵站优化结果。',
      charts: [
        createChart('泵站效率关注点', 'bar', ['泵组组合', '设备效率', '调度策略'], [
          { name: '关注程度', data: [4, 5, 4] },
        ]),
      ],
      tables: [
        createTable('泵站效率关注表', ['项', '说明'], [
          ['泵组组合', '建议核查高负荷时段启停组合'],
          ['设备效率', '建议核查泵效率和电机效率的近期波动'],
          ['调度策略', '建议结合压力目标优化泵组切换逻辑'],
        ]),
      ],
      alerts: [],
    },
    {
      title: '异常与风险',
      content: sectionContents[3] || '当前草稿已保留异常与风险章节，建议结合压力、摩阻和敏感性结果生成实测风险提示。',
      charts: [],
      tables: [
        createTable('风险提示清单', ['风险项', '影响', '建议'], [
          ['压力波动', '可能影响末站安全裕度', '补充末站压力实测值并建立阈值预警'],
          ['能耗异常', '可能带来额外运行成本', '对高能耗时段和泵组组合进行复盘'],
          ['参数敏感', '关键变量波动会放大压力/摩阻变化', '建立敏感变量监测与复核机制'],
        ]),
      ],
      alerts: [createAlert('当前为通用草稿，风险项需要结合真实计算结果进一步量化。')],
    },
    {
      title: '优化建议',
      content: recommendations.join('；'),
      charts: [],
      tables: [
        createTable('优化建议执行清单', ['建议事项', '优先级'], recommendations.map((item, index) => [
          item,
          index === 0 ? '高' : index === 1 ? '中高' : '中',
        ])),
      ],
      alerts: [createAlert('通用草稿建议仅供预览，请结合项目实际工况确认后执行。')],
    },
  ];

  if (hasStructuredCoverage || hasDetailedStructuredCoverage) {
    const fallbackSectionMap = new Map(
      fallbackSections.map((section) => [section.title, section]),
    );
    const mergedSections = existingSections.map((section) => {
      const fallbackSection = fallbackSectionMap.get(section.title);
      if (!fallbackSection) {
        return section;
      }

      return {
        ...section,
        content: sanitizeText(section.content, fallbackSection.content),
        charts: Array.isArray(section.charts) && section.charts.length > 0
          ? section.charts
          : fallbackSection.charts,
        tables: Array.isArray(section.tables) && section.tables.length > 0
          ? section.tables
          : fallbackSection.tables,
        alerts: Array.isArray(section.alerts) && section.alerts.length > 0
          ? section.alerts
          : fallbackSection.alerts,
      };
    });

    return normalizeReport({
      ...report,
      title: sanitizeText(report.title, `运行分析报告：${safeUserRequest.slice(0, 24)}`),
      summary: summaryText,
      recommendations,
      sections: mergedSections,
    }, safeUserRequest);
  }

  return normalizeReport({
    title: sanitizeText(report.title, `运行分析报告：${safeUserRequest.slice(0, 24)}`),
    summary: summaryText,
    recommendations,
    sections: fallbackSections,
  }, safeUserRequest);
}

function extractContextMeta(reportContext) {
  const context = asRecord(reportContext);
  const histories = asRecord(context.latest_histories);
  const requestedProject = asRecord(context.requested_project);
  const historyIds = ['hydraulic', 'optimization', 'sensitivity']
    .map((key) => toNumber(asRecord(histories[key]).id))
    .filter((value) => value !== null && value > 0);

  return {
    projectId: pickFirstValue(
      toNumber(requestedProject.project_id),
      asRecord(histories.hydraulic).projectId,
      asRecord(histories.optimization).projectId,
      asRecord(histories.sensitivity).projectId,
    ),
    historyIds,
  };
}

async function callQwen(userRequest) {
  const config = getConfig();
  const useChinese = /[\u4e00-\u9fff]/.test(userRequest);

  if (isPlaceholderKey(config.apiKey)) {
    const error = new Error(`DashScope API key is missing in ${envPath}`);
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${config.apiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      messages: useChinese
        ? [
            {
              role: 'system',
              content:
                '你是管道能耗分析报告助手。你只能返回 JSON，顶层字段必须是 title、summary、recommendations、sections。' +
                '所有字段值都必须使用简体中文，不要输出任何 JSON 之外的说明。' +
                '每个 section 必须包含 title、content、charts、tables、alerts，recommendations 必须是字符串数组，内容要专业、务实、贴近管道运行分析场景。' +
                'sections 必须至少包含以下标题：核心指标摘要与结论、运行概览、能耗分析、泵站效率、异常与风险、优化建议。' +
                '至少在“能耗分析”或“泵站效率”中提供一个 charts 项，图表格式使用 {title,type,data:{x,series}}；至少在“核心指标摘要与结论”或“异常与风险”中提供一个 tables 项；异常与风险必须提供 alerts。',
            },
            {
              role: 'user',
              content:
                `请根据这个需求生成一份简洁但有用的分析报告草稿：${userRequest}\n` +
                '严格按以下 JSON 结构输出，字段名保持英文，字段值全部使用简体中文：\n' +
                '{\n' +
                '  "title": "字符串",\n' +
                '  "summary": "字符串",\n' +
                '  "recommendations": ["字符串"],\n' +
                '  "sections": [\n' +
                '    {\n' +
                '      "title": "字符串",\n' +
                '      "content": "字符串",\n' +
                '      "charts": [{"title":"字符串","type":"line|bar","data":{"x":["字符串"],"series":[{"name":"字符串","data":[1,2,3]}]}}],\n' +
                '      "tables": [{"title":"字符串","headers":["列1","列2"],"rows":[["值1","值2"]]}],\n' +
                '      "alerts": [{"message":"字符串","level":"warning"}]\n' +
                '    }\n' +
                '  ]\n' +
                '}\n' +
                '请确保 sections 的标题包含：核心指标摘要与结论、运行概览、能耗分析、泵站效率、异常与风险、优化建议。',
            },
          ]
        : [
            {
              role: 'system',
              content:
                'You are a pipeline energy analysis report assistant. Return JSON only with keys: title, summary, recommendations, sections. ' +
                'Each section must contain title, content, charts, tables, and alerts. recommendations must be an array of strings. ' +
                'Sections must include: Executive Metrics and Conclusion, Operational Overview, Energy Analysis, Pump Station Efficiency, Exceptions and Risks, Optimization Actions. ' +
                'Include at least one chart, one table, and one risk alert. Keep the report practical and domain-specific.',
            },
            {
              role: 'user',
              content:
                `Generate a concise but useful analysis report draft for this request: ${userRequest}\n` +
                'Use this JSON shape exactly:\n' +
                '{\n' +
                '  "title": "string",\n' +
                '  "summary": "string",\n' +
                '  "recommendations": ["string"],\n' +
                '  "sections": [\n' +
                '    {\n' +
                '      "title": "string",\n' +
                '      "content": "string",\n' +
                '      "charts": [{"title":"string","type":"line|bar","data":{"x":["string"],"series":[{"name":"string","data":[1,2,3]}]}}],\n' +
                '      "tables": [{"title":"string","headers":["Column"],"rows":[["Value"]]}],\n' +
                '      "alerts": [{"message":"string","level":"warning"}]\n' +
                '    }\n' +
                '  ]\n' +
                '}',
            },
          ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `DashScope request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return normalizeReport({}, userRequest);
  }

  const jsonText = extractJsonObject(content);
  try {
    return ensureDraftReportStructure(normalizeReport(JSON.parse(jsonText), userRequest), userRequest);
  } catch {
    return ensureDraftReportStructure(normalizeReport(content, userRequest), userRequest);
  }
}

const docsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Qwen Agent Lite</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; max-width: 760px; margin: 48px auto; padding: 0 20px; color: #0f172a; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }
      pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 12px; overflow: auto; }
    </style>
  </head>
  <body>
    <h1>Qwen Agent Lite</h1>
    <p>This local service exposes the minimal endpoints required by the report preview page.</p>
    <p>Config file: <code>${envPath}</code></p>
    <p>Required key: <code>OPENAI_API_KEY</code></p>
    <pre>POST /api/v1/report/generate
GET  /api/v1/report/:id
DELETE /api/v1/report/:id
GET  /api/v1/report/download/:id?format=docx|pdf
GET  /api/v1/health/live
GET  /api/v1/health/ready</pre>
  </body>
</html>
`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,satoken',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/docs')) {
    sendHtml(response, 200, docsHtml);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/health/live') {
    sendJson(response, 200, { alive: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/health/ready') {
    const config = getConfig();
    sendJson(response, 200, {
      ready: true,
      keyConfigured: !isPlaceholderKey(config.apiKey),
      model: config.model,
    });
    return;
  }

  const persistedReportMatch = url.pathname.match(/^\/api\/v1\/report\/(\d+)$/);
  if (request.method === 'GET' && persistedReportMatch) {
    try {
      const persisted = loadPersistedReport(Number.parseInt(persistedReportMatch[1], 10));
      if (!persisted) {
        sendJson(response, 404, { detail: 'Persisted report was not found.' });
        return;
      }

      sendJson(response, 200, {
        trace_id: randomUUID(),
        report: persisted.report,
        java_report_id: persisted.record.id,
        local_report_count: getLocalReportCount(),
        java_download_url: `/api/v1/report/download/${persisted.record.id}?format=docx`,
        java_download_url_pdf: persisted.record.filePath && existsSync(getSidecarPaths(persisted.record.filePath).pdfPath)
          ? `/api/v1/report/download/${persisted.record.id}?format=pdf`
          : null,
      });
      return;
    } catch (error) {
      sendJson(response, 500, {
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  if (request.method === 'DELETE' && persistedReportMatch) {
    try {
      const deleted = deletePersistedReport(Number.parseInt(persistedReportMatch[1], 10));
      if (!deleted) {
        sendJson(response, 404, { detail: 'Persisted report was not found.' });
        return;
      }

      sendJson(response, 200, {
        success: true,
        id: deleted.id,
      });
      return;
    } catch (error) {
      sendJson(response, 500, {
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  const persistedDownloadMatch = url.pathname.match(/^\/api\/v1\/report\/download\/(\d+)$/);
  if (request.method === 'GET' && persistedDownloadMatch) {
    try {
      const persisted = loadPersistedReport(Number.parseInt(persistedDownloadMatch[1], 10));
      if (!persisted?.record?.filePath) {
        sendJson(response, 404, { detail: 'Persisted report file was not found.' });
        return;
      }

      const format = String(url.searchParams.get('format') || 'docx').toLowerCase();
      const sidecarPaths = getSidecarPaths(persisted.record.filePath);
      const downloadPath = format === 'pdf' ? sidecarPaths.pdfPath : persisted.record.filePath;
      if (!existsSync(downloadPath)) {
        sendJson(response, 404, { detail: `Requested ${format.toUpperCase()} archive was not found.` });
        return;
      }

      const buffer = readFileSync(downloadPath);
      const fileName = format === 'pdf'
        ? `${String(persisted.record.fileName || `report-${persisted.record.id}.doc`).replace(/\.[^.]+$/i, '')}.pdf`
        : String(persisted.record.fileName || `report-${persisted.record.id}.doc`);
      response.writeHead(200, {
        'Content-Type': format === 'pdf'
          ? 'application/pdf'
          : 'application/msword; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Access-Control-Allow-Origin': '*',
      });
      response.end(buffer);
      return;
    } catch (error) {
      sendJson(response, 500, {
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/report/generate') {
    try {
      const body = await readJsonBody(request);
      const userRequest =
        typeof body?.user_request === 'string' && body.user_request.trim()
          ? body.user_request.trim()
          : '';
      const reportContext = isRecord(body?.report_context) ? body.report_context : null;

      if (!userRequest) {
        sendJson(response, 400, { detail: 'user_request is required' });
        return;
      }

      const safeUserRequest = sanitizeText(userRequest, FALLBACK_REQUEST_TEXT);
      const rawReport = reportContext
        ? buildStructuredReport(safeUserRequest, reportContext)
        : await callQwen(safeUserRequest);
      const report = ensureDraftReportStructure(
        normalizeReport(rawReport, safeUserRequest),
        safeUserRequest,
      );
      if (reportContext && isRecord(report)) {
        const requestedProject = asRecord(reportContext.requested_project);
        const latestHistories = asRecord(reportContext.latest_histories);
        const reportProjectName = String(
          pickFirstValue(
            requestedProject.project_name,
            requestedProject.projectName,
            asRecord(latestHistories.hydraulic).projectName,
            asRecord(latestHistories.optimization).projectName,
            asRecord(latestHistories.sensitivity).projectName,
            '',
          ) || '',
        ).trim();
        if (reportProjectName) {
          report.title = `${reportProjectName}运行分析报告`;
        }
      }
      if (reportContext && isRecord(report) && String(report.title || '').includes('[object Object]')) {
        const normalizedProjectName = getContextProjectName(reportContext);
        if (normalizedProjectName) {
          report.title = `${normalizedProjectName}运行分析报告`;
        }
      }
      const fileInfo = persistReportFiles(report);
      const reportId = insertReportRecord(
        report,
        fileInfo,
        reportContext ? extractContextMeta(reportContext) : {},
      );
      sendJson(response, 200, {
        trace_id: randomUUID(),
        report,
        java_report_id: reportId,
        local_report_count: getLocalReportCount(),
        java_download_url: `/api/v1/report/download/${reportId}?format=docx`,
        java_download_url_pdf: fileInfo.pdfPath ? `/api/v1/report/download/${reportId}?format=pdf` : null,
      });
      return;
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      sendJson(response, statusCode, {
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  sendJson(response, 404, { detail: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[qwen-agent-lite] listening on http://0.0.0.0:${port}`);
  console.log(`[qwen-agent-lite] env file: ${envPath}`);
});
