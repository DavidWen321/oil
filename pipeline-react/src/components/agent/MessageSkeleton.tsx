import { Skeleton } from 'antd';
import styles from './ChatMessage.module.css';

/**
 * 消息加载骨架屏
 * 用于 AI 响应加载时的占位显示
 */
export default function MessageSkeleton() {
  return (
    <div className={styles.assistantMsg}>
      <Skeleton
        active
        paragraph={{ rows: 3, width: ['100%', '90%', '60%'] }}
        title={false}
      />
    </div>
  );
}
