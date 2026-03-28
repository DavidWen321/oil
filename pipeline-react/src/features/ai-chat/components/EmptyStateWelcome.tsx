import { ArrowRight, Sparkles } from 'lucide-react';

interface EmptyStateWelcomeProps {
  prompts: string[];
  onPromptSelect: (prompt: string) => void;
}

export function EmptyStateWelcome({ prompts, onPromptSelect }: EmptyStateWelcomeProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-2 py-10 text-center">
      <div className="mx-auto flex max-w-[720px] flex-col items-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#e0f2fe_0%,#dbeafe_55%,#e2e8f0_100%)] text-slate-700 shadow-[0_14px_32px_rgba(148,163,184,0.18)] ring-1 ring-white/90">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-neutral-950 md:text-4xl">
          让智能分析从一个问题开始
        </h1>
        <p className="mt-4 max-w-[620px] text-[15px] leading-7 text-neutral-500 md:text-base">
          你可以直接输入业务场景、异常现象、调度目标或优化约束。助手会结合知识库、计算服务与数据接口给出可执行建议。
        </p>

        <div className="mt-8 grid w-full gap-3 md:grid-cols-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="group rounded-3xl border border-neutral-200/80 bg-white px-5 py-4 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium leading-6 text-neutral-800">{prompt}</div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition group-hover:text-neutral-900" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
