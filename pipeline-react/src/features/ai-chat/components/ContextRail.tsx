import { Activity, ChevronDown, Gauge, ListTodo, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PlanStep, TraceLog, TraceMetrics, ToolExecutionEvent } from '../../../types/agent';

interface ContextRailProps {
  plan: PlanStep[];
  logs: TraceLog[];
  metrics: TraceMetrics;
  activeTools: ToolExecutionEvent[];
  currentStep: number;
}

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: typeof Activity;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-3xl bg-white/80 p-4 ring-1 ring-black/5">
      <button type="button" className="flex w-full items-center justify-between gap-3" onClick={() => setOpen((prev) => !prev)}>
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <Icon className="h-4 w-4 text-neutral-500" />
          {title}
        </div>
        <ChevronDown className={[ 'h-4 w-4 text-neutral-400 transition-transform', open ? 'rotate-180' : '' ].join(' ')} />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

export function ContextRail({ plan, logs, metrics, activeTools, currentStep }: ContextRailProps) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4">
      <div className="rounded-3xl bg-white/85 p-4 ring-1 ring-black/5">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">当前运行</div>
        <div className="mt-2 text-sm text-neutral-600">步骤 {currentStep || 0}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">工具</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{activeTools.length}</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">日志</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{logs.length}</div>
          </div>
        </div>
      </div>

      <Section title="执行计划" icon={ListTodo}>
        <div className="space-y-2">
          {plan.length === 0 ? <div className="text-sm text-neutral-500">尚未生成执行计划</div> : null}
          {plan.map((step) => (
            <div key={`${step.step_number}-${step.description}`} className="rounded-2xl bg-neutral-50 px-3 py-3">
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-neutral-800">
                <span>步骤 {step.step_number}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-neutral-500 ring-1 ring-black/5">
                  {step.status === 'in_progress' ? '进行中' : step.status === 'completed' ? '已完成' : step.status === 'failed' ? '失败' : '待执行'}
                </span>
              </div>
              <div className="mt-1 text-sm leading-6 text-neutral-600">{step.description}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="工具调用" icon={Wrench}>
        <div className="space-y-2">
          {activeTools.length === 0 ? <div className="text-sm text-neutral-500">当前回复未触发工具调用</div> : null}
          {activeTools.map((tool, index) => (
            <div key={tool.call_id ?? `${tool.tool}-${index}`} className="rounded-2xl bg-neutral-50 px-3 py-3">
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-neutral-800">
                <span>{tool.tool}</span>
                <span className="text-xs text-neutral-500">{tool.status === 'running' ? '执行中' : '已完成'}</span>
              </div>
              {tool.output ? (
                <div className="mt-2 text-xs leading-6 text-neutral-500">
                  {tool.output.length > 160 ? `${tool.output.slice(0, 160)}...` : tool.output}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="实时日志" icon={Activity} defaultOpen={false}>
        <div className="space-y-2">
          {logs.length === 0 ? <div className="text-sm text-neutral-500">暂无日志</div> : null}
          {logs.slice(-8).reverse().map((log, index) => (
            <div key={`${log.timestamp}-${index}`} className="rounded-2xl bg-neutral-50 px-3 py-3 text-xs leading-6 text-neutral-600">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
                <span>{log.type}</span>
                <span>{new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {log.text}
            </div>
          ))}
        </div>
      </Section>

      <Section title="性能指标" icon={Gauge} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">总耗时</div>
            <div className="mt-1 font-semibold text-neutral-900">{metrics.total_duration_ms} ms</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="text-[11px] tracking-[0.12em] text-neutral-400">模型调用</div>
            <div className="mt-1 font-semibold text-neutral-900">{metrics.llm_calls}</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">工具调用</div>
            <div className="mt-1 font-semibold text-neutral-900">{metrics.tool_calls}</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="text-[11px] tracking-[0.12em] text-neutral-400">令牌数</div>
            <div className="mt-1 font-semibold text-neutral-900">{metrics.total_tokens}</div>
          </div>
        </div>
      </Section>
    </div>
  );
}
