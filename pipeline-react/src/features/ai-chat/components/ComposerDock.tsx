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
  return (
    <div className="px-4 pb-5 pt-3 md:px-6">
      <div className="mx-auto w-full max-w-[860px]">
        <div className="rounded-[30px] border border-neutral-200/80 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-500/10">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="描述你的业务场景、诊断问题或优化目标"
            rows={3}
            className="min-h-[96px] w-full resize-none rounded-t-[30px] bg-transparent px-5 pt-4 text-[15px] leading-7 text-neutral-900 outline-none placeholder:text-neutral-400"
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
              <div className="text-xs text-neutral-400">Enter 发送，Shift + Enter 换行</div>
              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  <Square className="h-4 w-4 fill-current" />
                  停止生成
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!draft.trim()}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
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
