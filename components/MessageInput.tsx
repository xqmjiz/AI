
import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, AttachmentIcon, CloseIcon, StopIcon } from './Icons';

interface MessageInputProps {
  onSendMessage: (message: string, attachments: File[]) => void;
  isLoading: boolean;
  onCancelStream: () => void;
  editingContent?: string | null;
  onCancelEdit: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isLoading, onCancelStream, editingContent, onCancelEdit }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`; // 192px is roughly max-h-48
    }
  }, [input]);

  useEffect(() => {
    if (editingContent) {
        setInput(editingContent);
        textareaRef.current?.focus();
    }
  }, [editingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSendMessage(input.trim(), attachments);
      setInput('');
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleCancelEdit = () => {
      onCancelEdit();
      setInput('');
  };

  return (
    <div className="p-4 bg-background">
       {editingContent && (
        <div className="mb-2 px-3 py-1.5 bg-surface rounded-lg flex justify-between items-center text-sm animate-fade-in">
          <span className="text-text-secondary">メッセージを編集中...</span>
          <button onClick={handleCancelEdit} className="text-primary hover:text-primary-focus font-semibold">
            キャンセル
          </button>
        </div>
      )}
       {attachments.length > 0 && (
         <div className="mb-2 flex flex-wrap gap-2">
           {attachments.map((file, index) => (
             <div key={index} className="relative">
               <button
                 onClick={() => handleRemoveAttachment(index)}
                 className="absolute -top-2 -right-2 bg-secondary rounded-full p-0.5 text-primary-content hover:bg-secondary-focus"
                 aria-label={`Remove ${file.name}`}
               >
                 <CloseIcon className="w-4 h-4" />
               </button>
               {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
               ) : (
                 <div className="w-20 h-20 bg-surface rounded-lg flex flex-col items-center justify-center p-1">
                    <span className="text-xs text-text-secondary text-center truncate w-full">{file.name}</span>
                 </div>
               )}
             </div>
           ))}
         </div>
       )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-grow bg-surface rounded-2xl flex items-end p-1">
          <button
            type="button"
            onClick={handleAttachmentClick}
            disabled={isLoading || !!editingContent}
            aria-label="Attach file"
            className="m-1 p-3 rounded-full text-primary-content disabled:text-text-secondary transition-colors duration-200 hover:bg-secondary-focus focus:outline-none focus:ring-2 focus:ring-secondary-focus"
          >
            <AttachmentIcon className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力"
            rows={1}
            className="w-full bg-transparent p-3 text-text-primary placeholder-text-secondary resize-none focus:outline-none max-h-48 no-scrollbar"
          />
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,application/pdf,.doc,.docx,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={!!editingContent}
          />
          {isLoading ? (
             <button
                type="button"
                onClick={onCancelStream}
                aria-label="Stop generating"
                className="m-1 p-3 rounded-full bg-secondary text-primary-content transition-colors duration-200 hover:bg-secondary-focus focus:outline-none focus:ring-2 focus:ring-secondary-focus"
              >
                <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                aria-label="Send message"
                className="m-1 p-3 rounded-full bg-secondary text-primary-content disabled:bg-surface disabled:text-text-secondary transition-colors duration-200 hover:bg-secondary-focus focus:outline-none focus:ring-2 focus:ring-secondary-focus"
            >
                <SendIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
