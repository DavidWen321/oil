import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { motion } from 'motion/react';
import styles from './ResponsiveTable.module.css';

interface ResponsiveTableProps<T> extends TableProps<T> {
  cardRender: (record: T, index: number) => ReactNode;
  breakpoint?: number;
}

export default function ResponsiveTable<T extends object>({
  cardRender,
  breakpoint = 640,
  dataSource,
  ...tableProps
}: ResponsiveTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCardMode, setIsCardMode] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCardMode(entry.contentRect.width < breakpoint);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [breakpoint]);

  return (
    <div ref={containerRef} className={styles.container}>
      {isCardMode ? (
        <div className={styles.cardList}>
          {(dataSource || []).map((record, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 24 }}
            >
              {cardRender(record, index)}
            </motion.div>
          ))}
        </div>
      ) : (
        <Table<T> dataSource={dataSource} {...tableProps} />
      )}
    </div>
  );
}
