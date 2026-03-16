import { http } from './request';
import type {
  R,
  LoginParams,
  LoginResult,
  Project,
  Pipeline,
  PumpStation,
  OilProperty,
  HydraulicAnalysisParams,
  HydraulicAnalysisResult,
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
} from '../types';

// ========== 认证相关 ==========
export const authApi = {
  login: (params: LoginParams) =>
    http.post<R<LoginResult>>('/auth/login', params),
};

// ========== 项目管理 ==========
export const projectApi = {
  list: () => http.get<R<Project[]>>('/project/list'),
  get: (id: number) => http.get<R<Project>>(`/project/${id}`),
  create: (data: Partial<Project>) => http.post<R<void>>('/project', data),
  update: (data: Partial<Project>) => http.put<R<void>>('/project', data),
  delete: (ids: number[]) => http.delete<R<void>>(`/project/${ids.join(',')}`),
};

// ========== 管道管理 ==========
export const pipelineApi = {
  listByProject: (proId: number) =>
    http.get<R<Pipeline[]>>(`/pipeline/list/${proId}`),
  get: (id: number) => http.get<R<Pipeline>>(`/pipeline/${id}`),
  create: (data: Partial<Pipeline>) => http.post<R<void>>('/pipeline', data),
  update: (data: Partial<Pipeline>) => http.put<R<void>>('/pipeline', data),
  delete: (ids: number[]) => http.delete<R<void>>(`/pipeline/${ids.join(',')}`),
};

// ========== 泵站管理 ==========
export const pumpStationApi = {
  list: () => http.get<R<PumpStation[]>>('/pump-station/list'),
  get: (id: number) => http.get<R<PumpStation>>(`/pump-station/${id}`),
  create: (data: Partial<PumpStation>) =>
    http.post<R<void>>('/pump-station', data),
  update: (data: Partial<PumpStation>) =>
    http.put<R<void>>('/pump-station', data),
  delete: (ids: number[]) =>
    http.delete<R<void>>(`/pump-station/${ids.join(',')}`),
};

// ========== 油品管理 ==========
export const oilPropertyApi = {
  list: () => http.get<R<OilProperty[]>>('/oil-property/list'),
  get: (id: number) => http.get<R<OilProperty>>(`/oil-property/${id}`),
  create: (data: Partial<OilProperty>) =>
    http.post<R<void>>('/oil-property', data),
  update: (data: Partial<OilProperty>) =>
    http.put<R<void>>('/oil-property', data),
  delete: (ids: number[]) =>
    http.delete<R<void>>(`/oil-property/${ids.join(',')}`),
};

// ========== 水力分析 ==========
export const calculationApi = {
  // 水力分析
  hydraulicAnalysis: (params: HydraulicAnalysisParams) =>
    http.post<R<HydraulicAnalysisResult>>(
      '/calculation/hydraulic-analysis',
      params
    ),

  // 泵站优化
  optimization: (params: OptimizationParams) =>
    http.post<R<OptimizationResult>>('/calculation/optimization', params),

  // 敏感性分析
  sensitivityAnalysis: (params: SensitivityParams) =>
    http.post<R<SensitivityResult>>(
      '/calculation/sensitivity/analyze',
      params
    ),

  // 获取敏感性变量列表
  getSensitivityVariables: () =>
    http.get<R<string[]>>('/calculation/sensitivity/variables'),
};

// ========== 智能故障诊断 ==========
export const diagnosisApi = {
  // 综合诊断
  analyze: (params: DiagnosisRequest) =>
    http.post<R<DiagnosisResult>>('/calculation/diagnosis/analyze', params),

  // 快速健康检查
  quickCheck: (params: DiagnosisRequest) =>
    http.post<R<number>>('/calculation/diagnosis/quick-check', params),

  // 获取历史诊断
  getLatest: (pipelineId: number) =>
    http.get<R<DiagnosisResult>>(`/calculation/diagnosis/latest/${pipelineId}`),
};

// ========== 多方案对比 ==========
export const comparisonApi = {
  // 方案对比分析
  compare: (params: ComparisonRequest) =>
    http.post<R<ComparisonResult>>('/calculation/comparison/analyze', params),

  // 获取对比维度
  getDimensions: () =>
    http.get<R<string[]>>('/calculation/comparison/dimensions'),
};

// ========== 碳排放核算 ==========
export const carbonApi = {
  // 碳排放计算
  calculate: (params: CarbonCalculationRequest) =>
    http.post<R<CarbonCalculationResult>>(
      '/calculation/carbon/calculate',
      params
    ),

  // 获取电网排放因子
  getEmissionFactors: () =>
    http.get<R<Record<string, number>>>('/calculation/carbon/emission-factors'),

  // 获取行业平均强度
  getIndustryAverage: () =>
    http.get<R<number>>('/calculation/carbon/industry-average'),
};

// ========== 实时监控 ==========
export const monitorApi = {
  // 获取当前数据
  getCurrentData: (pipelineId: number) =>
    http.get<R<MonitorDataPoint>>(`/calculation/monitor/current/${pipelineId}`),

  // 获取所有数据
  getAllCurrentData: () =>
    http.get<R<MonitorDataPoint[]>>('/calculation/monitor/current/all'),

  // 获取活动告警
  getActiveAlarms: (pipelineId?: number) =>
    http.get<R<AlarmMessage[]>>('/calculation/monitor/alarms', {
      params: { pipelineId },
    }),

  // 确认告警
  acknowledgeAlarm: (alarmId: string, userId: string) =>
    http.post<R<void>>(`/calculation/monitor/alarms/${alarmId}/acknowledge`, {
      userId,
    }),

  // 解决告警
  resolveAlarm: (alarmId: string) =>
    http.post<R<void>>(`/calculation/monitor/alarms/${alarmId}/resolve`),

  // 获取告警规则
  getAlarmRules: () =>
    http.get<R<AlarmRule[]>>('/calculation/monitor/rules'),

  // 更新告警规则
  updateAlarmRule: (rule: AlarmRule) =>
    http.post<R<void>>('/calculation/monitor/rules', rule),

  // 模拟数据
  simulateData: (pipelineId: number, scenario: string) =>
    http.get<R<MonitorDataPoint>>(
      `/calculation/monitor/simulate/${pipelineId}`,
      { params: { scenario } }
    ),

  // 启动模拟
  startSimulation: (pipelineId: number, interval: number = 3000) =>
    http.post<R<void>>(
      `/calculation/monitor/simulate/${pipelineId}/start`,
      null,
      { params: { interval } }
    ),

  // 停止模拟
  stopSimulation: (pipelineId: number) =>
    http.post<R<void>>(`/calculation/monitor/simulate/${pipelineId}/stop`),
};

// ========== 统计报表 ==========
export const statisticsApi = {
  getOverview: () =>
    http.get<R<unknown>>('/calculation/statistics/overview'),

  getDailyTrend: (startDate: string, endDate: string) =>
    http.get<R<unknown>>('/calculation/statistics/trend/daily', {
      params: { startDate, endDate },
    }),
};
