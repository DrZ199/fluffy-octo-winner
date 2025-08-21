import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for Nelson Textbook data
export interface NelsonChunk {
  id: string;
  content: string;
  metadata: {
    chapter?: string;
    section?: string;
    page?: number;
    topic?: string;
  };
  embedding?: number[];
  created_at: string;
}

// Search function for Nelson Textbook content
export async function searchNelsonContent(query: string, limit: number = 10): Promise<NelsonChunk[]> {
  try {
    // Assuming the table is named 'nelson_chunks' - adjust as needed
    const { data, error } = await supabase
      .from('nelson_chunks')
      .select('*')
      .textSearch('content', query, {
        type: 'websearch',
        config: 'english'
      })
      .limit(limit);

    if (error) {
      console.error('Error searching Nelson content:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Semantic search using embeddings (if available)
export async function semanticSearch(query: string, embedding: number[], limit: number = 10): Promise<NelsonChunk[]> {
  try {
    // Use RPC function for vector similarity search
    const { data, error } = await supabase
      .rpc('match_nelson_chunks', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit
      });

    if (error) {
      console.error('Error in semantic search:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

// Get Nelson chapters/sections for navigation
export async function getNelsonStructure() {
  try {
    const { data, error } = await supabase
      .from('nelson_chunks')
      .select('metadata')
      .not('metadata->chapter', 'is', null);

    if (error) {
      console.error('Error getting Nelson structure:', error);
      throw error;
    }

    // Group by chapters and sections
    const structure = data.reduce((acc: Record<string, Set<string>>, item: any) => {
      const metadata = item.metadata as { chapter?: string; section?: string };
      const chapter = metadata?.chapter;
      const section = metadata?.section;
      
      if (chapter) {
        if (!acc[chapter]) {
          acc[chapter] = new Set();
        }
        if (section) {
          acc[chapter].add(section);
        }
      }
      
      return acc;
    }, {} as Record<string, Set<string>>);

    // Convert Sets to Arrays
    const result = Object.entries(structure).map(([chapter, sections]) => ({
      chapter,
      sections: Array.from(sections)
    }));

    return result;
  } catch (error) {
    console.error('Error getting structure:', error);
    return [];
  }
}