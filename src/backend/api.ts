// Nelson-GPT Backend API
// This would typically be deployed as a Cloudflare Worker or similar

import type { ChatMessage, MedicalContext } from '@/lib/ai';

// Environment variables interface
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  MISTRAL_API_KEY: string;
  HF_API_KEY: string;
}

// API request/response types
interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
}

interface ChatResponse {
  message: string;
  sources?: Array<{
    content: string;
    metadata: any;
  }>;
  sessionId: string;
}

interface SearchRequest {
  query: string;
  limit?: number;
}

interface MemoryRequest {
  sessionId: string;
  message: string;
  role: 'user' | 'assistant';
}

// CORS headers helper
function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return false;
  }
  
  if (limit.count >= 30) { // 30 requests per minute
    return true;
  }
  
  limit.count++;
  return false;
}

// Main API handler
export default {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const origin = request.headers.get('Origin') || '*';
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    
    // Rate limiting
    if (isRateLimited(clientIP)) {
      return Response.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: corsHeaders(origin) }
      );
    }
    
    try {
      // Health check endpoint
      if (url.pathname === '/api/health' && method === 'GET') {
        return Response.json(
          {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            service: 'nelson-gpt-api'
          },
          { headers: corsHeaders(origin) }
        );
      }
      
      // Chat endpoint - handles AI conversations
      if (url.pathname === '/api/chat' && method === 'POST') {
        const body = await request.json() as ChatRequest;
        
        if (!body.messages || !Array.isArray(body.messages)) {
          return Response.json(
            { error: 'Invalid request: messages array required' },
            { status: 400, headers: corsHeaders(origin) }
          );
        }
        
        // In a real implementation, this would:
        // 1. Search Supabase for relevant Nelson content
        // 2. Retrieve memory context
        // 3. Call Mistral API with context
        // 4. Stream response back
        // 5. Save conversation to memory
        
        // For now, return a mock response since the frontend handles this directly
        const mockResponse: ChatResponse = {
          message: 'This endpoint is handled directly by the frontend for demo purposes. In production, this would process the request server-side.',
          sessionId: body.sessionId || `session_${Date.now()}`,
          sources: []
        };
        
        return Response.json(mockResponse, { headers: corsHeaders(origin) });
      }
      
      // Knowledge search endpoint
      if (url.pathname === '/api/search' && method === 'POST') {
        const body = await request.json() as SearchRequest;
        
        if (!body.query) {
          return Response.json(
            { error: 'Invalid request: query required' },
            { status: 400, headers: corsHeaders(origin) }
          );
        }
        
        // Mock response - in production, this would search Supabase
        return Response.json(
          {
            results: [
              {
                id: '1',
                content: `Mock Nelson Textbook content related to: ${body.query}`,
                metadata: {
                  chapter: 'Sample Chapter',
                  section: 'Sample Section',
                  page: 123
                }
              }
            ],
            total: 1,
            query: body.query
          },
          { headers: corsHeaders(origin) }
        );
      }
      
      // Memory endpoint - handles conversation memory
      if (url.pathname === '/api/memory' && method === 'POST') {
        const body = await request.json() as MemoryRequest;
        
        if (!body.sessionId || !body.message || !body.role) {
          return Response.json(
            { error: 'Invalid request: sessionId, message, and role required' },
            { status: 400, headers: corsHeaders(origin) }
          );
        }
        
        // Mock response - in production, this would update memory system
        return Response.json(
          {
            success: true,
            memoryId: `memory_${Date.now()}`,
            sessionId: body.sessionId
          },
          { headers: corsHeaders(origin) }
        );
      }
      
      // Medical entity extraction endpoint
      if (url.pathname === '/api/extract-entities' && method === 'POST') {
        const body = await request.json() as { text: string };
        
        if (!body.text) {
          return Response.json(
            { error: 'Invalid request: text required' },
            { status: 400, headers: corsHeaders(origin) }
          );
        }
        
        // Mock entity extraction - in production, this would use HF API
        const mockEntities = [
          { entity: 'fever', label: 'SYMPTOM', confidence: 0.95 },
          { entity: 'pediatric', label: 'SPECIALTY', confidence: 0.89 },
          { entity: 'diagnosis', label: 'PROCEDURE', confidence: 0.76 }
        ];
        
        return Response.json(
          {
            entities: mockEntities.filter(e => 
              body.text.toLowerCase().includes(e.entity.toLowerCase())
            )
          },
          { headers: corsHeaders(origin) }
        );
      }
      
      // Statistics endpoint
      if (url.pathname === '/api/stats' && method === 'GET') {
        return Response.json(
          {
            totalChunks: 22000,
            totalConversations: 1250,
            totalMemories: 5680,
            activeUsers: 89,
            averageResponseTime: '1.2s',
            uptime: '99.9%'
          },
          { headers: corsHeaders(origin) }
        );
      }
      
      // Feedback endpoint
      if (url.pathname === '/api/feedback' && method === 'POST') {
        const body = await request.json();
        
        // Log feedback (in production, save to database)
        console.log('User feedback:', body);
        
        return Response.json(
          { success: true, message: 'Feedback received' },
          { headers: corsHeaders(origin) }
        );
      }
      
      // 404 for unmatched routes
      return Response.json(
        { 
          error: 'Endpoint not found',
          path: url.pathname,
          availableEndpoints: [
            'GET /api/health',
            'POST /api/chat',
            'POST /api/search', 
            'POST /api/memory',
            'POST /api/extract-entities',
            'GET /api/stats',
            'POST /api/feedback'
          ]
        },
        { status: 404, headers: corsHeaders(origin) }
      );
      
    } catch (error) {
      console.error('API Error:', error);
      
      return Response.json(
        { 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  }
};

// Export types for frontend use
export type { ChatRequest, ChatResponse, SearchRequest, MemoryRequest };