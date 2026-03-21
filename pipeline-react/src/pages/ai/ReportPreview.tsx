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
  DownloadOutlined,
  FilePdfOutlined,
  FileSearchOutlined,
  FileWordOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { agentApi } from '../../api/agent';
import { reportApi } from '../../api';
import type {
  AnalysisReport,
  ReportData,
  ReportGeneratePayload,
  ReportSection,
} from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';
import { useUserStore } from '../../stores/userStore';

const { Paragraph, Text, Title } = Typography;

const TEXT = {
  defaultRequest: '\u751f\u6210\u957f\u5e86\u7ba1\u9053\u672c\u6708\u8fd0\u884c\u5206\u6790\u62a5\u544a',
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
    '\u8bf7\u8f93\u5165\u62a5\u544a\u9700\u6c42\uff0c\u4f8b\u5982\uff1a\u751f\u6210\u957f\u5e86\u7ba1\u9053\u672c\u6708\u8fd0\u884c\u5206\u6790\u62a5\u544a\uff0c\u5e76\u603b\u7ed3\u80fd\u8017\u53d8\u5316\u3001\u6cf5\u7ad9\u6548\u7387\u548c\u4f18\u5316\u5efa\u8bae\u3002',
  downloadWord: '\u4e0b\u8f7d Word',
  downloadPdf: '\u4e0b\u8f7d PDF',
  javaReportId: 'Java\u62a5\u544aID',
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
  colId: '\u7f16\u53f7',
  colReportNo: '\u62a5\u544a\u7f16\u53f7',
  colTitle: '\u6807\u9898',
  colType: '\u7c7b\u578b',
  colStatus: '\u72b6\u6001',
  colCreateTime: '\u751f\u6210\u65f6\u95f4',
  colAction: '\u64cd\u4f5c',
  actionDownload: '\u4e0b\u8f7d',
  descId: '\u7f16\u53f7',
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
  const [request, setRequest] = useState(TEXT.defaultRequest);
  const [generating, setGenerating] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [javaReportId, setJavaReportId] = useState<number | null>(null);
  const [javaReportList, setJavaReportList] = useState<AnalysisReport[]>([]);
  const [selectedJavaReport, setSelectedJavaReport] = useState<AnalysisReport | null>(null);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);
  const [agentUnavailable, setAgentUnavailable] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const aiStatusText = agentUnavailable ? TEXT.aiOffline : TEXT.aiOnline;
  const selectedReportStatus = selectedJavaReport?.status;
  const selectedSummary = selectedJavaReport?.reportSummary || TEXT.summaryPlaceholder;
  const selectedReportVersion = selectedJavaReport ? TEXT.defaultVersion : '-';
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
      value: selectedJavaReport?.fileFormat || '-',
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
      setSelectedJavaReport(response.data);
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

  useEffect(() => {
    void loadJavaReports(1, DEFAULT_PAGE_SIZE, { silent: true, selectFirst: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    const text = request.trim();
    if (!text) {
      message.warning(TEXT.inputRequest);
      return;
    }

    setGenerating(true);
    try {
      const response = await agentApi.generateReport(text);
      const payload = extractAgentPayload(response) as ReportGeneratePayload;

      if (payload.report) {
        setReport(payload.report);
      }

      const nextJavaReportId = payload.java_report_id ?? null;
      setJavaReportId(nextJavaReportId);
      setAgentUnavailable(false);

      await loadJavaReports(1, pagination.pageSize, { silent: true });
      if (nextJavaReportId) {
        await handleSelectJavaReport(Number(nextJavaReportId));
      }

      message.success(TEXT.aiGenerateSuccess);
    } catch {
      setAgentUnavailable(true);
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

  const handleDownloadJavaReport = useCallback(async (record: AnalysisReport) => {
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
  }, [appendDownloadHistory, selectedReportSource]);

  const openAgentDownload = useCallback((format: 'docx' | 'pdf') => {
    if (!javaReportId) {
      return;
    }
    appendDownloadHistory(
      javaReportId,
      report?.title || selectedJavaReport?.reportTitle || TEXT.untitledReport,
      `${format.toUpperCase()} ${TEXT.actionDownload}`,
      TEXT.sourceAgent,
    );
    window.open(agentApi.getJavaReportDownloadUrl(javaReportId, format), '_blank');
  }, [appendDownloadHistory, javaReportId, report?.title, selectedJavaReport?.reportTitle]);

  const tableColumns = useMemo(
    () => [
      {
        title: TEXT.colId,
        dataIndex: 'id',
        key: 'id',
        width: 88,
        align: 'center' as const,
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
        width: 128,
        align: 'center' as const,
        render: (_: unknown, record: AnalysisReport) => (
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
        ),
      },
    ],
    [downloading, handleDownloadJavaReport],
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

                {javaReportId ? (
                  <Space wrap>
                    <Button icon={<FileWordOutlined />} onClick={() => openAgentDownload('docx')}>
                      {TEXT.downloadWord}
                    </Button>
                    <Button icon={<FilePdfOutlined />} onClick={() => openAgentDownload('pdf')}>
                      {TEXT.downloadPdf}
                    </Button>
                    <Text type="secondary">
                      {TEXT.javaReportId}: {javaReportId}
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
                <Text type="secondary">
                  {TEXT.totalPrefix} {pagination.total} {TEXT.totalSuffix}
                </Text>
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
                <>
                  <Title level={4}>{report.title}</Title>
                  <Text type="secondary">
                    {TEXT.generatedAt}: {report.generate_time}
                  </Text>

                  {report.summary ? (
                    <Paragraph style={{ marginTop: 12 }}>{report.summary}</Paragraph>
                  ) : null}

                  {report.sections.map((section, index) => (
                    <ReportSectionView key={`${section.title}-${index}`} section={section} />
                  ))}
                </>
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
    </AnimatedPage>
  );
}

function ReportSectionView({ section }: { section: ReportSection }) {
  const firstChart = section.charts?.[0] as Record<string, unknown> | undefined;
  const firstTable = section.tables?.[0] as Record<string, unknown> | undefined;

  const tableColumns = useMemo(() => {
    const headers = Array.isArray(firstTable?.headers) ? (firstTable.headers as string[]) : [];
    return headers.map((header) => ({ title: header, dataIndex: header, key: header }));
  }, [firstTable]);

  const tableData = useMemo(() => {
    const rows = Array.isArray(firstTable?.rows) ? (firstTable.rows as unknown[][]) : [];
    const headers = Array.isArray(firstTable?.headers) ? (firstTable.headers as string[]) : [];
    return rows.map((row, rowIndex) => {
      const record: Record<string, unknown> = { key: rowIndex };
      headers.forEach((header, colIndex) => {
        record[header] = row[colIndex];
      });
      return record;
    });
  }, [firstTable]);

  const chartOption = useMemo(() => {
    if (!firstChart) {
      return null;
    }

    const chartType = (firstChart.type as string) || 'line';
    const chartData = (firstChart.data as Record<string, unknown>) || {};
    const xValues = (chartData.x as string[]) || (chartData.dates as string[]) || [];
    const yValues = (chartData.y as number[]) || (chartData.values as number[]) || [];

    return {
      tooltip: {},
      xAxis: { type: 'category', data: xValues },
      yAxis: { type: 'value' },
      series: [
        {
          data: yValues,
          type: chartType === 'bar' ? 'bar' : 'line',
          smooth: chartType !== 'bar',
        },
      ],
    };
  }, [firstChart]);

  return (
    <Card size="small" style={{ marginTop: 12 }} title={section.title}>
      <Paragraph>{section.content}</Paragraph>

      {chartOption ? <ReactECharts style={{ height: 280 }} option={chartOption} /> : null}

      {tableColumns.length > 0 ? (
        <Table size="small" columns={tableColumns} dataSource={tableData} pagination={false} />
      ) : null}

      {(section.alerts ?? []).map((alert, idx) => (
        <Paragraph key={idx} type="warning">
          {(alert as { message?: string }).message ?? ''}
        </Paragraph>
      ))}
    </Card>
  );
}
