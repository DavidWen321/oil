import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  Paperclip,
  Search,
  SendHorizontal,
  Workflow,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';

type ChatRole = 'user' | 'assistant';
type AgentStatus = 'thinking' | 'executing' | 'completed';
type TraceStatus = 'completed' | 'running' | 'pending';

interface ChatRecord {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface ToolSelection {
  id: string;
  name: string;
  query: string;
  mode: string;
  params: string[];
}

interface TraceStep {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: TraceStatus;
}

interface MetricItem {
  label: string;
  value: string;
  unit: string;
}

interface AgentDebugState {
  status: AgentStatus;
  statusDetail: string;
  activeModel: string;
  toolSelection: ToolSelection[];
  trace: TraceStep[];
  logs: string[];
  metrics: MetricItem[];
}

const QUICK_PROMPTS = [
  '分析流量从 800 m³/h 提升到 1200 m³/h 的能耗变化',
  '比较两种泵站调度策略对年运行成本的影响',
  '给出冬季高黏度工况下的压降优化建议',
];

const INITIAL_MESSAGES: ChatRecord[] = [
  {
    id: 'm-1',
    role: 'assistant',
    content:
      '已连接到管道能耗分析智能体。你可以直接描述目标，我会自动完成工具选择、执行追踪和结果解释。',
    timestamp: '09:18',
  },
  {
    id: 'm-2',
    role: 'user',
    content: '请评估项目 A 在 900 m³/h 工况下的能耗瓶颈。',
    timestamp: '09:19',
  },
  {
    id: 'm-3',
    role: 'assistant',
    content:
      '已识别到主要瓶颈在 2# 泵站前段压降偏高，初步判断与高黏度油品和局部阀门阻力有关。我正在准备分段压降和效率对比结果。',
    timestamp: '09:19',
  },
];

const INITIAL_DEBUG_STATE: AgentDebugState = {
  status: 'executing',
  statusDetail: '正在执行 hydraulic_calculation，并聚合各泵站效率曲线。',
  activeModel: 'Claude Opus 4.6',
  toolSelection: [
    {
      id: 'tool-1',
      name: 'query_database',
      query: '查询项目 A 的管道分段参数与泵站实时工况',
      mode: 'SQL + Schema',
      params: ['project=A', 'window=24h', 'max_rows=300'],
    },
    {
      id: 'tool-2',
      name: 'hydraulic_calculation',
      query: '计算 900 m³/h 下各分段摩阻损失与总压降',
      mode: 'Physics Solver',
      params: ['flow=900', 'temperature=32C', 'oil=5#'],
    },
  ],
  trace: [
    {
      id: 'step-1',
      title: 'Intent Parsing',
      detail: '识别目标为瓶颈定位 + 能耗优化建议。',
      time: '09:19:02',
      status: 'completed',
    },
    {
      id: 'step-2',
      title: 'Tool Search',
      detail: '在 registry 中检索到 3 个候选工具，选择 2 个。',
      time: '09:19:03',
      status: 'completed',
    },
    {
      id: 'step-3',
      title: 'Data Retrieval',
      detail: '拉取泵站负载、阀门开度、分段长度与粗糙度。',
      time: '09:19:04',
      status: 'completed',
    },
    {
      id: 'step-4',
      title: 'Hydraulic Solve',
      detail: '正在进行分段压降迭代求解并计算比能耗。',
      time: '09:19:05',
      status: 'running',
    },
    {
      id: 'step-5',
      title: 'Response Synthesis',
      detail: '生成最终结论与调度建议。',
      time: '--:--:--',
      status: 'pending',
    },
  ],
  logs: [
    '[09:19:02] planner.intent: bottleneck_analysis',
    '[09:19:03] tool.search: top_k=3, selected=query_database,hydraulic_calculation',
    '[09:19:04] sql.exec: rows=186, latency=128ms',
    '[09:19:05] hydraulic.solve: segment=12, iter=18, residual=1.7e-5',
    '[09:19:05] trace.emit: node=Hydraulic Solve, status=running',
  ],
  metrics: [
    { label: 'Latency', value: '1.84', unit: 's' },
    { label: 'Input Tokens', value: '2,148', unit: 'tok' },
    { label: 'Output Tokens', value: '486', unit: 'tok' },
    { label: 'Tool Calls', value: '2', unit: 'calls' },
  ],
};

function currentClock() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function traceDot(status: TraceStatus) {
  if (status === 'completed') return 'bg-emerald-500';
  if (status === 'running') return 'bg-blue-500 animate-pulse';
  return 'bg-slate-300';
}

function statusMeta(status: AgentStatus) {
  if (status === 'thinking') {
    return {
      label: 'Thinking',
      dotClass: 'bg-amber-500 animate-pulse',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
  }
  if (status === 'executing') {
    return {
      label: 'Executing',
      dotClass: 'bg-blue-500 animate-pulse',
      badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    };
  }
  return {
    label: 'Completed',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
}

export default function AIChat() {
  const [messages, setMessages] = useState<ChatRecord[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [debugState, setDebugState] = useState<AgentDebugState>(INITIAL_DEBUG_STATE);
  const sendTimerRef = useRef<number | null>(null);

  const stateMeta = useMemo(() => statusMeta(debugState.status), [debugState.status]);
  const canSend = Boolean(draft.trim()) && !sending;

  useEffect(
    () => () => {
      if (sendTimerRef.current !== null) {
        window.clearTimeout(sendTimerRef.current);
      }
    },
    [],
  );

  const onSend = () => {
    const content = draft.trim();
    if (!content || sending) return;

    const now = currentClock();
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content, timestamp: now.slice(0, 5) },
    ]);
    setDraft('');
    setSending(true);

    setDebugState((prev) => ({
      ...prev,
      status: 'thinking',
      statusDetail: '正在解析输入并生成执行计划。',
      trace: prev.trace.map((step, index) => {
        if (index === 0 || index === 1) return { ...step, status: 'completed' };
        if (index === 2) return { ...step, status: 'running', time: now };
        return { ...step, status: 'pending' };
      }),
      logs: [
        ...prev.logs,
        `[${now}] user.input: ${content}`,
        `[${now}] planner.route: intent=energy_analysis`,
      ],
      metrics: [
        { label: 'Latency', value: '--', unit: 's' },
        { label: 'Input Tokens', value: '2,304', unit: 'tok' },
        { label: 'Output Tokens', value: '--', unit: 'tok' },
        { label: 'Tool Calls', value: '0', unit: 'calls' },
      ],
    }));

    sendTimerRef.current = window.setTimeout(() => {
      const finishedAt = currentClock();
      const summary = `已完成分析：在当前工况下，2# 泵站入口前 18.4km 管段贡献了约 37% 总压降。建议优先优化该段阀门开度，并将晚高峰流量限制在 1020 m³/h 以下。`;

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: summary,
          timestamp: finishedAt.slice(0, 5),
        },
      ]);

      setDebugState((prev) => ({
        ...prev,
        status: 'completed',
        statusDetail: '执行完成，结果已写入主对话区。',
        trace: prev.trace.map((step, index) => {
          if (index < 4) return { ...step, status: 'completed', time: finishedAt };
          return { ...step, status: 'completed', time: finishedAt };
        }),
        logs: [
          ...prev.logs,
          `[${finishedAt}] tool.call: hydraulic_calculation done`,
          `[${finishedAt}] response.emit: content_delta completed`,
        ],
        metrics: [
          { label: 'Latency', value: '2.11', unit: 's' },
          { label: 'Input Tokens', value: '2,304', unit: 'tok' },
          { label: 'Output Tokens', value: '512', unit: 'tok' },
          { label: 'Tool Calls', value: '2', unit: 'calls' },
        ],
      }));

      setSending(false);
      sendTimerRef.current = null;
    }, 1100);
  };

  return (
    <AnimatedPage>
      <div className="h-[calc(100vh-64px)] bg-mesh-light bg-slate-100 p-3 md:p-4 overflow-hidden">
        <div className="grid h-full gap-3 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="relative min-h-0 rounded-[28px] border border-slate-200/70 bg-white/80 shadow-soft backdrop-blur-xl">
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 md:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    AI Agent Workspace
                  </p>
                  <h1 className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
                    Pipeline Energy Copilot
                  </h1>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${stateMeta.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${stateMeta.dotClass}`} />
                  {stateMeta.label}
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-36">
                  {messages.map((message) =>
                    message.role === 'assistant' ? (
                      <article key={message.id} className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="max-w-[90%]">
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {message.content}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-400">{message.timestamp}</p>
                        </div>
                      </article>
                    ) : (
                      <article key={message.id} className="ml-auto max-w-[90%]">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-7 text-slate-700 ring-1 ring-slate-200/80">
                          {message.content}
                        </div>
                        <p className="mt-2 text-right text-[11px] text-slate-400">{message.timestamp}</p>
                      </article>
                    ),
                  )}

                  {sending ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200/80">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 md:px-6 md:pb-6">
                <div className="pointer-events-auto w-full max-w-3xl rounded-3xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-4">
                  <div className="flex items-end gap-3">
                    <button
                      type="button"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Attach file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          onSend();
                        }
                      }}
                      rows={1}
                      placeholder="输入你的分析需求，Shift + Enter 换行..."
                      className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={onSend}
                      disabled={!canSend}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      aria-label="Send message"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setDraft(prompt)}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="min-h-0 rounded-[28px] border border-slate-200/70 bg-white/85 shadow-soft backdrop-blur-xl overflow-hidden">
            <div className="flex h-full min-h-0 flex-col">
              <div className="sticky top-0 z-10 rounded-t-[28px] border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Agent Observability</p>
                    <p className="mt-1 text-xs text-slate-500">{debugState.statusDetail}</p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${stateMeta.badgeClass}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${stateMeta.dotClass}`} />
                    {stateMeta.label}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-900">Tool Selection</h2>
                  </div>
                  <div className="space-y-3">
                    {debugState.toolSelection.map((tool) => (
                      <article key={tool.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{tool.name}</p>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200">
                            {tool.mode}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{tool.query}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tool.params.map((tag) => (
                            <span
                              key={`${tool.id}-${tag}`}
                              className="max-w-full truncate rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-900">Execution Plan / Trace</h2>
                  </div>
                  <div className="relative pl-1">
                    {debugState.trace.map((step, index) => (
                      <div key={step.id} className="relative pb-5 last:pb-0">
                        {index < debugState.trace.length - 1 ? (
                          <span className="absolute left-[6px] top-4 h-full w-px bg-slate-200" />
                        ) : null}
                        <span
                          className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${traceDot(step.status)}`}
                        />
                        <div className="ml-6 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                            <span className="text-[11px] text-slate-400">{step.time}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-600">{step.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-900">Real-time Logs</h2>
                  </div>
                  <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>stream.log</span>
                      <span className="inline-flex items-center gap-1">
                        <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                        live
                      </span>
                    </div>
                    <pre className="max-h-52 overflow-y-auto overflow-x-auto whitespace-pre font-mono text-[11px] leading-5 text-zinc-100">
                      {debugState.logs.join('\n')}
                    </pre>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-900">Performance Metrics</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {debugState.metrics.map((metric) => (
                      <article
                        key={metric.label}
                        className="rounded-xl bg-slate-50 p-3 text-slate-700 ring-1 ring-slate-200/70"
                      >
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          {metric.label}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">
                          {metric.value}
                          <span className="ml-1 text-xs font-medium text-slate-500">{metric.unit}</span>
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-900">Session Snapshot</span>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    当前会话展示 mock trace、tool 参数标签与日志滚动区域。你可以直接发送消息查看状态从
                    Thinking 到 Completed 的完整过渡。
                  </p>
                </section>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AnimatedPage>
  );
}
