// Memory system for Nelson-GPT - simplified Memori-like functionality

export interface MemoryEntry {
  id: string;
  content: string;
  category: 'medical_fact' | 'case_context' | 'user_preference' | 'clinical_rule' | 'conversation';
  importance: number; // 0-1 scale
  timestamp: Date;
  tags: string[];
  metadata: {
    patient_age?: string;
    medical_specialty?: string;
    diagnosis?: string;
    treatment?: string;
    source?: 'nelson' | 'conversation' | 'user_input';
  };
}

export interface ConversationMemory {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    memories: string[]; // IDs of memories created from this message
  }>;
  summary: string;
  keyTopics: string[];
  startTime: Date;
  lastActivity: Date;
}

class MemoryManager {
  private memories: Map<string, MemoryEntry> = new Map();
  private conversations: Map<string, ConversationMemory> = new Map();
  private currentSessionId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  // Start a new conversation session
  startSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSessionId = sessionId;
    
    const conversation: ConversationMemory = {
      sessionId,
      messages: [],
      summary: '',
      keyTopics: [],
      startTime: new Date(),
      lastActivity: new Date()
    };
    
    this.conversations.set(sessionId, conversation);
    this.saveToStorage();
    return sessionId;
  }

  // Add a message to current session and extract memories
  async addMessage(role: 'user' | 'assistant', content: string): Promise<string[]> {
    if (!this.currentSessionId) {
      this.startSession();
    }

    const conversation = this.conversations.get(this.currentSessionId!);
    if (!conversation) return [];

    const memories = await this.extractMemoriesFromContent(content, role);
    const memoryIds = memories.map(m => m.id);

    conversation.messages.push({
      role,
      content,
      timestamp: new Date(),
      memories: memoryIds
    });

    conversation.lastActivity = new Date();
    
    // Update conversation summary and topics
    if (conversation.messages.length % 10 === 0) {
      await this.updateConversationSummary(conversation);
    }

    this.saveToStorage();
    return memoryIds;
  }

  // Extract memories from content using simple NLP
  private async extractMemoriesFromContent(content: string, role: 'user' | 'assistant'): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];
    const lowerContent = content.toLowerCase();

    // Extract medical facts
    if (role === 'assistant' && (lowerContent.includes('diagnosis') || lowerContent.includes('treatment') || lowerContent.includes('medication'))) {
      const memory: MemoryEntry = {
        id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content,
        category: 'medical_fact',
        importance: 0.8,
        timestamp: new Date(),
        tags: this.extractTags(content),
        metadata: {
          source: 'conversation',
          medical_specialty: this.inferSpecialty(content)
        }
      };
      memories.push(memory);
      this.memories.set(memory.id, memory);
    }

    // Extract user preferences
    if (role === 'user' && (lowerContent.includes('prefer') || lowerContent.includes('always') || lowerContent.includes('never'))) {
      const memory: MemoryEntry = {
        id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content,
        category: 'user_preference',
        importance: 0.9,
        timestamp: new Date(),
        tags: this.extractTags(content),
        metadata: {
          source: 'user_input'
        }
      };
      memories.push(memory);
      this.memories.set(memory.id, memory);
    }

    // Extract case context
    if (lowerContent.includes('patient') || lowerContent.includes('case') || lowerContent.includes('year old')) {
      const memory: MemoryEntry = {
        id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content,
        category: 'case_context',
        importance: 0.7,
        timestamp: new Date(),
        tags: this.extractTags(content),
        metadata: {
          source: 'conversation',
          patient_age: this.extractAge(content)
        }
      };
      memories.push(memory);
      this.memories.set(memory.id, memory);
    }

    return memories;
  }

  // Search memories by query
  searchMemories(query: string, limit: number = 10): MemoryEntry[] {
    const lowerQuery = query.toLowerCase();
    const searchTerms = lowerQuery.split(' ').filter(term => term.length > 2);
    
    const scored = Array.from(this.memories.values()).map(memory => {
      let score = 0;
      const lowerContent = memory.content.toLowerCase();
      
      // Exact phrase match
      if (lowerContent.includes(lowerQuery)) {
        score += 10;
      }
      
      // Individual term matches
      searchTerms.forEach(term => {
        if (lowerContent.includes(term)) {
          score += 2;
        }
        if (memory.tags.some(tag => tag.toLowerCase().includes(term))) {
          score += 3;
        }
      });
      
      // Boost by importance and recency
      score *= memory.importance;
      const daysSinceCreated = (Date.now() - memory.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      score *= Math.max(0.1, 1 - (daysSinceCreated / 30)); // Decay over 30 days
      
      return { memory, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  // Get relevant memories for current context
  getRelevantMemories(query: string, currentContext?: string): string[] {
    const memories = this.searchMemories(query, 5);
    
    // Add recent conversation context
    if (this.currentSessionId) {
      const conversation = this.conversations.get(this.currentSessionId);
      if (conversation && conversation.summary) {
        return [conversation.summary, ...memories.map(m => m.content)];
      }
    }
    
    return memories.map(m => m.content);
  }

  // Extract tags from content
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Medical specialties
    const specialties = ['cardiology', 'neurology', 'oncology', 'endocrinology', 'gastroenterology', 'pulmonology', 'nephrology', 'infectious', 'emergency'];
    specialties.forEach(specialty => {
      if (lowerContent.includes(specialty)) {
        tags.push(specialty);
      }
    });
    
    // Common medical terms
    const medicalTerms = ['diagnosis', 'treatment', 'medication', 'symptom', 'syndrome', 'disease', 'therapy', 'surgery', 'procedure'];
    medicalTerms.forEach(term => {
      if (lowerContent.includes(term)) {
        tags.push(term);
      }
    });
    
    // Age groups
    const ageGroups = ['newborn', 'infant', 'toddler', 'child', 'adolescent', 'pediatric'];
    ageGroups.forEach(age => {
      if (lowerContent.includes(age)) {
        tags.push(age);
      }
    });
    
    return tags;
  }

  // Infer medical specialty from content
  private inferSpecialty(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('heart') || lowerContent.includes('cardiac')) return 'cardiology';
    if (lowerContent.includes('brain') || lowerContent.includes('neuro')) return 'neurology';
    if (lowerContent.includes('cancer') || lowerContent.includes('tumor')) return 'oncology';
    if (lowerContent.includes('diabetes') || lowerContent.includes('hormone')) return 'endocrinology';
    if (lowerContent.includes('stomach') || lowerContent.includes('intestin')) return 'gastroenterology';
    if (lowerContent.includes('lung') || lowerContent.includes('respiratory')) return 'pulmonology';
    if (lowerContent.includes('kidney') || lowerContent.includes('renal')) return 'nephrology';
    if (lowerContent.includes('infection') || lowerContent.includes('bacteria')) return 'infectious disease';
    if (lowerContent.includes('emergency') || lowerContent.includes('urgent')) return 'emergency medicine';
    
    return 'general pediatrics';
  }

  // Extract age from content
  private extractAge(content: string): string | undefined {
    const ageMatches = content.match(/(\d+)\s*(year|month|week|day)s?\s*old/i);
    if (ageMatches) {
      return `${ageMatches[1]} ${ageMatches[2]}${ageMatches[1] !== '1' ? 's' : ''} old`;
    }
    
    const ageTerms = ['newborn', 'infant', 'toddler', 'preschooler', 'school-age', 'adolescent'];
    for (const term of ageTerms) {
      if (content.toLowerCase().includes(term)) {
        return term;
      }
    }
    
    return undefined;
  }

  // Update conversation summary
  private async updateConversationSummary(conversation: ConversationMemory): Promise<void> {
    const recentMessages = conversation.messages.slice(-10);
    const content = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    // Simple summarization - in a real app, you'd use an AI model
    conversation.summary = `Recent discussion about ${this.extractKeyTopicsFromMessages(recentMessages).join(', ')}`;
    conversation.keyTopics = this.extractKeyTopicsFromMessages(conversation.messages);
  }

  // Extract key topics from messages
  private extractKeyTopicsFromMessages(messages: Array<{ content: string }>): string[] {
    const allContent = messages.map(m => m.content).join(' ').toLowerCase();
    const topics: string[] = [];
    
    // Medical conditions
    const conditions = ['fever', 'cough', 'asthma', 'diabetes', 'seizure', 'infection', 'rash', 'pain'];
    conditions.forEach(condition => {
      if (allContent.includes(condition)) {
        topics.push(condition);
      }
    });
    
    return [...new Set(topics)]; // Remove duplicates
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      const data = {
        memories: Array.from(this.memories.entries()),
        conversations: Array.from(this.conversations.entries()),
        currentSessionId: this.currentSessionId
      };
      localStorage.setItem('nelson-gpt-memory', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save memory to storage:', error);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('nelson-gpt-memory');
      if (stored) {
        const data = JSON.parse(stored);
        this.memories = new Map(data.memories || []);
        this.conversations = new Map(data.conversations || []);
        this.currentSessionId = data.currentSessionId;
        
        // Convert string dates back to Date objects
        this.memories.forEach(memory => {
          memory.timestamp = new Date(memory.timestamp);
        });
        
        this.conversations.forEach(conversation => {
          conversation.startTime = new Date(conversation.startTime);
          conversation.lastActivity = new Date(conversation.lastActivity);
          conversation.messages.forEach(message => {
            message.timestamp = new Date(message.timestamp);
          });
        });
      }
    } catch (error) {
      console.error('Failed to load memory from storage:', error);
    }
  }

  // Get memory statistics
  getMemoryStats(): { totalMemories: number; totalConversations: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};
    this.memories.forEach(memory => {
      categories[memory.category] = (categories[memory.category] || 0) + 1;
    });
    
    return {
      totalMemories: this.memories.size,
      totalConversations: this.conversations.size,
      categories
    };
  }

  // Clear all memories
  clearMemories(): void {
    this.memories.clear();
    this.conversations.clear();
    this.currentSessionId = null;
    this.saveToStorage();
  }

  // Get current session ID
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  // Get conversation history
  getConversationHistory(): ConversationMemory[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();