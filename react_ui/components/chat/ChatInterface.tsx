'use client';

import { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';

export default function ChatInterface() {
  const [showSettings, setShowSettings] = useState(false);
  const { userId, setUserId } = useStore();
  
  // Initialize userId if not set
  useEffect(() => {
    if (!userId) {
      // Check if user ID exists in localStorage
      const storedUserId = localStorage.getItem('mcp_chat_user_id');
      if (storedUserId) {
        setUserId(storedUserId);
      } else {
        // Generate new random user ID
        const newUserId = uuidv4().substring(0, 8);
        setUserId(newUserId);
        localStorage.setItem('mcp_chat_user_id', newUserId);
      }
    }
  }, [userId, setUserId]);
  
  return (
    <div className="flex flex-col h-full">
      
      {/* Main chat area with conditional settings panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat messages and input */}
        <div className={`flex flex-col flex-1 ${showSettings ? 'lg:flex-1' : 'w-full'}`}>
          {/* Message list */}
          <MessageList />
          
          {/* Chat input */}
          <ChatInput />
        </div>
        
      </div>
    
    </div>
  );
}
