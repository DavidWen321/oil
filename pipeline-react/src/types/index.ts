// ========== 閫氱敤绫诲瀷 ==========

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

export interface AnalysisReport {
  id: number;
  proId?: number;
  pipelineId?: number;
  reportNo?: string;
  reportType?: string;
  reportTitle?: string;
  reportSummary?: string;
  fileName?: string;
  filePath?: string;
  fileFormat?: string;
  fileSize?: number;
  historyIds?: string;
  status?: number;
  errorMsg?: string;
  createBy?: string;
  createTime?: string;
  updateTime?: string;
}

export interface CalculationHistory {
  id: number;
  calcType?: string;
  calcTypeName?: string;
  projectId?: number;
  projectName?: string;
  userId?: number;
  userName?: string;
  inputParams?: string;
  outputResult?: string;
  status?: number;
  statusName?: string;
  errorMessage?: string;
  calcDuration?: number;
  calcDurationFormatted?: string;
  remark?: string;
  createTime?: string;
}

// ========== 鐢ㄦ埛璁よ瘉 ==========

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

// ========== 鏁版嵁绠＄悊 ==========

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

// ========== 姘村姏鍒嗘瀽 ==========
export interface KnowledgeDocument {
  id: number;
  title: string;
  category: string;
  sourceType?: string;
  tags?: string;
  remark?: string;
  fileName: string;
  fileExtension?: string;
  fileSize?: number;
  fileHash?: string;
  storageType?: string;
  storageBucket?: string;
  storageObjectKey?: string;
  agentDocId?: string;
  chunkCount?: number;
  retryCount?: number;
  status: string;
  failureReason?: string;
  lastIngestTime?: string;
  createBy?: string;
  createTime?: string;
  updateTime?: string;
}

export interface KnowledgeIngestTask {
  id: number;
  documentId: number;
  taskType: string;
  attemptNo: number;
  status: string;
  agentDocId?: string;
  chunkCount?: number;
  failureReason?: string;
  createBy?: string;
  startedAt?: string;
  finishedAt?: string;
  createTime?: string;
  updateTime?: string;
}

// ========== 濮撳姏鍒嗘瀽 ==========

export interface HydraulicAnalysisParams {
  projectId?: number;
  pipelineId?: number;
  oilId?: number;
  flowRate: number;
  density: number;
  viscosity: number;
  length: number;
  diameter: number;
  thickness: number;
  roughness: number;
  startAltitude: number;
  endAltitude: number;
  inletPressure: number;
  pump480Num: number;
  pump375Num: number;
  pump480Head: number;
  pump375Head: number;
}

export interface HydraulicAnalysisResult {
  frictionHeadLoss: number;
  reynoldsNumber: number;
  flowRegime: string;
  hydraulicSlope: number;
  totalHead: number;
  firstStationOutPressure: number;
  endStationInPressure: number;
}

// ========== 娉电珯浼樺寲 ==========

export interface OptimizationParams {
  projectId?: number;
  flowRate: number;
  density: number;
  viscosity: number;
  length: number;
  diameter: number;
  thickness: number;
  roughness: number;
  startAltitude: number;
  endAltitude: number;
  inletPressure: number;
  pump480Head: number;
  pump375Head: number;
  pumpEfficiency?: number;
  motorEfficiency?: number;
  workingDays?: number;
  electricityPrice?: number;
}

export interface OptimizationResult {
  pump480Num: number;
  pump375Num: number;
  totalHead: number;
  totalPressureDrop: number;
  endStationInPressure: number;
  isFeasible: boolean;
  totalEnergyConsumption: number;
  totalCost: number;
  description: string;
}

// ========== 鏁忔劅鎬у垎鏋?==========

export interface SensitivityVariableConfig {
  variableType: string;
  variableName: string;
  unit: string;
  startPercent: number;
  endPercent: number;
  stepPercent: number;
}

export interface SensitivityVariableInfo {
  code: string;
  name: string;
  unit: string;
  minChangePercent: number;
  maxChangePercent: number;
}

export interface SensitivityParams {
  projectId?: number;
  projectName?: string;
  baseParams: HydraulicAnalysisParams;
  variables: SensitivityVariableConfig[];
  analysisType: 'SINGLE' | 'MULTI' | 'CROSS';
}

export interface SensitivityResult {
  baseResult: HydraulicAnalysisResult;
  variableResults: VariableSensitivityResult[];
  sensitivityRanking: SensitivityRanking[];
  duration: number;
  totalCalculations: number;
}

export interface VariableSensitivityResult {
  variableType: string;
  variableName: string;
  unit: string;
  baseValue: number;
  dataPoints: SensitivityPoint[];
  sensitivityCoefficient: number;
  trend: string;
  maxImpactPercent: number;
}

export interface SensitivityPoint {
  changePercent: number;
  variableValue: number;
  frictionHeadLoss: number;
  frictionChangePercent: number;
  endStationPressure: number;
  pressureChangePercent: number;
  hydraulicSlope: number;
  reynoldsNumber: number;
  flowRegime: string;
  fullResult: HydraulicAnalysisResult;
}

export interface SensitivityRanking {
  rank: number;
  variableType: string;
  variableName: string;
  sensitivityCoefficient: number;
  description: string;
}

// ========== 鏁呴殰璇婃柇 ==========

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

// ========== 澶氭柟妗堝姣?==========

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

// ========== 纰虫帓鏀炬牳绠?==========

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

// ========== 瀹炴椂鐩戞帶 ==========

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

// ========== 鍓嶇鐩戞帶绫诲瀷 ==========

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
