import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, Menu, BookOpen, Brain, Settings, History, Wifi, WifiOff, Sparkles, MessageCircle, Zap, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePWA } from '@/hooks/use-pwa';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { generateMistralStream, classifyMedicalQuery, type ChatMessage, type MedicalContext } from '@/lib/ai';
import { searchNelsonContent, type NelsonChunk } from '@/lib/supabase';
import { memoryManager } from '@/lib/memory';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  className?: string;
}

export default function ChatInterface({ className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 **Welcome to Nelson-GPT!**\n\nI\'m your advanced AI pediatric medical assistant powered by the complete Nelson Textbook of Pediatrics. I can help with:\n\n🔬 **Pediatric diagnosis** and differential diagnosis\n💊 **Treatment recommendations** and protocols\n📊 **Drug dosing** and safety information\n🧠 **Medical decision support**\n📚 **Educational content** and guidelines\n\nHow can I assist you today?',
      timestamp: new Date(),
      id: 'welcome'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Memory and context state
  const [sessionId, setSessionId] = useState<string>('');
  const [memoryStats, setMemoryStats] = useState({ totalMemories: 0, totalConversations: 0, categories: {} });
  
  // PWA features
  const { isOnline, isInstallable, install } = usePWA();

  useEffect(() => {
    // Start memory session
    const newSessionId = memoryManager.startSession();
    setSessionId(newSessionId);
    updateMemoryStats();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const updateMemoryStats = () => {
    setMemoryStats(memoryManager.getMemoryStats());
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      id: `user_${Date.now()}`
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Add user message to memory
      await memoryManager.addMessage('user', userMessage.content);

      // Classify the medical query
      const classification = await classifyMedicalQuery(userMessage.content);
      
      // Search Nelson textbook for relevant content
      const nelsonChunks = await searchNelsonContent(userMessage.content, 5);
      
      // Get relevant memories
      const memoryContext = memoryManager.getRelevantMemories(userMessage.content);

      // Build medical context
      const medicalContext: MedicalContext = {
        nelsonChunks: nelsonChunks.map(chunk => ({
          content: chunk.content,
          metadata: chunk.metadata
        })),
        memoryContext,
        conversationHistory: messages.slice(-10) // Last 10 messages for context
      };

      // Generate streaming response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        id: `assistant_${Date.now()}`
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Stream the response
      const stream = generateMistralStream([...messages, userMessage], medicalContext);
      
      for await (const chunk of stream) {
        assistantMessage.content += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id ? { ...msg, content: assistantMessage.content } : msg
        ));
      }

      // Add assistant response to memory
      await memoryManager.addMessage('assistant', assistantMessage.content);
      updateMemoryStats();

    } catch (error) {
      console.error('Error generating response:', error);
      
      // Show toast notification for errors
      if (!isOnline) {
        toast.error('You are offline. Please check your internet connection.');
      } else {
        toast.error('Failed to get response. Please try again.');
      }
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `⚠️ I apologize, but I encountered an error while processing your request. ${!isOnline ? 'You appear to be offline.' : 'This could be due to network issues or API service being temporarily unavailable.'} \n\nPlease try again in a moment.`,
        timestamp: new Date(),
        id: `error_${Date.now()}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        role: 'assistant',
        content: '👋 Hello! I\'m Nelson-GPT, your AI pediatric medical assistant. How can I assist you today?',
        timestamp: new Date(),
        id: 'welcome_new'
      }
    ]);
    // Start new memory session
    const newSessionId = memoryManager.startSession();
    setSessionId(newSessionId);
  };

  const conversationHistory = memoryManager.getConversationHistory();

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 ${className}`}>
      {/* Stunning Header with Multi-layer Gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/15 to-purple-500/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/5 dark:to-black/10" />
        <div className="relative flex items-center justify-between p-6 border-b border-border/30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative group hover:bg-gradient-to-br hover:from-blue-500/20 hover:to-purple-500/20 transition-all duration-500 hover:shadow-lg hover:shadow-blue-500/25 border border-transparent hover:border-blue-300/50 dark:hover:border-blue-400/30"
                >
                  <Menu size={20} className="transition-all duration-500 group-hover:scale-110 group-hover:rotate-180" />
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-400/30 to-purple-400/30 opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-96 bg-gradient-to-b from-white via-blue-50/50 to-indigo-100/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-r border-blue-200/50 dark:border-slate-700/50 backdrop-blur-xl">
                <SheetHeader className="pb-8">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 group-hover:shadow-purple-500/40 transition-all duration-500 group-hover:scale-110">
                        <Bot className="h-6 w-6 text-white transition-transform duration-500 group-hover:rotate-12" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-3 border-white shadow-lg">
                        <div className="absolute inset-1 bg-gradient-to-br from-green-300 to-emerald-400 rounded-full animate-pulse" />
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/40 to-purple-400/40 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                    </div>
                    <div className="space-y-1">
                      <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                        Nelson-GPT
                      </SheetTitle>
                      <p className="text-sm bg-gradient-to-r from-blue-500/80 to-indigo-500/80 dark:from-blue-400/80 dark:to-indigo-400/80 bg-clip-text text-transparent font-medium">
                        ✨ AI Medical Assistant
                      </p>
                    </div>
                  </div>
                </SheetHeader>
                
                <Tabs defaultValue="knowledge" className="mt-4">
                  <TabsList className="grid w-full grid-cols-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/30 dark:border-slate-600/30 shadow-lg">
                    <TabsTrigger 
                      value="knowledge" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/25 transition-all duration-300 hover:bg-blue-50 dark:hover:bg-slate-700"
                    >
                      <BookOpen size={16} className="mr-2" />
                      Knowledge
                    </TabsTrigger>
                    <TabsTrigger 
                      value="memory" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 transition-all duration-300 hover:bg-indigo-50 dark:hover:bg-slate-700"
                    >
                      <Brain size={16} className="mr-2" />
                      Memory
                    </TabsTrigger>
                    <TabsTrigger 
                      value="settings" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/25 transition-all duration-300 hover:bg-purple-50 dark:hover:bg-slate-700"
                    >
                      <Settings size={16} className="mr-2" />
                      Settings
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="knowledge" className="space-y-6 mt-6">
                    <div className="group">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-5 w-5 text-blue-500" />
                        <h3 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Knowledge Base</h3>
                      </div>
                      <div className="space-y-3">
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200/50 dark:border-blue-700/30 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-500 group-hover:scale-[1.02]">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                                <BookOpen className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-blue-900 dark:text-blue-100">Nelson Textbook of Pediatrics</div>
                                <div className="text-sm text-blue-700/80 dark:text-blue-300/80 mt-1">22,000+ comprehensive medical chunks</div>
                                <Badge className="mt-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                                  ✓ Real-time Search
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Button 
                          variant="outline" 
                          className="w-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border-blue-300/50 dark:border-blue-600/50 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Browse Medical Chapters
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="h-5 w-5 text-indigo-500" />
                        <h3 className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Quick Actions</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-auto p-3 bg-gradient-to-br from-red-50 to-pink-100 dark:from-red-900/20 dark:to-pink-900/20 border-red-200/50 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300"
                        >
                          <div className="text-center">
                            <div className="text-xs font-semibold text-red-700 dark:text-red-300">🩺 Diagnosis</div>
                            <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Differential</div>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-auto p-3 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200/50 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300"
                        >
                          <div className="text-center">
                            <div className="text-xs font-semibold text-green-700 dark:text-green-300">💊 Medications</div>
                            <div className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">Drug Info</div>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-auto p-3 bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200/50 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300"
                        >
                          <div className="text-center">
                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">📋 Guidelines</div>
                            <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Treatment</div>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-auto p-3 bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200/50 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                        >
                          <div className="text-center">
                            <div className="text-xs font-semibold text-orange-700 dark:text-orange-300">🚨 Emergency</div>
                            <div className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-1">Protocols</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="memory" className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">🧠 Memory System</h3>
                      <div className="space-y-2">
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Total Memories:</span>
                                <Badge variant="secondary">{memoryStats.totalMemories}</Badge>
                              </div>
                              <div className="flex justify-between">
                                <span>Conversations:</span>
                                <Badge variant="secondary">{memoryStats.totalConversations}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Memory Categories:</h4>
                          {Object.entries(memoryStats.categories).map(([category, count]) => (
                            <div key={category} className="flex justify-between text-sm">
                              <span className="capitalize">{category.replace('_', ' ')}:</span>
                              <Badge variant="outline">{String(count)}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">
                        <History size={16} className="inline mr-1" />
                        Recent Conversations
                      </h3>
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {conversationHistory.slice(0, 5).map((conv, index) => (
                            <Card key={conv.sessionId}>
                              <CardContent className="p-2">
                                <div className="text-xs text-muted-foreground">
                                  {conv.lastActivity.toLocaleDateString()}
                                </div>
                                <div className="text-sm font-medium truncate">
                                  {conv.keyTopics.slice(0, 3).join(', ') || 'General discussion'}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">⚙️ Settings</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Response Style</label>
                          <select className="w-full mt-1 p-2 border rounded">
                            <option>Detailed Medical</option>
                            <option>Concise Clinical</option>
                            <option>Educational</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Specialty Focus</label>
                          <select className="w-full mt-1 p-2 border rounded">
                            <option>General Pediatrics</option>
                            <option>Emergency Medicine</option>
                            <option>Cardiology</option>
                            <option>Neurology</option>
                            <option>Oncology</option>
                          </select>
                        </div>
                        
                        <Separator />
                        
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            memoryManager.clearMemories();
                            updateMemoryStats();
                            clearConversation();
                          }}
                        >
                          Clear All Memory
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </SheetContent>
            </Sheet>
          
            <div>
              <h1 className="font-bold text-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Nelson</h1>
            </div>
          </div>
        
          <div className="flex items-center gap-3">
            {/* Beautiful Status Indicators */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur border border-white/20 dark:border-slate-700/50 shadow-lg">
                {isOnline ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                    <Wifi size={12} className="text-green-500" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">Online</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-lg shadow-red-400/50" />
                    <WifiOff size={12} className="text-red-500" />
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">Offline</span>
                  </>
                )}
              </div>
              
              {/* Enhanced Install Button */}
              {isInstallable && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    install?.();
                    toast.success('🚀 Installing Nelson-GPT...');
                  }}
                  className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border-blue-300/50 dark:border-blue-600/50 hover:border-blue-400 text-blue-700 dark:text-blue-300 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 font-medium"
                >
                  📱 Install App
                </Button>
              )}
              
              <Badge className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300/50 dark:border-indigo-600/50 shadow-sm">
                🔐 Session: {sessionId.slice(-8)}
              </Badge>
              
              <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur rounded-lg border border-white/20 dark:border-slate-700/50 shadow-lg">
                <ThemeToggle />
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearConversation}
                className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 border-green-300/50 dark:border-green-600/50 hover:border-green-400 text-green-700 dark:text-green-300 hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300 font-medium"
              >
                ✨ New Chat
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Beautiful Messages with Animations */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-6 bg-gradient-to-b from-transparent to-blue-50/30 dark:to-slate-900/30">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex gap-4 animate-in slide-in-from-bottom-2 duration-500 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 group">
                  <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:shadow-purple-500/40 transition-all duration-500 group-hover:scale-110">
                    <Bot size={18} className="text-white transition-transform duration-500 group-hover:rotate-12" />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/50 to-purple-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                  </div>
                </div>
              )}
              
              <Card className={`max-w-[85%] border-0 shadow-xl transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] ${
                message.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white shadow-blue-500/30 hover:shadow-blue-500/40' 
                  : 'bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-800 dark:to-slate-700/50 shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-blue-200/30 dark:hover:shadow-blue-900/30'
              }`}>
                <CardContent className="p-5">
                  <div className={`prose prose-sm max-w-none transition-all duration-300 ${
                    message.role === 'user'
                      ? 'prose-invert text-white/95'
                      : 'dark:prose-invert prose-blue'
                  }`}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="space-y-1 ml-4">{children}</ul>,
                        li: ({ children }) => <li className="flex items-start gap-2"><span className="text-blue-500 dark:text-blue-400 mt-1.5">•</span><span>{children}</span></li>,
                        strong: ({ children }) => <strong className="font-semibold text-blue-700 dark:text-blue-300">{children}</strong>,
                        h3: ({ children }) => <h3 className="font-bold text-lg mb-2 text-blue-800 dark:text-blue-200">{children}</h3>
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.timestamp && (
                    <div className={`text-xs mt-3 flex items-center gap-1 opacity-70 ${
                      message.role === 'user' 
                        ? 'text-white/80' 
                        : 'text-muted-foreground'
                    }`}>
                      <span className="w-1 h-1 bg-current rounded-full" />
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {message.role === 'user' && (
                <div className="flex-shrink-0 group">
                  <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:shadow-teal-500/40 transition-all duration-500 group-hover:scale-110">
                    <User size={18} className="text-white transition-transform duration-500 group-hover:rotate-12" />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/50 to-teal-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 justify-start animate-in slide-in-from-bottom-2 duration-500">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30 animate-pulse">
                  <Bot size={18} className="text-white" />
                </div>
              </div>
              <Card className="bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-800 dark:to-slate-700/50 border-0 shadow-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Loader2 size={18} className="animate-spin text-blue-500" />
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                        🧠 Analyzing your medical query...
                      </span>
                      <div className="text-xs text-blue-500/80 dark:text-blue-400/80">
                        Searching Nelson Textbook & consulting medical knowledge
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Beautiful Input Area with Glass Effect */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-50/50 via-white/80 to-transparent dark:from-slate-900/50 dark:via-slate-800/80 backdrop-blur-xl" />
        <div className="relative p-6 border-t border-blue-200/30 dark:border-slate-700/30">
          <div className="flex gap-4 max-w-4xl mx-auto">
            <div className="relative flex-1 group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-all duration-500 blur-xl" />
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="🩺 Ask about pediatric medicine, diagnosis, treatment protocols..."
                className="relative h-14 px-6 text-base bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-2 border-blue-200/50 dark:border-slate-600/50 focus:border-blue-400 dark:focus:border-blue-500 rounded-2xl shadow-xl shadow-blue-500/5 focus:shadow-blue-500/20 transition-all duration-500 placeholder:text-blue-400/70 dark:placeholder:text-blue-400/50"
                disabled={isLoading}
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 disabled:from-gray-300 disabled:via-gray-400 disabled:to-gray-500 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 disabled:shadow-gray-400/20 transition-all duration-500 hover:scale-110 disabled:hover:scale-100 group"
            >
              {isLoading ? (
                <div className="relative">
                  <Loader2 size={20} className="animate-spin text-white" />
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                </div>
              ) : (
                <Send size={20} className="text-white transition-transform duration-300 group-hover:translate-x-1" />
              )}
            </Button>
          </div>
          <div className="text-center mt-4 max-w-4xl mx-auto">
            <p className="text-sm bg-gradient-to-r from-blue-600/80 via-indigo-600/80 to-purple-600/80 dark:from-blue-400/80 dark:via-indigo-400/80 dark:to-purple-400/80 bg-clip-text text-transparent font-medium">
              ⚡ Powered by Nelson Textbook • 🧠 Advanced AI • 🔒 For educational and decision support only
            </p>
            <p className="text-xs text-blue-500/60 dark:text-blue-400/60 mt-1">
              Always use professional clinical judgment in patient care decisions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}