import {
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ChatConversation } from '../types';
import { formatConversationTime } from '../utils/chatUi';

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  open: boolean;
  onClose?: () => void;
  onCreate: () => void;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  open: _open,
  onClose: _onClose,
  onCreate,
  onSelect,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#f5f7fb_100%)] px-4 py-4">
      <div className="flex items-center gap-3 px-1 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_52%,#e2e8f0_100%)] text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.22)] ring-1 ring-white/80">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-900">智能分析助手</div>
          <div className="text-xs text-neutral-500">专业智能工作台</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] px-4 py-3 text-sm font-medium text-slate-800 shadow-[0_12px_24px_rgba(147,197,253,0.18)] transition hover:border-sky-300 hover:bg-[linear-gradient(135deg,#e0f2fe_0%,#dbeafe_100%)] hover:text-slate-900"
      >
        <MessageSquarePlus className="h-4 w-4" />
        新建会话
      </button>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
        <Search className="h-4 w-4" />
        <span>搜索会话</span>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-400">
          最近会话
        </div>
        <div className="space-y-1.5">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <div
                key={conversation.id}
                className={[
                  'group rounded-2xl border p-2 transition',
                  active
                    ? 'border-sky-200/90 bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(219,234,254,0.96)_100%)] text-slate-900 shadow-[0_12px_26px_rgba(148,163,184,0.16)]'
                    : 'border-transparent hover:bg-white/90',
                ].join(' ')}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => onSelect(conversation.id)}
                >
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className={['mt-1 line-clamp-2 text-xs', active ? 'text-slate-600' : 'text-neutral-500'].join(' ')}>
                    {conversation.preview}
                  </div>
                  <div className={['mt-2 text-[11px]', active ? 'text-slate-500' : 'text-neutral-400'].join(' ')}>
                    {formatConversationTime(conversation.updatedAt)}
                  </div>
                </button>
                <div className={['mt-2 flex items-center justify-end gap-1', active ? 'text-slate-500' : 'text-neutral-400'].join(' ')}>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/70 hover:text-neutral-900"
                    aria-label="更多"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label="删除会话"
                    onClick={() => onDelete(conversation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 border-t border-neutral-200/80 px-1 pt-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-neutral-600 transition hover:bg-white hover:text-neutral-900"
        >
          <Settings2 className="h-4 w-4" />
          设置
        </button>
      </div>
    </aside>
  );
}
