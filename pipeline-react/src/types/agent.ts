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
  local_report_count?: number | null;
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

export interface KnowledgeStageBaseline {
  supported_file_types: string[];
  required_metadata_fields: string[];
  minimal_pipeline: string[];
  module_boundaries: Record<string, string[]>;
}

export interface KnowledgeDocumentSummary {
  doc_id: string;
  title: string;
  source: string;
  category: string;
  tags: string[];
  author?: string | null;
  summary?: string | null;
  language?: string | null;
  version?: string | null;
  external_id?: string | null;
  effective_at?: string | null;
  file_name: string;
  relative_path: string;
  file_type: string;
  file_size_bytes: number;
  source_type: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface KnowledgeDocumentListPayload {
  documents: KnowledgeDocumentSummary[];
  total: number;
}

export interface KnowledgeUploadPayload {
  success: boolean;
  document: KnowledgeDocumentSummary;
  message: string;
}

export interface KnowledgeDeletePayload {
  success: boolean;
  doc_id: string;
  file_deleted: boolean;
  index_deleted: boolean;
  message: string;
}

export interface KnowledgeStatsPayload {
  total_documents: number;
  documents_by_category: Record<string, number>;
  collection_name: string;
  total_chunks: number;
  index_exists: boolean;
  knowledge_root: string;
}

export interface KnowledgeSearchItem {
  doc_id: string;
  doc_title: string;
  content_preview: string;
  score: number;
  category?: string | null;
}

export interface KnowledgeSearchPayload {
  query: string;
  results: KnowledgeSearchItem[];
  total: number;
}

export interface KnowledgeRetrievalDebugItem {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  source: string;
  category?: string | null;
  content_preview: string;
  full_text_preview?: string | null;
  score: number;
  match_type: string;
}

export interface KnowledgeRetrievalDebugMetrics {
  use_hybrid: boolean;
  sparse_enabled: boolean;
  sparse_index_built: boolean;
  dense_weight: number;
  sparse_weight: number;
  dense_candidates: number;
  sparse_candidates: number;
  hybrid_candidates: number;
  dense_duration_ms: number;
  sparse_duration_ms: number;
  fusion_duration_ms: number;
  total_duration_ms: number;
}

export interface KnowledgeSearchDebugPayload {
  query: string;
  top_k: number;
  category_filter?: string | null;
  dense_results: KnowledgeRetrievalDebugItem[];
  sparse_results: KnowledgeRetrievalDebugItem[];
  hybrid_results: KnowledgeRetrievalDebugItem[];
  debug: KnowledgeRetrievalDebugMetrics;
  rerank_results: KnowledgeRerankDebugItem[];
  rerank_debug: KnowledgeRerankDebugMetrics;
}

export interface KnowledgeRerankDebugItem {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  source: string;
  category?: string | null;
  match_type: string;
  original_score: number;
  rerank_score: number;
  final_score: number;
  content_preview: string;
  context_preview?: string | null;
  full_text_preview: string;
}

export interface KnowledgeRerankDebugMetrics {
  reranker_class: string;
  reranker_threshold: number;
  reranker_enabled: boolean;
  rerank_candidates_before: number;
  rerank_candidates_after: number;
  rerank_duration_ms: number;
  contextual_enabled: boolean;
  contextual_results: number;
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type?: string | null;
  weight?: number;
}

export interface KnowledgeGraphVisualization {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface KnowledgeGraphQueryResult {
  message?: string;
  matched_nodes: KnowledgeGraphNode[];
  center_node?: string | null;
  visualization: KnowledgeGraphVisualization;
  total_matches?: number;
}

export interface KnowledgeGraphQueryPayload {
  query: string;
  result: KnowledgeGraphQueryResult;
}

export interface KnowledgeReindexPayload {
  success: boolean;
  documents_indexed: number;
  registry_total: number;
  recreate: boolean;
  message: string;
}
