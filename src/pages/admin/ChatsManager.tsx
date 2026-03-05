import { useEffect, useState, useCallback, useRef } from 'react';
import { api as backendApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Loader2, 
  MessageSquare, 
  Send, 
  Pencil, 
  X, 
  User, 
  UserCheck, 
  Search,
  MoreVertical,
  Phone,
  Video,
  Clock,
  CheckCheck,
  Bot
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatSession {
  id: string;
  session_id: string;
  user_id: string | null;
  status: string;
  language: string | null;
  consultant_typing: boolean | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  lastMessage?: string;
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: 'user' | 'consultant' | 'ai' | 'system';
  sender_id: string | null;
  content: string;
  created_at: string;
}

interface LastMessageRow {
  content: string;
}

const languageLabels: Record<string, string> = {
  en: 'English',
  yo: 'Yoruba',
  ha: 'Hausa',
  pcm: 'Pidgin',
  ig: 'Igbo',
};

export default function ChatsManager() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [response, setResponse] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessions = async () => {
    try {
      const { data, error } = await backendApi
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch last message for each session
      const sessionRows = (data as ChatSession[] | null) || [];
      const sessionsWithMessages = await Promise.all(
        sessionRows.map(async (session) => {
          const { data: lastMsg } = await backendApi
            .from('chat_messages')
            .select('content')
            .eq('session_id', session.session_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          const lastMessageRow = lastMsg as LastMessageRow | null;
          
          return {
            ...session,
            lastMessage: lastMessageRow?.content || 'No messages yet',
          };
        })
      );

      setSessions(sessionsWithMessages);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load chat sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const { data, error } = await backendApi
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as ChatMessage[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to new messages when a session is selected
  useEffect(() => {
    if (!selectedSession) return;

    const channel = backendApi
      .channel(`admin_messages_${selectedSession.session_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${selectedSession.session_id}`,
        },
        (payload) => {
          const newMessage = (payload as { new: ChatMessage }).new;
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      backendApi.removeChannel(channel);
    };
  }, [selectedSession]);

  const handleSelectSession = async (session: ChatSession) => {
    setSelectedSession(session);
    await fetchMessages(session.session_id);
  };

  // Debounced typing indicator
  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!selectedSession) return;
    try {
      await backendApi
        .from('chat_sessions')
        .update({ consultant_typing: typing })
        .eq('session_id', selectedSession.session_id);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [selectedSession]);

  // Handle response input with typing indicator
  const handleResponseChange = (value: string) => {
    setResponse(value);
    
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        updateTypingStatus(false);
      }
    }, 2000);
  };

  // Clear typing indicator when session changes
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (selectedSession && isTyping) {
        updateTypingStatus(false);
      }
    };
  }, [selectedSession, isTyping, updateTypingStatus]);

  const handleSendResponse = async () => {
    if (!selectedSession || !response.trim()) return;
    setIsSending(true);

    try {
      // Clear typing indicator
      setIsTyping(false);
      await updateTypingStatus(false);

      // Insert message
      const { error } = await backendApi
        .from('chat_messages')
        .insert({
          session_id: selectedSession.session_id,
          sender_type: 'consultant',
          content: response.trim(),
        });

      if (error) throw error;

      // Trigger push notification
      try {
        await backendApi.functions.invoke('send-consultant-notification', {
          body: {
            chatId: selectedSession.id,
            userId: selectedSession.user_id,
            message: response.substring(0, 100) + (response.length > 100 ? '...' : '')
          }
        });
      } catch (notifError) {
        console.error('Failed to send push notification:', notifError);
      }

      setResponse('');
      fetchSessions(); // Refresh to update last message
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseChat = async () => {
    if (!selectedSession) return;

    try {
      // Send closing message
      await backendApi
        .from('chat_messages')
        .insert({
          session_id: selectedSession.session_id,
          sender_type: 'system',
          content: 'This chat has been closed. Thank you for using TaxBot!',
        });

      // Update session status
      const { error } = await backendApi
        .from('chat_sessions')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('session_id', selectedSession.session_id);

      if (error) throw error;

      toast.success('Chat closed');
      setSelectedSession(prev => prev ? { ...prev, status: 'closed' } : null);
      fetchSessions();
    } catch (error) {
      console.error('Error closing chat:', error);
      toast.error('Failed to close chat');
    }
  };

  const handleReopenChat = async () => {
    if (!selectedSession) return;

    try {
      const { error } = await backendApi
        .from('chat_sessions')
        .update({ 
          status: 'open',
          closed_at: null,
        })
        .eq('session_id', selectedSession.session_id);

      if (error) throw error;

      // Update local state
      setSelectedSession(prev => prev ? { ...prev, status: 'open', closed_at: null } : null);
      toast.success('Chat reopened');
      fetchSessions();
    } catch (error) {
      console.error('Error reopening chat:', error);
      toast.error('Failed to reopen chat');
    }
  };

  // Filter sessions based on search
  const filteredSessions = sessions.filter(session => 
    session.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openChats = filteredSessions.filter(s => s.status === 'open');
  const closedChats = filteredSessions.filter(s => s.status === 'closed');

  const getSenderInfo = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return { name: 'User', color: 'bg-blue-500', icon: User };
      case 'consultant':
        return { name: 'You', color: 'bg-green-500', icon: UserCheck };
      case 'ai':
        return { name: 'AI Bot', color: 'bg-purple-500', icon: Bot };
      default:
        return { name: 'System', color: 'bg-gray-400', icon: MessageSquare };
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 -m-6">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r bg-card flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex border-b">
          <div className="flex-1 p-3 text-center border-r">
            <p className="text-2xl font-bold text-green-600">{openChats.length}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div className="flex-1 p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{closedChats.length}</p>
            <p className="text-xs text-muted-foreground">Closed</p>
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No conversations</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={cn(
                    'p-4 cursor-pointer hover:bg-muted/50 transition-colors',
                    selectedSession?.id === session.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={session.status === 'open' ? 'bg-green-500/20 text-green-600' : 'bg-muted'}>
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">
                          User {session.session_id.slice(0, 6)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.updated_at), { addSuffix: false })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {session.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant={session.status === 'open' ? 'default' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {session.status}
                        </Badge>
                        {session.language && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {languageLabels[session.language] || session.language}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b px-4 flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className={selectedSession.status === 'open' ? 'bg-green-500/20 text-green-600' : 'bg-muted'}>
                    <User className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">User {selectedSession.session_id.slice(0, 8)}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      selectedSession.status === 'open' ? 'bg-green-500' : 'bg-gray-400'
                    )} />
                    <span>{selectedSession.status === 'open' ? 'Active' : 'Closed'}</span>
                    <span>•</span>
                    <span>{languageLabels[selectedSession.language || 'en']}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedSession.status === 'open' ? 'default' : 'secondary'}>
                  {selectedSession.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedSession.status === 'open' ? (
                      <DropdownMenuItem onClick={handleCloseChat} className="text-destructive">
                        <X className="w-4 h-4 mr-2" />
                        Close Chat
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleReopenChat}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Reopen Chat
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Date Header */}
                <div className="text-center">
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                    Started {format(new Date(selectedSession.created_at), 'PPP')}
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No messages yet</p>
                    <p className="text-sm">Messages will appear here</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const sender = getSenderInfo(message.sender_type);
                    const isConsultant = message.sender_type === 'consultant';
                    const isSystem = message.sender_type === 'system';
                    const showAvatar = index === 0 || 
                      messages[index - 1].sender_type !== message.sender_type;

                    if (isSystem) {
                      return (
                        <div key={message.id} className="text-center">
                          <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                            {message.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-2',
                          isConsultant ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        {showAvatar ? (
                          <Avatar className="w-8 h-8 mt-1">
                            <AvatarFallback className={sender.color}>
                              <sender.icon className="w-4 h-4 text-white" />
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2.5',
                            isConsultant
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : message.sender_type === 'ai'
                                ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-tl-sm'
                                : 'bg-muted rounded-tl-sm'
                          )}
                        >
                          {showAvatar && (
                            <p className={cn(
                              'text-xs font-medium mb-1',
                              isConsultant ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            )}>
                              {sender.name}
                            </p>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <div className={cn(
                            'flex items-center gap-1 mt-1',
                            isConsultant ? 'justify-end' : 'justify-start'
                          )}>
                            <span className={cn(
                              'text-[10px]',
                              isConsultant ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            )}>
                              {format(new Date(message.created_at), 'HH:mm')}
                            </span>
                            {isConsultant && (
                              <CheckCheck className="w-3 h-3 text-primary-foreground/60" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            {selectedSession.status === 'open' ? (
              <div className="border-t p-4 bg-card">
                <div className="max-w-3xl mx-auto">
                  {isTyping && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Pencil className="w-3 h-3 animate-pulse" />
                      User can see you're typing...
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={response}
                      onChange={(e) => handleResponseChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendResponse();
                        }
                      }}
                      placeholder="Type a message..."
                      rows={1}
                      className="min-h-[44px] max-h-32 resize-none"
                    />
                    <Button 
                      onClick={handleSendResponse} 
                      disabled={isSending || !response.trim()}
                      size="icon"
                      className="h-11 w-11 shrink-0"
                    >
                      {isSending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-t p-4 bg-muted/50">
                <div className="max-w-3xl mx-auto text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    This chat has been closed
                  </p>
                  <Button variant="outline" size="sm" onClick={handleReopenChat}>
                    Reopen Chat
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-1">Select a conversation</h3>
              <p className="text-sm">Choose a chat from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
