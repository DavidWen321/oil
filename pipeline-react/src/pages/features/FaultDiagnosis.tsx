import { useState, useRef } from 'react';
import { Card, Form, InputNumber, Button, Row, Col, Progress, Tag, Collapse, Descriptions, Space, Alert, message, Flex } from 'antd';
import { AlertOutlined, CheckCircleOutlined, WarningOutlined, ExclamationCircleOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsInstance } from 'echarts-for-react';
import type { DiagnosisResult } from '../../types';
import { diagnosisApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';

export default function FaultDiagnosis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await diagnosisApi.analyze(values);
      if (res.data) {
        setResult(res.data);
        message.success('诊断完成');
      }
    } catch {
      // 模拟诊断结果
      const mockResult: DiagnosisResult = {
        diagnosisId: 'diag-' + Date.now(),
        pipelineId: 1,
        diagnosisTime: new Date().toISOString(),
        healthScore: 72,
        healthLevel: 'WARNING',
        faults: [
          { faultType: 'PRESSURE_HIGH', faultCode: 'PRESSURE_HIGH', faultName: '压力过高', severity: 'warning', confidence: 85, description: '首站出站压力超过设计值10%', detectedValue: '7.15 MPa', normalRange: '≤6.5 MPa', deviationPercent: 10, possibleCauses: ['出口阀门开度不足', '下游堵塞', '泵站出力过大'], recommendations: ['检查并调整出口阀门', '核查下游管道状况'] },
          { faultType: 'FLOW_DIFF', faultCode: 'LEAKAGE_SUSPECTED', faultName: '疑似泄漏', severity: 'critical', confidence: 78, description: '进出口流量差异达到3.5%，超过正常阈值', detectedValue: '差异30 m³/h', normalRange: '差异<2%', deviationPercent: 3.5, possibleCauses: ['管道腐蚀穿孔', '焊缝开裂', '阀门密封失效'], recommendations: ['【紧急】启动泄漏应急预案', '使用负压波法定位泄漏点', '组织沿线巡检'] },
        ],
        conclusion: '本次诊断共发现2个问题，其中1个严重问题需要立即处理。系统健康评分为72分，建议优先处理疑似泄漏问题。',
        priorityActions: ['【疑似泄漏】立即启动泄漏应急预案', '【压力过高】检查并调整出口阀门开度'],
        riskPredictions: [
          { riskType: '环境污染风险', riskDescription: '若泄漏持续，可能造成土壤和水源污染', probability: 75, impactLevel: '严重', preventiveMeasures: ['立即封堵泄漏点', '准备应急物资'] }
        ],
        metrics: { pressureScore: 70, flowScore: 60, pumpScore: 85, energyScore: 80, pressureStatus: '警告', flowStatus: '异常', pumpStatus: '良好', energyStatus: '良好' }
      };
      setResult(mockResult);
      message.success('诊断完成（演示模式）');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return '#52c41a';
    if (score >= 75) return '#1890ff';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
      case 'warning': return <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />;
      default: return <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
    }
  };

  const radarOption = result ? {
    radar: { indicator: [{ name: '压力', max: 100 }, { name: '流量', max: 100 }, { name: '泵站', max: 100 }, { name: '能耗', max: 100 }] },
    series: [{ type: 'radar', data: [{ value: [result.metrics.pressureScore, result.metrics.flowScore, result.metrics.pumpScore, result.metrics.energyScore], name: '健康指标', areaStyle: { color: 'rgba(102,126,234,0.3)' }, lineStyle: { color: '#667eea' } }] }]
  } : null;

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><MedicineBoxOutlined /> 智能故障诊断</h2>
        <p>基于AI的管道系统智能故障诊断，识别潜在风险并给出处理建议</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card title="运行数据输入" className="page-card">
            <Form form={form} layout="vertical" onFinish={onFinish}
              initialValues={{ pipelineId: 1, inletPressure: 7.15, outletPressure: 0.75, inletFlowRate: 860, outletFlowRate: 830, maxDesignPressure: 6.5, designFlowRate: 850 }}>
              <Form.Item name="pipelineId" label="管道ID"><InputNumber style={{ width: '100%' }} /></Form.Item>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="inletPressure" label="首站压力(MPa)"><InputNumber precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="outletPressure" label="末站压力(MPa)"><InputNumber precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="inletFlowRate" label="首站流量(m³/h)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="outletFlowRate" label="末站流量(m³/h)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="maxDesignPressure" label="设计压力上限"><InputNumber precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="designFlowRate" label="设计流量"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={loading} icon={<AlertOutlined />} block size="large" danger>开始诊断</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {result ? (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {/* 健康评分 */}
              <Card className="page-card">
                <Row gutter={24} align="middle">
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={result.healthScore} strokeColor={getHealthColor(result.healthScore)} format={(p) => <span style={{ fontSize: 28, fontWeight: 700 }}>{p}</span>} />
                    <div style={{ marginTop: 8 }}><Tag color={result.healthLevel === 'EXCELLENT' ? 'success' : result.healthLevel === 'GOOD' ? 'blue' : result.healthLevel === 'WARNING' ? 'warning' : 'error'}>{result.healthLevel === 'EXCELLENT' ? '优秀' : result.healthLevel === 'GOOD' ? '良好' : result.healthLevel === 'WARNING' ? '警告' : '危险'}</Tag></div>
                  </Col>
                  <Col span={18}><ReactECharts option={radarOption!} style={{ height: 200 }} /></Col>
                </Row>
              </Card>

              {/* 诊断结论 */}
              <Alert title="诊断结论" description={result.conclusion} type={result.healthLevel === 'CRITICAL' ? 'error' : result.healthLevel === 'WARNING' ? 'warning' : 'success'} showIcon />

              {/* 优先处理建议 */}
              <Card title="优先处理建议" className="page-card">
                <Flex vertical gap={8}>
                  {result.priorityActions.map((item, idx) => (
                    <div key={idx} style={{ padding: '8px 0', borderBottom: idx < result.priorityActions.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      <Tag color={idx === 0 ? 'red' : 'orange'}>{idx + 1}</Tag> {item}
                    </div>
                  ))}
                </Flex>
              </Card>

              {/* 故障详情 */}
              <Card title={`检测到的问题 (${result.faults.length})`} className="page-card">
                <Collapse accordion items={result.faults.map((fault, idx) => ({
                  key: idx.toString(),
                  label: <Space>{getSeverityIcon(fault.severity)}<span>{fault.faultName}</span><Tag color={fault.severity === 'critical' ? 'red' : fault.severity === 'warning' ? 'orange' : 'blue'}>{fault.severity === 'critical' ? '严重' : fault.severity === 'warning' ? '警告' : '提示'}</Tag><span style={{ color: '#999' }}>置信度: {fault.confidence}%</span></Space>,
                  children: (
                    <div>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="问题描述" span={2}>{fault.description}</Descriptions.Item>
                        <Descriptions.Item label="检测值">{fault.detectedValue}</Descriptions.Item>
                        <Descriptions.Item label="正常范围">{fault.normalRange}</Descriptions.Item>
                        <Descriptions.Item label="偏离程度">{fault.deviationPercent}%</Descriptions.Item>
                        <Descriptions.Item label="置信度">{fault.confidence}%</Descriptions.Item>
                      </Descriptions>
                      <div style={{ marginTop: 16 }}>
                        <strong>可能原因：</strong>
                        <ul>{fault.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}</ul>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <strong>处理建议：</strong>
                        <ul>{fault.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                      </div>
                    </div>
                  )
                }))} />
              </Card>

              {/* 风险预测 */}
              {result.riskPredictions.length > 0 && (
                <Card title="风险预测" className="page-card">
                  {result.riskPredictions.map((risk, idx) => (
                    <Alert key={idx} title={<><strong>{risk.riskType}</strong> - 发生概率: {risk.probability}%</>} description={risk.riskDescription} type="warning" style={{ marginBottom: 8 }} />
                  ))}
                </Card>
              )}
            </Space>
          ) : (
            <Card className="page-card" style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#999' }}><MedicineBoxOutlined style={{ fontSize: 64, marginBottom: 16, color: '#667eea' }} /><h3>智能故障诊断</h3><p>输入运行数据后，系统将自动分析潜在故障</p></div>
            </Card>
          )}
        </Col>
      </Row>
    </AnimatedPage>
  );
}
