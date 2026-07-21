'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Check, Copy } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
}

const preprocessMarkdown = (text: string) => {
  if (!text) return '';
  // Convert \[ ... \] to $$ ... $$
  let processed = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  // Convert \( ... \) to $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  return processed;
};

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const processedContent = preprocessMarkdown(content);
  return (
    <div className="markdown-body wrap-break-word prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full border-collapse border border-gray-300 min-w-full divide-y divide-gray-200">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
          th: ({ children }) => (
            <th className="bg-gray-100 border border-gray-300 px-4 py-2.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-600">
              {children}
            </td>
          ),
          ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1 text-sm text-gray-700">{children}</ol>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1 text-sm text-gray-700">{children}</ul>,
          li: ({ children }) => <li className="my-1 leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-xl font-bold my-4 text-gray-900 border-b border-gray-100 pb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold my-3 text-gray-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold my-2 text-gray-900">{children}</h3>,
          p: ({ children }) => <p className="my-2 leading-relaxed text-sm text-gray-700 wrap-break-word whitespace-pre-wrap">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-markee-primary hover:text-red-700 underline font-medium transition-colors"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-200 pl-4 py-1 my-3 text-gray-500 italic bg-gray-50/50 rounded-r-md">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');

            if (inline || !match) {
              return (
                <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-xs font-mono font-semibold" {...props}>
                  {children}
                </code>
              );
            }

            return <CodeBlock language={language} code={codeString} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5 text-xs text-gray-300 font-mono">
        <span className="uppercase font-semibold text-gray-400">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-gray-700"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={language || 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.825rem',
            lineHeight: '1.5',
            backgroundColor: '#1e1e1e',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
