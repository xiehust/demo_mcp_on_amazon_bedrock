'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { createPortal } from 'react-dom';

export function ToolUsagePanel() {
  // Store expansion state with stable keys
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [modalContent, setModalContent] = useState<{tool: any, index: number} | null>(null);
  const { messages } = useStore();
  
  // Find all assistant messages with tool usage (not just the last one)
  const messagesWithToolUsage = useMemo(() => {
    return messages.filter(msg => 
      msg.role === 'assistant' && 
      msg.toolUse && 
      Array.isArray(msg.toolUse) && 
      msg.toolUse.length > 0
    ).slice(-1); // Only keep the most recent one
  }, [messages]);
  
  // Get all tool usage data from the message
  const toolUsage = useMemo(() => {
    if (messagesWithToolUsage.length === 0) return [];
    const message = messagesWithToolUsage[0];
    return message?.toolUse || [];
  }, [messagesWithToolUsage]);
  
  // Memoized toggle handler to prevent recreation on renders
  const handleToggle = useCallback((id: string, tool: any, index: number) => {
    setExpandedItems(prev => {
      const newState = { ...prev };
      newState[id] = !prev[id];
      return newState;
    });
    
    // If expanding, set modal content
    if (!expandedItems[id]) {
      setModalContent({ tool, index });
    } else {
      setModalContent(null);
    }
  }, [expandedItems]);
  
  // Close modal when clicking outside
  const closeModal = useCallback(() => {
    setModalContent(null);
    setExpandedItems({});
  }, []);
  
  return (
    <>
      <div className="p-4">
        {/* <h3 className="text-s font-medium mb-2">Tool Usage</h3> */}
        
        {toolUsage.length > 0 ? (
          <div className="space-y-4">
            {toolUsage.map((tool, index) => {
              // Create a stable key for each item
              const itemKey = `tool-${index}-${tool?.name || 'result'}`;
              
              return (
                <ToolUsageItem
                  key={itemKey}
                  tool={tool}
                  index={index}
                  itemId={itemKey}
                  isExpanded={!!expandedItems[itemKey]}
                  onToggle={() => handleToggle(itemKey, tool, index)}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 italic">
            No tool usage available
          </div>
        )}
      </div>
      
      {/* Modal for expanded tool content */}
      {modalContent && createPortal(
        <ToolResultModal
          tool={modalContent.tool}
          index={modalContent.index}
          onClose={closeModal}
        />,
        document.body
      )}
    </>
  );
}

interface ToolUsageItemProps {
  tool: any;
  index: number;
  itemId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolUsageItem({ tool, index, itemId, isExpanded, onToggle }: ToolUsageItemProps) {
  
  // Memoize these values to prevent recalculations
  const { isToolCall, title, toolDataString, images } = useMemo(() => {
    // Safely check if this is a tool call
    const isToolCall = Boolean(tool && tool.name);
    const title = isToolCall ? `Tool Call ${Math.floor(index/2) + 1}` : `Tool Result ${Math.floor(index/2) + 1}`;
    
    // Define a minimal type for content blocks
    interface ContentBlock {
      type?: string;
      text?: string;
      image?: {
        source?: {
          base64?: string;
        };
      };
      [key: string]: any; // Allow other properties
    }
    
    // Safely extract images
    let images: string[] = [];
    try {
      if (!isToolCall && tool && tool.content && Array.isArray(tool.content)) {
        images = tool.content
          .filter((block: ContentBlock) => block && block.image?.source?.base64)
          .map((block: ContentBlock) => block.image?.source?.base64 || '');
      }
    } catch (error) {
      console.error("Error extracting images:", error);
    }

    // Safely handle tool data without modifying the original
    let toolDataString = '{}';
    try {
      if (!tool) {
        toolDataString = '{}';
      } else {
        const formattedTool = {...tool};
        
        // Handle tool results with content array
        if (!isToolCall && formattedTool.content) {
          formattedTool.content = formattedTool.content.map((block: ContentBlock) => {
            if (!block) return block;
            
            // Clone the block to avoid modifying the original
            const blockCopy = {...block};
            
            // Handle images by replacing base64 data with placeholder
            if (blockCopy.image?.source?.base64) {
              blockCopy.image = {
                ...blockCopy.image,
                source: { base64: "[BASE64 IMAGE DATA - NOT DISPLAYED]" }
              };
            }
            
            return blockCopy;
          });
        }
        
        toolDataString = JSON.stringify(formattedTool, null, 2);
      }
    } catch (error) {
      console.error('Error formatting tool data:', error);
      toolDataString = JSON.stringify(tool, null, 2);
    }
    
    return { isToolCall, title, toolDataString, images };
  }, [tool, index]);

  
  return (
    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden" id={itemId}>
      <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3">
        <div className="text-s">
          {isToolCall ? (tool?.name || 'Unknown Tool') : 'Result'}
        </div>
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded-md"
        >
          {isExpanded ? '▼' : '►'} {title}
        </button>
      </div>
    </div>
  );
}

// Modal component for displaying expanded tool content
function ToolResultModal({ tool, index, onClose }: { tool: any, index: number, onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Handle escape key to close
  useEffect(() => {
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);
  
  // Memoize these values to prevent recalculations
  const { isToolCall, title, toolDataString, images } = useMemo(() => {
    // Safely check if this is a tool call
    const isToolCall = Boolean(tool && tool.name);
    const title = isToolCall ? `Tool Call ${Math.floor(index/2) + 1}` : `Tool Result ${Math.floor(index/2) + 1}`;
    
    // Define a minimal type for content blocks
    interface ContentBlock {
      type?: string;
      text?: string;
      image?: {
        source?: {
          base64?: string;
        };
      };
      [key: string]: any; // Allow other properties
    }
    
    // Safely extract images
    let images: string[] = [];
    try {
      if (!isToolCall && tool && tool.content && Array.isArray(tool.content)) {
        images = tool.content
          .filter((block: ContentBlock) => block && block.image?.source?.base64)
          .map((block: ContentBlock) => block.image?.source?.base64 || '');
      }
    } catch (error) {
      console.error("Error extracting images:", error);
    }

    // Safely handle tool data without modifying the original
    let toolDataString = '{}';
    try {
      if (!tool) {
        toolDataString = '{}';
      } else {
        const formattedTool = {...tool};
        
        // Handle tool results with content array
        if (!isToolCall && formattedTool.content) {
          formattedTool.content = formattedTool.content.map((block: ContentBlock) => {
            if (!block) return block;
            
            // Clone the block to avoid modifying the original
            const blockCopy = {...block};
            
            // Handle images by replacing base64 data with placeholder
            if (blockCopy.image?.source?.base64) {
              blockCopy.image = {
                ...blockCopy.image,
                source: { base64: "[BASE64 IMAGE DATA - NOT DISPLAYED]" }
              };
            }
            
            return blockCopy;
          });
        }
        
        toolDataString = JSON.stringify(formattedTool, null, 2);
      }
    } catch (error) {
      console.error('Error formatting tool data:', error);
      toolDataString = JSON.stringify(tool, null, 2);
    }
    
    return { isToolCall, title, toolDataString, images };
  }, [tool, index]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-3/4 max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Modal header */}
        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-lg">
            {isToolCall ? (tool?.name || 'Unknown Tool') : 'Result'} - {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* Modal content */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 rounded-md text-s p-4">
            <SyntaxHighlighter
              language="json"
              style={oneLight}
              codeTagProps={{ style: { whiteSpace: 'pre-wrap' } }}
              customStyle={{ background: 'transparent' }}
            >
              {toolDataString}
            </SyntaxHighlighter>
            
            {/* Display images if any */}
            {images.length > 0 && (
              <div className="mt-4 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
