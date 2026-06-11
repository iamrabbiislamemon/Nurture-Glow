import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { AIService, RiskLevel } from '../services/aiService';
import { useAuth } from './AuthContext';

export type ChatEntry = {
  role: 'user' | 'bot';
  text: string;
  sources?: any[];
  modelUsed?: string;
  intent?: string;
  riskLevel?: RiskLevel;
};

interface AIContextType {
  chat: ChatEntry[];
  loading: boolean;
  sendMessage: (message: string, locale: any) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setChat([]);
      return;
    }
    try {
      const history = await AIService.getChatHistory();
      const entries: ChatEntry[] = [];
      history.forEach((h: any) => {
        entries.push({ role: 'user', text: h.message });
        entries.push({
          role: 'bot',
          text: h.response,
          modelUsed: h.model_used,
          intent: h.intent,
          riskLevel: h.risk_level
        });
      });
      setChat(entries);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendMessage = useCallback(async (message: string, locale: any) => {
    if (!message.trim()) return;
    
    // Stage the user message immediately in global state
    setChat(prev => [...prev, { role: 'user', text: message }]);
    setLoading(true);

    try {
      const response = await AIService.chatAssistant(message, locale, true);
      setChat(prev => [
        ...prev,
        {
          role: 'bot',
          text: response.text,
          sources: response.sources,
          modelUsed: response.model_used,
          intent: response.intent,
          riskLevel: response.risk_level
        }
      ]);
    } catch (error) {
      console.error('Error in chat assistant:', error);
      setChat(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await AIService.clearChatHistory();
      setChat([]);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  }, []);

  const value = useMemo(
    () => ({ chat, loading, sendMessage, clearHistory, loadHistory }),
    [chat, loading, sendMessage, clearHistory, loadHistory]
  );

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
