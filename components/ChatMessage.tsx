
import React, { useState } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { LoadingDots, WebIcon, CopyIcon, RegenerateIcon, CheckIcon, EditIcon } from './Icons';

interface ChatMessageProps {
  message: ChatMessageType;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentContent: string) => void;
  isGenerating: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRegenerate, onEdit, isGenerating }) => {
  const [copied, setCopied] = useState(false);

  const isUser = message.author === 'user';
  const isModelMessage = message.author === 'model';
  const isLoadingPlaceholder = isModelMessage && message.content.trim() === '';

  const formatContent = (content: string) => {
    const blocks: string[] = [];
    
    const parseInline = (text: string) => {
        return text
            // IMPORTANT: Order matters. From most specific to least.
            // Bold and Italic
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="text-primary font-mono bg-secondary px-1 rounded">$1</code>');
    };

    const addBlock = (html: string) => {
        const placeholder = `\n__BLOCK_PLACEHOLDER_${blocks.length}__\n`;
        blocks.push(html);
        return placeholder;
    };
    
    let processedContent = content;

    processedContent = processedContent.replace(
        /^\|(?:.*\|)+\r?\n\|(?:\s*:?-+:?\s*\|)+\r?\n(?:^\|(?:.*\|)+\r?\n?)+/gm,
        (tableMarkdown) => {
            const lines = tableMarkdown.trim().split('\n');
            const headerLine = lines[0];
            const bodyLines = lines.slice(2);
            const headers = headerLine.split('|').slice(1, -1).map(h => parseInline(h.trim()));
            const tableHead = `<thead><tr class="bg-surface">${headers.map(h => `<th class="p-3 font-semibold text-text-primary text-left border-b border-secondary">${h}</th>`).join('')}</tr></thead>`;
            const tableBody = `<tbody>${bodyLines.map(rowLine => {
                const cells = rowLine.split('|').slice(1, -1).map(c => parseInline(c.trim()));
                return `<tr class="border-t border-surface">${cells.map(c => `<td class="p-3">${c}</td>`).join('')}</tr>`;
            }).join('')}</tbody>`;
            const tableHtml = `<div class="overflow-x-auto my-4 rounded-lg border border-surface"><table class="w-full text-left">${tableHead}${tableBody}</table></div>`;
            return addBlock(tableHtml);
        }
    );

    processedContent = processedContent.replace(
        /(?:^\s*[\*\-]\s.*\r?\n?)+/gm,
        (listMarkdown) => {
            const items = listMarkdown.trim().split('\n').map(item => 
                `<li class="mb-1">${parseInline(item.replace(/^\s*[\*\-]\s/, ''))}</li>`
            ).join('');
            return addBlock(`<ul class="list-disc list-inside my-4 pl-4 space-y-1">${items}</ul>`);
        }
    );

    processedContent = processedContent.replace(
        /(?:^\s*\d+\.\s.*\r?\n?)+/gm,
        (listMarkdown) => {
            const items = listMarkdown.trim().split('\n').map(item => 
                `<li class="mb-1">${parseInline(item.replace(/^\s*\d+\.\s/, ''))}</li>`
            ).join('');
            return addBlock(`<ol class="list-decimal list-inside my-4 pl-4 space-y-1">${items}</ol>`);
        }
    );

    processedContent = processedContent
        .replace(/^### (.*$)/gm, (_, p1) => `<h3 class="text-lg font-semibold mt-4 mb-2">${parseInline(p1)}</h3>`)
        .replace(/^## (.*$)/gm, (_, p1) => `<h2 class="text-xl font-bold mt-5 mb-3">${parseInline(p1)}</h2>`)
        .replace(/^# (.*$)/gm, (_, p1) => `<h1 class="text-2xl font-extrabold mt-6 mb-4">${parseInline(p1)}</h1>`);

    processedContent = parseInline(processedContent);
    processedContent = processedContent.replace(/\n/g, '<br />');

    blocks.forEach((blockHtml, index) => {
        const placeholderRegex = new RegExp(`(<br\\s*\\/?>)*__BLOCK_PLACEHOLDER_${index}__(<br\\s*\\/?>)*`, 'g');
        processedContent = processedContent.replace(placeholderRegex, blockHtml);
    });
    
    return processedContent;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  const showModelActionBar = isModelMessage && !isLoadingPlaceholder && !isGenerating;
  const showUserActionBar = isUser && !isGenerating;

  return (
    <div className={`flex flex-col animate-fade-in ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="max-w-[80%] text-text-primary">
        {isLoadingPlaceholder ? (
            <LoadingDots />
        ) : (
            <>
                <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((attachment, index) => (
                      attachment.type.startsWith('image/') && (
                        <div key={index} className="relative">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-w-xs h-auto rounded-lg"
                          />
                        </div>
                      )
                    ))}
                  </div>
                )}
                {message.groundingChunks && message.groundingChunks.length > 0 && (
                  <div className="mt-4 text-sm">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-text-secondary">
                          <WebIcon className="w-4 h-4" />
                          <span>Sources from the web</span>
                      </h4>
                      <ol className="list-decimal list-inside space-y-1">
                          {message.groundingChunks.map((chunk, index) => (
                              <li key={index} className="truncate">
                                  <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={chunk.web.title || chunk.web.uri}>
                                      {chunk.web.title || chunk.web.uri}
                                  </a>
                              </li>
                          ))}
                      </ol>
                  </div>
                )}
            </>
        )}
      </div>
      
      {showModelActionBar && (
        <div className="w-full max-w-[80%]">
          <div className="mt-2 flex items-center gap-1 text-text-secondary">
              <button onClick={handleCopy} className="p-2 rounded-full hover:bg-surface" aria-label="Copy message">
                  {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
              </button>
              <button onClick={() => onRegenerate(message.id)} className="p-2 rounded-full hover:bg-surface" aria-label="Regenerate response">
                  <RegenerateIcon className="w-4 h-4" />
              </button>
          </div>
        </div>
      )}

      {showUserActionBar && (
        <div className="w-full max-w-[80%] flex justify-end">
          <div className="mt-2 flex items-center gap-1 text-text-secondary">
              <button onClick={handleCopy} className="p-2 rounded-full hover:bg-surface" aria-label="Copy message">
                  {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
              </button>
              <button onClick={() => onEdit(message.id, message.content)} className="p-2 rounded-full hover:bg-surface" aria-label="Edit message">
                  <EditIcon className="w-4 h-4" />
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;