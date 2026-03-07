import React from 'react';
import { motion } from 'motion/react';
import { Input } from 'antd';
import type { InputProps } from 'antd';

interface ShakeInputProps extends InputProps {
  shake?: boolean;
}

/**
 * 带抖动动画的输入框
 * 用于表单验证失败时的视觉反馈
 */
export default function ShakeInput({ shake, ...props }: ShakeInputProps) {
  return (
    <motion.div
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      <Input {...props} />
    </motion.div>
  );
}
