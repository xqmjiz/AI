
import React, { useRef, useLayoutEffect } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import ChatMessage from './ChatMessage';

interface ChatWindowProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentContent: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, onRegenerate, onEdit }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-4xl font-bold text-text-primary">こんにちは</h1>
            <p className="mt-4 text-lg text-text-secondary">何をお手伝いしましょうか？</p>
        </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
      {messages.map((msg, index) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          isGenerating={isLoading && index === messages.length - 1}
        />
      ))}
    </div>
  );
};

export default ChatWindow;