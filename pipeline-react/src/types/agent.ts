export type TraceStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'waiting_hitl'
  | 'completed'
  | 'stopped'
  | 'error';

export interface PlanStep {
  step_id?: string;
  step_number: number;
  description: string;
  agent: string;
  expected_output?: string;
  depends_on?: Array<string | number>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: unknown;
  error?: string | null;
  duration_ms?: number | null;
  retry_count?: number;
}

export interface TraceLog {
  timestamp: string;
  type: string;
  text: string;
  stepNumber?: number;
  agent?: string;
}

export interface TraceMetrics {
  total_duration_ms: number;
  llm_calls: number;
  tool_calls: number;
  total_tokens: number;
  steps_completed: number;
  steps_failed: number;
  retries: number;
}

export interface HITLOption {
  id: string;
  label: string;
  energy?: number;
  end_pressure?: number;
  saving_rate?: number;
  risk_level?: 'high' | 'normal';
}

export interface HITLRequest {
  request_id?: string;
  type: string;
  title: string;
  description: string;
  options: HITLOption[];
  data?: Record<string, unknown>;
}

export interface HITLResponse {
  request_id?: string;
  selected_option: string;
  modified_data?: Record<string, unknown>;
  comment?: string;
}

export interface TraceEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface ToolSearchScore {
  name: string;
  score: number;
  forced?: boolean;
}

export interface ToolSearchFilters {
  categories?: string[];
  sources?: string[];
}

export interface ToolSearchSnapshot {
  query: string;
  selected_tools: string[];
  selected_scores: ToolSearchScore[];
  total_tools: number;
  duration_ms: number;
  mode: string;
  filters?: ToolSearchFilters;
  timestamp: string;
}

export interface AgentTraceState {
  traceId: string | null;
  plan: PlanStep[];
  currentStep: number;
  thinking: string;
  logs: TraceLog[];
  metrics: TraceMetrics;
  hitlRequest: HITLRequest | null;
  status: TraceStatus;
  finalResponse: string;
  sessionId: string;
  activeTools: ToolExecutionEvent[];
  lastToolSearch: ToolSearchSnapshot | null;
  errorMessage?: string | null;
}

export interface ReportSection {
  title: string;
  content: string;
  charts?: Array<Record<string, unknown>>;
  tables?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
}

export interface ReportData {
  title: string;
  generate_time: string;
  sections: ReportSection[];
  summary?: string;
  recommendations?: string[];
}

export interface ReportGeneratePayload {
  trace_id: string;
  report: ReportData;
  java_report_id?: number | null;
  java_download_url?: string | null;
  java_download_url_pdf?: string | null;
}

export interface ToolExecutionEvent {
  tool: string;
  call_id?: string;
  input?: Record<string, unknown>;
  output?: string;
  timestamp?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  tools?: ToolExecutionEvent[];
}
