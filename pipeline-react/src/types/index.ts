// ========== 通用类型 ==========

export interface R<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PageQuery {
  pageNum: number;
  pageSize: number;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

// ========== 用户认证 ==========

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  userId: number;
  username: string;
  nickname: string;
}

export interface UserInfo {
  userId: number;
  username: string;
  nickname: string;
  avatar?: string;
  roles: string[];
}

// ========== 数据管理 ==========

export interface Project {
  proId: number;
  number: string;
  name: string;
  responsible?: string;
  buildDate?: string;
  createTime?: string;
  updateTime?: string;
  isDeleted?: number;
}

export interface Pipeline {
  id: number;
  proId: number;
  name: string;
  length: number;
  diameter: number;
  thickness: number;
  throughput: number;
  startAltitude: number;
  endAltitude: number;
  roughness?: number;
  workTime?: number;
  createTime?: string;
  updateTime?: string;
}

export interface PumpStation {
  id: number;
  name: string;
  pumpEfficiency: number;
  electricEfficiency: number;
  displacement: number;
  comePower: number;
  zmi480Lift: number;
  zmi375Lift: number;
  createTime?: string;
  updateTime?: string;
}

export interface OilProperty {
  id: number;
  name: string;
  density: number;
  viscosity: number;
  createTime?: string;
  updateTime?: string;
}

// ========== 水力分析 ==========

export interface HydraulicAnalysisParams {
  pipelineId: number;
  flowRate: number;
  inletPressure: number;
  oilDensity: number;
  oilViscosity: number;
  pipelineLength: number;
  innerDiameter: number;
  roughness: number;
  elevationDiff: number;
}

export interface HydraulicAnalysisResult {
  calculationId: string;
  reynoldsNumber: number;
  flowRegime: string;
  frictionFactor: number;
  frictionHeadLoss: number;
  hydraulicGradient: number;
  inletPressure: number;
  outletPressure: number;
  velocity: number;
  flowRate: number;
  feasible: boolean;
  message: string;
}

// ========== 泵站优化 ==========

export interface OptimizationParams {
  pipelineId: number;
  flowRate: number;
  inletPressure: number;
  oilDensity: number;
  oilViscosity: number;
  pipelineLength: number;
  innerDiameter: number;
  elevationDiff: number;
}

export interface OptimizationResult {
  calculationId: string;
  optimalScheme: PumpScheme;
  allSchemes: PumpScheme[];
  message: string;
}

export interface PumpScheme {
  schemeId: number;
  pumpCombination: string;
  totalPower: number;
  efficiency: number;
  outletPressure: number;
  feasible: boolean;
  energyConsumption: number;
}

// ========== 敏感性分析 ==========

export interface SensitivityParams {
  baseParams: HydraulicAnalysisParams;
  variableType: string;
  variableRange: number[];
  steps: number;
}

export interface SensitivityResult {
  analysisId: string;
  variableType: string;
  dataPoints: SensitivityPoint[];
  sensitivity: number;
  trend: string;
}

export interface SensitivityPoint {
  variableValue: number;
  resultValue: number;
  changePercent: number;
}

// ========== 故障诊断 ==========

export interface DiagnosisRequest {
  pipelineId: number;
  projectId?: number;
  inletPressure: number;
  outletPressure: number;
  maxDesignPressure?: number;
  minDesignPressure?: number;
  inletFlowRate: number;
  outletFlowRate: number;
  designFlowRate?: number;
  temperature?: number;
  actualFrictionLoss?: number;
  theoreticalFrictionLoss?: number;
  actualUnitEnergy?: number;
  standardUnitEnergy?: number;
  pumpDataList?: PumpOperationData[];
}

export interface PumpOperationData {
  pumpStationId?: number;
  pumpName?: string;
  runningPumpCount?: number;
  actualEfficiency?: number;
  ratedEfficiency?: number;
  vibrationValue?: number;
  vibrationThreshold?: number;
}

export interface DiagnosisResult {
  diagnosisId: string;
  pipelineId: number;
  diagnosisTime: string;
  healthScore: number;
  healthLevel: string;
  faults: FaultInfo[];
  conclusion: string;
  priorityActions: string[];
  riskPredictions: RiskPrediction[];
  metrics: DiagnosisMetrics;
}

export interface FaultInfo {
  faultType: string;
  faultCode: string;
  faultName: string;
  severity: string;
  confidence: number;
  description: string;
  detectedValue: string;
  normalRange: string;
  deviationPercent: number;
  possibleCauses: string[];
  recommendations: string[];
}

export interface RiskPrediction {
  riskType: string;
  riskDescription: string;
  probability: number;
  impactLevel: string;
  preventiveMeasures: string[];
}

export interface DiagnosisMetrics {
  pressureScore: number;
  flowScore: number;
  pumpScore: number;
  energyScore: number;
  pressureStatus: string;
  flowStatus: string;
  pumpStatus: string;
  energyStatus: string;
}

// ========== 多方案对比 ==========

export interface ComparisonRequest {
  projectId: number;
  pipelineId: number;
  schemes: SchemeData[];
}

export interface SchemeData {
  schemeName: string;
  description?: string;
  flowRate: number;
  inletPressure: number;
  outletPressure?: number;
  pumpConfigs?: PumpConfig[];
  oilTemperature?: number;
  oilDensity?: number;
  oilViscosity?: number;
  dailyOperatingHours?: number;
  electricityPrice?: number;
}

export interface PumpConfig {
  stationName?: string;
  runningPumpCount?: number;
  pumpPower?: number;
  pumpEfficiency?: number;
  variableFrequency?: boolean;
  frequency?: number;
}

export interface ComparisonResult {
  comparisonId: string;
  comparisonTime: string;
  schemeCount: number;
  schemeAnalyses: SchemeAnalysis[];
  radarChart: RadarChartData;
  barCharts: BarChartData[];
  overallRanking: RankingItem[];
  recommendation: RecommendedScheme;
  conclusion: string;
}

export interface SchemeAnalysis {
  schemeName: string;
  totalPower: number;
  dailyEnergyConsumption: number;
  yearlyEnergyConsumption: number;
  yearlyCost: number;
  unitEnergyConsumption: number;
  systemEfficiency: number;
  safetyMargin: number;
  yearlyCarbonEmission: number;
  energyScore: number;
  costScore: number;
  efficiencyScore: number;
  safetyScore: number;
  environmentScore: number;
  overallScore: number;
  advantages: string[];
  disadvantages: string[];
}

export interface RadarChartData {
  dimensions: string[];
  series: { name: string; values: number[] }[];
}

export interface BarChartData {
  metricName: string;
  unit: string;
  items: { schemeName: string; value: number; isBest: boolean }[];
}

export interface RankingItem {
  rank: number;
  schemeName: string;
  score: number;
  comment: string;
}

export interface RecommendedScheme {
  schemeName: string;
  reasons: string[];
  recommendationLevel: number;
  expectedBenefit: {
    yearlySavingEnergy: number;
    yearlySavingCost: number;
    yearlyCarbonReduction: number;
  };
}

// ========== 碳排放核算 ==========

export interface CarbonCalculationRequest {
  projectId: number;
  pipelineId?: number;
  startDate: string;
  endDate: string;
  periodType?: string;
  electricityConsumption: number;
  gridType?: string;
  useGreenPower?: boolean;
  greenPowerRatio?: number;
  naturalGasConsumption?: number;
  dieselConsumption?: number;
  oilThroughput?: number;
  volatileRate?: number;
  vaporRecoveryRate?: number;
  greenAreaSize?: number;
  solarGeneration?: number;
  pipelineLength?: number;
  pumpStationCount?: number;
}

export interface CarbonCalculationResult {
  calculationId: string;
  calculationTime: string;
  totalEmission: number;
  scope1Emission: number;
  scope2Emission: number;
  scope3Emission: number;
  carbonSink: number;
  netEmission: number;
  emissionPerTon: number;
  emissionPerTonKm: number;
  emissionLevel: string;
  carbonScore: number;
  emissionDetails: EmissionDetail[];
  emissionShares: { name: string; value: number; percent: number }[];
  reductionSuggestions: ReductionSuggestion[];
  carbonQuota?: CarbonQuota;
}

export interface EmissionDetail {
  source: string;
  scope: string;
  activityData: number;
  activityUnit: string;
  emissionFactor: number;
  emission: number;
  sharePercent: number;
}

export interface ReductionSuggestion {
  seq: number;
  category: string;
  suggestion: string;
  expectedReduction: number;
  investmentCost: number;
  paybackPeriod: number;
  difficulty: string;
  priority: number;
}

export interface CarbonQuota {
  annualQuota: number;
  usedQuota: number;
  remainingQuota: number;
  usageRate: number;
  projectedGap: number;
  carbonPrice: number;
  projectedTradingAmount: number;
}

// ========== 实时监控 ==========

export interface MonitorDataPoint {
  dataId: string;
  pipelineId: number;
  pipelineName: string;
  timestamp: string;
  inletPressure: number;
  outletPressure: number;
  pressureDrop: number;
  inletFlowRate: number;
  outletFlowRate: number;
  flowDifference: number;
  flowDifferenceRate: number;
  temperature: number;
  runningPumpCount: number;
  totalPower: number;
  avgPumpEfficiency: number;
  realTimePower: number;
  cumulativeEnergy: number;
  unitEnergy: number;
  healthScore: number;
  systemStatus: string;
  activeAlarmCount: number;
}

export interface AlarmMessage {
  alarmId: string;
  pipelineId: number;
  pipelineName: string;
  alarmTime: string;
  alarmType: string;
  alarmLevel: string;
  title: string;
  description: string;
  metricName: string;
  currentValue: number;
  threshold: number;
  deviationPercent: number;
  source: string;
  status: string;
  suggestion: string;
}

export interface AlarmRule {
  ruleId: number;
  ruleName: string;
  alarmType: string;
  metricName: string;
  operator: string;
  warningThreshold: number;
  criticalThreshold: number;
  emergencyThreshold?: number;
  enabled: boolean;
  description: string;
}

// ========== 前端监控类型 ==========

export interface MonitorData {
  pipelineId: number;
  timestamp: string;
  inletPressure: number;
  outletPressure: number;
  flowRate: number;
  oilTemperature: number;
  pumpStatus: PumpStatus[];
  energyConsumption: number;
  systemEfficiency: number;
}

export interface PumpStatus {
  pumpId: number;
  name: string;
  running: boolean;
  current: number;
  frequency: number;
  vibration: number;
}

export interface AlarmInfo {
  alarmId: string;
  pipelineId: number;
  alarmType: string;
  alarmLevel: 'info' | 'warning' | 'critical';
  message: string;
  value: string;
  threshold: string;
  timestamp: string;
  acknowledged: boolean;
}

export * from './agent';
