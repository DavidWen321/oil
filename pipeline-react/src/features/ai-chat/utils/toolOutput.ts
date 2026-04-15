import type { ToolExecutionEvent } from '../../../types/agent';

const TOOL_LABELS: Record<string, string> = {
  SQL_Database: '\u6570\u636e\u5e93\u67e5\u8be2',
  Knowledge_Base: '\u77e5\u8bc6\u5e93\u68c0\u7d22',
  Hydraulic_Analysis: '\u6c34\u529b\u8ba1\u7b97',
  query_database: '\u6570\u636e\u5e93\u67e5\u8be2',
  execute_safe_sql: '\u5b89\u5168 SQL \u67e5\u8be2',
  query_projects: '\u9879\u76ee\u5217\u8868\u67e5\u8be2',
  query_project_by_id: '\u9879\u76ee\u8be6\u60c5\u67e5\u8be2',
  query_pipelines: '\u7ba1\u9053\u5217\u8868\u67e5\u8be2',
  query_pipeline_detail: '\u7ba1\u9053\u8be6\u60c5\u67e5\u8be2',
  query_pump_stations: '\u6cf5\u7ad9\u67e5\u8be2',
  query_oil_properties: '\u6cb9\u54c1\u67e5\u8be2',
  get_calculation_parameters: '\u8ba1\u7b97\u53c2\u6570\u67e5\u8be2',
};

interface ToolPayload {
  success?: boolean;
  message?: unknown;
  error?: unknown;
  raw?: unknown;
  content?: unknown;
  count?: unknown;
  data?: unknown;
}

export interface ToolOutputPresentation {
  displayStatus: ToolExecutionEvent['status'];
  summary: string;
  detail: string | null;
  rawDetail: string | null;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function unwrapToolEnvelope(raw: string) {
  const trimmed = raw.trim();
  const singleQuoted = trimmed.match(/^content='([\s\S]*?)'\s+name=/);
  if (singleQuoted) return singleQuoted[1];

  const doubleQuoted = trimmed.match(/^content="([\s\S]*?)"\s+name=/);
  if (doubleQuoted) return doubleQuoted[1];

  return trimmed;
}

function parsePayload(raw: string): ToolPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as ToolPayload;
  } catch {
    return null;
  }
}

function getFirstString(...candidates: unknown[]) {
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }
  return '';
}

function stripVerboseGuide(message: string) {
  const retryToken = '\u8bf7\u6539\u7528\u4e0b\u9762\u8fd9\u4e9b\u771f\u5b9e\u4e1a\u52a1\u8868\u540d\u540e\u91cd\u8bd5\uff1a';
  const schemaToken = '\u6570\u636e\u5e93\u67e5\u8be2\u53ea\u80fd\u4f7f\u7528\u4e0b\u9762\u8fd9\u4e9b\u771f\u5b9e\u4e1a\u52a1\u8868\u540d\u548c\u5b57\u6bb5\u540d';
  const condensed = message.split(retryToken)[0]?.trim();
  if (condensed) return condensed;
  const schemaGuideIndex = message.indexOf(schemaToken);
  if (schemaGuideIndex > 0) {
    return message.slice(0, schemaGuideIndex).trim();
  }
  return message.trim();
}

function looksLikeFailure(text: string) {
  const normalized = text.toLowerCase();
  if (!normalized) return false;
  if (
    normalized.includes('\u672a\u627e\u5230\u6570\u636e') ||
    normalized.includes('\u672a\u67e5\u5230\u6570\u636e')
  ) {
    return false;
  }
  return (
    normalized.includes('\u67e5\u8be2\u5931\u8d25') ||
    normalized.includes('error') ||
    normalized.includes('exception') ||
    normalized.includes('unknown column') ||
    normalized.includes("doesn't exist") ||
    normalized.includes('unknown table') ||
    normalized.includes("can't connect to mysql") ||
    normalized.includes('connection refused') ||
    normalized.includes('10061')
  );
}

function summarizeMessage(message: string) {
  const normalized = normalizeText(stripVerboseGuide(message));
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return { summary: '\u5de5\u5177\u6267\u884c\u5b8c\u6210', detail: null as string | null };
  }

  if (normalized.includes('\u68c0\u6d4b\u5230\u4e0d\u5b58\u5728\u6216\u4e0d\u5141\u8bb8\u8bbf\u95ee\u7684\u8868\u540d')) {
    return {
      summary: '\u67e5\u8be2\u4f7f\u7528\u4e86\u4e0d\u5b58\u5728\u7684\u8868\u540d',
      detail: normalized,
    };
  }

  if (lower.includes('unknown column')) {
    return {
      summary: '\u67e5\u8be2\u5b57\u6bb5\u4e0d\u5b58\u5728',
      detail: normalized,
    };
  }

  if (
    lower.includes("can't connect to mysql") ||
    lower.includes('connection refused') ||
    normalized.includes('10061')
  ) {
    return {
      summary: '\u6570\u636e\u5e93\u6682\u65f6\u4e0d\u53ef\u7528',
      detail: '\u8bf7\u68c0\u67e5 MySQL \u670d\u52a1\u662f\u5426\u542f\u52a8\uff0c\u4ee5\u53ca AI \u670d\u52a1\u7684\u6570\u636e\u5e93\u8fde\u63a5\u914d\u7f6e\u662f\u5426\u6b63\u786e\u3002',
    };
  }

  if (normalized.includes('\u53ea\u5141\u8bb8\u6267\u884c SELECT \u67e5\u8be2')) {
    return {
      summary: '\u53ea\u5141\u8bb8\u6267\u884c SELECT \u67e5\u8be2',
      detail: '\u5f53\u524d\u5de5\u5177\u7981\u6b62\u6267\u884c\u5199\u5165\u3001\u5220\u9664\u6216\u7ed3\u6784\u4fee\u6539\u7c7b SQL\u3002',
    };
  }

  if (normalized.includes('\u7981\u6b62\u67e5\u8be2\u7cfb\u7edf\u7528\u6237\u5bc6\u7801\u5b57\u6bb5')) {
    return {
      summary: '\u654f\u611f\u5b57\u6bb5\u5df2\u88ab\u62e6\u622a',
      detail: normalized,
    };
  }

  if (
    normalized.includes('\u672a\u627e\u5230\u6570\u636e') ||
    normalized.includes('\u672a\u67e5\u5230\u6570\u636e')
  ) {
    return {
      summary: '\u672a\u67e5\u5230\u6570\u636e',
      detail: normalized,
    };
  }

  return {
    summary: normalized.length > 88 ? `${normalized.slice(0, 88)}...` : normalized,
    detail: normalized.length > 88 ? normalized : null,
  };
}

function toCount(payload: ToolPayload) {
  if (typeof payload.count === 'number' && Number.isFinite(payload.count)) {
    return payload.count;
  }
  if (Array.isArray(payload.data)) {
    return payload.data.length;
  }
  if (payload.data && typeof payload.data === 'object') {
    return 1;
  }
  return null;
}

export function getToolTitle(toolName: string) {
  return TOOL_LABELS[toolName] ?? toolName;
}

export function getToolDisplayStatus(tool: ToolExecutionEvent) {
  return describeToolOutput(tool).displayStatus;
}

export function describeToolOutput(tool: ToolExecutionEvent): ToolOutputPresentation {
  if (!tool.output?.trim()) {
    if (tool.status === 'running') {
      return {
        displayStatus: 'running',
        summary: '\u7b49\u5f85\u5de5\u5177\u8fd4\u56de\u7ed3\u679c',
        detail: null,
        rawDetail: null,
      };
    }
    return {
      displayStatus: tool.status,
      summary: tool.status === 'failed' ? '\u5de5\u5177\u6267\u884c\u5931\u8d25' : '\u5de5\u5177\u6267\u884c\u5b8c\u6210',
      detail: null,
      rawDetail: null,
    };
  }

  const rawDetail = tool.output.trim();
  const unwrapped = unwrapToolEnvelope(rawDetail);
  const payload = parsePayload(unwrapped);

  if (payload) {
    const message = getFirstString(payload.message, payload.error, payload.raw, payload.content);
    const count = toCount(payload);

    if (payload.success === false) {
      const summarized = summarizeMessage(message || unwrapped);
      return {
        displayStatus: 'failed',
        summary: summarized.summary,
        detail: summarized.detail,
        rawDetail: rawDetail === summarized.detail ? null : rawDetail,
      };
    }

    if (payload.success === true) {
      if (count === 0) {
        return {
          displayStatus: 'completed',
          summary: '\u672a\u67e5\u5230\u6570\u636e',
          detail:
            message && message !== '\u67e5\u8be2\u6210\u529f\uff0c\u4f46\u672a\u627e\u5230\u6570\u636e'
              ? normalizeText(message)
              : null,
          rawDetail: null,
        };
      }

      if (typeof count === 'number' && count > 0) {
        return {
          displayStatus: 'completed',
          summary: `\u5df2\u8fd4\u56de ${count} \u6761\u7ed3\u679c`,
          detail: message ? normalizeText(message) : null,
          rawDetail: null,
        };
      }

      if (message) {
        const summarized = summarizeMessage(message);
        return {
          displayStatus: looksLikeFailure(message) ? 'failed' : 'completed',
          summary: summarized.summary,
          detail: summarized.detail,
          rawDetail: null,
        };
      }
    }

    if (message) {
      const summarized = summarizeMessage(message);
      return {
        displayStatus: looksLikeFailure(message) ? 'failed' : tool.status,
        summary: summarized.summary,
        detail: summarized.detail,
        rawDetail: rawDetail === summarized.detail ? null : rawDetail,
      };
    }
  }

  const summarized = summarizeMessage(unwrapped);
  return {
    displayStatus: looksLikeFailure(unwrapped) ? 'failed' : tool.status,
    summary: summarized.summary,
    detail: summarized.detail,
    rawDetail: rawDetail === summarized.detail ? null : rawDetail,
  };
}
