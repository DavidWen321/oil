import { http } from './request';
import type {
<<<<<<< Updated upstream
  R,
=======
  AlarmMessage,
  AlarmRule,
  AnalysisReport,
  CarbonCalculationRequest,
  CarbonCalculationResult,
  ComparisonRequest,
  ComparisonResult,
  CalculationHistory,
  DiagnosisRequest,
  DiagnosisResult,
  HydraulicAnalysisParams,
  HydraulicAnalysisResult,
>>>>>>> Stashed changes
  LoginParams,
  LoginResult,
  Project,
  Pipeline,
  PumpStation,
  OilProperty,
<<<<<<< Updated upstream
  HydraulicAnalysisParams,
  HydraulicAnalysisResult,
=======
  PageResult,
>>>>>>> Stashed changes
  OptimizationParams,
  OptimizationResult,
  SensitivityParams,
  SensitivityResult,
  DiagnosisRequest,
  DiagnosisResult,
  ComparisonRequest,
  ComparisonResult,
  CarbonCalculationRequest,
  CarbonCalculationResult,
  MonitorDataPoint,
  AlarmMessage,
  AlarmRule,
  AnalysisReport,
  CarbonCalculationRequest,
  CarbonCalculationResult,
  ComparisonRequest,
  ComparisonResult,
  CalculationHistory,
  DiagnosisRequest,
  DiagnosisResult,
  HydraulicAnalysisParams,
  HydraulicAnalysisResult,
  KnowledgeIngestTask,
  LoginParams,
  LoginResult,
  MonitorDataPoint,
  OilProperty,
  OptimizationParams,
  OptimizationResult,
  PageResult,
  KnowledgeDocument,
  Pipeline,
  Project,
  PumpStation,
  R,
  SensitivityResult,
  SensitivityVariableInfo,
} from '../types';

export const authApi = {
  login: (params: LoginParams) => http.post<R<LoginResult>>('/auth/login', params),
};

export const projectApi = {
  list: () => http.get<R<Project[]>>('/project/list'),
  get: (id: number) => http.get<R<Project>>(`/project/${id}`),
  create: (data: Partial<Project>) => http.post<R<boolean>>('/project', data),
  update: (data: Partial<Project>) => http.put<R<boolean>>('/project', data),
  delete: (ids: number[]) => http.delete<R<boolean>>(`/project/${ids.join(',')}`),
};

export const pipelineApi = {
  listByProject: (projectId: number) => http.get<R<Pipeline[]>>(`/pipeline/list/${projectId}`),
  get: (id: number) => http.get<R<Pipeline>>(`/pipeline/${id}`),
  create: (data: Partial<Pipeline>) => http.post<R<boolean>>('/pipeline', data),
  update: (data: Partial<Pipeline>) => http.put<R<boolean>>('/pipeline', data),
  delete: (ids: number[]) => http.delete<R<boolean>>(`/pipeline/${ids.join(',')}`),
};

export const pumpStationApi = {
  list: () => http.get<R<PumpStation[]>>('/pump-station/list'),
  get: (id: number) => http.get<R<PumpStation>>(`/pump-station/${id}`),
  create: (data: Partial<PumpStation>) => http.post<R<boolean>>('/pump-station', data),
  update: (data: Partial<PumpStation>) => http.put<R<boolean>>('/pump-station', data),
  delete: (ids: number[]) => http.delete<R<boolean>>(`/pump-station/${ids.join(',')}`),
};

export const oilPropertyApi = {
  list: () => http.get<R<OilProperty[]>>('/oil-property/list'),
  get: (id: number) => http.get<R<OilProperty>>(`/oil-property/${id}`),
  create: (data: Partial<OilProperty>) => http.post<R<boolean>>('/oil-property', data),
  update: (data: Partial<OilProperty>) => http.put<R<boolean>>('/oil-property', data),
  delete: (ids: number[]) => http.delete<R<boolean>>(`/oil-property/${ids.join(',')}`),
};

export const knowledgeDocumentApi = {
  list: () => http.get<R<KnowledgeDocument[]>>('/knowledge-doc/list'),
  listTasks: (id: number) => http.get<R<KnowledgeIngestTask[]>>(`/knowledge-doc/${id}/tasks`),
  upload: (data: FormData) => http.post<R<KnowledgeDocument>>('/knowledge-doc/upload', data),
  retry: (id: number) => http.post<R<KnowledgeDocument>>(`/knowledge-doc/${id}/retry`),
  delete: (id: number) => http.delete<R<boolean>>(`/knowledge-doc/${id}`),
};

export const calculationApi = {
  hydraulicAnalysis: (params: HydraulicAnalysisParams) =>
    http.post<R<HydraulicAnalysisResult>>('/calculation/hydraulic-analysis', params),
  optimization: (params: OptimizationParams) =>
    http.post<R<OptimizationResult>>('/calculation/optimization', params),
  sensitivityAnalysis: (params: Record<string, unknown>) =>
    http.post<R<SensitivityResult>>('/calculation/sensitivity/analyze', params),
  quickSensitivityAnalysis: (variableType: string, params: HydraulicAnalysisParams) =>
    http.post<R<SensitivityResult>>(
      `/calculation/sensitivity/quick-single?variableType=${encodeURIComponent(variableType)}`,
      params,
    ),
  getSensitivityVariables: () =>
    http.get<R<SensitivityVariableInfo[]>>('/calculation/sensitivity/variables'),
};

export const diagnosisApi = {
  analyze: (params: DiagnosisRequest) =>
    http.post<R<DiagnosisResult>>('/calculation/diagnosis/analyze', params),
  quickCheck: (params: DiagnosisRequest) =>
    http.post<R<number>>('/calculation/diagnosis/quick-check', params),
  getLatest: (pipelineId: number) =>
    http.get<R<DiagnosisResult>>(`/calculation/diagnosis/latest/${pipelineId}`),
};

export const comparisonApi = {
  compare: (params: ComparisonRequest) =>
    http.post<R<ComparisonResult>>('/calculation/comparison/analyze', params),
  getDimensions: () => http.get<R<string[]>>('/calculation/comparison/dimensions'),
};

export const carbonApi = {
  calculate: (params: CarbonCalculationRequest) =>
    http.post<R<CarbonCalculationResult>>('/calculation/carbon/calculate', params),
  getEmissionFactors: () =>
    http.get<R<Record<string, number>>>('/calculation/carbon/emission-factors'),
  getIndustryAverage: () => http.get<R<number>>('/calculation/carbon/industry-average'),
};

export const monitorApi = {
  getCurrentData: (pipelineId: number) =>
    http.get<R<MonitorDataPoint>>(`/calculation/monitor/current/${pipelineId}`),
  getAllCurrentData: () => http.get<R<MonitorDataPoint[]>>('/calculation/monitor/current/all'),
  receiveData: (data: MonitorDataPoint) => http.post<R<void>>('/calculation/monitor/data', data),
  getActiveAlarms: (pipelineId?: number) =>
    http.get<R<AlarmMessage[]>>('/calculation/monitor/alarms', { params: { pipelineId } }),
  acknowledgeAlarm: (alarmId: string, userId: string) =>
    http.post<R<void>>(`/calculation/monitor/alarms/${alarmId}/acknowledge`, { userId }),
  resolveAlarm: (alarmId: string) =>
    http.post<R<void>>(`/calculation/monitor/alarms/${alarmId}/resolve`),
  getAlarmRules: () => http.get<R<AlarmRule[]>>('/calculation/monitor/rules'),
  updateAlarmRule: (rule: AlarmRule) => http.post<R<void>>('/calculation/monitor/rules', rule),
  simulateData: (pipelineId: number, scenario: string) =>
    http.get<R<MonitorDataPoint>>(`/calculation/monitor/simulate/${pipelineId}`, {
      params: { scenario },
    }),
  startSimulation: (pipelineId: number, interval = 3000) =>
    http.post<R<void>>(`/calculation/monitor/simulate/${pipelineId}/start`, null, {
      params: { interval },
    }),
  stopSimulation: (pipelineId: number) =>
    http.post<R<void>>(`/calculation/monitor/simulate/${pipelineId}/stop`),
};

export const statisticsApi = {
  getOverview: () => http.get<R<unknown>>('/calculation/statistics/overview'),
  getDailyTrend: (startDate: string, endDate: string) =>
    http.get<R<unknown>>('/calculation/statistics/trend/daily', {
      params: { startDate, endDate },
    }),
};
<<<<<<< Updated upstream
=======

export const reportApi = {
  page: (params?: {
    reportType?: string;
    projectId?: number;
    userId?: number;
    pageNum?: number;
    pageSize?: number;
  }) => http.get<R<PageResult<AnalysisReport>>>('/calculation/report/page', { params }),
  recent: (limit = 10, userId?: number) =>
    http.get<R<AnalysisReport[]>>('/calculation/report/recent', {
      params: { limit, userId },
    }),
  detail: (id: number) => http.get<R<AnalysisReport>>(`/calculation/report/${id}`),
  delete: (id: number) => http.delete<R<void>>(`/calculation/report/${id}`),
};

export const calculationHistoryApi = {
  page: (params?: {
    calcType?: string;
    projectId?: number;
    userId?: number;
    status?: number;
    pageNum?: number;
    pageSize?: number;
    keyword?: string;
  }) => http.get<R<PageResult<CalculationHistory>>>('/calculation/history/page', { params }),
  byProject: (
    projectId: number,
    params?: {
      pageNum?: number;
      pageSize?: number;
      calcType?: string;
    },
  ) =>
    http.get<R<PageResult<CalculationHistory>>>(`/calculation/history/project/${projectId}`, {
      params,
    }),
  detail: (id: number) => http.get<R<CalculationHistory>>(`/calculation/history/${id}`),
};
