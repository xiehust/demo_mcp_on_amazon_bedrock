'use client';

import { useState } from 'react';
import { Message } from '@/lib/store';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus,oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [showToolUse, setShowToolUse] = useState(false);
  
  return (
    <div className={cn(
      "flex w-full items-start gap-4 py-4",
      message.role === 'user' ? "justify-start" : "justify-start"
    )}>
      {/* Avatar/Icon */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
        message.role === 'user' 
          ? "bg-blue-100 text-blue-900" 
          : "bg-white"
      )}>
        {message.role === 'user' ? '👤' : (
          <img 
            src="/bedrock.webp" 
            alt="Amazon Bedrock"
            className="h-full w-full object-cover rounded-md"
          />
        )}
      </div>
      
      {/* Message Content */}
      <div className={cn(
        "flex flex-col space-y-2 max-w-5xl",
        message.role === 'user' ? "items-start" : "items-start"
      )}>
        {/* Role Label */}
        <div className="text text-muted-foreground">
          {message.role === 'user' ? 'You' : 'Assistant'}
        </div>
        
        {/* Message Bubble */}
        <div className={cn(
          "rounded-lg px-4 py-3 shadow-sm",
          message.role === 'user' 
            ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100" 
            : "bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
        )}>
          {/* Markdown Content */}
          <ReactMarkdown
            className="prose prose-sm max-w-none dark:prose-invert"
            components={{
              code(props) {
                const { children, className, node, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                
                return isInline ? (
                  <code className={className} {...rest}>
                    {children}
                  </code>
                ) : (
                  <SyntaxHighlighter
                    // @ts-ignore - styles typing issue in react-syntax-highlighter
                    style={oneLight}
                    language={match?.[1] || 'text'}
                    PreTag="div"
                    {...rest}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                );
              }
            }}
          >
            {message.content + (isLoading ? '▌' : '')}
          </ReactMarkdown>
        </div>
        
        {/* Thinking Section (if available) */}
        {message.thinking && (
          <div className="w-full">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              {showThinking ? '▼' : '►'} Thinking
            </button>
            
            {showThinking && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 rounded-md text-sm overflow-auto max-h-64">
                <pre className="whitespace-pre-wrap text">
                  {message.thinking}
                </pre>
              </div>
            )}
          </div>
        )}
        
        {/* Tool Use Section (if available) */}
        {message.toolUse && message.toolUse.length > 0 && (
          <div className="w-full mt-2">
            <button
              onClick={() => setShowToolUse(!showToolUse)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 mb-1"
            >
              {showToolUse ? '▼' : '►'} Tool Usage
            </button>
            
            {showToolUse && (
              <div className="space-y-2">
                {message.toolUse.map((tool, index) => (
                  <ToolUseDisplay key={index} tool={tool} index={index} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolUseDisplay({ tool, index }: { tool: any, index: number }) {
  const [expanded, setExpanded] = useState(false);
  // Check if this is a tool call or result
  const isToolCall = tool.name;
  const title = isToolCall ? `Tool Call ${Math.floor(index/2) + 1}` : `Tool Result ${Math.floor(index/2) + 1}`;
  
  // Handle image display for tool results
  const images: string[] = [];
  if (!isToolCall && tool.content) {
    tool.content.forEach((block: any) => {
      if (block.image?.source?.base64) {
        images.push(block.image.source.base64);
      }
    });
  }

  let toolText = structuredClone(tool);
  if (!isToolCall && toolText.content) {
    toolText.content.forEach((block: any) => {
      if (block.image?.source?.base64) {
         //assign a new key to the image object
        block.image.source.base64 = "[BASE64 IMAGE DATA - NOT DISPLAYED]";
      }
    });
  }
  
  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded-md"
      >
        {expanded ? '▼' : '►'} {title}
      </button>
      
      {expanded && (
        <div className="mt-1 p-2 bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 rounded-md text-sm overflow-auto max-h-64">
          {/* <pre className="whitespace-pre-wrap">
            {JSON.stringify(tool, null, 2)}
          </pre> */}
          <pre className="whitespace-pre-wrap">
          <SyntaxHighlighter
              // @ts-ignore - styles typing issue in react-syntax-highlighter
              style={oneLight}
              language={'json'}
              PreTag="div"
            >
               {JSON.stringify(toolText, null, 2)}
          </SyntaxHighlighter>
          </pre>
          {/* Display images if any */}
          {images.length > 0 && (
            <div className="mt-2 space-y-2">
              {images.map((base64, i) => (
                <div key={i} className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                  <img 
                    src={`data:image/png;base64,${base64}`} 
                    alt={`Tool result image ${i}`}
                    className="max-w-full h-auto"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
