import type {
  HITLResponse,
  KnowledgeDeleteResponse,
  KnowledgeDocumentListPayload,
  KnowledgeGraphQueryPayload,
  KnowledgeReindexResponse,
  KnowledgeSearchDebugPayload,
  KnowledgeSearchPayload,
  KnowledgeStageBaseline,
  KnowledgeStatsPayload,
  KnowledgeUploadPayload,
  KnowledgeUploadResponse,
} from '../types/agent';

const AGENT_API_BASE =
  import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8100/api/v1';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

async function buildError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await parseJson<{ detail?: string; message?: string }>(response);
    const message = payload.detail || payload.message;
    if (message) {
      return new Error(message);
    }
  } catch {
    // Ignore parse errors and fall back to an HTTP status message.
  }

  return new Error(`${fallback}: ${response.status}`);
}

async function ensureOk(response: Response, fallback: string) {
  if (!response.ok) {
    throw await buildError(response, fallback);
  }
}

export const agentApi = {
  baseUrl: AGENT_API_BASE,

  async chat(message: string, sessionId: string) {
    const response = await fetch(`${AGENT_API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    await ensureOk(response, 'chat request failed');
    return parseJson<Record<string, unknown>>(response);
  },

  async confirm(sessionId: string, responsePayload: HITLResponse) {
    const response = await fetch(`${AGENT_API_BASE}/chat/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, response: responsePayload }),
    });

    await ensureOk(response, 'confirm request failed');
    return parseJson<Record<string, unknown>>(response);
  },

  async getTrace(traceId: string) {
    const response = await fetch(`${AGENT_API_BASE}/trace/${traceId}`);
    await ensureOk(response, 'trace request failed');
    return parseJson<Record<string, unknown>>(response);
  },

  async generateReport(
    userRequest: string,
    sessionId?: string,
    reportContext?: Record<string, unknown>,
  ) {
    const response = await fetch(`${AGENT_API_BASE}/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_request: userRequest,
        session_id: sessionId,
        report_context: reportContext,
      }),
    });

    await ensureOk(response, 'report request failed');
    return parseJson<Record<string, unknown>>(response);
  },

  async getReportDetail(reportId: number) {
    const response = await fetch(`${AGENT_API_BASE}/report/${reportId}`);
    await ensureOk(response, 'report detail request failed');
    return parseJson<Record<string, unknown>>(response);
  },

  async deleteReport(reportId: number) {
    const response = await fetch(`${AGENT_API_BASE}/report/${reportId}`, {
      method: 'DELETE',
    });
    await ensureOk(response, 'report delete request failed');
    return parseJson<Record<string, unknown>>(response);
  },

  async listJavaReports(pageNum = 1, pageSize = 10) {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    });
    const response = await fetch(`${AGENT_API_BASE}/report/java/reports?${params.toString()}`);
    await ensureOk(response, 'list java reports failed');
    return parseJson<Record<string, unknown>>(response);
  },

  getJavaReportDownloadUrl(reportId: number, format: 'docx' | 'pdf' = 'docx') {
    return `${AGENT_API_BASE}/report/download/${reportId}?format=${format}`;
  },

  async queryGraph(query: string) {
    const params = new URLSearchParams({ query });
    const response = await fetch(`${AGENT_API_BASE}/graph/query?${params.toString()}`);
    await ensureOk(response, 'graph request failed');
    return parseJson<KnowledgeGraphQueryPayload>(response);
  },

  async getKnowledgeBaseline() {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/baseline`);
    await ensureOk(response, 'knowledge baseline request failed');
    return parseJson<KnowledgeStageBaseline>(response);
  },

  async listKnowledgeDocuments(params?: { category?: string; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.category) {
      searchParams.set('category', params.category);
    }
    if (params?.status) {
      searchParams.set('status', params.status);
    }

    const query = searchParams.toString();
    const response = await fetch(
      `${AGENT_API_BASE}/knowledge/documents${query ? `?${query}` : ''}`,
    );
    await ensureOk(response, 'knowledge documents request failed');
    return parseJson<KnowledgeDocumentListPayload>(response);
  },

  async getKnowledgeStats() {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/stats`);
    await ensureOk(response, 'knowledge stats request failed');
    return parseJson<KnowledgeStatsPayload>(response);
  },

  async uploadKnowledgeDocument(payload: KnowledgeUploadPayload) {
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
    await ensureOk(response, 'knowledge upload failed');
    return parseJson<KnowledgeUploadResponse>(response);
  },

  async deleteKnowledgeDocument(docId: string) {
    const response = await fetch(
      `${AGENT_API_BASE}/knowledge/documents/${encodeURIComponent(docId)}`,
      {
        method: 'DELETE',
      },
    );
    await ensureOk(response, 'knowledge delete failed');
    return parseJson<KnowledgeDeleteResponse>(response);
  },

  async reindexKnowledge(recreate = true) {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recreate }),
    });
    await ensureOk(response, 'knowledge reindex failed');
    return parseJson<KnowledgeReindexResponse>(response);
  },

  async debugKnowledgeSearch(payload: KnowledgeSearchPayload) {
    const response = await fetch(`${AGENT_API_BASE}/knowledge/search/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await ensureOk(response, 'knowledge debug search failed');
    return parseJson<KnowledgeSearchDebugPayload>(response);
  },
};
