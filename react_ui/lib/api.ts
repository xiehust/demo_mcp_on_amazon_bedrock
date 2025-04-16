import { Model, McpServer, Message } from './store'

const API_KEY = process.env.NEXT_PUBLIC_API_KEY
// Use Next.js API routes instead of direct backend access to avoid CORS issues
const MCP_BASE_URL = process.env.NEXT_PUBLIC_MCP_BASE_URL

// Helper function to get auth headers
const getAuthHeaders = (userId: string) => {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'X-User-ID': userId,
    'Content-Type': 'application/json'
  }
}

// Get user ID from local storage with fallback
const getUserId = () => {
  let userId = localStorage.getItem('mcp_chat_user_id') || 'anonymous';
  
  // Check if the stored ID is a JSON object with mcp_chat_user_id key
  if (userId && userId.includes('{')) {
    try {
      const parsedId = JSON.parse(userId);
      if (parsedId && typeof parsedId === 'object' && parsedId.mcp_chat_user_id) {
        userId = parsedId.mcp_chat_user_id;
      }
    } catch (e) {
      // If parsing fails, use the original ID as is
    }
  }
  
  return userId;
}

// Fetch available models
export async function fetchModels(): Promise<Model[]> {
  try {
    const response = await fetch(`${MCP_BASE_URL}/v1/list/models`, {
      headers: getAuthHeaders(getUserId())
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }
    
    const data = await response.json()
    return data.models || []
  } catch (error) {
    console.error('Error fetching models:', error)
    return []
  }
}

// Fetch available MCP servers
export async function fetchMcpServers(): Promise<McpServer[]> {
  try {
    const response = await fetch(`${MCP_BASE_URL}/v1/list/mcp_server`, {
      headers: getAuthHeaders(getUserId())
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP servers: ${response.status}`)
    }
    
    const data = await response.json()
    return (data.servers || []).map((server: any) => ({
      serverName: server.server_name,
      serverId: server.server_id,
      enabled: false
    }))
  } catch (error) {
    console.error('Error fetching MCP servers:', error)
    return []
  }
}

// Remove an MCP server
export async function removeMcpServer(serverId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${MCP_BASE_URL}/v1/remove/mcp_server/${serverId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(getUserId())
    });
    
    const data = await response.json();
    return {
      success: data.errno === 0,
      message: data.msg || 'Unknown error'
    };
  } catch (error) {
    console.error('Error removing MCP server:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Add a new MCP server
export async function addMcpServer(
  serverId: string,
  serverName: string,
  command: string,
  args: string[] = [],
  env: Record<string, string> = {},
  configJson: Record<string, any> = {}
): Promise<{ success: boolean; message: string }> {
  try {
    const payload = {
      server_id: serverId,
      server_desc: serverName,
      command,
      args,
      env,
      config_json: configJson
    }
    
    const response = await fetch(`${MCP_BASE_URL}/v1/add/mcp_server`, {
      method: 'POST',
      headers: getAuthHeaders(getUserId()),
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    return {
      success: data.errno === 0,
      message: data.msg || 'Unknown error'
    }
  } catch (error) {
    console.error('Error adding MCP server:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Send a chat message and get response
export async function sendChatMessage(
  messages: Message[],
  modelId: string,
  mcpServerIds: string[],
  stream: boolean = true,
  maxTokens: number = 1024,
  temperature: number = 0.6,
  extraParams: Record<string, any> = {}
): Promise<Response | { content: string; extras: any }> {
  const payload = {
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    model: modelId,
    mcp_server_ids: mcpServerIds,
    extra_params: extraParams,
    stream,
    temperature,
    max_tokens: maxTokens
  }
  
  const userId = getUserId()
  
  if (stream) {
    // Return the stream response for client-side processing
    const headers = {
      ...getAuthHeaders(userId),
      'Accept': 'text/event-stream'
    }
    
    return fetch(`${MCP_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
  } else {
    // Process the response and return the content
    const response = await fetch(`${MCP_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`)
    }
    
    const data = await response.json()
    return {
      content: data.choices[0].message.content,
      extras: data.choices[0].message_extras || {}
    }
  }
}

// Generate a random user ID
export function generateRandomUserId(): string {
  const newId = Math.random().toString(36).substring(2, 10)
  // Ensure we always store a plain string, not a JSON object
  localStorage.setItem('mcp_chat_user_id', newId)
  return newId
}
