import { memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * 代码高亮组件 - 集成 react-syntax-highlighter
 * 支持多语言语法高亮，使用 One Dark 主题
 */
function CodeBlock({ inline, className, children, ...props }: CodeBlockProps) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  // 行内代码不高亮
  if (inline || !language) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  // 代码块高亮
  return (
    <SyntaxHighlighter
      style={oneDark as SyntaxHighlighterProps['style']}
      language={language}
      PreTag="div"
      customStyle={{
        margin: '12px 0',
        borderRadius: '8px',
        fontSize: '14px',
        lineHeight: '1.6',
      }}
      codeTagProps={{
        style: {
          fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
        },
      }}
    >
      {codeString}
    </SyntaxHighlighter>
  );
}

export default memo(CodeBlock);
