import {
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeftClose,
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
  open,
  onClose,
  onCreate,
  onSelect,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <>
      <div
        className={[
          'fixed inset-0 z-30 bg-neutral-950/20 backdrop-blur-sm transition xl:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-neutral-200/70 bg-white/92 px-3 pb-3 pt-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform xl:static xl:z-auto xl:w-[280px] xl:translate-x-0 xl:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-2 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">智能分析助手</div>
              <div className="text-xs text-neutral-500">Professional AI Workspace</div>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 xl:hidden"
            onClick={onClose}
            aria-label="关闭会话栏"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <MessageSquarePlus className="h-4 w-4" />
          新建会话
        </button>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
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
                    'group rounded-2xl p-2 transition',
                    active ? 'bg-neutral-950 text-white shadow-sm' : 'hover:bg-neutral-100',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => onSelect(conversation.id)}
                  >
                    <div className="truncate text-sm font-medium">{conversation.title}</div>
                    <div className={['mt-1 line-clamp-2 text-xs', active ? 'text-neutral-300' : 'text-neutral-500'].join(' ')}>
                      {conversation.preview}
                    </div>
                    <div className={['mt-2 text-[11px]', active ? 'text-neutral-400' : 'text-neutral-400'].join(' ')}>
                      {formatConversationTime(conversation.updatedAt)}
                    </div>
                  </button>
                  <div className={['mt-2 flex items-center justify-end gap-1', active ? 'text-neutral-300' : 'text-neutral-400'].join(' ')}>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/5 hover:text-neutral-900"
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

        <div className="mt-3 border-t border-neutral-200/70 px-2 pt-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Settings2 className="h-4 w-4" />
            设置
          </button>
        </div>
      </aside>
    </>
  );
}
