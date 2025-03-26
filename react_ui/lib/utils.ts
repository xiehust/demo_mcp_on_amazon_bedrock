import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract thinking content from message and return cleaned content
 */
export function extractThinking(content: string): { thinking: string | null; cleanContent: string } {
  const thinkingRegex = /<thinking>(.*?)<\/thinking>/s;
  const match = content.match(thinkingRegex);
  
  if (match) {
    const thinking = match[1];
    // Remove the thinking tags and content from the main content
    const cleanContent = content.replace(thinkingRegex, '').trim();
    return { thinking, cleanContent };
  }
  
  return { thinking: null, cleanContent: content };
}

/**
 * Extract tool use information from message
 */
export function extractToolUse(content: string): { toolUse: any | null; cleanContent: string } {
  const toolUseRegex = /<tool_use>(.*?)<\/tool_use>/s;
  const match = content.match(toolUseRegex);
  
  if (match) {
    try {
      const toolUse = JSON.parse(match[1]);
      // Remove the tool use tags and content from the main content
      const cleanContent = content.replace(toolUseRegex, '').trim();
      return { toolUse, cleanContent };
    } catch (error) {
      console.error('Failed to parse tool use JSON:', error);
    }
  }
  
  return { toolUse: null, cleanContent: content };
}
