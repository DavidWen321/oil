import { ChevronDown, CircleCheckBig, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ToolExecutionEvent } from '../../../types/agent';

const TOOL_LABELS: Record<string, string> = {
  SQL_Database: '数据库查询',
  Knowledge_Base: '知识库检索',
  Hydraulic_Analysis: '水力计算',
};

function getToolTitle(toolName: string) {
  return TOOL_LABELS[toolName] ?? toolName;
}

interface ToolCallAccordionProps {
  tools: ToolExecutionEvent[];
}

export function ToolCallAccordion({ tools }: ToolCallAccordionProps) {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    const running = tools.filter((tool) => tool.status === 'running').length;
    if (running > 0) {
      return `已调用 ${tools.length} 个工具，${running} 个仍在执行`;
    }
    return `已调用 ${tools.length} 个工具`;
  }, [tools]);

  if (!tools.length) return null;

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/80">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div>
          <div className="text-sm font-medium text-neutral-800">查看分析过程</div>
          <div className="mt-1 text-xs text-neutral-500">{summary}</div>
        </div>
        <ChevronDown className={[ 'h-4 w-4 text-neutral-400 transition-transform', open ? 'rotate-180' : '' ].join(' ')} />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-neutral-200/80 px-4 py-4">
          {tools.map((tool, index) => {
            const Icon = tool.status === 'running' ? LoaderCircle : tool.status === 'completed' ? CircleCheckBig : TriangleAlert;
            return (
              <div key={tool.call_id ?? `${tool.tool}-${index}`} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                    <Icon className={[ 'h-4 w-4', tool.status === 'running' ? 'animate-spin text-sky-500' : tool.status === 'completed' ? 'text-emerald-500' : 'text-amber-500' ].join(' ')} />
                    {getToolTitle(tool.tool)}
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                    {tool.status === 'running' ? '执行中' : tool.status === 'completed' ? '已完成' : '失败'}
                  </span>
                </div>
                {tool.output ? (
                  <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-3 text-xs leading-6 text-neutral-600">
                    {tool.output.length > 240 ? `${tool.output.slice(0, 240)}...` : tool.output}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
