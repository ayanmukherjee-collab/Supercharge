import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Square, ChevronDown, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, type ChatMessage } from '../lib/chatService';
import { useApiKeyStore, getModelFamily, type ApiProvider } from '../lib/apiKeyStore';
import { ProviderIcons } from './icons/ProviderIcons';

import { useChatHistory } from '../hooks/useChatHistory';

interface ChatViewProps {
    provider: ApiProvider | null;
    initialMessage: string;
    activeChatId: string | null;
    onBack: () => void;
    onOpenSidebar: () => void;
}

const AnimatedMarkdownComponents = {
    p: ({ node, ...props }: any) => <p className="animate-blur-fade leading-relaxed mb-4 last:mb-0" {...props} />,
    li: ({ node, ...props }: any) => <li className="animate-blur-fade mb-1" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-4 space-y-2 animate-blur-fade" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-4 space-y-2 animate-blur-fade" {...props} />,
    pre: ({ node, ...props }: any) => <pre className="animate-blur-fade bg-white/5 border border-white/10 p-4 rounded-xl overflow-x-auto my-4 text-[13px]" {...props} />,
    code: ({ node, inline, className, children, ...props }: any) => {
        return !inline ? (
            <code className={className} {...props}>
                {children}
            </code>
        ) : (
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] text-white/90" {...props}>
                {children}
            </code>
        )
    },
    h1: ({ node, ...props }: any) => <h1 className="text-3xl font-bold text-white mt-8 mb-4 animate-blur-fade" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-white mt-6 mb-3 animate-blur-fade" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-white mt-5 mb-2 animate-blur-fade" {...props} />,
    a: ({ node, ...props }: any) => <a className="text-blue-400 hover:text-blue-300 underline font-medium" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-bold text-white" {...props} />,
    em: ({ node, ...props }: any) => <em className="italic text-white/90" {...props} />
};

export function ChatView({ provider, initialMessage, activeChatId, onBack, onOpenSidebar }: ChatViewProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const fullStreamingTextRef = useRef('');
    const currentAnimatedLengthRef = useRef(0);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef(false);
    const streamFinishedRef = useRef(false);
    const { providers } = useApiKeyStore();
    const { fetchMessages, appendMessage, createChat } = useChatHistory();
    const currentChatIdRef = useRef<string | null>(activeChatId);

    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    // Initial load of messages if activeChatId is provided
    useEffect(() => {
        let mounted = true;
        const loadMessages = async () => {
            setIsHistoryLoading(true);
            if (activeChatId) {
                currentChatIdRef.current = activeChatId;
                const dbMessages = await fetchMessages(activeChatId);
                if (mounted) {
                    setMessages(dbMessages);
                }
            } else {
                setMessages([]);
                currentChatIdRef.current = null;
            }
            if (mounted) setIsHistoryLoading(false);
        };
        loadMessages();
        return () => { mounted = false; };
    }, [activeChatId, fetchMessages]);

    // Model selector state within chat
    // Fall back to first available provider if the passed provider is null
    const [currentProvider, setCurrentProvider] = useState(provider || providers[0]);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    // Close model menu on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
                setIsModelMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Send message and stream response
    const doSend = useCallback(async (userText: string, history: ChatMessage[]) => {
        if (!currentProvider) {
            setError('No API provider selected.');
            return;
        }

        const userMsg: ChatMessage = { role: 'user', content: userText };
        const updatedMessages = [...history, userMsg];
        setMessages(updatedMessages);
        setIsStreaming(true);
        setIsThinking(true);
        setStreamingText('');
        fullStreamingTextRef.current = '';
        currentAnimatedLengthRef.current = 0;
        streamFinishedRef.current = false;
        setError(null);
        abortRef.current = false;

        let chatId = currentChatIdRef.current;

        // If it's a new chat, create it in DB first using the first message as title
        if (!chatId) {
            const newChat = await createChat(userText.slice(0, 50) + (userText.length > 50 ? '...' : ''));
            if (newChat) {
                chatId = newChat.id;
                currentChatIdRef.current = chatId;
            }
        }

        // Persist user message immediately
        if (chatId) {
            await appendMessage(chatId, userMsg);
        }

        // Add empty assistant placeholder (rendered with streamingText if last message)
        const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
        setMessages((prev) => [...prev, assistantMsg]);

        // Animation loop for smooth text rendering
        let animationFrameId: number;
        const animateText = () => {
            if (abortRef.current) return;

            setStreamingText((prev) => {
                const target = fullStreamingTextRef.current;
                if (prev === target) return prev;

                // Calculate dynamic chunk size based on how far behind we are
                const diff = target.length - prev.length;
                const chunkSize = Math.max(1, Math.ceil(diff / 5)); // Catch up if falling behind

                const nextText = target.slice(0, prev.length + chunkSize);
                currentAnimatedLengthRef.current = nextText.length;
                return nextText;
            });

            animationFrameId = requestAnimationFrame(animateText);
        };

        animationFrameId = requestAnimationFrame(animateText);

        try {
            const stream = sendMessage(currentProvider, updatedMessages);
            let firstChunkReceived = false;

            for await (const chunk of stream) {
                if (abortRef.current) break;

                if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    setIsThinking(false);
                }

                fullStreamingTextRef.current += chunk;
                // We DON'T update messages state here anymore to prevent heavy re-renders
            }

            streamFinishedRef.current = true;

            // Wait for animation to finish completely before setting final state
            // Use currentAnimatedLengthRef.current to avoid stale closure issues with state
            while (currentAnimatedLengthRef.current < fullStreamingTextRef.current.length && !abortRef.current) {
                await new Promise(r => setTimeout(r, 50));
            }

            // Once stream is complete and animated, set final message state
            const finalContent = fullStreamingTextRef.current;
            setMessages((prev) => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'assistant', content: finalContent };
                return newMsgs;
            });

            // Persist the complete assistant message
            if (chatId && finalContent) {
                await appendMessage(chatId, { role: 'assistant', content: finalContent });
            }

        } catch (err: any) {
            setError(err.message || 'Something went wrong');
            // Remove the empty assistant message on error
            setMessages((prev) => {
                if (prev[prev.length - 1]?.content === '') {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } finally {
            cancelAnimationFrame(animationFrameId);
            setIsStreaming(false);
            setIsThinking(false);
            setStreamingText('');
            fullStreamingTextRef.current = '';
        }
    }, [currentProvider, createChat, appendMessage]);

    // Send initial message on mount
    const hasSentInitialMessageRef = useRef(false);
    useEffect(() => {
        if (!isHistoryLoading && initialMessage.trim() && !hasSentInitialMessageRef.current) {
            hasSentInitialMessageRef.current = true;
            doSend(initialMessage, messages);
        }
    }, [isHistoryLoading, initialMessage, doSend, messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;
        const text = input;
        setInput('');
        doSend(text, messages);
    };

    const handleStop = () => {
        abortRef.current = true;
    };

    const providerInfo = currentProvider ? getModelFamily(currentProvider.family) : null;

    return (
        <div className="fixed inset-0 flex flex-col bg-black overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.04] blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="h-14 border-b border-white/5 flex items-center px-4 relative z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenSidebar}
                        className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                            <line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.5" />
                        </svg>
                    </button>

                    <button
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-4 w-px bg-white/10 mx-1" />

                    {/* Model selector */}
                    <div className="relative" ref={modelMenuRef}>
                        {currentProvider && providerInfo && (
                            <button
                                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                className="flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors py-1.5 px-3 rounded-full hover:bg-white/5"
                            >
                                {ProviderIcons[currentProvider.family as keyof typeof ProviderIcons]
                                    ? ProviderIcons[currentProvider.family as keyof typeof ProviderIcons]({ className: "w-3 h-3 text-white/80" })
                                    : <span
                                        className="w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                                        style={{ backgroundColor: providerInfo.color }}
                                    />}
                                <span className="font-medium">{currentProvider.label}</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                        )}

                        {isModelMenuOpen && (
                            <div className="absolute left-0 top-full mt-1 w-64 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl py-1 z-50">
                                {providers.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setCurrentProvider(p);
                                            setIsModelMenuOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between rounded-full ${currentProvider.id === p.id
                                            ? 'text-white bg-white/5'
                                            : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {ProviderIcons[p.family as keyof typeof ProviderIcons]
                                                ? ProviderIcons[p.family as keyof typeof ProviderIcons]({ className: "w-3 h-3 text-white/80" })
                                                : <span
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: getModelFamily(p.family).color }}
                                                />}
                                            <span>{p.label}</span>
                                        </div>
                                        <span className="text-[10px] text-white/30">{p.model}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Messages container - now taking up all space behind the footer */}
            <div className="flex-1 relative z-10 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto pt-10 pb-32 px-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
                    <div className="max-w-3xl mx-auto space-y-8">
                        <AnimatePresence initial={false}>
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="max-w-[80%] bg-white/10 border border-white/10 rounded-2xl rounded-br-md px-4 py-3 text-sm text-white/90 leading-relaxed">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        <div className="max-w-[85%] flex gap-4">
                                            <div className="w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center">
                                                {currentProvider && ProviderIcons[currentProvider.family as keyof typeof ProviderIcons]
                                                    ? ProviderIcons[currentProvider.family as keyof typeof ProviderIcons]({ className: "w-5 h-5 text-white/90" })
                                                    : providerInfo?.name?.[0] || 'A'}
                                            </div>
                                            <div className="text-sm text-white/80 leading-relaxed overflow-hidden">
                                                {isThinking && i === messages.length - 1 ? (
                                                    <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full animate-pulse mt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                                                        <span className="text-xs font-medium text-white/50 ml-1">Thinking...</span>
                                                    </div>
                                                ) : (
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={AnimatedMarkdownComponents}
                                                    >
                                                        {(isStreaming && i === messages.length - 1 ? streamingText : msg.content) + (isStreaming && i === messages.length - 1 ? ' ▍' : '')}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* Input - localized frosted glass effect on the box only */}
            <div className="absolute bottom-0 left-0 right-0 py-6 px-4 z-20 bg-gradient-to-t from-black via-black/80 to-transparent">
                <form
                    onSubmit={handleSubmit}
                    className="max-w-3xl mx-auto flex items-center gap-3 bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 shadow-2xl"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isStreaming ? 'Waiting for response...' : 'Send a message...'}
                        disabled={isStreaming}
                        className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/30 focus:outline-none disabled:opacity-50"
                    />
                    {isStreaming ? (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white/70 transition-colors"
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white/70 transition-colors"
                        >
                            {input.trim() ? (
                                <Send className="w-3.5 h-3.5" />
                            ) : (
                                <Mic className="w-3.5 h-3.5" />
                            )}
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
