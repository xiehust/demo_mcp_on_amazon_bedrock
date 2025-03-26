import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
  thinking?: string
  toolUse?: any[]
}

export type Model = {
  modelName: string
  modelId: string
}

export type McpServer = {
  serverName: string
  serverId: string
  enabled: boolean
}

interface ChatStore {
  // Messages
  messages: Message[]
  addMessage: (message: Message) => void
  updateLastMessage: (content: string, thinking?: string, toolUse?: any[]) => void
  clearMessages: () => void
  
  // Settings
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
  maxTokens: number
  setMaxTokens: (tokens: number) => void
  temperature: number
  setTemperature: (temp: number) => void
  enableThinking: boolean
  setEnableThinking: (enabled: boolean) => void
  enableStream: boolean
  setEnableStream: (enabled: boolean) => void
  budgetTokens: number
  setBudgetTokens: (tokens: number) => void
  onlyNMostRecentImages: number
  setOnlyNMostRecentImages: (count: number) => void
  
  // Models
  models: Model[]
  setModels: (models: Model[]) => void
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  
  // MCP Servers
  mcpServers: McpServer[]
  setMcpServers: (servers: McpServer[]) => void
  toggleServerEnabled: (serverId: string) => void
  addMcpServer: (server: McpServer) => void
  removeMcpServer: (serverId: string) => void
  
  // User
  userId: string
  setUserId: (id: string) => void
}

export const useStore = create<ChatStore>()(
  persist(
    (set) => ({
      // Messages
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      updateLastMessage: (content, thinking, toolUse) => set((state) => {
        const messages = [...state.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content,
            ...(thinking !== undefined && { thinking }),
            ...(toolUse !== undefined && { toolUse })
          }
        }
        return { messages }
      }),
      clearMessages: () => set((state) => ({ 
        messages: [{ role: 'system', content: state.systemPrompt }] 
      })),
      
      // Settings
      systemPrompt: 'You are a helpful assistant.',
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      maxTokens: 4000,
      setMaxTokens: (tokens) => set({ maxTokens: tokens }),
      temperature: 0.7,
      setTemperature: (temp) => set({ temperature: temp }),
      enableThinking: false,
      setEnableThinking: (enabled) => set({ enableThinking: enabled }),
      enableStream: true,
      setEnableStream: (enabled) => set({ enableStream: enabled }),
      budgetTokens: 8192,
      setBudgetTokens: (tokens) => set({ budgetTokens: tokens }),
      onlyNMostRecentImages: 1,
      setOnlyNMostRecentImages: (count) => set({ onlyNMostRecentImages: count }),
      
      // Models
      models: [],
      setModels: (models) => set({ models }),
      selectedModel: '',
      setSelectedModel: (modelId) => set({ selectedModel: modelId }),
      
      // MCP Servers
      mcpServers: [],
      setMcpServers: (servers) => set({ mcpServers: servers }),
      toggleServerEnabled: (serverId) => set((state) => ({
        mcpServers: state.mcpServers.map(server => 
          server.serverId === serverId 
            ? { ...server, enabled: !server.enabled } 
            : server
        )
      })),
      addMcpServer: (server) => set((state) => ({
        mcpServers: [...state.mcpServers, server]
      })),
      removeMcpServer: (serverId) => set((state) => ({
        mcpServers: state.mcpServers.filter(server => server.serverId !== serverId)
      })),
      
      // User
      userId: '',
      setUserId: (id) => set({ userId: id })
    }),
    {
      name: 'mcp-chat-store',
    }
  )
)
