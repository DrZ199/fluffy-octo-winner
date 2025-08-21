// AI Service for Mistral and Hugging Face integration

const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
const HF_API_KEY = import.meta.env.VITE_HF_API_KEY;

if (!MISTRAL_API_KEY || !HF_API_KEY) {
  console.warn('Missing AI API keys');
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  id?: string;
}

export interface MedicalContext {
  nelsonChunks: Array<{
    content: string;
    metadata: {
      chapter?: string;
      section?: string;
      page?: number;
    };
  }>;
  memoryContext: string[];
  conversationHistory: ChatMessage[];
}

// Mistral API client
export async function generateMistralResponse(
  messages: ChatMessage[],
  context?: MedicalContext
): Promise<string> {
  try {
    // Build system prompt with medical context
    const systemPrompt = buildMedicalSystemPrompt(context);
    
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.3,
        max_tokens: 2000,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Mistral API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    console.error('Mistral API error:', error);
    throw error;
  }
}

// Streaming response for real-time chat
export async function* generateMistralStream(
  messages: ChatMessage[],
  context?: MedicalContext
): AsyncGenerator<string, void, unknown> {
  try {
    const systemPrompt = buildMedicalSystemPrompt(context);
    
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.3,
        max_tokens: 2000,
        top_p: 0.9,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Mistral streaming error:', error);
    throw error;
  }
}

// Hugging Face embedding function
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      body: JSON.stringify({
        inputs: text,
        options: {
          wait_for_model: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const embedding = await response.json();
    return Array.isArray(embedding) ? embedding : embedding.embeddings || [];
  } catch (error) {
    console.error('HuggingFace embedding error:', error);
    return [];
  }
}

// Medical entity extraction using HF
export async function extractMedicalEntities(text: string): Promise<Array<{ entity: string; label: string; confidence: number }>> {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/Clinical-AI-Apollo/Medical-NER', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      body: JSON.stringify({
        inputs: text,
        options: {
          wait_for_model: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Medical NER API error: ${response.status}`);
    }

    const entities = await response.json();
    return Array.isArray(entities) ? entities : [];
  } catch (error) {
    console.error('Medical NER error:', error);
    return [];
  }
}

// Build comprehensive medical system prompt
function buildMedicalSystemPrompt(context?: MedicalContext): string {
  let prompt = `You are Nelson-GPT, an advanced AI pediatric medical assistant based on Nelson Textbook of Pediatrics. You provide evidence-based medical information, diagnostic assistance, and treatment guidance for pediatric healthcare professionals.

CORE CAPABILITIES:
- Pediatric diagnosis and differential diagnosis
- Treatment recommendations based on current guidelines
- Drug dosing and safety information for children
- Medical decision support
- Educational content delivery

RESPONSE GUIDELINES:
- Always cite relevant Nelson Textbook sections when available
- Provide evidence-based recommendations
- Include differential diagnoses when appropriate
- Mention age-specific considerations
- Highlight critical safety information
- Use clear, professional medical language
- Include relevant dosing information when discussing medications

IMPORTANT LIMITATIONS:
- This is for educational and decision support only
- Always recommend clinical judgment and direct patient evaluation
- Do not replace professional medical judgment
- Emphasize the need for appropriate clinical context`;

  // Add Nelson Textbook context
  if (context?.nelsonChunks && context.nelsonChunks.length > 0) {
    prompt += '\n\nRELEVANT NELSON TEXTBOOK CONTENT:\n';
    context.nelsonChunks.forEach((chunk, index) => {
      prompt += `\n${index + 1}. ${chunk.metadata.chapter ? `[${chunk.metadata.chapter}` : '[Chapter Unknown'}${chunk.metadata.section ? ` - ${chunk.metadata.section}` : ''}]: ${chunk.content}`;
    });
  }

  // Add memory context
  if (context?.memoryContext && context.memoryContext.length > 0) {
    prompt += '\n\nRELEVANT CONVERSATION HISTORY:\n';
    context.memoryContext.forEach((memory, index) => {
      prompt += `\n${index + 1}. ${memory}`;
    });
  }

  prompt += '\n\nProvide a comprehensive, evidence-based response using the available information.';
  
  return prompt;
}

// Medical query classification
export async function classifyMedicalQuery(query: string): Promise<{
  category: string;
  confidence: number;
  entities: string[];
}> {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      body: JSON.stringify({
        inputs: `Classify this medical query: "${query}". Categories: diagnosis, treatment, medication, anatomy, physiology, emergency, general.`,
        options: { wait_for_model: true }
      })
    });

    if (!response.ok) {
      return {
        category: 'general',
        confidence: 0.5,
        entities: []
      };
    }

    // Simple classification logic - can be enhanced
    const lowerQuery = query.toLowerCase();
    let category = 'general';
    let confidence = 0.6;

    if (lowerQuery.includes('diagnos') || lowerQuery.includes('symptom')) {
      category = 'diagnosis';
      confidence = 0.8;
    } else if (lowerQuery.includes('treat') || lowerQuery.includes('therapy')) {
      category = 'treatment'; 
      confidence = 0.8;
    } else if (lowerQuery.includes('drug') || lowerQuery.includes('medication') || lowerQuery.includes('dose')) {
      category = 'medication';
      confidence = 0.8;
    } else if (lowerQuery.includes('emergency') || lowerQuery.includes('urgent') || lowerQuery.includes('acute')) {
      category = 'emergency';
      confidence = 0.9;
    }

    return {
      category,
      confidence,
      entities: []
    };
  } catch (error) {
    console.error('Query classification error:', error);
    return {
      category: 'general',
      confidence: 0.5,
      entities: []
    };
  }
}