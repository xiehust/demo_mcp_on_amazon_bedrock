import { Message } from '../store/chatStore';

// Get environment variables with server/client detection
const getBaseUrl = () => {
  // Check if we're running on the server or client
  if (typeof window === 'undefined') {
    // Server-side: use internal URL
    return process.env.SERVER_MCP_BASE_URL || 'http://localhost:7002';
  } else {
    // Client-side: use public URL
    return process.env.NEXT_PUBLIC_MCP_BASE_URL || '';
  }
};

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

/**
 * Get authentication headers with user ID
 */
export const getAuthHeaders = (userId: string) => {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'X-User-ID': userId
  };
};

/**
 * Request list of available models
 */
export async function listModels(userId: string) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/v1/list/models`;
  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(userId)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error listing models:', error);
    return [];
  }
}

/**
 * Request list of MCP servers
 */
export async function listMcpServers(userId: string) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/v1/list/mcp_server`;
  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(userId)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP servers: ${response.status}`);
    }
    
    const data = await response.json();
    return data.servers || [];
  } catch (error) {
    console.error('Error listing MCP servers:', error);
    return [];
  }
}

/**
 * Add a new MCP server
 */
export async function addMcpServer(
  userId: string,
  serverId: string,
  serverName: string,
  command: string,
  args: string[] = [],
  env: Record<string, string> | null = null,
  configJson: Record<string, any> = {}
) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/v1/add/mcp_server`;
  
  try {
    const payload: any = {
      server_id: serverId,
      server_desc: serverName,
      command: command,
      args: args,
      config_json: configJson
    };
    
    if (env) {
      payload.env = env;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(userId),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    return {
      success: data.errno === 0,
      message: data.msg || 'Unknown error'
    };
  } catch (error) {
    console.error('Error adding MCP server:', error);
    return {
      success: false,
      message: 'Failed to add MCP server due to network error'
    };
  }
}

/**
 * Process streaming response from chat API
 */
export function processStreamResponse(
  response: Response,
  onContent: (content: string) => void,
  onToolUse: (toolUse: string) => void,
  onThinking: (thinking: string) => void,
  onError: (error: string) => void,
  onDone?: () => void
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let aborted = false;
  
  if (!reader) {
    onError('Response body is null');
    return { abort: () => {} };
  }
  
  // Create an abort function
  const abort = () => {
    aborted = true;
    // We need to actively cancel the reader to ensure stream processing stops
    reader.cancel().catch(err => console.error('Error canceling reader:', err));
  };
  
  const processChunk = async () => {
    if (aborted) {
      if (onDone) onDone();
      return;
    }
    try {
      // If already aborted before trying to read, exit immediately
      if (aborted) {
        if (onDone) onDone();
        return;
      }
      
      const { done, value } = await reader.read();
      
      // Check abort status again after read completes
      if (done || aborted) {
        if (onDone) onDone();
        return;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            // Stream is complete from server side, mark as aborted to stop processing
            aborted = true;
            if (onDone) {
              onDone();
            }
            return;
          }
          
          try {
            const jsonData = JSON.parse(data);
            const delta = jsonData.choices[0]?.delta || {};
            
            if ('content' in delta) {
              onContent(delta.content);
            }
            
            const messageExtras = jsonData.choices[0]?.message_extras || {};
            if ('tool_use' in messageExtras) {
              onToolUse(JSON.stringify(messageExtras.tool_use));
            }
            
            // Extract thinking content if present
            const content = jsonData.choices[0]?.delta?.content || '';
            const thinkingMatch = content.match(/<thinking>(.*?)<\/thinking>/s);
            if (thinkingMatch) {
              onThinking(thinkingMatch[1]);
            }
            
            // Check if message_extras contains thinking
            if (messageExtras && messageExtras.thinking) {
              onThinking(messageExtras.thinking);
            }
          } catch (e) {
            console.error('Failed to parse JSON:', data, e);
          }
        }
      }
      
      // Continue reading if not aborted
      if (!aborted) {
        processChunk();
      } else if (onDone) {
        onDone();
      }
    } catch (error) {
      if (!aborted) {
        onError(`Error processing stream: ${error}`);
      }
      if (onDone) onDone();
    }
  };
  
  processChunk();
  
  // Return abort function to allow stopping the stream
  return { abort };
}

/**
 * Stop an active streaming response
 */
export async function stopStream(userId: string, streamId: string) {
  // Don't attempt to stop if stream ID is empty
  if (!streamId) {
    console.warn('No stream ID provided to stop');
    return {
      success: false,
      message: 'No stream ID provided'
    };
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/v1/stop/stream/${streamId}`;
  
  try {
    const controller = new AbortController();
    // Set a timeout to prevent the stop request from hanging
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(userId),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Stream stop response not OK: ${response.status}`);
      // Still consider it a "success" for UI purposes, as we want to reset UI state
      return {
        success: true,
        message: 'Stream may have already completed'
      };
    }
    
    const data = await response.json();
    return {
      success: data.errno === 0 || data.msg === 'Stream may have already completed',
      message: data.msg || 'Unknown error'
    };
  } catch (error) {
    console.error('Error stopping stream:', error);
    // If there's a timeout or network error, still consider it a "success" for UI state
    return {
      success: true,
      message: 'Could not confirm stream stop, but UI has been reset'
    };
  }
}

/**
 * Send chat request to API
 */
export async function sendChatRequest({
  messages,
  modelId,
  mcpServerIds,
  userId,
  stream = true,
  maxTokens = 1024,
  temperature = 0.6,
  extraParams = {}
}: {
  messages: Message[];
  modelId: string;
  mcpServerIds: string[];
  userId: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  extraParams?: Record<string, any>;
}) {
  const baseUrl = getBaseUrl();
  
  const payload = {
    messages,
    model: modelId,
    mcp_server_ids: mcpServerIds,
    extra_params: extraParams,
    stream,
    temperature,
    max_tokens: maxTokens
  };
  
  try {
    if (stream) {
      // For streaming responses, use our dedicated streaming endpoint
      const streamUrl = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions-stream`;
      
      const headers = {
        ...getAuthHeaders(userId),
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      };
      
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Generate a unique stream ID if not provided in the response
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      return { response, messageExtras: {}, streamId };
    } else {
      // For non-streaming responses, use the standard endpoint
      const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(userId),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      const message = data.choices[0].message.content;
      const messageExtras = data.choices[0].message_extras || {};
      
      return { message, messageExtras };
    }
  } catch (error) {
    console.error('Error sending chat request:', error);
    return {
      message: 'An error occurred when calling the Converse operation: The system encountered an unexpected error during processing. Try your request again.',
      messageExtras: {}
    };
  }
}
