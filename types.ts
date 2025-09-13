
export type MessageAuthor = 'user' | 'model';

export interface Attachment {
  name: string;
  url: string;
  type: string;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  content: string;
  attachments?: Attachment[];
  groundingChunks?: GroundingChunk[];
  files?: File[]; // For regeneration
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  isPinned?: boolean;
}
