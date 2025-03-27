import { NextApiRequest, NextApiResponse } from 'next';

// Base URL for the MCP server backend (internal only)
const MCP_BASE_URL = process.env.SERVER_MCP_BASE_URL || 'http://localhost:7002';

// Explicitly set response to be unstable (no auto-transform)
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

// Custom NextJS API route to handle streaming data from backend
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // This is critically important - it disables automatic response buffering
  // This ensures each chunk is sent immediately to the client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable nginx buffering if behind nginx
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  
  // Track if we've already responded
  let hasResponded = false;
  
  try {
    // Prepare headers for backend request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization as string;
    }

    if (req.headers['x-user-id']) {
      headers['X-User-ID'] = req.headers['x-user-id'] as string;
    }
    
    // Make the request to the backend
    const controller = new AbortController();
    
    // Handle client disconnection
    req.on('close', () => {
      controller.abort();
      console.log('Client closed connection');
    });
    
    const backendResponse = await fetch(`${MCP_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
      signal: controller.signal
    });

    // Check for backend errors
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', errorText);
      res.write(`data: ${JSON.stringify({error: `Backend error: ${backendResponse.status}`})}\n\n`);
      res.end();
      hasResponded = true;
      return;
    }
    
    // Get the backend stream
    const backendStream = backendResponse.body;
    if (!backendStream) {
      res.write('data: {"error": "No stream available from backend"}\n\n');
      res.end();
      hasResponded = true;
      return;
    }
    
    const reader = backendStream.getReader();
    const decoder = new TextDecoder();
    
    try {
      let buffer = '';
      
      // Process the stream chunk by chunk
      while (true) {
        // Get the next chunk
        const { value, done } = await reader.read();
        
        if (done) {
          // Send any remaining data in buffer
          if (buffer.length > 0) {
            res.write(buffer);
          }
          // End the response
          res.end();
          hasResponded = true;
          break;
        }
        
        // Decode the chunk
        const text = decoder.decode(value, { stream: true });
        buffer += text;
        
        // Process complete lines
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          // Extract a complete line
          const line = buffer.slice(0, newlineIndex + 1);
          buffer = buffer.slice(newlineIndex + 1);
          
          // Write the line to the client IMMEDIATELY
          res.write(line);
          
          // Log a message for each "data:" line for debugging
          if (line.startsWith('data:')) {
            console.log('Sent SSE event at:', new Date().toISOString());
          }
        }
      }
    } catch (e) {
      console.error('Stream processing error:', e);
      // Only try to respond if we haven't ended the response already
      if (!hasResponded) {
        res.write('data: {"error": "Stream processing error"}\n\n');
        res.end();
        hasResponded = true;
      }
    }
  } catch (error) {
    console.error('Proxy error:', error);
    // Only send error if we haven't responded yet
    if (!hasResponded) {
      res.write(`data: {"error": "Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`);
      res.end();
    }
  }
}
