'use client';

import { useMemo,useState } from 'react';
import { useStore } from '@/lib/store';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function ToolInputPanel() {
  const { messages } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get the latest assistant message with tool input
  const toolInput = useMemo(() => {
    try {
      const lastAssistantMessage = [...messages]
        .reverse()
        .find(msg => msg.role === 'assistant' && msg.toolInput);
      
      return lastAssistantMessage?.toolInput || '';
    } catch (error) {
      console.error("Error finding message with tool input:", error);
      return '';
    }
  }, [messages]);
  
  return (
    <div className="p-4">
      <h4 className="text-sx font-medium mb-2">Tool Input</h4>
      {toolInput ? (
        <div className="text-s bg-gray-50 border border-gray-200 rounded-md p-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between mb-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div className={`${isExpanded ? '' : 'max-h-[300px] overflow-auto'}`}>
            <SyntaxHighlighter
              language="json"
              style={oneLight}
              codeTagProps={{ style: { whiteSpace: 'pre-wrap' } }}

              customStyle={{ background: 'transparent' }}
            >
              {toolInput}
            </SyntaxHighlighter>
          </div>
        </div>
      ) : (
        <div className="text-s text-gray-500 dark:text-gray-400 italic">
          No tool input available
        </div>
      )}
    </div>
  );
}

