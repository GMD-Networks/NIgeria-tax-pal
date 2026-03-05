import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Send, Sparkles, UserCheck, Pencil, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { API_BASE } from '@/services/api';
import { UsageLimitGate } from '@/components/subscription/UsageLimitGate';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  senderType?: 'user' | 'consultant' | 'ai' | 'system';
}

interface ChatMessageRow {
  id: string;
  sender_type: 'user' | 'consultant' | 'ai' | 'system';
  content: string;
  created_at: string;
}

interface ChatSessionRow {
  consultant_typing?: boolean;
  status?: 'open' | 'closed';
}

interface RealtimePayload<T> {
  new: T;
}

type ChatMode = 'ai' | 'expert';

const CHAT_URL = `${API_BASE}/functions/tax-ai-chat`;

const Chat = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { 
    canUse, 
    currentUsage, 
    limit, 
    isUnlimited, 
    isLoading: usageLoading,
    incrementUsage 
  } = useFeatureUsage('chat');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Tax Assistant. Ask me any tax question and I'll give you a quick answer. For detailed personalized advice, chat directly with our consultant!",
      timestamp: new Date(),
      senderType: 'ai',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('ai');
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [showExpertPrompt, setShowExpertPrompt] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [hasTrackedUsage, setHasTrackedUsage] = useState(false);
  const [consultantTyping, setConsultantTyping] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [chatStatus, setChatStatus] = useState<'open' | 'closed'>('open');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    t('chat.suggestions.paye'),
    t('chat.suggestions.wht'),
    t('chat.suggestions.deadline'),
    t('chat.suggestions.exemptions'),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show expert prompt after 2 user messages
  useEffect(() => {
    if (userMessageCount >= 2 && chatMode === 'ai' && !showExpertPrompt) {
      setShowExpertPrompt(true);
    }
  }, [userMessageCount, chatMode, showExpertPrompt]);

  const loadExistingMessages = useCallback(async () => {
    try {
      const { data: existingMessages, error } = await backendApi
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const existingMessageRows = (existingMessages as ChatMessageRow[] | null) || [];
      if (existingMessageRows.length > 0) {
        const formattedMessages: Message[] = existingMessageRows.map(msg => ({
          id: msg.id,
          role: msg.sender_type === 'user' ? 'user' : msg.sender_type === 'consultant' ? 'assistant' : 'system',
          content: msg.content,
          timestamp: new Date(msg.created_at),
          senderType: msg.sender_type as 'user' | 'consultant' | 'ai' | 'system',
        }));

        // Keep the welcome message and add loaded messages
        setMessages(prev => {
          const welcomeMsg = prev.find(m => m.id === '1');
          const expertIntro = prev.find(m => m.content.includes("You're now connected"));
          return [
            ...(welcomeMsg ? [welcomeMsg] : []),
            ...(expertIntro ? [expertIntro] : []),
            ...formattedMessages,
          ];
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [sessionId]);

  // Subscribe to new messages and session updates
  useEffect(() => {
    if (chatMode !== 'expert' || !sessionCreated) return;

    // Subscribe to new messages
    const messagesChannel = backendApi
      .channel(`chat_messages_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePayload<ChatMessageRow>) => {
          const newMessage = payload.new;

          // Only add consultant/system messages (user messages are added locally)
          if (newMessage.sender_type === 'consultant' || newMessage.sender_type === 'system') {
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id);
              if (exists) return prev;

              return [...prev, {
                id: newMessage.id,
                role: newMessage.sender_type === 'consultant' ? 'assistant' : 'system',
                content: newMessage.content,
                timestamp: new Date(newMessage.created_at),
                senderType: newMessage.sender_type,
              }];
            });
            setConsultantTyping(false);
          }
        }
      )
      .subscribe();

    // Subscribe to session updates (typing indicator, status)
    const sessionChannel = backendApi
      .channel(`chat_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePayload<ChatSessionRow>) => {
          const session = payload.new;
          setConsultantTyping(session.consultant_typing === true);

          if (session.status === 'closed') {
            setChatStatus('closed');
            setMessages(prev => [...prev, {
              id: `closed_${Date.now()}`,
              role: 'system',
              content: "This chat has been closed by the consultant. Thank you for using TaxBot!",
              timestamp: new Date(),
              senderType: 'system',
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      backendApi.removeChannel(messagesChannel);
      backendApi.removeChannel(sessionChannel);
    };
  }, [chatMode, sessionId, sessionCreated]);

  // Load existing messages when switching to expert mode
  useEffect(() => {
    if (chatMode === 'expert' && sessionCreated) {
      loadExistingMessages();
    }
  }, [chatMode, sessionCreated, loadExistingMessages]);

  const createSession = async () => {
    if (sessionCreated) return true;

    try {
      const { error } = await backendApi
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          user_id: user?.id || null,
          status: 'open',
          language: 'en',
        });

      if (error) throw error;
      setSessionCreated(true);
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to start chat session');
      return false;
    }
  };

  const streamAIResponse = async (userMessages: { role: string; content: string }[]) => {
    try {
      const { data: sessionData } = await backendApi.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          messages: userMessages,
          messageCount: userMessageCount + 1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.id.startsWith('streaming_')) {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, {
                  id: `streaming_${Date.now()}`,
                  role: 'assistant',
                  content: assistantContent,
                  timestamp: new Date(),
                  senderType: 'ai' as const,
                }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Finalize the message ID
      setMessages(prev => prev.map(m => 
        m.id.startsWith('streaming_') 
          ? { ...m, id: Date.now().toString() }
          : m
      ));

    } catch (error) {
      console.error('AI streaming error:', error);
      toast.error('Failed to get AI response. Please try again.');
      throw error;
    }
  };

  const sendExpertMessage = async (text: string) => {
    try {
      // Ensure session exists
      const sessionOk = await createSession();
      if (!sessionOk) return;

      // Save message to chat_messages table
      const { error } = await backendApi
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'user',
          sender_id: user?.id || null,
          content: text,
        });

      if (error) throw error;
      setIsLoading(false);

    } catch (error) {
      console.error('Expert chat error:', error);
      toast.error('Failed to send message. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSend = async (message?: string) => {
    const text = message || input.trim();
    if (!text || chatStatus === 'closed') return;

    // Track usage on first message of session
    if (!hasTrackedUsage && user && !isUnlimited) {
      const success = await incrementUsage();
      if (!success) {
        toast.error('You have reached your free usage limit. Please upgrade to continue.');
        return;
      }
      setHasTrackedUsage(true);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      senderType: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    if (chatMode === 'ai') {
      setUserMessageCount(prev => prev + 1);
      
      // Build message history for AI
      const aiMessages = [...messages, userMessage]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      try {
        await streamAIResponse(aiMessages);
      } catch {
        // Error already handled in streamAIResponse
      } finally {
        setIsLoading(false);
      }
    } else {
      await sendExpertMessage(text);
    }
  };

  const switchToExpert = async () => {
    setChatMode('expert');
    setShowExpertPrompt(false);
    
    // Create session immediately
    await createSession();
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: "You're now connected to our tax consultant! 👋\n\nType your message below and our expert will respond directly in this chat. They typically reply within a few minutes during business hours.\n\nYou'll see their responses appear here in real-time.",
      timestamp: new Date(),
      senderType: 'system',
    }]);
  };

  const switchToAI = () => {
    setChatMode('ai');
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Switched back to AI Assistant. How can I help you?",
      timestamp: new Date(),
      senderType: 'ai',
    }]);
  };

  if (usageLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <UsageLimitGate
        featureType="chat"
        currentUsage={currentUsage}
        limit={limit}
        isUnlimited={isUnlimited}
        canUse={canUse}
      >
        <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <header className="bg-card border-b border-border px-4 pt-12 pb-4 safe-top flex-shrink-0">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl",
                chatMode === 'ai' ? "bg-gradient-primary" : "bg-green-500"
              )}>
                {chatMode === 'ai' ? (
                  <Bot className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <UserCheck className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-lg">
                  {chatMode === 'ai' ? t('chat.aiAssistant') : 'Tax Consultant'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {chatMode === 'ai' ? 'Quick answers • 24/7' : chatStatus === 'closed' ? 'Chat closed' : 'Live conversation • Online'}
                </p>
              </div>
            </div>
            
            {/* Toggle Chat Mode Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={chatMode === 'ai' ? switchToExpert : switchToAI}
              className={cn(
                "text-xs",
                chatMode === 'ai' 
                  ? "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:border-green-800"
                  : "bg-primary/10 border-primary/20 hover:bg-primary/20"
              )}
            >
              {chatMode === 'ai' ? (
                <>
                  <UserCheck className="w-3 h-3 mr-1 text-green-600" />
                  <span className="text-green-700 dark:text-green-400">Chat with Expert</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 mr-1 text-primary" />
                  <span className="text-primary">Back to AI</span>
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Expert Prompt Banner */}
        <AnimatePresence>
          {showExpertPrompt && chatMode === 'ai' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800 overflow-hidden"
            >
              <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Need detailed advice? Chat directly with our consultant!
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={switchToExpert}
                  className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                >
                  Connect
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Status Banner */}
        {chatStatus === 'closed' && chatMode === 'expert' && (
          <div className="bg-muted border-b border-border px-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              This conversation has been closed. Start a new chat for further assistance.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-lg mx-auto space-y-4">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' && 'flex-row-reverse'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
                    message.role === 'user' 
                      ? 'bg-muted'
                      : message.senderType === 'consultant' 
                        ? 'bg-green-500' 
                        : message.senderType === 'system'
                          ? 'bg-gray-400'
                          : 'bg-gradient-primary'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-muted-foreground" />
                  ) : message.senderType === 'consultant' ? (
                    <UserCheck className="w-4 h-4 text-white" />
                  ) : message.senderType === 'system' ? (
                    <Sparkles className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.senderType === 'consultant'
                        ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                        : message.senderType === 'system'
                          ? 'bg-muted border border-border'
                          : 'bg-card border border-border'
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  {message.senderType === 'consultant' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">Tax Consultant</p>
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
                  chatMode === 'ai' ? "bg-gradient-primary" : "bg-green-500"
                )}>
                  {chatMode === 'ai' ? (
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Consultant Typing Indicator */}
            {consultantTyping && chatMode === 'expert' && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex gap-3"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-green-500">
                  <Pencil className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600 dark:text-green-400">Consultant is typing</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggestions - only show when few messages */}
        {messages.length <= 2 && chatMode === 'ai' && (
          <div className="px-4 py-2 flex-shrink-0">
            <div className="max-w-lg mx-auto">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSend(suggestion)}
                    className="whitespace-nowrap flex-shrink-0 text-xs"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-card border-t border-border px-4 py-4 safe-bottom flex-shrink-0">
          <div className="max-w-lg mx-auto flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={
                chatStatus === 'closed' 
                  ? "Chat closed" 
                  : chatMode === 'ai' 
                    ? t('chat.placeholder') 
                    : "Type your message to the consultant..."
              }
              className="flex-1"
              disabled={isLoading || chatStatus === 'closed'}
            />
            <Button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim() || chatStatus === 'closed'}
              size="icon"
              className={cn(
                chatMode === 'ai' ? "bg-gradient-primary" : "bg-green-600 hover:bg-green-700"
              )}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        </div>
      </UsageLimitGate>
    </AppLayout>
  );
};

export default Chat;
