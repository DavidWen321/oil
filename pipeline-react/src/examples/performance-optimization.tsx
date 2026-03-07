/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  React Performance Optimization Examples
 *  React 性能优化示例代码
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { memo, useMemo, useCallback, useState } from 'react';

// ============================================================================
// 1. React.memo - 避免不必要的重渲染
// ============================================================================

interface UserCardProps {
  name: string;
  email: string;
  avatar: string;
}

// 使用 memo 包裹组件，只有 props 变化时才重新渲染
export const UserCard = memo(({ name, email, avatar }: UserCardProps) => {
  console.log('UserCard rendered');

  return (
    <div className="user-card">
      <img src={avatar} alt={name} />
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  );
});

// 自定义比较函数（可选）
export const UserCardWithCustomCompare = memo(
  ({ name, email, avatar }: UserCardProps) => {
    return (
      <div className="user-card">
        <img src={avatar} alt={name} />
        <h3>{name}</h3>
        <p>{email}</p>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 返回 true 表示不重新渲染，false 表示重新渲染
    return (
      prevProps.name === nextProps.name &&
      prevProps.email === nextProps.email &&
      prevProps.avatar === nextProps.avatar
    );
  }
);

// ============================================================================
// 2. useMemo - 缓存计算结果
// ============================================================================

interface DataListProps {
  items: Array<{ id: number; value: number }>;
}

export function DataList({ items }: DataListProps) {
  // 缓存昂贵的计算结果
  const total = useMemo(() => {
    console.log('Calculating total...');
    return items.reduce((sum, item) => sum + item.value, 0);
  }, [items]); // 只有 items 变化时才重新计算

  const average = useMemo(() => {
    console.log('Calculating average...');
    return items.length > 0 ? total / items.length : 0;
  }, [items, total]);

  // 缓存过滤后的数据
  const highValueItems = useMemo(() => {
    console.log('Filtering high value items...');
    return items.filter((item) => item.value > 100);
  }, [items]);

  return (
    <div>
      <p>总计: {total}</p>
      <p>平均: {average.toFixed(2)}</p>
      <p>高价值项: {highValueItems.length}</p>
    </div>
  );
}

// ============================================================================
// 3. useCallback - 缓存函数引用
// ============================================================================

interface SearchBoxProps {
  onSearch: (query: string) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState('');

  // 缓存事件处理函数，避免子组件不必要的重渲染
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []); // 依赖为空，函数永远不变

  const handleSubmit = useCallback(() => {
    onSearch(query);
  }, [query, onSearch]); // 只有 query 或 onSearch 变化时才重新创建

  return (
    <div>
      <input type="text" value={query} onChange={handleChange} />
      <button onClick={handleSubmit}>搜索</button>
    </div>
  );
}

// ============================================================================
// 4. 组合使用 memo + useCallback
// ============================================================================

interface TodoItemProps {
  id: number;
  text: string;
  completed: boolean;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

// 使用 memo 避免父组件更新时重渲染
const TodoItem = memo(({ id, text, completed, onToggle, onDelete }: TodoItemProps) => {
  console.log(`TodoItem ${id} rendered`);

  return (
    <div className="todo-item">
      <input
        type="checkbox"
        checked={completed}
        onChange={() => onToggle(id)}
      />
      <span style={{ textDecoration: completed ? 'line-through' : 'none' }}>
        {text}
      </span>
      <button onClick={() => onDelete(id)}>删除</button>
    </div>
  );
});

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: '学习 React', completed: false },
    { id: 2, text: '优化性能', completed: false },
  ]);

  // 使用 useCallback 缓存回调函数
  const handleToggle = useCallback((id: number) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const handleDelete = useCallback((id: number) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  return (
    <div>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          {...todo}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}

// ============================================================================
// 5. 避免在渲染中创建新对象/数组
// ============================================================================

// ❌ 不好的做法
export function BadExample() {
  return (
    <UserCard
      name="张三"
      email="zhangsan@example.com"
      avatar="/avatar.jpg"
      // 每次渲染都创建新对象，导致 UserCard 重渲染
      // style={{ padding: 10 }}
    />
  );
}

// ✅ 好的做法
const userCardStyle = { padding: 10 }; // 提取到组件外部

export function GoodExample() {
  return (
    <UserCard
      name="张三"
      email="zhangsan@example.com"
      avatar="/avatar.jpg"
      // style={userCardStyle}
    />
  );
}

// ============================================================================
// 6. 使用 key 优化列表渲染
// ============================================================================

interface Item {
  id: string;
  name: string;
}

// ❌ 不好的做法：使用 index 作为 key
export function BadList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item.name}</li>
      ))}
    </ul>
  );
}

// ✅ 好的做法：使用唯一 ID 作为 key
export function GoodList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
