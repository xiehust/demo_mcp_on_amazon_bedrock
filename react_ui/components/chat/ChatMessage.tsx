'use client';

import { useState } from 'react';
import { Message } from '@/lib/store';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus,oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, File } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
  const [showThinking, setShowThinking] = useState(false);
  
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
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 rounded-md text-sm overflow-auto max-h-128">
                <pre className="whitespace-pre-wrap bg-gray-50 text-blue-600 dark:bg-gray-800 dark:text-blue-600 p-2 rounded">
                  {message.thinking}
                </pre>
              </div>
            )}
          </div>
        )}
        {/* Message Bubble */}
        <div className={cn(
          "rounded-lg px-4 py-3 shadow-sm",
          message.role === 'user' 
            ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100" 
            : "bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
        )}>
          {/* Structured Content or Markdown */}
          {typeof message.content === 'string' ? (
            // Regular markdown content
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
          ) : (
            // Structured content (array of ContentItem)
            <div className="space-y-4">
              {message.content.map((item, index) => (
                <div key={index}>
                  {/* Text content */}
                  {item.type === 'text' && item.text && (
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
                      {item.text}
                    </ReactMarkdown>
                  )}
                  
                  {/* Image content */}
                  {item.type === 'image_url' && item.image_url?.url && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-w-lg">
                      <img 
                        src={item.image_url.url}
                        alt="Attached image" 
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  )}
                  
                  {/* File content */}
                  {item.type === 'file' && item.file && (
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.file.filename || "Attached file"}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.file.file_id ? "File ID: " + item.file.file_id : "File attached"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && <span className="animate-pulse">▌</span>}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
