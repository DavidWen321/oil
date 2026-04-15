import { Paperclip, SendHorizontal, Square, WandSparkles } from 'lucide-react';
import type { ChatMode } from '../types';
import { MODE_OPTIONS } from '../utils/chatUi';

interface ComposerDockProps {
  draft: string;
  mode: ChatMode;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onModeChange: (mode: ChatMode) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ComposerDock({
  draft,
  mode,
  busy,
  onDraftChange,
  onModeChange,
  onSubmit,
  onStop,
}: ComposerDockProps) {
  const activeMode = MODE_OPTIONS.find((option) => option.value === mode);

  return (
    <div className="px-4 pb-5 pt-3 md:px-6">
      <div className="w-full max-w-[980px]">
        <div className="rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_24px_54px_rgba(15,23,42,0.10)] ring-1 ring-black/5 backdrop-blur focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-500/10">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200/70 px-5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-800">
                {busy ? '正在生成分析结果' : '开始一段新的分析'}
              </div>
              <div className="mt-1 line-clamp-1 text-xs text-neutral-500">
                {activeMode?.description ?? '输入业务场景、问题线索或优化目标，助手会按当前模式组织输出。'}
              </div>
            </div>
            <div className="hidden rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1.5 text-xs font-medium text-sky-700 sm:block">
              {activeMode?.label ?? '标准分析'}
            </div>
          </div>

          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="描述你的业务场景、诊断问题或优化目标"
            rows={3}
            className="min-h-[108px] w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-7 text-neutral-900 outline-none placeholder:text-neutral-400"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />

          <div className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Paperclip className="h-4 w-4" />
                上传
              </button>

              <label className="relative">
                <span className="sr-only">选择模式</span>
                <WandSparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <select
                  value={mode}
                  onChange={(event) => onModeChange(event.target.value as ChatMode)}
                  className="h-10 appearance-none rounded-full border border-neutral-200 bg-neutral-50 pl-9 pr-9 text-sm text-neutral-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10"
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs text-neutral-500">
                单独回车发送，Shift + Enter 换行
              </div>
              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-sky-200/80 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] px-4 text-sm font-medium text-slate-800 transition hover:border-sky-300 hover:bg-[linear-gradient(135deg,#e0f2fe_0%,#dbeafe_100%)]"
                >
                  <Square className="h-4 w-4 fill-current" />
                  停止生成
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!draft.trim()}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-sky-200/80 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] px-4 text-sm font-medium text-slate-800 shadow-[0_10px_22px_rgba(147,197,253,0.16)] transition hover:border-sky-300 hover:bg-[linear-gradient(135deg,#e0f2fe_0%,#dbeafe_100%)] disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none"
                >
                  <SendHorizontal className="h-4 w-4" />
                  发送
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
