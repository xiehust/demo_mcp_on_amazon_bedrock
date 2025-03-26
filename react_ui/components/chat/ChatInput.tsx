'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useStore, Message } from '@/lib/store';
import { sendChatRequest, processStreamResponse, stopStream } from '@/lib/api/chat';
import { extractThinking, extractToolUse } from '@/lib/utils';

export function ChatInput() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const abortControllerRef = useRef<{ abort: () => void } | null>(null);
  
  const {
    messages,
    addMessage,
    updateLastMessage,
    userId,
    selectedModel,
    models,
    mcpServers,
    enableStream,
    enableThinking,
    maxTokens,
    temperature,
    budgetTokens,
    onlyNMostRecentImages
  } = useStore();
  
  // Get selected server IDs from mcpServers
  const selectedServers = mcpServers
    .filter(server => server.enabled)
    .map(server => server.serverId);
    
  // Get model ID from selected model name
  const modelId = selectedModel;
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleStopGeneration = async () => {
    // First try local abort to stop the stream processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Then call server-side stop to terminate the stream
    if (!currentStreamId || !userId) {
      // Even if we don't have streamId/userId, make sure UI is reset
      setIsStreaming(false);
      setCurrentStreamId(null);
      return;
    }
    
    try {
      const result = await stopStream(userId, currentStreamId);
      if (result.success) {
        console.log('Stream stopped successfully');
      } else {
        console.error('Failed to stop stream:', result.message);
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
    } finally {
      setIsStreaming(false);
      setCurrentStreamId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim() || isLoading || !selectedModel) return;
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: prompt };
    addMessage(userMessage);
    
    // Clear input
    setPrompt('');
    setIsLoading(true);
    
    try {
      // We already have the modelId from our store
      
      // Prepare messages for API
      const apiMessages = [...messages, userMessage];
      
      // Extra parameters
      const extraParams = {
        only_n_most_recent_images: onlyNMostRecentImages,
        budget_tokens: budgetTokens,
        enable_thinking: enableThinking
      };
      
      // Send chat request
      if (enableStream) {
        // Handle streaming response
        const { response, streamId } = await sendChatRequest({
          messages: apiMessages,
          modelId,
          mcpServerIds: selectedServers,
          userId,
          stream: true,
          maxTokens,
          temperature,
          extraParams
        });
        
        if (response) {
          let fullResponse = '';
          let fullThinking = '';
          let toolUseData: any[] = [];
          
          // Set streaming state and save stream ID
          setIsStreaming(true);
          setCurrentStreamId(streamId);
          
          // Add initial empty assistant message that will be updated with streaming content
          addMessage({ role: 'assistant', content: '' });
          
          // Process streaming response
          // Store abort controller reference
          const controller = processStreamResponse(
            response,
            // Content handler
            (content) => {
              fullResponse += content;
              // Extract thinking and tool use from content
              const { thinking, cleanContent: contentAfterThinking } = extractThinking(fullResponse);
              fullResponse = contentAfterThinking;
              fullThinking += thinking??"";
              // Update message with content and thinking if available
              updateLastMessage(
                contentAfterThinking || '', 
                fullThinking.trim() ? fullThinking : undefined
              );
            },
            // Tool use handler
            (toolUse) => {
              try {
                const toolUseJson = JSON.parse(JSON.parse(toolUse));
                if (Array.isArray(toolUseJson)) {
                  toolUseData = toolUseJson;
                  // console.log("toolUseData:", toolUseJson);

                  // Update last assistant message with tool use data
                // Update last message with tool use data
                // Keep existing content but add tool use
                const { messages } = useStore.getState();
                const lastMessageIndex = messages.length - 1;
                if (lastMessageIndex >= 0 && messages[lastMessageIndex].role === 'assistant') {
                  const currentContent = messages[lastMessageIndex].content;
                  updateLastMessage(
                    currentContent || '', 
                    undefined, 
                    [ ...messages[lastMessageIndex].toolUse || [], ...toolUseData]);
                }
                  // console.log("messages:", messages);
                }
              } catch (error) {
                console.error('Failed to parse tool use data:', error);
              }
            },
              // Thinking handler - directly sent from server, not extracted from content
              (thinking) => {
                if (thinking && thinking.trim()) {
                  const { messages } = useStore.getState();
                  const lastMessageIndex = messages.length - 1;
                  if (lastMessageIndex >= 0 && messages[lastMessageIndex].role === 'assistant') {
                    const currentContent = messages[lastMessageIndex].content;
                    updateLastMessage(currentContent, thinking);
                  }
                }
              },
            // Error handler
            (error) => {
              console.error('Stream error:', error);
              addMessage({ 
                role: 'assistant', 
                content: 'An error occurred while processing your request.' 
              });
              setIsStreaming(false);
              setCurrentStreamId(null);
              abortControllerRef.current = null;
            },
            // Done handler
            () => {
              setIsStreaming(false);
              setCurrentStreamId(null);
              abortControllerRef.current = null;
            }
          );
          
          // Store the abort controller
          abortControllerRef.current = controller;
        }
      } else {
        // Handle non-streaming response
        const { message, messageExtras } = await sendChatRequest({
          messages: apiMessages,
          modelId,
          mcpServerIds: selectedServers,
          userId,
          stream: false,
          maxTokens,
          temperature,
          extraParams
        });
        
        // Extract thinking from message
        const { thinking, cleanContent: contentAfterThinking } = extractThinking(message);
        
        // Extract tool use from content
        const { toolUse: extractedToolUse, cleanContent } = extractToolUse(contentAfterThinking);
        
        // Combine extracted tool use with any from messageExtras
        let toolUseData = extractedToolUse ? 
          (Array.isArray(extractedToolUse) ? extractedToolUse : [extractedToolUse]) : 
          [];
          
        // Add tool use from messageExtras if available
        if (messageExtras && messageExtras.tool_use) {
          try {
            const extraToolUse = messageExtras.tool_use;
            if (Array.isArray(extraToolUse) && extraToolUse.length > 0) {
              toolUseData = [...toolUseData, ...extraToolUse];
            }
          } catch (error) {
            console.error('Failed to parse tool use data:', error);
          }
        }
        
        // Add assistant message with tool use data if available
        addMessage({ 
          role: 'assistant', 
          content: cleanContent,
          thinking: thinking || undefined,
          toolUse: toolUseData
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({ 
        role: 'assistant', 
        content: 'An error occurred while processing your request.' 
      });
    } finally {
      setIsLoading(false);
      // Only reset streaming state for non-streaming requests or errors
      if (!enableStream) {
        setIsStreaming(false);
        setCurrentStreamId(null);
        abortControllerRef.current = null;
      }
    }
  };
  
  return (
    <div className="p-4 border-t">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <div className="relative flex-1">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your message..."
          className="w-full p-3 pr-12 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[60px]"
          rows={1}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
      </div>
      
      {isStreaming ? (
        <Button 
          type="button"
          onClick={handleStopGeneration}
          className="h-10 bg-red-500 hover:bg-red-600"
        >
          Stop
        </Button>
      ) : (
        <Button 
          type="submit" 
          disabled={isLoading || !prompt.trim() || !selectedModel}
          className="h-10"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
      )}
      </form>
    </div>
  );
}
