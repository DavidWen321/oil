import { useUserStore } from '../stores/userStore';
import type { HITLResponse } from '../types/agent';

import type {
  KnowledgeDeletePayload,
  KnowledgeDocumentListPayload,
  KnowledgeGraphQueryPayload,
  KnowledgeReindexPayload,
  KnowledgeSearchDebugPayload,
  KnowledgeSearchPayload,
  KnowledgeStageBaseline,
  KnowledgeStatsPayload,
  KnowledgeUploadPayload,
} from '../types/agent';

const AGENT_API_BASE =
  import.meta.env.VITE_AGENT_API_BASE_URL?.replace(/\/+$/, '') || '/api/v1';

function getAgentHeaders(json = false): HeadersInit {
  const token = useUserStore.getState().token;
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token
      ? {
          satoken: token,
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

async function buildError(response: Response, fallback: string): Promise<Error> {
  const text = await response.text();
  if (!text) {
    return new Error(`${fallback}: ${response.status}`);
  }

  try {
    const payload = JSON.parse(text) as { detail?: unknown; message?: unknown };
    const detail =
      typeof payload.detail === 'string'
        ? payload.detail
        : typeof payload.message === 'string'
          ? payload.message
          : '';
    return new Error(detail || `${fallback}: ${response.status}`);
  } catch {
    return new Error(`${fallback}: ${response.status}`);
  }
}

export const agentApi = {
  baseUrl: AGENT_API_BASE,

  async chat(message: string, sessionId: string) {
    const response = await fetch(`${AGENT_API_BASE}/chat`, {
      method: 'POST',
      headers: getAgentHeaders(true),
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    if (!response.ok) {
      throw new Error(`chat request failed: ${response.status}`);
    }

    return parseJson<Record<string, unknown>>(response);
  },

  async confirm(sessionId: string, responsePayload: HITLResponse) {
    const response = await fetch(`${AGENT_API_BASE}/chat/confirm`, {
      method: 'POST',
      headers: getAgentHeaders(true),
      body: JSON.stringify({ session_id: sessionId, ...responsePayload }),
    });

    if (!response.ok) {
      throw new Error(`confirm request failed: ${response.status}`);
    }

    return parseJson<Record<string, unknown>>(response);
  },

  async getTrace(traceId: string) {
    const response = await fetch(`${AGENT_API_BASE}/trace/${traceId}`, {
      headers: getAgentHeaders(),
    });
    if (!response.ok) {
      throw new Error(`trace request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  async generateReport(
    userRequest: string,
    sessionId?: string,
    reportContext?: Record<string, unknown>,
  ) {
    const response = await fetch(`${AGENT_API_BASE}/report/generate`, {
      method: 'POST',
      headers: getAgentHeaders(true),
      body: JSON.stringify({
        user_request: userRequest,
        session_id: sessionId,
        report_context: reportContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`report request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  async getReportDetail(reportId: number) {
    const response = await fetch(`${AGENT_API_BASE}/report/${reportId}`);
    if (!response.ok) {
      throw new Error(`report detail request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  async deleteReport(reportId: number) {
    const response = await fetch(`${AGENT_API_BASE}/report/${reportId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`report delete request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  async listJavaReports(pageNum = 1, pageSize = 10) {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    });
    const response = await fetch(`${AGENT_API_BASE}/report/java/reports?${params.toString()}`, {
      headers: getAgentHeaders(),
    });
    if (!response.ok) {
      throw new Error(`list java reports failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  getJavaReportDownloadUrl(reportId: number, format: 'docx' | 'pdf' = 'docx') {
    return `${AGENT_API_BASE}/report/download/${reportId}?format=${format}`;
  },

  async queryGraph(query: string) {
    const params = new URLSearchParams({ query });
    const response = await fetch(`${AGENT_API_BASE}/graph/query?${params.toString()}`, {
      headers: getAgentHeaders(),
    });
    if (!response.ok) {
      throw await buildError(response, 'graph request failed');
    }
    return parseJson<KnowledgeGraphQueryPayload>(response);
  },

  async getKnowledgeBaseline() {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/baseline`);
    if (!response.ok) {
      throw await buildError(response, 'knowledge baseline request failed');
    }
    return parseJson<KnowledgeStageBaseline>(response);
  },

  async listKnowledgeDocuments(params?: { category?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.category) {
      query.set('category', params.category);
    }
    if (params?.status) {
      query.set('status', params.status);
    }
    const suffix = query.size ? `?${query.toString()}` : '';
    const response = await fetch(`${AGENT_API_BASE}/knowledge/documents${suffix}`);
    if (!response.ok) {
      throw await buildError(response, 'knowledge documents request failed');
    }
    return parseJson<KnowledgeDocumentListPayload>(response);
  },

  async uploadKnowledgeDocument(payload: {
    file: File;
    title: string;
    source: string;
    category: string;
    tags: string[];
    author?: string;
    summary?: string;
    language?: string;
    version?: string;
    external_id?: string;
    effective_at?: string;
  }) {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('title', payload.title);
    formData.append('source', payload.source);
    formData.append('category', payload.category);
    formData.append('tags', payload.tags.join(','));

    if (payload.author) {
      formData.append('author', payload.author);
    }
    if (payload.summary) {
      formData.append('summary', payload.summary);
    }
    if (payload.language) {
      formData.append('language', payload.language);
    }
    if (payload.version) {
      formData.append('version', payload.version);
    }
    if (payload.external_id) {
      formData.append('external_id', payload.external_id);
    }
    if (payload.effective_at) {
      formData.append('effective_at', payload.effective_at);
    }

    const response = await fetch(`${AGENT_API_BASE}/knowledge/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw await buildError(response, 'knowledge upload failed');
    }
    return parseJson<KnowledgeUploadPayload>(response);
  },

  async deleteKnowledgeDocument(docId: string) {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/documents/${docId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw await buildError(response, 'knowledge delete failed');
    }
    return parseJson<KnowledgeDeletePayload>(response);
  },

  async reindexKnowledge(recreate = true) {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recreate }),
    });
    if (!response.ok) {
      throw await buildError(response, 'knowledge reindex failed');
    }
    return parseJson<KnowledgeReindexPayload>(response);
  },

  async getKnowledgeStats() {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/stats`);
    if (!response.ok) {
      throw await buildError(response, 'knowledge stats request failed');
    }
    return parseJson<KnowledgeStatsPayload>(response);
  },

  async searchKnowledge(payload: { query: string; top_k?: number; category?: string }) {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw await buildError(response, 'knowledge search failed');
    }
    return parseJson<KnowledgeSearchPayload>(response);
  },

  async debugKnowledgeSearch(payload: { query: string; top_k?: number; category?: string }) {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/search/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw await buildError(response, 'knowledge debug search failed');
    }
    return parseJson<KnowledgeSearchDebugPayload>(response);
  },
};
