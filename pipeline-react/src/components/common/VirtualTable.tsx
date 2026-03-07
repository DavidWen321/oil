import { useVirtualizer } from '@tanstack/react-virtual';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { useRef } from 'react';

interface VirtualTableProps<T> extends TableProps<T> {
  /**
   * 虚拟滚动容器高度
   */
  scrollHeight?: number;
  /**
   * 每行高度（用于计算虚拟滚动）
   */
  rowHeight?: number;
}

/**
 * 虚拟滚动表格组件
 * 基于 @tanstack/react-virtual 实现，支持大数据量渲染
 *
 * 使用示例：
 * <VirtualTable
 *   dataSource={largeDataset}
 *   columns={columns}
 *   scrollHeight={600}
 *   rowHeight={54}
 * />
 */
export default function VirtualTable<T extends { id?: number | string; key?: string | number }>({
  dataSource = [],
  scrollHeight = 600,
  rowHeight = 54,
  ...tableProps
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: dataSource.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const virtualDataSource = virtualItems.map((virtualRow) => dataSource[virtualRow.index]);

  return (
    <div
      ref={parentRef}
      style={{
        height: scrollHeight,
        overflow: 'auto',
      }}
    >
      <Table<T>
        {...tableProps}
        dataSource={virtualDataSource}
        pagination={false}
        scroll={{ y: scrollHeight }}
        components={{
          body: {
            wrapper: ({ children, ...props }: any) => (
              <tbody {...props}>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: paddingTop }} />
                  </tr>
                )}
                {children}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: paddingBottom }} />
                  </tr>
                )}
              </tbody>
            ),
          },
        }}
      />
    </div>
  );
}
