import type { HITLResponse } from '../types/agent';

const AGENT_API_BASE =
  import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8100/api/v1';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

export const agentApi = {
  baseUrl: AGENT_API_BASE,

  async chat(message: string, sessionId: string) {
    const response = await fetch(`${AGENT_API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, response: responsePayload }),
    });

    if (!response.ok) {
      throw new Error(`confirm request failed: ${response.status}`);
    }

    return parseJson<Record<string, unknown>>(response);
  },

  async getTrace(traceId: string) {
    const response = await fetch(`${AGENT_API_BASE}/trace/${traceId}`);
    if (!response.ok) {
      throw new Error(`trace request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  async generateReport(userRequest: string, sessionId?: string) {
    const response = await fetch(`${AGENT_API_BASE}/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_request: userRequest, session_id: sessionId }),
    });

    if (!response.ok) {
      throw new Error(`report request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },

  async listJavaReports(pageNum = 1, pageSize = 10) {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    });
    const response = await fetch(`${AGENT_API_BASE}/report/java/reports?${params.toString()}`);
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
    const response = await fetch(`${AGENT_API_BASE}/graph/query?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`graph request failed: ${response.status}`);
    }
    return parseJson<Record<string, unknown>>(response);
  },
};
