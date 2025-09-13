import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, Attachment, GroundingChunk, ChatSession } from './types';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import Sidebar from './components/Sidebar';
import { streamChatResponse, generateImage, generateRefinedPrompt, getApiKeyError } from './services/geminiService';
import type { GenerateContentResponse, Content } from '@google/genai';

// Helper to convert our ChatMessage format to Gemini's Content format
const messagesToHistory = (messages: ChatMessage[]): Content[] => {
    return messages
        .filter(msg => msg.content) // Ensure there is content to send
        .map(msg => ({
            role: msg.author,
            parts: [{ text: msg.content }]
            // Note: This simple conversion doesn't handle multimodal (image) history yet.
        }));
};


const App: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const isCancelledRef = useRef(false);
    
    // Check for API Key configuration error on initial load
    useEffect(() => {
        const errorMsg = getApiKeyError();
        if (errorMsg) {
            setApiKeyError(errorMsg);
        }
    }, []);

    // Load sessions from localStorage on initial render
    useEffect(() => {
        try {
            const storedSessions = localStorage.getItem('chatSessions');
            if (storedSessions) {
                setSessions(JSON.parse(storedSessions));
            }
        } catch (e) {
            console.error("Failed to load sessions from localStorage", e);
        }
    }, []);
    
    // Save sessions to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('chatSessions', JSON.stringify(sessions));
        } catch (e) {
            console.error("Failed to save sessions to localStorage", e);
        }
    }, [sessions]);
    
    const activeSession = sessions.find(s => s.id === activeSessionId) || null;
    const messages = activeSession ? activeSession.messages : [];

    const handleSendMessage = useCallback(async (userInput: string, attachments: File[]) => {
        if (editingMessage && attachments.length > 0) {
            // For simplicity, disable attachments when editing.
            // This could be enhanced later.
            return;
        }

        setError(null);
        setIsLoading(true);
        isCancelledRef.current = false;
        
        let currentSessionId = activeSessionId;
        let sessionToUpdate = sessions.find(s => s.id === currentSessionId);
        
        // If there's no active session, create a new one
        if (!currentSessionId || !sessionToUpdate) {
            currentSessionId = `session-${Date.now()}`;
            const newSession: ChatSession = {
                id: currentSessionId,
                title: userInput.substring(0, 40) + (userInput.length > 40 ? '...' : ''),
                messages: [],
                isPinned: false,
            };
            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(currentSessionId);
            sessionToUpdate = newSession;
        }

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            author: 'user',
            content: userInput,
            attachments: attachments.map(file => ({
                name: file.name,
                url: URL.createObjectURL(file),
                type: file.type,
            })),
            files: attachments,
        };
        
        const modelMessageId = `model-${Date.now()}`;
        const modelMessagePlaceholder: ChatMessage = {
            id: modelMessageId,
            author: 'model',
            content: '',
            groundingChunks: [],
        };

        const updateSessionMessages = (updater: (prevMessages: ChatMessage[]) => ChatMessage[]) => {
            setSessions(prev => prev.map(s =>
                s.id === currentSessionId
                    ? { ...s, messages: updater(s.messages) }
                    : s
            ));
        };
        
        // Determine the base messages for this turn
        let baseMessages: ChatMessage[];
        if (editingMessage && sessionToUpdate) {
            const editIndex = sessionToUpdate.messages.findIndex(m => m.id === editingMessage.id);
            baseMessages = editIndex !== -1 ? sessionToUpdate.messages.slice(0, editIndex) : sessionToUpdate.messages;
        } else {
            baseMessages = sessionToUpdate?.messages || [];
        }

        const historyForAPI = messagesToHistory(baseMessages);
        
        // Optimistically update the UI
        updateSessionMessages(() => [...baseMessages, userMessage, modelMessagePlaceholder]);
        
        if (editingMessage) {
            setEditingMessage(null);
        }

        try {
            const lastMessage = baseMessages.length > 0 ? baseMessages[baseMessages.length - 1] : null;
            const secondToLastMessage = baseMessages.length > 1 ? baseMessages[baseMessages.length - 2] : null;

            let isFollowUpImageRequest = false;
            let promptForImage = userInput;

            if (lastMessage?.author === 'model' &&
                lastMessage.attachments?.some(a => a.type.startsWith('image/')) &&
                secondToLastMessage?.author === 'user' &&
                attachments.length === 0) {
                
                const originalPrompt = secondToLastMessage.content;
                const refinedResult = await generateRefinedPrompt(originalPrompt, userInput);

                if (refinedResult !== 'NO_MODIFICATION') {
                    isFollowUpImageRequest = true;
                    promptForImage = refinedResult;
                }
            }

            const imageKeywords = ['画像', '作って', '生成', '描いて', 'generate', 'draw', 'create', 'show me a picture of'];
            const isDirectImageRequest = imageKeywords.some(keyword => userInput.toLowerCase().includes(keyword)) && attachments.length === 0;

            const isImageRequest = isDirectImageRequest || isFollowUpImageRequest;

            if (isImageRequest) {
                updateSessionMessages(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, content: 'Generating your image...' } : msg));
                
                const base64ImageBytes = await generateImage(promptForImage);
                if (isCancelledRef.current) return;
                const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                const imageAttachment: Attachment = {
                    name: `Generated image for "${promptForImage.substring(0, 40)}..."`,
                    url: imageUrl,
                    type: 'image/png',
                };
                
                updateSessionMessages(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, content: 'Here is the image you requested.', attachments: [imageAttachment] } : msg));
            } else {
                const stream = await streamChatResponse(userInput, historyForAPI);
                let fullResponse = '';
                const groundingChunksMap = new Map<string, GroundingChunk['web']>();

                for await (const chunk of stream) {
                    if (isCancelledRef.current) break;

                    const responseChunk = chunk as GenerateContentResponse;
                    const chunkText = responseChunk.text;
                    if(chunkText) {
                      fullResponse += chunkText;
                    }
                    
                    const groundingMetadata = responseChunk.candidates?.[0]?.groundingMetadata;
                    if (groundingMetadata?.groundingChunks) {
                        groundingMetadata.groundingChunks.forEach((chunk: any) => {
                            if (chunk.web?.uri) {
                                groundingChunksMap.set(chunk.web.uri, chunk.web);
                            }
                        });
                    }
                    
                    const aggregatedChunks = Array.from(groundingChunksMap.values()).map(web => ({ web }));

                    updateSessionMessages(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, content: fullResponse, groundingChunks: aggregatedChunks } : msg));
                }
            }
        } catch (err) {
            if (!isCancelledRef.current) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(errorMessage);
                updateSessionMessages(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, content: `Error: ${errorMessage}` } : msg));
            }
        } finally {
            setIsLoading(false);
        }
    }, [activeSessionId, sessions, editingMessage]);

    const handleCancelStream = () => {
        isCancelledRef.current = true;
    };
    
    const handleNewChat = useCallback(() => {
        setActiveSessionId(null);
        setEditingMessage(null);
    }, []);

    const handleSelectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
        setEditingMessage(null);
    }, []);

    const handleRegenerate = useCallback((modelMessageId: string) => {
        if (!activeSession) return;
        
        const modelMessageIndex = activeSession.messages.findIndex(msg => msg.id === modelMessageId);
        if (modelMessageIndex > 0) {
            const userMessageToResend = activeSession.messages[modelMessageIndex - 1];
            if (userMessageToResend && userMessageToResend.author === 'user') {
                
                const messagesBeforeRegen = activeSession.messages.slice(0, modelMessageIndex - 1);

                setSessions(prev => prev.map(s => 
                    s.id === activeSessionId 
                    ? { ...s, messages: messagesBeforeRegen }
                    : s
                ));

                // A brief timeout allows React to process the state update before we send the message
                setTimeout(() => {
                    handleSendMessage(userMessageToResend.content, userMessageToResend.files || []);
                }, 0);
            }
        }
    }, [activeSession, activeSessionId, handleSendMessage]);

    const handleEdit = useCallback((id: string, content: string) => {
        setEditingMessage({ id, content });
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingMessage(null);
    }, []);

    const handleRenameSession = useCallback((sessionId: string, newTitle: string) => {
        setSessions(prev => prev.map(s => 
            s.id === sessionId ? { ...s, title: newTitle } : s
        ));
    }, []);

    const handleDeleteSession = useCallback((sessionId: string) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        // If the deleted session was active, reset to new chat view
        if (activeSessionId === sessionId) {
            setActiveSessionId(null);
        }
    }, [activeSessionId]);

    const handlePinSession = useCallback((sessionId: string, isPinned: boolean) => {
        setSessions(prev => prev.map(s => 
            s.id === sessionId ? { ...s, isPinned } : s
        ));
    }, []);
    
    // If there's an API key error, render a dedicated error screen
    if (apiKeyError) {
        return (
            <div className="flex h-screen bg-background text-text-primary font-sans items-center justify-center p-4">
                <div className="bg-surface p-8 rounded-lg shadow-lg max-w-lg text-center animate-fade-in">
                    <h1 className="text-2xl font-bold text-red-400 mb-4">Configuration Error</h1>
                    <p className="text-text-secondary mb-4">The application could not start. Please check the configuration.</p>
                    <code className="block bg-background p-3 rounded-md text-left text-sm text-red-300 whitespace-pre-wrap">
                        {apiKeyError}
                    </code>
                    <p className="text-text-secondary mt-6 text-sm">
                       Please ensure the <code>API_KEY</code> environment variable is set correctly in your Vercel project settings and redeploy the application.
                    </p>
                </div>
            </div>
        );
    }


    return (
        <div className="flex h-screen bg-background text-text-primary font-sans">
            <Sidebar 
                sessions={sessions} 
                activeSessionId={activeSessionId}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
                onPinSession={handlePinSession}
            />
            <div className="flex flex-col flex-1 overflow-hidden">
                <main className="w-full h-full max-w-5xl mx-auto flex flex-col flex-1 overflow-hidden">
                    <ChatWindow messages={messages} isLoading={isLoading} onRegenerate={handleRegenerate} onEdit={handleEdit} />
                    {error && (
                        <div className="px-6 pb-2 text-red-400 animate-slide-up">
                            <p><strong>Error:</strong> {error}</p>
                        </div>
                    )}
                    <MessageInput 
                        onSendMessage={handleSendMessage} 
                        isLoading={isLoading} 
                        onCancelStream={handleCancelStream}
                        editingContent={editingMessage?.content}
                        onCancelEdit={handleCancelEdit}
                    />
                </main>
            </div>
        </div>
    );
};

export default App;