import { Circle, Menu, PanelRightOpen, Sparkles, WifiOff, Wifi } from 'lucide-react';
import type { ChatMode } from '../types';
import { MODE_OPTIONS } from '../utils/chatUi';

interface ChatTopbarProps {
  title: string;
  mode: ChatMode;
  connected: boolean;
  contextOpen: boolean;
  onToggleSidebar: () => void;
  onToggleContext: () => void;
  onModeChange: (mode: ChatMode) => void;
}

export function ChatTopbar({
  title,
  mode,
  connected,
  contextOpen,
  onToggleSidebar,
  onToggleContext,
  onModeChange,
}: ChatTopbarProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-neutral-200/70 px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 xl:hidden"
          onClick={onToggleSidebar}
          aria-label="打开会话栏"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-neutral-900 md:text-lg">{title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
            <Sparkles className="h-3.5 w-3.5" />
            <span>智能分析助手</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <label className="relative hidden md:block">
          <span className="sr-only">选择模式</span>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as ChatMode)}
            className="h-10 appearance-none rounded-full border border-neutral-200 bg-white pl-4 pr-10 text-sm text-neutral-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="hidden items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 md:flex">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-500" />
          )}
          <Circle className={[ 'h-2.5 w-2.5 fill-current', connected ? 'text-emerald-500' : 'text-amber-500' ].join(' ')} />
          {connected ? '已连接' : '重连中'}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          onClick={onToggleContext}
          aria-label="切换上下文面板"
        >
          <PanelRightOpen className={[ 'h-5 w-5 transition-transform', contextOpen ? 'rotate-180' : '' ].join(' ')} />
        </button>
      </div>
    </header>
  );
}
