import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import ReactECharts from 'echarts-for-react';
import {
  BarChartOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { agentApi } from '../../api/agent';
import { calculationHistoryApi, projectApi, reportApi } from '../../api';
import type {
  AnalysisReport,
  CalculationHistory,
  Project,
  ReportData,
  ReportGeneratePayload,
  ReportSection,
} from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';
import type {
  LinkedCalculationRecord,
  LinkedCalculationType,
} from '../../stores/calculationLinkStore';
import { useCalculationLinkStore } from '../../stores/calculationLinkStore';
import { useUserStore } from '../../stores/userStore';

const { Paragraph } = Typography;

const TEXT = {
  pageTitle: '报告预览',
  pageDescription: '从数据库读取项目信息和历史生成报告，支持按勾选项目筛选。',
  projectTitle: '项目勾选',
  projectDescription: '以下项目编号、项目名称、负责人、创建时间均直接来自数据库。',
  historyTitle: '历史生成报告',
  historyDescription: '下方展示数据库中已生成的历史报告，可按上方勾选项目进行筛选。',
  reload: '刷新数据',
  selectAll: '全选',
  clearAll: '清空',
  selectedCount: '已勾选',
  selectedUnit: '项',
  dbTag: '数据库',
  allReports: '全部历史报告',
  filteredReports: '按勾选项目筛选',
  fieldNumber: '项目编号',
  fieldName: '项目名称',
  fieldResponsible: '负责人',
  fieldCreateTime: '创建时间',
  reportNo: '报告编号',
  reportTitle: '报告标题',
  reportType: '报告类型',
  reportStatus: '状态',
  projectEmpty: '数据库中暂无项目数据',
  reportEmpty: '数据库中暂无历史生成报告',
  reportFilterEmpty: '当前勾选项目暂无历史生成报告',
  loadProjectFailed: '读取项目数据失败，请稍后重试',
  loadReportFailed: '读取历史生成报告失败，请稍后重试',
  statusCompleted: '已完成',
  statusGenerating: '生成中',
  statusFailed: '失败',
  statusUnknown: '未知',
  typeUnknown: '未分类',
} as const;

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ');
}

function sortProjects(list: Project[]) {
  return [...list].sort((left, right) => {
    const leftTime = new Date(left.createTime || left.buildDate || 0).getTime();
    const rightTime = new Date(right.createTime || right.buildDate || 0).getTime();

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.proId - right.proId;
  });
}

function sortReports(list: AnalysisReport[]) {
  return [...list].sort((left, right) => {
    const leftTime = new Date(left.createTime || 0).getTime();
    const rightTime = new Date(right.createTime || 0).getTime();

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id - left.id;
  });
}

function getStatusMeta(status?: number) {
  if (status === 1) {
    return { text: TEXT.statusCompleted, color: 'success' as const };
  }

  if (status === 0) {
    return { text: TEXT.statusGenerating, color: 'processing' as const };
  }

  if (status === 2) {
    return { text: TEXT.statusFailed, color: 'error' as const };
  }

  return { text: TEXT.statusUnknown, color: 'default' as const };
}

function getReportTypeText(value?: string) {
  if (!value) {
    return TEXT.typeUnknown;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === 'DAILY') {
    return '日报';
  }

  if (normalized === 'WEEKLY') {
    return '周报';
  }

  if (normalized === 'MONTHLY') {
    return '月报';
  }

  if (normalized === 'ANNUAL') {
    return '年报';
  }

  if (normalized === 'HYDRAULIC') {
    return '水力分析';
  }

  if (normalized === 'OPTIMIZATION') {
    return '泵站优化';
  }

  if (normalized === 'SENSITIVITY') {
    return '敏感性分析';
  }

  return value;
}

const TEXT = {
  defaultRequest:
    '\u751f\u6210\u957f\u5e86\u7ba1\u9053\u672c\u6708\u8fd0\u884c\u5206\u6790\u62a5\u544a\uff0c\u5e76\u5199\u660e\u8ba1\u7b97\u5165\u53c2\u3001\u6c34\u529b\u7ed3\u679c\u3001\u4f18\u5316\u7ed3\u679c\u548c\u654f\u611f\u6027\u7ed3\u679c\u3002',
  completed: '\u5df2\u5b8c\u6210',
  generating: '\u751f\u6210\u4e2d',
  failed: '\u5931\u8d25',
  unknown: '\u672a\u77e5',
  reportPreview: '\u62a5\u544a\u9884\u89c8',
  pageDescription:
    '\u56f4\u7ed5\u8fd0\u884c\u5206\u6790\u3001\u80fd\u8017\u8bc4\u4f30\u548c\u4f18\u5316\u5efa\u8bae\u751f\u6210\u6b63\u5f0f\u62a5\u544a\uff0c\u5e76\u652f\u6301 Java \u843d\u5e93\u4e0e\u4e0b\u8f7d\u5f52\u6863\u3002',
  loadJavaReports: '\u8bfb\u53d6Java\u62a5\u544a',
  refreshList: '\u5237\u65b0\u5217\u8868',
  generateReport: '\u751f\u6210\u62a5\u544a',
  requestTitle: '\u62a5\u544a\u9700\u6c42',
  requestHelp:
    '\u63cf\u8ff0\u8d8a\u5177\u4f53\uff0cAI \u751f\u6210\u7684\u6458\u8981\u3001\u56fe\u8868\u548c\u4f18\u5316\u5efa\u8bae\u5c31\u8d8a\u5b8c\u6574\u3002',
  agentUnavailableTitle: 'AI \u62a5\u544a\u670d\u52a1\u5f53\u524d\u4e0d\u53ef\u7528',
  agentUnavailableDesc:
    '\u8bfb\u53d6\u548c\u4e0b\u8f7d\u5df2\u751f\u6210\u7684 Java \u62a5\u544a\u53ef\u4ee5\u6b63\u5e38\u4f7f\u7528\uff1b\u5982\u679c\u8981\u542f\u7528 AI \u81ea\u52a8\u751f\u6210\uff0c\u9700\u8981\u5148\u542f\u52a8 8100 \u7aef\u53e3\u7684 Agent \u670d\u52a1\u3002',
  requestPlaceholder:
    '\u8bf7\u8f93\u5165\u62a5\u544a\u9700\u6c42\uff0c\u4f8b\u5982\uff1a\u751f\u6210\u957f\u5e86\u7ba1\u9053\u672c\u6708\u8fd0\u884c\u5206\u6790\u62a5\u544a\uff0c\u5e76\u5199\u660e\u8ba1\u7b97\u5165\u53c2\u3001\u6c34\u529b\u7ed3\u679c\u3001\u4f18\u5316\u7ed3\u679c\u548c\u654f\u611f\u6027\u7ed3\u679c\u660e\u7ec6\u3002',
  downloadWord: '\u4e0b\u8f7d Word',
  downloadPdf: '\u4e0b\u8f7d PDF',
  javaReportId: '\u62a5\u544a\u8bb0\u5f55ID',
  localReportCount: '\u672c\u5730\u62a5\u544a\u6570',
  aiReportReady: 'AI \u62a5\u544a\u5df2\u5c31\u7eea',
  aiReportPending: 'AI \u62a5\u544a\u672a\u751f\u6210',
  javaStorageReady: 'Java \u843d\u5e93\u5df2\u5173\u8054',
  javaStoragePending: 'Java \u843d\u5e93\u5f85\u751f\u6210',
  javaReportRecords: '\u5386\u53f2\u751f\u6210\u62a5\u544a',
  totalPrefix: '\u5171',
  totalSuffix: '\u6761',
  emptyJavaReports: '\u6682\u65e0\u5386\u53f2\u751f\u6210\u62a5\u544a',
  currentReport: '\u5f53\u524d\u9009\u4e2d\u62a5\u544a',
  selectJavaReport: '\u8bf7\u5148\u8bfb\u53d6\u6216\u9009\u62e9\u4e00\u4efd Java \u62a5\u544a',
  noSummary: '\u5f53\u524d\u62a5\u544a\u6682\u65e0\u6458\u8981\u4fe1\u606f\u3002',
  untitledReport: '\u672a\u547d\u540d\u62a5\u544a',
  generatedAt: '\u751f\u6210\u65f6\u95f4',
  reportHint: '\u751f\u6210\u540e\u5c06\u5728\u6b64\u6e32\u67d3\u56fe\u8868\u3001\u8868\u683c\u4e0e AI \u62a5\u544a\u5185\u5bb9\u3002',
  statAiStatus: 'AI \u670d\u52a1',
  aiOnline: '\u53ef\u7528',
  aiOffline: '\u79bb\u7ebf',
  noSelection: '\u672a\u9009\u62e9',
  generationGuide: '\u751f\u6210\u6307\u5f15',
  guideStep1Title: '\u8f93\u5165\u62a5\u544a\u76ee\u6807',
  guideStep1Desc:
    '\u5efa\u8bae\u76f4\u63a5\u5199\u660e\u65f6\u95f4\u8303\u56f4\u3001\u5173\u6ce8\u6307\u6807\u548c\u5e0c\u671b\u5f97\u5230\u7684\u7ed3\u8bba\u3002',
  guideStep2Title: '\u8bfb\u53d6\u5386\u53f2\u62a5\u544a',
  guideStep2Desc:
    '\u53ef\u5148\u8bfb\u53d6 Java \u62a5\u544a\uff0c\u53c2\u8003\u4ee5\u5f80\u843d\u5e93\u6587\u4ef6\u7684\u7ed3\u6784\u548c\u6458\u8981\u98ce\u683c\u3002',
  guideStep3Title: '\u68c0\u67e5 AI \u5185\u5bb9',
  guideStep3Desc:
    '\u751f\u6210\u540e\u4f1a\u5728\u9875\u9762\u4e0b\u65b9\u6e32\u67d3\u5206\u7ae0\u5185\u5bb9\uff0c\u540c\u65f6\u5173\u8054 Java \u62a5\u544a\u8bb0\u5f55\u3002',
  recommendedPrompts: '\u63a8\u8350\u63d0\u793a',
  prompt1:
    '\u751f\u6210\u957f\u5e86\u7ba1\u9053\u672c\u6708\u8fd0\u884c\u5206\u6790\u62a5\u544a\uff0c\u5f3a\u8c03\u80fd\u8017\u53d8\u5316\u3001\u672b\u7ad9\u538b\u529b\u4e0e\u5f02\u5e38\u544a\u8b66\u3002',
  prompt2:
    '\u5bf9\u672c\u5468\u6cf5\u7ad9\u6548\u7387\u6ce2\u52a8\u8fdb\u884c\u8bc4\u4f30\uff0c\u7ed9\u51fa\u53ef\u6267\u884c\u7684\u4f18\u5316\u8c03\u5ea6\u5efa\u8bae\u3002',
  prompt3:
    '\u57fa\u4e8e\u8fd1\u671f\u8fd0\u884c\u6570\u636e\u603b\u7ed3\u5355\u4f4d\u80fd\u8017\u8d70\u52bf\uff0c\u5bf9\u6cf5\u7ec4\u7ec4\u5408\u4f18\u5316\u8fdb\u884c\u4e13\u9898\u8bf4\u660e\u3002',
  reportCoverage: '\u62a5\u544a\u5c06\u8986\u76d6',
  coverage1: '\u8fd0\u884c\u6982\u89c8',
  coverage2: '\u80fd\u8017\u5206\u6790',
  coverage3: '\u6cf5\u7ad9\u6548\u7387',
  coverage4: '\u5f02\u5e38\u4e0e\u98ce\u9669',
  coverage5: '\u4f18\u5316\u5efa\u8bae',
  reportStructure: '\u62a5\u544a\u7ed3\u6784\u9884\u89c8',
  expectedOutput: '\u9884\u671f\u8f93\u51fa',
  expected1: '\u6838\u5fc3\u6307\u6807\u6458\u8981\u4e0e\u7ed3\u8bba',
  expected2: '\u66f2\u7ebf\u56fe\u3001\u8868\u683c\u548c\u5206\u7ae0\u5185\u5bb9',
  expected3: '\u53ef\u843d\u5730\u7684\u4f18\u5316\u5efa\u8bae\u548c\u98ce\u9669\u63d0\u793a',
  expected4: 'Word/PDF \u5f52\u6863\u6587\u4ef6',
  detailReadFailed: '\u8bfb\u53d6\u62a5\u544a\u8be6\u60c5\u5931\u8d25',
  javaReadFailed: '\u8bfb\u53d6 Java \u62a5\u544a\u5931\u8d25',
  inputRequest: '\u8bf7\u8f93\u5165\u62a5\u544a\u9700\u6c42',
  aiGenerateSuccess: 'AI \u62a5\u544a\u751f\u6210\u6210\u529f',
  aiUnavailable:
    'AI \u62a5\u544a\u670d\u52a1\u672a\u542f\u52a8\uff0c\u5f53\u524d\u53ea\u80fd\u8bfb\u53d6\u548c\u4e0b\u8f7d\u5df2\u751f\u6210\u7684 Java \u62a5\u544a',
  javaRefreshSuccess: 'Java \u62a5\u544a\u5df2\u5237\u65b0',
  relogin: '\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55',
  javaDownloadFailed: 'Java \u62a5\u544a\u4e0b\u8f7d\u5931\u8d25',
  colId: '\u5e8f\u53f7',
  colReportNo: '\u62a5\u544a\u7f16\u53f7',
  colTitle: '\u6807\u9898',
  colType: '\u7c7b\u578b',
  colStatus: '\u72b6\u6001',
  colCreateTime: '\u751f\u6210\u65f6\u95f4',
  colAction: '\u64cd\u4f5c',
  actionView: '\u67e5\u770b',
  actionDelete: '\u5220\u9664',
  actionDownload: '\u4e0b\u8f7d',
  doubleClickHint: '\u53cc\u51fb\u884c\u53ef\u67e5\u770b\u62a5\u544a',
  deleteConfirmTitle: '\u786e\u5b9a\u5220\u9664\u8fd9\u4efd\u5386\u53f2\u62a5\u544a\u5417\uff1f',
  deleteConfirmDesc: '\u5220\u9664\u540e\u5c06\u540c\u65f6\u79fb\u9664\u5f52\u6863\u6587\u4ef6\u4e0e\u5386\u53f2\u8bb0\u5f55\u3002',
  deleteSuccess: '\u62a5\u544a\u5df2\u5220\u9664',
  deleteFailed: '\u5220\u9664\u62a5\u544a\u5931\u8d25',
  calcHistoryLoadFailed: '\u8bfb\u53d6\u8ba1\u7b97\u5386\u53f2\u5931\u8d25\uff0c\u8bf7\u5148\u786e\u8ba4\u8ba1\u7b97\u670d\u52a1\u53ef\u7528\u3002',
  calcHistoryMissing:
    '\u672a\u627e\u5230\u53ef\u7528\u7684\u8ba1\u7b97\u5386\u53f2\uff0c\u8bf7\u5148\u5b8c\u6210\u6c34\u529b\u5206\u6790\u3001\u6cf5\u7ad9\u4f18\u5316\u6216\u654f\u611f\u6027\u5206\u6790\u3002',
  calcHistoryProjectMissingPrefix:
    '\u9879\u76ee\u300c',
  calcHistoryProjectMissingSuffix:
    '\u300d\u6682\u65e0\u53ef\u7528\u7684\u8ba1\u7b97\u5386\u53f2\uff0c\u8bf7\u5148\u5728\u8be5\u9879\u76ee\u4e0b\u5b8c\u6210\u8ba1\u7b97\u3002',
  projectDetectRequired:
    '\u672a\u4ece\u62a5\u544a\u9700\u6c42\u4e2d\u8bc6\u522b\u5230\u9879\u76ee\u540d\uff0c\u7cfb\u7edf\u5c06\u4f18\u5148\u9009\u7528\u5f53\u524d\u4f1a\u8bdd\u5df2\u5173\u8054\u7684\u8ba1\u7b97\u7ed3\u679c\u3002',
  projectDetectFallback:
    '\u672a\u4ece\u62a5\u544a\u9700\u6c42\u4e2d\u8bc6\u522b\u5230\u9879\u76ee\u540d\uff0c\u672c\u6b21\u5df2\u81ea\u52a8\u9009\u62e9\u6700\u8fd1\u4e14\u4fe1\u606f\u6700\u5b8c\u6574\u7684\u8ba1\u7b97\u7ed3\u679c\u751f\u6210\u62a5\u544a\u3002',
  linkedContextAppliedPrefix:
    '\u672c\u6b21\u62a5\u544a\u5df2\u5173\u8054\u5f53\u524d\u4f1a\u8bdd\u8ba1\u7b97\uff1a',
  calcHistoryPartialPrefix: '\u62a5\u544a\u5c06\u57fa\u4e8e\u5df2\u83b7\u53d6\u7684\u8ba1\u7b97\u7ed3\u679c\u751f\u6210\uff0c\u7f3a\u5c11\uff1a',
  calcTypeHydraulic: '\u6c34\u529b\u5206\u6790',
  calcTypeOptimization: '\u6cf5\u7ad9\u4f18\u5316',
  calcTypeSensitivity: '\u654f\u611f\u6027\u5206\u6790',
  descId: '\u8bb0\u5f55ID',
  descStatus: '\u72b6\u6001',
  descReportNo: '\u62a5\u544a\u7f16\u53f7',
  descReportType: '\u62a5\u544a\u7c7b\u578b',
  descFileFormat: '\u6587\u4ef6\u683c\u5f0f',
  descFileSize: '\u6587\u4ef6\u5927\u5c0f',
  descCreateTime: '\u521b\u5efa\u65f6\u95f4',
  descCreateBy: '\u521b\u5efa\u4eba',
  descVersion: '\u7248\u672c\u53f7',
  descSource: '\u62a5\u544a\u6765\u6e90',
  aiReportContent: 'AI \u62a5\u544a\u5185\u5bb9',
  reportOverview: '\u62a5\u544a\u6982\u89c8',
  reportAbstract: '\u62a5\u544a\u6458\u8981',
  archiveDetails: '\u5f52\u6863\u4e0e\u4ea4\u4ed8',
  downloadRecords: '\u4e0b\u8f7d\u8bb0\u5f55',
  blockStatus: '\u62a5\u544a\u72b6\u6001',
  blockFormat: '\u5f52\u6863\u683c\u5f0f',
  blockDownload: '\u4e0b\u8f7d\u72b6\u6001',
  blockOwner: '\u521b\u5efa\u4eba',
  blockCreatedAt: '\u751f\u6210\u65f6\u95f4',
  blockVolume: '\u6587\u4ef6\u4f53\u79ef',
  blockReady: '\u5df2\u5c31\u7eea',
  blockWaiting: '\u5f85\u751f\u6210',
  blockCanDownload: '\u53ef\u4e0b\u8f7d',
  blockUnavailable: '\u4e0d\u53ef\u7528',
  blockUnknownOwner: '\u672a\u8bb0\u5f55',
  defaultVersion: 'v1.0',
  sourceAgent: 'AI Agent + Java \u843d\u5e93',
  sourceJava: 'Java \u8ba1\u7b97\u670d\u52a1',
  sourcePending: '\u5f85\u751f\u6210',
  summaryPlaceholder:
    '\u9009\u4e2d\u62a5\u544a\u540e\uff0c\u8fd9\u91cc\u4f1a\u5c55\u793a\u6458\u8981\u3001\u5f52\u6863\u4fe1\u606f\u4e0e\u4e0b\u8f7d\u72b6\u6001\u3002',
  reportTags: '\u62a5\u544a\u6807\u7b7e',
  tagArchived: '\u5df2\u843d\u5e93',
  tagSelectable: '\u53ef\u9884\u89c8',
  tagDownloadable: '\u53ef\u4e0b\u8f7d',
  previewTitle: '\u793a\u4f8b\u9884\u89c8',
  previewDescription:
    '\u4e0b\u65b9\u4e3a AI \u62a5\u544a\u5c1a\u672a\u751f\u6210\u65f6\u7684\u9ad8\u4fdd\u771f\u9884\u89c8\uff0c\u7528\u4e8e\u5c55\u793a\u6458\u8981\u3001\u5efa\u8bae\u4e0e\u7ed3\u6784\u5316\u8868\u683c\u7684\u6700\u7ec8\u5448\u73b0\u6548\u679c\u3002',
  mockSummaryTitle: '\u793a\u4f8b\u6458\u8981',
  mockSummaryBody:
    '\u672c\u5468\u957f\u5e86\u7ba1\u9053\u603b\u4f53\u8fd0\u884c\u5e73\u7a33\uff0c\u5355\u4f4d\u80fd\u8017\u5728\u5468\u4e09\u5230\u5468\u56db\u671f\u95f4\u51fa\u73b0\u8f7b\u5fae\u6298\u5347\uff0c\u4e3b\u8981\u4e0e\u6cf5\u7ad9\u6548\u7387\u6ce2\u52a8\u548c\u5c40\u90e8\u8f93\u91cf\u53d8\u5316\u6709\u5173\u3002\u672b\u7ad9\u538b\u529b\u6574\u4f53\u5904\u4e8e\u5b89\u5168\u533a\u95f4\uff0c\u4f46 2 \u53f7\u6cf5\u7ec4\u7ec4\u5408\u4ecd\u6709\u8c03\u4f18\u7a7a\u95f4\u3002',
  mockSuggestionTitle: '\u793a\u4f8b\u4f18\u5316\u5efa\u8bae',
  mockSuggestion1: '\u4f18\u5148\u5c06 2 \u53f7\u7ad9 ZMI480 \u6cf5\u7ec4\u5207\u6362\u5230\u6548\u7387\u66f4\u9ad8\u7684\u7ec4\u5408\u6863\u4f4d\u3002',
  mockSuggestion2: '\u5bf9\u9ad8\u8f93\u91cf\u65f6\u6bb5\u8fdb\u884c\u5206\u65f6\u8c03\u5ea6\uff0c\u964d\u4f4e\u5355\u4f4d\u8f93\u9001\u7535\u8017\u3002',
  mockSuggestion3: '\u6301\u7eed\u76d1\u63a7\u672b\u7ad9\u538b\u529b\u4e0e\u6cf5\u6548\u5173\u8054\u53d8\u5316\uff0c\u51cf\u5c11\u8fc7\u5269\u626c\u7a0b\u3002',
  mockTableTitle: '\u793a\u4f8b\u5206\u6790\u8868\u683c',
  mockMetric1: '\u5355\u4f4d\u80fd\u8017',
  mockMetric2: '\u672b\u7ad9\u538b\u529b',
  mockMetric3: '\u6cf5\u7ad9\u6548\u7387',
  mockMetric4: '\u4f18\u5316\u6f5c\u529b',
  mockDimCol: '\u5206\u6790\u7ef4\u5ea6',
  mockCurrentCol: '\u5f53\u524d\u8868\u73b0',
  mockRiskCol: '\u98ce\u9669\u7b49\u7ea7',
  mockActionCol: '\u5efa\u8bae\u52a8\u4f5c',
  riskLow: '\u4f4e',
  riskMedium: '\u4e2d',
  previewSectionTitle: '\u793a\u4f8b\u5efa\u8bae\u6bb5\u843d',
  previewSectionBody:
    '\u5efa\u8bae\u4f18\u5148\u5173\u6ce8\u5468\u4e09\u81f3\u5468\u56db\u671f\u95f4\u7684\u80fd\u8017\u6298\u5347\u533a\u95f4\uff0c\u7ed3\u5408\u6cf5\u7ad9\u542f\u505c\u7b56\u7565\u548c\u672b\u7ad9\u538b\u529b\u63a7\u5236\u505a\u534f\u540c\u4f18\u5316\u3002\u82e5\u5c06\u9ad8\u8d1f\u8377\u65f6\u6bb5\u7684\u6cf5\u7ec4\u7ec4\u5408\u7531\u5f53\u524d\u65b9\u6848\u5207\u6362\u4e3a\u9ad8\u6548\u7ec4\u5408\uff0c\u9884\u8ba1\u53ef\u5e26\u6765 5% \u5230 7% \u7684\u80fd\u8017\u6539\u5584\u7a7a\u95f4\u3002',
  alertTagsTitle: '\u793a\u4f8b\u544a\u8b66\u6807\u7b7e',
  alertTag1: '\u80fd\u8017\u6298\u5347',
  alertTag2: '\u6cf5\u6548\u6ce2\u52a8',
  alertTag3: '\u672b\u7ad9\u538b\u529b\u7a33\u5b9a',
  sampleSectionsTitle: '\u793a\u4f8b\u7ae0\u8282\u5361',
  sampleSection1Title: '\u4e00\u3001\u8fd0\u884c\u6982\u89c8',
  sampleSection1Desc:
    '\u6982\u89c8\u672c\u5468\u6d41\u91cf\u3001\u538b\u529b\u548c\u80fd\u8017\u603b\u4f53\u53d8\u5316\uff0c\u8bc6\u522b\u5f02\u5e38\u6ce2\u52a8\u65f6\u6bb5\u3002',
  sampleSection2Title: '\u4e8c\u3001\u6548\u7387\u8bca\u65ad',
  sampleSection2Desc:
    '\u5bf9\u6cf5\u7ec4\u6548\u7387\u3001\u5355\u4f4d\u80fd\u8017\u548c\u626c\u7a0b\u5339\u914d\u5173\u7cfb\u8fdb\u884c\u5bf9\u6bd4\u8bc4\u4f30\u3002',
  sampleSection3Title: '\u4e09\u3001\u4f18\u5316\u6267\u884c',
  sampleSection3Desc:
    '\u7ed9\u51fa\u6cf5\u7ec4\u5207\u6362\u3001\u65f6\u6bb5\u8c03\u5ea6\u548c\u672b\u7ad9\u538b\u529b\u63a7\u5236\u7684\u6267\u884c\u5efa\u8bae\u3002',
  sampleRecordCreated: '\u62a5\u544a\u5f52\u6863',
  sampleRecordWord: 'Word \u4e0b\u8f7d',
  sampleRecordPdf: 'PDF \u4e0b\u8f7d',
  sampleRecordPending: '\u6682\u65e0\u4e0b\u8f7d\u8bb0\u5f55',
  sampleRecordPendingDesc:
    '\u5f53\u524d\u8fd8\u6ca1\u6709\u672c\u6b21\u4f1a\u8bdd\u7684\u5b9e\u9645\u4e0b\u8f7d\u64cd\u4f5c\uff0c\u4e0b\u8f7d Word/PDF \u540e\u4f1a\u5728\u6b64\u7d2f\u79ef\u3002',
  emptyAiReportTitle: '\u5c1a\u672a\u751f\u6210 AI \u5185\u5bb9',
  emptyAiReportDesc:
    '\u5f53\u524d\u8fd8\u6ca1\u6709\u53ef\u5c55\u793a\u7684 AI \u5206\u7ae0\u5185\u5bb9\uff0c\u4f46\u4f60\u53ef\u4ee5\u5148\u5728\u53f3\u4fa7\u67e5\u770b\u62a5\u544a\u5efa\u8bae\u7ed3\u6784\u4e0e\u8f93\u51fa\u8303\u56f4\u3002',
  previewMetaOnly:
    '\u5f53\u524d\u5f52\u6863\u6682\u672a\u4fdd\u5b58\u5b8c\u6574\u7ae0\u8282\u5185\u5bb9\uff0c\u53ef\u5148\u67e5\u770b\u6458\u8981\u6216\u4e0b\u8f7d\u5f52\u6863\u6587\u4ef6\u3002',
  recommendationSummary: '\u4f18\u5316\u5efa\u8bae\u6458\u8981',
  agentPdfUnavailable: 'PDF \u5f52\u6863\u6682\u672a\u751f\u6210',
  agentArchiveFailed: '\u62a5\u544a\u5f52\u6863\u4e0b\u8f7d\u5931\u8d25',
  brokenPreviewText: '\u539f\u59cb\u5185\u5bb9\u5b58\u5728\u4e71\u7801\uff0c\u8bf7\u91cd\u65b0\u751f\u6210\u62a5\u544a\u3002',
  missingPreviewCell: '\u5f85\u8865\u5145',
  missingSectionContent: '\u5f53\u524d\u7ae0\u8282\u6682\u65e0\u6709\u6548\u5185\u5bb9\u3002',
} as const;

const DEFAULT_PAGE_SIZE = 10;
const COVERAGE_ITEMS = [
  TEXT.coverage1,
  TEXT.coverage2,
  TEXT.coverage3,
  TEXT.coverage4,
  TEXT.coverage5,
];
const EXPECTED_ITEMS = [TEXT.expected1, TEXT.expected2, TEXT.expected3, TEXT.expected4];
const SAMPLE_SUGGESTION_ITEMS = [
  TEXT.mockSuggestion1,
  TEXT.mockSuggestion2,
  TEXT.mockSuggestion3,
];
const SAMPLE_SECTION_ITEMS = [
  { title: TEXT.sampleSection1Title, description: TEXT.sampleSection1Desc },
  { title: TEXT.sampleSection2Title, description: TEXT.sampleSection2Desc },
  { title: TEXT.sampleSection3Title, description: TEXT.sampleSection3Desc },
];
const SAMPLE_ALERT_TAGS = [TEXT.alertTag1, TEXT.alertTag2, TEXT.alertTag3];
const SAMPLE_TABLE_DATA = [
  {
    key: '1',
    dimension: '\u80fd\u8017\u8d70\u52bf',
    current: '\u5468\u4e2d\u51fa\u73b0 4.8% \u8f7b\u5fae\u6298\u5347',
    risk: 'medium',
    action: '\u4f18\u5148\u8c03\u6574 2 \u53f7\u6cf5\u7ec4\u8fd0\u884c\u7ec4\u5408',
  },
  {
    key: '2',
    dimension: '\u672b\u7ad9\u538b\u529b',
    current: '\u4fdd\u6301\u5728\u5b89\u5168\u4e0a\u9650\u4e0b 8% \u533a\u95f4',
    risk: 'low',
    action: '\u6301\u7eed\u76d1\u6d4b\u5c16\u5cf0\u65f6\u6bb5\u53d8\u5316',
  },
  {
    key: '3',
    dimension: '\u6cf5\u7ad9\u6548\u7387',
    current: '\u4e3b\u529b\u6cf5\u6548\u7387\u6ce2\u52a8\u5e45\u5ea6 2.1%',
    risk: 'medium',
    action: '\u6309\u65f6\u6bb5\u91cd\u6392\u6cf5\u7ec4\u542f\u505c\u7b56\u7565',
  },
];

const EXECUTIVE_METRIC_CONFIG = [
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['雷诺数'],
  },
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['流态'],
  },
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['摩阻损失'],
  },
  {
    category: '水力结果',
    sectionKeywords: ['水力结果', '水力'],
    metricKeywords: ['末站进站压头'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['推荐泵组合'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['总扬程'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['年能耗'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['总成本'],
  },
  {
    category: '优化结果',
    sectionKeywords: ['优化结果', '优化'],
    metricKeywords: ['可行性'],
  },
] as const;

type ParsedHistorySnapshot = {
  id: number;
  calcType: string;
  calcTypeName?: string;
  projectId?: number;
  projectName?: string;
  createTime?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

type LatestCalculationContext = {
  reportContext: Record<string, unknown>;
  missingLabels: string[];
  availableCount: number;
  matchedProject: Project | null;
  projectCount: number;
  linkedLabels: string[];
  usedGlobalFallback: boolean;
  usedLinkedContext: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseHistoryJson(value?: string) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toHistorySnapshot(history: CalculationHistory): ParsedHistorySnapshot | null {
  const output = parseHistoryJson(history.outputResult);
  if (!output) {
    return null;
  }

  return {
    id: history.id,
    calcType: history.calcType || '',
    calcTypeName: history.calcTypeName,
    projectId: history.projectId,
    projectName: history.projectName,
    createTime: history.createTime,
    input: parseHistoryJson(history.inputParams) ?? {},
    output,
  };
}

function toLinkedHistorySnapshot(record: LinkedCalculationRecord): ParsedHistorySnapshot {
  return {
    id: 0,
    calcType: record.calcType,
    calcTypeName: record.calcType,
    projectId: record.projectId ?? undefined,
    projectName: record.projectName ?? undefined,
    createTime: record.updatedAt,
    input: record.input,
    output: record.output,
  };
}

function normalizeProjectKeyword(value?: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function inferRequestedProject(requestText: string, projects: Project[]): Project | null {
  const normalizedRequest = normalizeProjectKeyword(requestText);
  if (!normalizedRequest) {
    return null;
  }

  const matches = projects.filter((project) => {
    const candidates = [project.name, project.number]
      .map((item) => normalizeProjectKeyword(item))
      .filter(Boolean);

    return candidates.some((candidate) => normalizedRequest.includes(candidate));
  });

  if (matches.length === 0) {
    return null;
  }

  return matches.sort((left, right) => {
    const leftLength = Math.max(left.name?.length ?? 0, left.number?.length ?? 0);
    const rightLength = Math.max(right.name?.length ?? 0, right.number?.length ?? 0);
    return rightLength - leftLength;
  })[0];
}

function inferLinkedProject(projects: Project[]): Project | null {
  const state = useCalculationLinkStore.getState();
  const explicitProject = state.lastProjectId
    ? projects.find((project) => project.proId === state.lastProjectId) ?? null
    : null;

  if (explicitProject) {
    return explicitProject;
  }

  const latestRecords = Object.values(state.latestByType).filter(
    (record): record is LinkedCalculationRecord => Boolean(record),
  );
  const uniqueProjectIds = Array.from(
    new Set(
      latestRecords
        .map((record) => record.projectId)
        .filter((projectId): projectId is number => typeof projectId === 'number'),
    ),
  );

  if (uniqueProjectIds.length === 1) {
    return projects.find((project) => project.proId === uniqueProjectIds[0]) ?? null;
  }

  if (state.lastProjectName) {
    return {
      proId: state.lastProjectId ?? 0,
      number: '',
      name: state.lastProjectName,
    };
  }

  return null;
}

function matchesProject(project: Project | null, snapshot: ParsedHistorySnapshot) {
  if (!project) {
    return true;
  }

  if (typeof project.proId === 'number' && project.proId > 0 && snapshot.projectId) {
    return snapshot.projectId === project.proId;
  }

  return normalizeProjectKeyword(snapshot.projectName) === normalizeProjectKeyword(project.name);
}

function createProjectFromSnapshot(
  snapshot: ParsedHistorySnapshot,
  projects: Project[],
): Project | null {
  if (typeof snapshot.projectId === 'number') {
    const matchedById = projects.find((project) => project.proId === snapshot.projectId) ?? null;
    if (matchedById) {
      return matchedById;
    }
  }

  const normalizedName = normalizeProjectKeyword(snapshot.projectName);
  if (normalizedName) {
    const matchedByName = projects.find(
      (project) => normalizeProjectKeyword(project.name) === normalizedName,
    ) ?? null;
    if (matchedByName) {
      return matchedByName;
    }
  }

  if (typeof snapshot.projectId === 'number' || snapshot.projectName) {
    return {
      proId: snapshot.projectId ?? 0,
      number: '',
      name: snapshot.projectName || `项目 ${snapshot.projectId ?? '-'}`,
    };
  }

  return null;
}

function inferFallbackProjectFromHistories(
  histories: CalculationHistory[],
  projects: Project[],
): Project | null {
  const parsedSnapshots = histories
    .map((history) => toHistorySnapshot(history))
    .filter((snapshot): snapshot is ParsedHistorySnapshot => Boolean(snapshot));

  if (parsedSnapshots.length === 0) {
    return null;
  }

  const groups = new Map<string, {
    project: Project | null;
    calcTypes: Set<string>;
    latestTime: number;
  }>();

  parsedSnapshots.forEach((snapshot) => {
    const project = createProjectFromSnapshot(snapshot, projects);
    const key = typeof snapshot.projectId === 'number'
      ? `id:${snapshot.projectId}`
      : `name:${normalizeProjectKeyword(snapshot.projectName) || 'unknown'}`;
    const current = groups.get(key) ?? {
      project,
      calcTypes: new Set<string>(),
      latestTime: 0,
    };

    current.project = current.project ?? project;
    current.calcTypes.add(snapshot.calcType);
    current.latestTime = Math.max(
      current.latestTime,
      snapshot.createTime ? new Date(snapshot.createTime).getTime() : 0,
    );
    groups.set(key, current);
  });

  return Array.from(groups.values())
    .sort((left, right) => {
      if (right.calcTypes.size !== left.calcTypes.size) {
        return right.calcTypes.size - left.calcTypes.size;
      }
      return right.latestTime - left.latestTime;
    })[0]?.project ?? null;
}

function getLinkedSnapshots(project: Project | null) {
  const definitions = [
    { key: 'hydraulic', calcType: 'HYDRAULIC' as LinkedCalculationType, label: TEXT.calcTypeHydraulic },
    { key: 'optimization', calcType: 'OPTIMIZATION' as LinkedCalculationType, label: TEXT.calcTypeOptimization },
    { key: 'sensitivity', calcType: 'SENSITIVITY' as LinkedCalculationType, label: TEXT.calcTypeSensitivity },
  ] as const;

  const state = useCalculationLinkStore.getState();
  const linkedHistories: Record<string, ParsedHistorySnapshot> = {};
  const linkedLabels: string[] = [];

  definitions.forEach(({ key, calcType, label }) => {
    const record = state.latestByType[calcType];
    if (!record) {
      return;
    }

    if (project && record.projectId !== project.proId) {
      return;
    }

    linkedHistories[key] = toLinkedHistorySnapshot(record);
    linkedLabels.push(label);
  });

  return { linkedHistories, linkedLabels };
}

function buildLatestCalculationContext(
  histories: CalculationHistory[],
  matchedProject: Project | null,
  projectCount: number,
  linkedHistories: Record<string, ParsedHistorySnapshot>,
  linkedLabels: string[],
  usedGlobalFallback: boolean,
): LatestCalculationContext {
  const parsedSnapshots = histories
    .map((history) => toHistorySnapshot(history))
    .filter((snapshot): snapshot is ParsedHistorySnapshot => Boolean(snapshot))
    .sort((left, right) => {
      const leftTime = left.createTime ? new Date(left.createTime).getTime() : 0;
      const rightTime = right.createTime ? new Date(right.createTime).getTime() : 0;
      return rightTime - leftTime;
    });

  const definitions = [
    { key: 'hydraulic', calcType: 'HYDRAULIC', label: TEXT.calcTypeHydraulic },
    { key: 'optimization', calcType: 'OPTIMIZATION', label: TEXT.calcTypeOptimization },
    { key: 'sensitivity', calcType: 'SENSITIVITY', label: TEXT.calcTypeSensitivity },
  ] as const;

  const latestHistories: Record<string, ParsedHistorySnapshot> = {};
  const missingLabels: string[] = [];

  definitions.forEach(({ key, calcType, label }) => {
    const linkedSnapshot = linkedHistories[key];
    if (linkedSnapshot) {
      latestHistories[key] = linkedSnapshot;
      return;
    }

    const latest = parsedSnapshots.find((snapshot) => snapshot.calcType === calcType);
    if (latest) {
      latestHistories[key] = latest;
      return;
    }
    missingLabels.push(label);
  });

  return {
    reportContext: {
      generated_at: new Date().toISOString(),
      latest_histories: latestHistories,
      requested_project: matchedProject
        ? {
            project_id: matchedProject.proId,
            project_name: matchedProject.name,
            project_number: matchedProject.number,
          }
        : undefined,
    },
    missingLabels,
    availableCount: Object.keys(latestHistories).length,
    matchedProject,
    projectCount,
    linkedLabels,
    usedGlobalFallback,
    usedLinkedContext: linkedLabels.length > 0,
  };
}

function extractAgentPayload(response: Record<string, unknown>) {
  if (response.report && typeof response.report === 'object') {
    return response;
  }
  if (response.data && typeof response.data === 'object') {
    return response.data as Record<string, unknown>;
  }
  return response;
}

function getStatusTag(status?: number) {
  if (status === 1) {
    return <Tag color="success">{TEXT.completed}</Tag>;
  }
  if (status === 0) {
    return <Tag color="processing">{TEXT.generating}</Tag>;
  }
  if (status === 2) {
    return <Tag color="error">{TEXT.failed}</Tag>;
  }
  return <Tag>{TEXT.unknown}</Tag>;
}

function getStatusText(status?: number) {
  if (status === 1) {
    return TEXT.completed;
  }
  if (status === 0) {
    return TEXT.generating;
  }
  if (status === 2) {
    return TEXT.failed;
  }
  return TEXT.unknown;
}

function isBrokenPreviewText(value: unknown) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const questionMarks = (normalized.match(/\?/g) || []).length;
  return normalized.includes('�') || questionMarks >= Math.max(2, Math.floor(normalized.length / 4));
}

function sanitizePreviewText(value: unknown, fallback: string = '-') : string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized || isBrokenPreviewText(normalized)) {
    return fallback;
  }

  return normalized;
}

function sanitizePreviewValue(
  value: unknown,
  fallback: string = TEXT.missingPreviewCell,
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'string') {
    return sanitizePreviewText(value, fallback);
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => sanitizePreviewValue(item, ''))
      .filter(Boolean)
      .join('、');
    return joined || fallback;
  }

  return fallback;
}

type ParsedPreviewTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

function matchesPreviewKeywords(value: string, keywords: readonly string[]) {
  const normalized = sanitizePreviewText(value, '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function normalizePreviewTableData(table: Record<string, unknown>): ParsedPreviewTable | null {
  const title = sanitizePreviewText(table.title, '');
  const headers = Array.isArray(table.headers)
    ? (table.headers as unknown[]).map((header, index) =>
        sanitizePreviewValue(header, `列${index + 1}`))
    : [];
  const rows = Array.isArray(table.rows)
    ? (table.rows as unknown[]).map((row) =>
        (Array.isArray(row) ? row : [row]).map((cell) => sanitizePreviewValue(cell)))
    : [];

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return { title, headers, rows };
}

function getSectionPreviewTables(section: ReportSection | null): ParsedPreviewTable[] {
  if (!section || !Array.isArray(section.tables)) {
    return [];
  }

  return section.tables
    .map((table) => normalizePreviewTableData(table as Record<string, unknown>))
    .filter((table): table is ParsedPreviewTable => Boolean(table));
}

function findPreviewSection(
  sections: ReportSection[],
  keywords: readonly string[],
): ReportSection | null {
  return sections.find((section) => matchesPreviewKeywords(section.title, keywords)) ?? null;
}

function findPreviewMetricRow(
  section: ReportSection | null,
  metricKeywords: readonly string[],
): string[] | null {
  const tables = getSectionPreviewTables(section);
  for (const table of tables) {
    for (const row of table.rows) {
      if (matchesPreviewKeywords(row[0] || '', metricKeywords)) {
        return row;
      }
    }
  }
  return null;
}

function buildSensitivityExecutiveRows(section: ReportSection | null): string[][] {
  if (!section) {
    return [];
  }

  const explicitRows = [
    findPreviewMetricRow(section, ['首要敏感变量']),
    findPreviewMetricRow(section, ['敏感系数']),
    findPreviewMetricRow(section, ['最大影响幅度']),
  ].filter((row): row is string[] => Boolean(row));

  if (explicitRows.length >= 2) {
    return explicitRows.map((row) => [
      '敏感性',
      row[0] || '敏感性指标',
      row[1] || TEXT.missingPreviewCell,
      row[2] || '-',
    ]);
  }

  const rankingTable = getSectionPreviewTables(section).find((table) =>
    matchesPreviewKeywords(table.title, ['排名'])
    || table.headers.some((header) => matchesPreviewKeywords(header, ['排名', '敏感系数'])));
  const firstRow = rankingTable?.rows[0];

  if (!firstRow) {
    return [];
  }

  return [
    ['敏感性', '首要敏感变量', firstRow[2] || firstRow[1] || TEXT.missingPreviewCell, firstRow[1] || '-'],
    ['敏感性', '敏感系数', firstRow[3] || TEXT.missingPreviewCell, firstRow[5] || '-'],
    ['敏感性', '最大影响幅度', firstRow[4] || TEXT.missingPreviewCell, firstRow[5] || '-'],
  ];
}

function buildExecutiveMetricTable(report: ReportData): Record<string, unknown> | null {
  const sections = Array.isArray(report.sections) ? report.sections : [];
  const summarySection = findPreviewSection(sections, ['报告摘要', '摘要']);
  const hydraulicSection = findPreviewSection(sections, ['水力结果', '水力']);
  const optimizationSection = findPreviewSection(sections, ['优化结果', '优化']);
  const sensitivitySection = findPreviewSection(sections, ['敏感性结果', '敏感性']);
  const rows: string[][] = [];
  const seenMetrics = new Set<string>();

  const pushMetricRow = (category: string, row: string[] | null, fallbackMetric: string) => {
    if (!row) {
      return;
    }

    const metric = row[0] || fallbackMetric;
    const key = `${category}-${metric}`;
    if (seenMetrics.has(key)) {
      return;
    }

    seenMetrics.add(key);
    rows.push([
      category,
      metric,
      row[1] || TEXT.missingPreviewCell,
      row[2] || '-',
    ]);
  };

  EXECUTIVE_METRIC_CONFIG.forEach((item) => {
    const targetSection = item.category === '水力结果'
      ? hydraulicSection
      : optimizationSection;
    pushMetricRow(
      item.category,
      findPreviewMetricRow(targetSection, item.metricKeywords)
        ?? findPreviewMetricRow(summarySection, item.metricKeywords),
      item.metricKeywords[0],
    );
  });

  buildSensitivityExecutiveRows(sensitivitySection || summarySection).forEach((row) => {
    const key = `${row[0]}-${row[1]}`;
    if (seenMetrics.has(key)) {
      return;
    }

    seenMetrics.add(key);
    rows.push(row);
  });

  if (rows.length === 0) {
    return null;
  }

  return {
    title: '关键指标总览',
    headers: ['类别', '指标', '结果', '单位/说明'],
    rows,
  };
}

function shouldRenderTablesBeforeContent(title: string) {
  return matchesPreviewKeywords(title, ['摘要', '结论', '建议']);
}

function formatFileSize(fileSize?: number) {
  if (!fileSize) {
    return '-';
  }
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }
  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }
  return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
}

function guessDownloadFilename(report: AnalysisReport) {
  const baseName = report.fileName || report.reportTitle || `report-${report.id}`;
  const hasExtension = /\.[a-z0-9]+$/i.test(baseName);
  const extension = report.fileFormat ? `.${report.fileFormat.toLowerCase()}` : '.docx';
  return hasExtension ? baseName : `${baseName}${extension}`;
}

interface DownloadHistoryItem {
  key: string;
  reportId: number;
  title: string;
  action: string;
  source: string;
  time: string;
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default function ReportPreview() {
  const currentUserId = useUserStore((state) => state.userInfo?.userId);
  const [request, setRequest] = useState<string>(TEXT.defaultRequest);
  const [generating, setGenerating] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [javaReportId, setJavaReportId] = useState<number | null>(null);
  const [localReportCount, setLocalReportCount] = useState<number | null>(null);
  const [javaReportList, setJavaReportList] = useState<AnalysisReport[]>([]);
  const [selectedJavaReport, setSelectedJavaReport] = useState<AnalysisReport | null>(null);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);
  const [agentPdfAvailable, setAgentPdfAvailable] = useState(false);
  const [agentUnavailable, setAgentUnavailable] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const aiStatusText = agentUnavailable ? TEXT.aiOffline : TEXT.aiOnline;
  const selectedReportStatus = selectedJavaReport?.status;
  const selectedSummary = sanitizePreviewText(
    selectedJavaReport?.reportSummary,
    TEXT.summaryPlaceholder,
  );
  const selectedReportVersion = selectedJavaReport ? TEXT.defaultVersion : '-';
  const isSelectedAgentReport = selectedJavaReport?.createBy === 'agent';
  const selectedReportSource = !selectedJavaReport
    ? TEXT.sourcePending
    : selectedJavaReport.createBy === 'agent'
      ? TEXT.sourceAgent
      : TEXT.sourceJava;
  const currentDownloadHistory = useMemo(
    () => (selectedJavaReport
      ? downloadHistory.filter((item) => item.reportId === selectedJavaReport.id)
      : []),
    [downloadHistory, selectedJavaReport],
  );
  const selectedStatusCards = [
    {
      label: TEXT.blockStatus,
      value: getStatusText(selectedJavaReport?.status),
      hint: selectedJavaReport ? TEXT.tagSelectable : TEXT.blockWaiting,
      color: selectedJavaReport?.status === 2 ? '#EF4444' : '#2563EB',
    },
    {
      label: TEXT.blockFormat,
      value: isSelectedAgentReport && agentPdfAvailable
        ? 'DOC / PDF'
        : selectedJavaReport?.fileFormat || '-',
      hint: selectedJavaReport ? TEXT.tagArchived : TEXT.blockWaiting,
      color: '#0F766E',
    },
    {
      label: TEXT.blockDownload,
      value: selectedJavaReport ? TEXT.blockCanDownload : TEXT.blockUnavailable,
      hint: selectedJavaReport ? TEXT.tagDownloadable : TEXT.blockWaiting,
      color: '#D97706',
    },
    {
      label: TEXT.blockOwner,
      value: selectedJavaReport?.createBy || TEXT.blockUnknownOwner,
      hint: selectedJavaReport?.createTime || '-',
      color: '#7C3AED',
    },
  ];
  const selectedArchiveItems = [
    { label: TEXT.descReportNo, value: selectedJavaReport?.reportNo || '-' },
    { label: TEXT.descReportType, value: selectedJavaReport?.reportType || '-' },
    { label: TEXT.descVersion, value: selectedReportVersion },
    { label: TEXT.descSource, value: selectedReportSource },
    { label: TEXT.blockCreatedAt, value: selectedJavaReport?.createTime || '-' },
    { label: TEXT.blockVolume, value: formatFileSize(selectedJavaReport?.fileSize) },
  ];

  const previewTrendOption = useMemo(() => ({
    grid: { left: 28, right: 18, top: 30, bottom: 26 },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#64748B' },
    },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五'],
      axisLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.12)' } },
      axisTick: { show: false },
      axisLabel: { color: '#64748B' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94A3B8' },
      splitLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.08)', type: 'dashed' } },
    },
    series: [
      {
        name: TEXT.mockMetric1,
        type: 'line',
        smooth: true,
        data: [91, 90, 94, 95, 92],
        lineStyle: { color: '#2563EB', width: 3 },
        itemStyle: { color: '#2563EB' },
        areaStyle: { color: 'rgba(37, 99, 235, 0.10)' },
      },
      {
        name: TEXT.mockMetric3,
        type: 'line',
        smooth: true,
        data: [86, 87, 84, 83, 85],
        lineStyle: { color: '#10B981', width: 3 },
        itemStyle: { color: '#10B981' },
      },
    ],
  }), []);

  const sampleTableColumns = useMemo(
    () => [
      {
        title: TEXT.mockDimCol,
        dataIndex: 'dimension',
        key: 'dimension',
        width: 120,
      },
      {
        title: TEXT.mockCurrentCol,
        dataIndex: 'current',
        key: 'current',
      },
      {
        title: TEXT.mockRiskCol,
        dataIndex: 'risk',
        key: 'risk',
        width: 100,
        align: 'center' as const,
        render: (value: string) => (
          <Tag color={value === 'medium' ? 'warning' : 'success'}>
            {value === 'medium' ? TEXT.riskMedium : TEXT.riskLow}
          </Tag>
        ),
      },
      {
        title: TEXT.mockActionCol,
        dataIndex: 'action',
        key: 'action',
        width: 220,
      },
    ],
    [],
  );

  const appendDownloadHistory = useCallback((
    reportId: number,
    title: string,
    action: string,
    source: string,
  ) => {
    setDownloadHistory((prev) => [
      {
        key: `${reportId}-${action}-${Date.now()}`,
        reportId,
        title,
        action,
        source,
        time: formatTimestamp(),
      },
      ...prev,
    ].slice(0, 12));
  }, []);

  const handleSelectJavaReport = async (id: number, fallback?: AnalysisReport) => {
    if (fallback) {
      setSelectedJavaReport(fallback);
    }

    try {
      const response = await reportApi.detail(id);
      const detail = response.data;
      setSelectedJavaReport(detail);

      if (detail.createBy === 'agent') {
        setJavaReportId(detail.id);
        setReport(null);
        setAgentPdfAvailable(false);

        try {
          const persistedResponse = await agentApi.getReportDetail(id);
          const persistedPayload = extractAgentPayload(persistedResponse) as unknown as ReportGeneratePayload;

          if (persistedPayload.report) {
            setReport(persistedPayload.report);
          }
          setLocalReportCount(persistedPayload.local_report_count ?? null);
          setAgentPdfAvailable(Boolean(persistedPayload.java_download_url_pdf));
        } catch {
          if (javaReportId !== id) {
            setReport(null);
          }
          setLocalReportCount(null);
          setAgentPdfAvailable(false);
        }
        return;
      }

      setJavaReportId(null);
      setLocalReportCount(null);
      setReport(null);
      setAgentPdfAvailable(false);
    } catch {
      if (!fallback) {
        message.error(TEXT.detailReadFailed);
      }
    }
  };

  const loadJavaReports = async (
    pageNum = pagination.current,
    pageSize = pagination.pageSize,
    options?: { silent?: boolean; selectFirst?: boolean },
  ) => {
    setTableLoading(true);
    try {
      const response = await reportApi.page({ pageNum, pageSize });
      const pageData = response.data;
      const list = Array.isArray(pageData?.list) ? pageData.list : [];

      setJavaReportList(list);
      setPagination({
        current: pageData?.pageNum ?? pageNum,
        pageSize: pageData?.pageSize ?? pageSize,
        total: pageData?.total ?? list.length,
      });

      if (options?.selectFirst) {
        if (list.length > 0) {
          await handleSelectJavaReport(Number(list[0].id), list[0]);
        } else {
          setSelectedJavaReport(null);
        }
      }
      return true;
    } catch {
      if (!options?.silent) {
        message.error(TEXT.javaReadFailed);
      }
      return false;
    } finally {
      setTableLoading(false);
    }
  };

  const handleDeleteJavaReport = useCallback(async (record: AnalysisReport) => {
    setDeleting(record.id);
    try {
      if (record.createBy === 'agent') {
        await agentApi.deleteReport(record.id);
      } else {
        await reportApi.delete(record.id);
      }

      if (selectedJavaReport?.id === record.id) {
        setSelectedJavaReport(null);
        setReport(null);
        setPreviewOpen(false);
      }
      if (javaReportId === record.id) {
        setJavaReportId(null);
      }

      const nextPage =
        javaReportList.length === 1 && pagination.current > 1
          ? pagination.current - 1
          : pagination.current;

      await loadJavaReports(nextPage, pagination.pageSize, {
        silent: true,
        selectFirst: selectedJavaReport?.id === record.id,
      });
      message.success(TEXT.deleteSuccess);
    } catch {
      message.error(TEXT.deleteFailed);
    } finally {
      setDeleting(null);
    }
  }, [
    javaReportId,
    javaReportList.length,
    loadJavaReports,
    pagination.current,
    pagination.pageSize,
    selectedJavaReport?.id,
  ]);

  useEffect(() => {
    void loadJavaReports(1, DEFAULT_PAGE_SIZE, { silent: true, selectFirst: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLatestCalculationContext = useCallback(async (requestText: string) => {
    let matchedProject: Project | null = null;
    let linkedProject: Project | null = null;
    let projectList: Project[] = [];
    let projectCount = 0;

    try {
      const projectResponse = await projectApi.list();
      projectList = Array.isArray(projectResponse.data) ? projectResponse.data : [];
      projectCount = projectList.length;
      matchedProject = inferRequestedProject(requestText, projectList);
      linkedProject = inferLinkedProject(projectList);
    } catch {
      matchedProject = null;
      linkedProject = inferLinkedProject([]);
      projectCount = 0;
    }

    let activeProject = matchedProject ?? linkedProject;
    const response = await calculationHistoryApi.page({
      userId: currentUserId ?? 1,
      projectId: activeProject?.proId,
      status: 1,
      pageNum: 1,
      pageSize: 100,
    });

    let list = Array.isArray(response.data?.list) ? response.data.list : [];
    let usedGlobalFallback = false;

    if (!activeProject) {
      const fallbackProject = inferFallbackProjectFromHistories(list, projectList);
      if (fallbackProject) {
        activeProject = fallbackProject;
        usedGlobalFallback = true;
        list = list.filter((history) => {
          const snapshot = toHistorySnapshot(history);
          return snapshot ? matchesProject(activeProject, snapshot) : false;
        });
      }
    }

    const { linkedHistories, linkedLabels } = getLinkedSnapshots(activeProject);
    return buildLatestCalculationContext(
      list,
      activeProject,
      projectCount,
      linkedHistories,
      linkedLabels,
      usedGlobalFallback,
    );
  }, [currentUserId]);

  const handleGenerate = async () => {
    const text = request.trim();
    if (!text) {
      message.warning(TEXT.inputRequest);
      return;
    }

    setGenerating(true);
    try {
      let contextResult: LatestCalculationContext;
      try {
        contextResult = await loadLatestCalculationContext(text);
      } catch {
        message.error(TEXT.calcHistoryLoadFailed);
        return;
      }

      if (contextResult.usedLinkedContext) {
        message.info(`${TEXT.linkedContextAppliedPrefix}${contextResult.linkedLabels.join('、')}`);
      }

      if (contextResult.usedGlobalFallback) {
        message.warning(TEXT.projectDetectFallback);
      }

      if (contextResult.availableCount === 0) {
        if (contextResult.matchedProject) {
          message.warning(
            `${TEXT.calcHistoryProjectMissingPrefix}${contextResult.matchedProject.name}${TEXT.calcHistoryProjectMissingSuffix}`,
          );
          return;
        }

        message.warning(TEXT.calcHistoryMissing);
        return;
      }

      if (contextResult.missingLabels.length > 0) {
        message.warning(
          `${TEXT.calcHistoryPartialPrefix}${contextResult.missingLabels.join('、')}`,
        );
      }

      const response = await agentApi.generateReport(text, undefined, contextResult.reportContext);
      const payload = extractAgentPayload(response) as unknown as ReportGeneratePayload;

      if (payload.report) {
        setReport(payload.report);
      }

      const nextJavaReportId = payload.java_report_id ?? null;
      setJavaReportId(nextJavaReportId);
      setLocalReportCount(payload.local_report_count ?? null);
      setAgentUnavailable(false);
      setAgentPdfAvailable(Boolean(payload.java_download_url_pdf));

      await loadJavaReports(1, pagination.pageSize, { silent: true });
      if (nextJavaReportId) {
        await handleSelectJavaReport(Number(nextJavaReportId));
      }

      message.success(TEXT.aiGenerateSuccess);
    } catch {
      setAgentUnavailable(true);
      setAgentPdfAvailable(false);
      message.error(TEXT.aiUnavailable);
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadJavaReports = async () => {
    const success = await loadJavaReports(1, pagination.pageSize, { selectFirst: true });
    if (success) {
      message.success(TEXT.javaRefreshSuccess);
    }
  };

  const handleDownloadAgentArchive = useCallback(async (
    record: AnalysisReport,
    format: 'docx' | 'pdf',
  ) => {
    if (format === 'pdf' && !agentPdfAvailable) {
      message.warning(TEXT.agentPdfUnavailable);
      return;
    }

    setDownloading(record.id);
    try {
      const response = await fetch(agentApi.getJavaReportDownloadUrl(record.id, format));
      if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseName = guessDownloadFilename(record).replace(/\.[^.]+$/i, '');
      link.href = downloadUrl;
      link.download = format === 'pdf' ? `${baseName}.pdf` : `${baseName}.doc`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      appendDownloadHistory(
        record.id,
        record.reportTitle || record.reportNo || TEXT.untitledReport,
        format === 'pdf' ? TEXT.sampleRecordPdf : TEXT.sampleRecordWord,
        TEXT.sourceAgent,
      );
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
    } catch {
      message.error(TEXT.agentArchiveFailed);
    } finally {
      setDownloading(null);
    }
  }, [agentPdfAvailable, appendDownloadHistory]);

  const handleDownloadJavaReport = useCallback(async (record: AnalysisReport) => {
    if (record.createBy === 'agent') {
      await handleDownloadAgentArchive(record, 'docx');
      return;
    }

    const token = useUserStore.getState().token;
    if (!token) {
      message.error(TEXT.relogin);
      return;
    }

    setDownloading(record.id);
    try {
      const response = await fetch(`/calculation/report/download/${record.id}`, {
        headers: {
          satoken: token,
        },
      });

      if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = guessDownloadFilename(record);
      document.body.appendChild(link);
      link.click();
      link.remove();
      appendDownloadHistory(
        record.id,
        record.reportTitle || record.reportNo || TEXT.untitledReport,
        `${record.fileFormat || 'DOCX'} ${TEXT.actionDownload}`,
        selectedReportSource,
      );
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
    } catch {
      message.error(TEXT.javaDownloadFailed);
    } finally {
      setDownloading(null);
    }
  }, [appendDownloadHistory, handleDownloadAgentArchive, selectedReportSource]);

  const handleDownloadSelectedReport = useCallback(() => {
    if (!selectedJavaReport) {
      return;
    }

    void handleDownloadJavaReport(selectedJavaReport);
  }, [handleDownloadJavaReport, selectedJavaReport]);

  const handleOpenJavaReport = useCallback((record: AnalysisReport) => {
    void handleSelectJavaReport(record.id, record);
    setPreviewOpen(true);
  }, [handleSelectJavaReport]);

  const tableColumns = useMemo(
    () => [
      {
        title: TEXT.colId,
        key: 'serialNumber',
        width: 88,
        align: 'center' as const,
        render: (_: unknown, __: AnalysisReport, index: number) =>
          (pagination.current - 1) * pagination.pageSize + index + 1,
      },
      {
        title: TEXT.colReportNo,
        dataIndex: 'reportNo',
        key: 'reportNo',
        width: 160,
        ellipsis: true,
      },
      {
        title: TEXT.colTitle,
        dataIndex: 'reportTitle',
        key: 'reportTitle',
        ellipsis: true,
      },
      {
        title: TEXT.colType,
        dataIndex: 'reportType',
        key: 'reportType',
        width: 140,
        align: 'center' as const,
        render: (value: string | undefined) => value || '-',
      },
      {
        title: TEXT.colStatus,
        dataIndex: 'status',
        key: 'status',
        width: 110,
        align: 'center' as const,
        render: (value: number | undefined) => getStatusTag(value),
      },
      {
        title: TEXT.colCreateTime,
        dataIndex: 'createTime',
        key: 'createTime',
        width: 180,
        align: 'center' as const,
        render: (value: string | undefined) => value || '-',
      },
      {
        title: TEXT.colAction,
        key: 'actions',
        width: 272,
        align: 'center' as const,
        render: (_: unknown, record: AnalysisReport) => (
          <Space size="small">
            <Button
              size="small"
              icon={<FileSearchOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenJavaReport(record);
              }}
            >
              {TEXT.actionView}
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={downloading === record.id}
              onClick={(event) => {
                event.stopPropagation();
                void handleDownloadJavaReport(record);
              }}
            >
              {TEXT.actionDownload}
            </Button>
            <Popconfirm
              title={TEXT.deleteConfirmTitle}
              description={TEXT.deleteConfirmDesc}
              okText="删除"
              cancelText="取消"
              onConfirm={() => void handleDeleteJavaReport(record)}
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={deleting === record.id}
                onClick={(event) => event.stopPropagation()}
              >
                {TEXT.actionDelete}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      deleting,
      downloading,
      handleDeleteJavaReport,
      handleDownloadJavaReport,
      handleOpenJavaReport,
      pagination.current,
      pagination.pageSize,
    ],
  );

  const tablePagination: TablePaginationConfig = {
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
    showSizeChanger: { showSearch: false },
    pageSizeOptions: [10, 20, 50, 100],
    onChange: (page, pageSize) => {
      void loadJavaReports(page, pageSize);
    },
  };

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2>{TEXT.reportPreview}</h2>
        <p>{TEXT.pageDescription}</p>
      </div>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card
          className="page-card"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)',
            border: '1px solid rgba(59, 130, 246, 0.14)',
          }}
        >
          <Row gutter={[20, 20]} align="top">
            <Col xs={24} xl={15}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {agentUnavailable ? (
                  <Alert
                    showIcon
                    type="warning"
                    message={TEXT.agentUnavailableTitle}
                    description={TEXT.agentUnavailableDesc}
                  />
                ) : null}

                <div>
                  <Title level={4} style={{ marginBottom: 8 }}>
                    {TEXT.requestTitle}
                  </Title>
                  <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    {TEXT.requestHelp}
                  </Paragraph>
                  <Input.TextArea
                    autoSize={{ minRows: 4, maxRows: 6 }}
                    value={request}
                    onChange={(event) => setRequest(event.target.value)}
                    placeholder={TEXT.requestPlaceholder}
                  />
                </div>

                <Space wrap>
                  <Button
                    onClick={() => void handleLoadJavaReports()}
                    icon={<FileSearchOutlined />}
                    loading={tableLoading}
                  >
                    {TEXT.loadJavaReports}
                  </Button>
                  <Button
                    onClick={() => void loadJavaReports(pagination.current, pagination.pageSize)}
                    icon={<ReloadOutlined />}
                    loading={tableLoading}
                  >
                    {TEXT.refreshList}
                  </Button>
                  <Button
                    onClick={() => void handleGenerate()}
                    loading={generating}
                    type="primary"
                    icon={<RobotOutlined />}
                  >
                    {TEXT.generateReport}
                  </Button>
                </Space>

                {javaReportId && selectedJavaReport?.id === javaReportId ? (
                  <Space wrap>
                    <Button
                      icon={<DownloadOutlined />}
                      loading={downloading === selectedJavaReport.id}
                      onClick={handleDownloadSelectedReport}
                    >
                      {selectedJavaReport.fileFormat
                        ? `${TEXT.actionDownload} (${selectedJavaReport.fileFormat})`
                        : TEXT.actionDownload}
                    </Button>
                    <Text type="secondary">
                      {TEXT.localReportCount}: {localReportCount ?? '-'}
                    </Text>
                  </Space>
                ) : null}
              </Space>
            </Col>

            <Col xs={24} xl={9}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Card size="small" style={{ background: '#FFFFFF', borderColor: 'rgba(15, 23, 42, 0.08)' }}>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Tag color={report ? 'success' : 'default'}>
                      {report ? TEXT.aiReportReady : TEXT.aiReportPending}
                    </Tag>
                    <Tag color={javaReportId ? 'blue' : 'default'}>
                      {javaReportId ? TEXT.javaStorageReady : TEXT.javaStoragePending}
                    </Tag>
                    <Tag color={agentUnavailable ? 'warning' : 'cyan'}>
                      {TEXT.statAiStatus}: {aiStatusText}
                    </Tag>
                  </Space>

                  <Divider style={{ margin: '12px 0' }} />

                  <Title level={5} style={{ marginBottom: 12 }}>
                    {TEXT.expectedOutput}
                  </Title>
                  <List
                    size="small"
                    split={false}
                    dataSource={EXPECTED_ITEMS}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '6px 0' }}>
                        <Space align="start">
                          <CheckCircleOutlined style={{ color: '#2563EB', marginTop: 4 }} />
                          <Text>{item}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>

                <Card size="small" style={{ background: '#FFFFFF', borderColor: 'rgba(15, 23, 42, 0.08)' }}>
                  <Title level={5} style={{ marginBottom: 12 }}>
                    {TEXT.reportCoverage}
                  </Title>
                  <Space wrap>
                    {COVERAGE_ITEMS.map((item) => (
                      <Tag key={item} color="blue">
                        {item}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]} align="stretch">
          <Col span={24}>
            <Card
              className="page-card"
              title={TEXT.javaReportRecords}
              extra={
                <Space size="middle">
                  <Text type="secondary">{TEXT.doubleClickHint}</Text>
                  <Text type="secondary">
                    {TEXT.totalPrefix} {pagination.total} {TEXT.totalSuffix}
                  </Text>
                </Space>
              }
            >
              <Table
                size="small"
                loading={tableLoading}
                rowKey={(record) => String(record.id)}
                pagination={tablePagination}
                columns={tableColumns}
                dataSource={javaReportList}
                locale={{
                  emptyText: (
                    <Space direction="vertical" size="small" style={{ padding: '24px 0' }}>
                      <Empty description={TEXT.emptyJavaReports} />
                      <Button type="primary" ghost onClick={() => void handleGenerate()}>
                        {TEXT.generateReport}
                      </Button>
                    </Space>
                  ),
                }}
                onRow={(record) => ({
                  onClick: () => {
                    void handleSelectJavaReport(record.id, record);
                  },
                  onDoubleClick: () => {
                    handleOpenJavaReport(record);
                  },
                })}
                rowClassName={(record) =>
                  selectedJavaReport?.id === record.id ? 'ant-table-row-selected' : ''
                }
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={10}>
            <Card
              className="page-card"
              title={TEXT.currentReport}
              extra={selectedReportStatus !== undefined ? getStatusTag(selectedReportStatus) : null}
            >
              <Row gutter={[16, 16]} align="stretch">
                <Col xs={24} lg={14}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Card
                      size="small"
                      style={{
                        background: '#F8FAFC',
                        borderColor: 'rgba(15, 23, 42, 0.06)',
                      }}
                    >
                      <Title level={5} style={{ marginBottom: 8 }}>
                        {selectedJavaReport?.reportTitle || TEXT.untitledReport}
                      </Title>
                      <Space wrap style={{ marginBottom: 12 }}>
                        <Tag color="blue">{TEXT.tagArchived}</Tag>
                        <Tag color="cyan">{TEXT.tagSelectable}</Tag>
                        <Tag color={selectedJavaReport ? 'success' : 'default'}>
                          {selectedJavaReport ? TEXT.tagDownloadable : TEXT.blockWaiting}
                        </Tag>
                      </Space>
                      <Paragraph style={{ marginBottom: 0 }}>{selectedSummary}</Paragraph>
                    </Card>

                    <Card size="small" title={TEXT.reportOverview}>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label={TEXT.descId}>
                          {selectedJavaReport?.id ?? '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={TEXT.descStatus}>
                          {selectedJavaReport ? getStatusTag(selectedJavaReport.status) : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={TEXT.descReportNo}>
                          {selectedJavaReport?.reportNo || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={TEXT.descReportType}>
                          {selectedJavaReport?.reportType || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={TEXT.descFileFormat}>
                          {selectedJavaReport?.fileFormat || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={TEXT.descFileSize}>
                          {formatFileSize(selectedJavaReport?.fileSize)}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Space>
                </Col>

                <Col xs={24} lg={10}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Row gutter={[12, 12]}>
                      {selectedStatusCards.map((item) => (
                        <Col key={item.label} span={12}>
                          <Card
                            size="small"
                            style={{
                              minHeight: 110,
                              background: '#FFFFFF',
                              borderColor: 'rgba(15, 23, 42, 0.08)',
                            }}
                          >
                            <Text type="secondary">{item.label}</Text>
                            <div
                              style={{
                                marginTop: 8,
                                marginBottom: 6,
                                fontSize: 18,
                                fontWeight: 600,
                                color: item.color,
                                lineHeight: 1.3,
                              }}
                            >
                              {item.value}
                            </div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {item.hint}
                            </Text>
                          </Card>
                        </Col>
                      ))}
                    </Row>

                    <Card size="small" title={TEXT.archiveDetails}>
                      <List
                        size="small"
                        split={false}
                        dataSource={selectedArchiveItems}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '8px 0' }}>
                            <div style={{ width: '100%' }}>
                              <Text type="secondary">{item.label}</Text>
                              <div style={{ marginTop: 2 }}>
                                <Text strong>{item.value}</Text>
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                      {isSelectedAgentReport ? (
                        <Space wrap style={{ marginTop: 12 }}>
                          <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            loading={selectedJavaReport ? downloading === selectedJavaReport.id : false}
                            onClick={() => {
                              if (selectedJavaReport) {
                                void handleDownloadAgentArchive(selectedJavaReport, 'docx');
                              }
                            }}
                          >
                            {TEXT.downloadWord}
                          </Button>
                          <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            disabled={!agentPdfAvailable}
                            loading={selectedJavaReport ? downloading === selectedJavaReport.id : false}
                            onClick={() => {
                              if (selectedJavaReport) {
                                void handleDownloadAgentArchive(selectedJavaReport, 'pdf');
                              }
                            }}
                          >
                            {TEXT.downloadPdf}
                          </Button>
                        </Space>
                      ) : null}
                    </Card>

                    <Card size="small" title={TEXT.downloadRecords}>
                      {currentDownloadHistory.length > 0 ? (
                        <List
                          size="small"
                          split={false}
                          dataSource={currentDownloadHistory}
                          renderItem={(item) => (
                            <List.Item style={{ padding: '10px 0' }}>
                              <div style={{ width: '100%' }}>
                                <Space
                                  style={{ width: '100%', justifyContent: 'space-between' }}
                                  align="start"
                                >
                                  <div>
                                    <Text strong>{item.action}</Text>
                                    <div style={{ marginTop: 2 }}>
                                      <Text type="secondary">{item.title}</Text>
                                    </div>
                                  </div>
                                  <Tag color="blue">{item.source}</Tag>
                                </Space>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {item.time}
                                </Text>
                              </div>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <>
                          <Text type="secondary">{TEXT.sampleRecordPending}</Text>
                          <div style={{ marginTop: 6 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {TEXT.sampleRecordPendingDesc}
                            </Text>
                          </div>
                        </>
                      )}
                    </Card>

                    {!selectedJavaReport ? (
                      <Card size="small" style={{ background: '#F8FAFC' }}>
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={TEXT.selectJavaReport}
                        />
                      </Card>
                    ) : null}
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={14}>
            <Card
              className="page-card"
              title={TEXT.aiReportContent}
              extra={
                report ? (
                  <Tag color="success">{TEXT.aiReportReady}</Tag>
                ) : (
                  <Tag>{TEXT.aiReportPending}</Tag>
                )
              }
            >
              {report ? (
                <ReportContentView report={report} />
              ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Alert
                    showIcon
                    type="info"
                    message={TEXT.previewTitle}
                    description={TEXT.previewDescription}
                  />

                  <Card size="small" title={TEXT.alertTagsTitle}>
                    <Space wrap>
                      {SAMPLE_ALERT_TAGS.map((item, index) => (
                        <Tag
                          key={item}
                          color={index === 0 ? 'warning' : index === 1 ? 'processing' : 'success'}
                        >
                          {item}
                        </Tag>
                      ))}
                    </Space>
                  </Card>

                  <Card size="small" title={TEXT.sampleSectionsTitle}>
                    <Row gutter={[12, 12]}>
                      {SAMPLE_SECTION_ITEMS.map((item, index) => (
                        <Col key={item.title} xs={24} md={8}>
                          <Card
                            size="small"
                            style={{
                              height: '100%',
                              background: '#F8FAFC',
                              borderColor: 'rgba(15, 23, 42, 0.06)',
                            }}
                          >
                            <Space align="start">
                              {index === 0 ? (
                                <BarChartOutlined style={{ color: '#2563EB', marginTop: 4 }} />
                              ) : index === 1 ? (
                                <ThunderboltOutlined style={{ color: '#D97706', marginTop: 4 }} />
                              ) : (
                                <CheckCircleOutlined style={{ color: '#10B981', marginTop: 4 }} />
                              )}
                              <div>
                                <Text strong>{item.title}</Text>
                                <div style={{ marginTop: 6 }}>
                                  <Text type="secondary">{item.description}</Text>
                                </div>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Card>

                  <Row gutter={[16, 16]} align="stretch">
                    <Col xs={24} lg={10}>
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Card size="small" title={TEXT.mockSummaryTitle}>
                          <Paragraph>{TEXT.mockSummaryBody}</Paragraph>
                          <Row gutter={[12, 12]}>
                            <Col span={12}>
                              <Statistic
                                title={TEXT.mockMetric1}
                                value="91.8"
                                suffix="kWh/km"
                                valueStyle={{ fontSize: 18 }}
                              />
                            </Col>
                            <Col span={12}>
                              <Statistic
                                title={TEXT.mockMetric2}
                                value="2.46"
                                suffix="MPa"
                                valueStyle={{ fontSize: 18 }}
                              />
                            </Col>
                            <Col span={12}>
                              <Statistic
                                title={TEXT.mockMetric3}
                                value="84.7"
                                suffix="%"
                                valueStyle={{ fontSize: 18 }}
                              />
                            </Col>
                            <Col span={12}>
                              <Statistic
                                title={TEXT.mockMetric4}
                                value="6.2"
                                suffix="%"
                                valueStyle={{ fontSize: 18 }}
                              />
                            </Col>
                          </Row>
                        </Card>

                        <Card size="small" title={TEXT.mockSuggestionTitle}>
                          <List
                            split={false}
                            dataSource={SAMPLE_SUGGESTION_ITEMS}
                            renderItem={(item) => (
                              <List.Item style={{ padding: '8px 0' }}>
                                <Space align="start">
                                  <CheckCircleOutlined style={{ color: '#2563EB', marginTop: 4 }} />
                                  <Text>{item}</Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      </Space>
                    </Col>

                    <Col xs={24} lg={14}>
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Card size="small" title={TEXT.reportStructure}>
                          <ReactECharts style={{ height: 220 }} option={previewTrendOption} />
                        </Card>

                        <Card size="small" title={TEXT.previewSectionTitle}>
                          <Paragraph style={{ marginBottom: 0 }}>
                            {TEXT.previewSectionBody}
                          </Paragraph>
                        </Card>
                      </Space>
                    </Col>
                  </Row>

                  <Card size="small" title={TEXT.mockTableTitle}>
                    <Table
                      size="small"
                      columns={sampleTableColumns}
                      dataSource={SAMPLE_TABLE_DATA}
                      pagination={false}
                    />
                  </Card>

                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {TEXT.emptyAiReportDesc} {TEXT.reportHint}
                  </Paragraph>
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      </Space>

      <Modal
        open={previewOpen}
        title={selectedJavaReport?.reportTitle || TEXT.currentReport}
        onCancel={() => setPreviewOpen(false)}
        width={960}
        footer={[
          ...(selectedJavaReport?.createBy === 'agent'
            ? [
                <Button
                  key="download-word"
                  icon={<DownloadOutlined />}
                  disabled={!selectedJavaReport}
                  loading={selectedJavaReport ? downloading === selectedJavaReport.id : false}
                  onClick={() => {
                    if (selectedJavaReport) {
                      void handleDownloadAgentArchive(selectedJavaReport, 'docx');
                    }
                  }}
                >
                  {TEXT.downloadWord}
                </Button>,
                <Button
                  key="download-pdf"
                  icon={<DownloadOutlined />}
                  disabled={!selectedJavaReport || !agentPdfAvailable}
                  loading={selectedJavaReport ? downloading === selectedJavaReport.id : false}
                  onClick={() => {
                    if (selectedJavaReport) {
                      void handleDownloadAgentArchive(selectedJavaReport, 'pdf');
                    }
                  }}
                >
                  {TEXT.downloadPdf}
                </Button>,
              ]
            : [
                <Button
                  key="download"
                  icon={<DownloadOutlined />}
                  disabled={!selectedJavaReport}
                  loading={selectedJavaReport ? downloading === selectedJavaReport.id : false}
                  onClick={handleDownloadSelectedReport}
                >
                  {selectedJavaReport?.fileFormat
                    ? `${TEXT.actionDownload} (${selectedJavaReport.fileFormat})`
                    : TEXT.actionDownload}
                </Button>,
              ]),
          <Button key="close" onClick={() => setPreviewOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        {selectedJavaReport ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={TEXT.descId}>{selectedJavaReport.id}</Descriptions.Item>
              <Descriptions.Item label={TEXT.descStatus}>
                {getStatusTag(selectedJavaReport.status)}
              </Descriptions.Item>
              <Descriptions.Item label={TEXT.descReportNo}>
                {selectedJavaReport.reportNo || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={TEXT.descFileFormat}>
                {selectedJavaReport.createBy === 'agent' && agentPdfAvailable
                  ? 'DOC / PDF'
                  : selectedJavaReport.fileFormat || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={TEXT.blockCreatedAt}>
                {selectedJavaReport.createTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={TEXT.blockOwner}>
                {selectedJavaReport.createBy || TEXT.blockUnknownOwner}
              </Descriptions.Item>
            </Descriptions>

            {report ? (
              <ReportContentView report={report} />
            ) : (
              <>
                <Paragraph style={{ marginBottom: 0 }}>{selectedSummary}</Paragraph>
                <Alert showIcon type="info" message={TEXT.previewMetaOnly} />
              </>
            )}
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.selectJavaReport} />
        )}
      </Modal>
    </AnimatedPage>
  );
}

function ReportContentView({ report }: { report: ReportData }) {
  const safeTitle = sanitizePreviewText(report.title, TEXT.untitledReport);
  const safeSummary = sanitizePreviewText(report.summary, '');
  const executiveMetricTable = useMemo(() => buildExecutiveMetricTable(report), [report]);
  const safeRecommendations = Array.isArray(report.recommendations)
    ? report.recommendations
        .map((item) => sanitizePreviewText(item, ''))
        .filter(Boolean)
    : [];

  return (
    <>
      <Title level={4}>{safeTitle}</Title>
      <Text type="secondary">
        {TEXT.generatedAt}: {report.generate_time}
      </Text>

      {(executiveMetricTable || safeSummary) ? (
        <Card size="small" style={{ marginTop: 12 }} title={TEXT.reportAbstract}>
          {executiveMetricTable ? (
            <ReportTableView table={executiveMetricTable} index={0} withTopMargin={false} />
          ) : null}
          {safeSummary ? (
            <Paragraph
              type={executiveMetricTable ? 'secondary' : undefined}
              style={{ marginTop: executiveMetricTable ? 12 : 0, marginBottom: 0 }}
            >
              {safeSummary}
            </Paragraph>
          ) : null}
        </Card>
      ) : null}

      {safeRecommendations.length > 0 ? (
        <Card size="small" style={{ marginTop: 12 }} title={TEXT.recommendationSummary}>
          <List
            split={false}
            dataSource={safeRecommendations}
            renderItem={(item) => (
              <List.Item style={{ padding: '8px 0' }}>
                <Space align="start">
                  <CheckCircleOutlined style={{ color: '#2563EB', marginTop: 4 }} />
                  <Text>{item}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      ) : null}

      {report.sections.map((section, index) => (
        <ReportSectionView key={`${section.title}-${index}`} section={section} />
      ))}
    </>
  );
}

function buildChartOption(chart: Record<string, unknown>) {
  const chartType = typeof chart.type === 'string' ? chart.type : 'line';
  const chartData = typeof chart.data === 'object' && chart.data ? chart.data as Record<string, unknown> : {};
  const xValues = Array.isArray(chartData.x)
    ? chartData.x as Array<string | number>
    : Array.isArray(chartData.categories)
      ? chartData.categories as Array<string | number>
      : Array.isArray(chartData.dates)
        ? chartData.dates as Array<string | number>
        : [];
  const seriesData = Array.isArray(chartData.series) ? chartData.series as Array<Record<string, unknown>> : [];

  const series = seriesData.length > 0
    ? seriesData.map((item, index) => ({
        name: typeof item.name === 'string' ? item.name : `系列 ${index + 1}`,
        type: typeof item.type === 'string' ? item.type : chartType === 'bar' ? 'bar' : 'line',
        smooth: (typeof item.type === 'string' ? item.type : chartType) !== 'bar',
        data: Array.isArray(item.data) ? item.data : [],
      }))
    : [
        {
          name: typeof chart.title === 'string' ? chart.title : '指标',
          type: chartType === 'bar' ? 'bar' : 'line',
          smooth: chartType !== 'bar',
          data: Array.isArray(chartData.y) ? chartData.y : Array.isArray(chartData.values) ? chartData.values : [],
        },
      ];

  if (xValues.length === 0 || series.every((item) => !Array.isArray(item.data) || item.data.length === 0)) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 36, right: 18, top: 42, bottom: 26 },
    xAxis: {
      type: 'category',
      data: xValues,
      axisTick: { show: false },
    },
    yAxis: { type: 'value' },
    series,
  };
}

function ReportTableView({
  table,
  index,
  withTopMargin = true,
}: {
  table: Record<string, unknown>;
  index: number;
  withTopMargin?: boolean;
}) {
  const tableTitle = sanitizePreviewText(table.title, '');
  const headers = useMemo(
    () => {
      const rawHeaders = Array.isArray(table.headers) ? (table.headers as unknown[]) : [];
      return rawHeaders.map((header, headerIndex) =>
        sanitizePreviewValue(header, `列${headerIndex + 1}`));
    },
    [table],
  );
  const rows = useMemo(
    () => (Array.isArray(table.rows) ? (table.rows as unknown[][]) : []),
    [table],
  );

  const tableColumns = useMemo(
    () => headers.map((header) => ({ title: header, dataIndex: header, key: header })),
    [headers],
  );

  const tableData = useMemo(
    () =>
      rows.map((row, rowIndex) => {
        const record: Record<string, unknown> = { key: `${index}-${rowIndex}` };
        headers.forEach((header, colIndex) => {
          record[header] = sanitizePreviewValue(row[colIndex], TEXT.missingPreviewCell);
        });
        return record;
      }),
    [headers, index, rows],
  );

  if (tableColumns.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: withTopMargin ? 12 : 0 }}>
      {tableTitle ? (
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          {tableTitle}
        </Text>
      ) : null}
      <Table
        size="small"
        columns={tableColumns}
        dataSource={tableData}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}

function ReportSectionView({ section }: { section: ReportSection }) {
  const sectionTitle = sanitizePreviewText(section.title, TEXT.untitledReport);
  const sectionContent = sanitizePreviewText(section.content, TEXT.missingSectionContent);
  const tableFirst = shouldRenderTablesBeforeContent(sectionTitle);
  const charts = Array.isArray(section.charts)
    ? (section.charts as Record<string, unknown>[])
    : [];
  const tables = Array.isArray(section.tables)
    ? (section.tables as Record<string, unknown>[])
    : [];

  const chartOptions = useMemo(
    () => charts
      .map((chart) => ({
        title: typeof chart.title === 'string' ? chart.title : '',
        option: buildChartOption(chart),
      }))
      .filter((item): item is { title: string; option: NonNullable<ReturnType<typeof buildChartOption>> } => Boolean(item.option)),
    [charts],
  );

  return (
    <Card size="small" style={{ marginTop: 12 }} title={sectionTitle}>
      {tableFirst ? (
        tables.map((table, index) => (
          <ReportTableView key={`${section.title}-table-${index}`} table={table} index={index} />
        ))
      ) : null}

      {sectionContent ? (
        <Paragraph
          type={tableFirst ? 'secondary' : undefined}
          style={{ marginTop: tableFirst && tables.length > 0 ? 12 : 0, marginBottom: 0 }}
        >
          {sectionContent}
        </Paragraph>
      ) : null}

      {chartOptions.map((item, index) => (
        <div key={`${section.title}-chart-${index}`} style={{ marginTop: 12 }}>
          {item.title ? (
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {item.title}
            </Text>
          ) : null}
          <ReactECharts style={{ height: 280 }} option={item.option} />
        </div>
      ))}

      {!tableFirst ? (
        tables.map((table, index) => (
          <ReportTableView key={`${section.title}-table-${index}`} table={table} index={index} />
        ))
      ) : null}

      {(section.alerts ?? []).map((alert, idx) => (
        <Alert
          key={idx}
          showIcon
          type="warning"
          style={{ marginTop: 12 }}
          message={(alert as { message?: string }).message ?? ''}
        />
      ))}
    </Card>
  );
}
