import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Square, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, type ChatMessage } from '../lib/chatService';
import { useApiKeyStore, getModelFamily, type ApiProvider } from '../lib/apiKeyStore';

interface ChatViewProps {
    provider: ApiProvider;
    initialMessage: string;
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

export function ChatView({ provider, initialMessage, onBack, onOpenSidebar }: ChatViewProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef(false);
    const { providers } = useApiKeyStore();

    // Model selector state within chat
    const [currentProvider, setCurrentProvider] = useState(provider);
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
        const userMsg: ChatMessage = { role: 'user', content: userText };
        const updatedMessages = [...history, userMsg];
        setMessages(updatedMessages);
        setIsStreaming(true);
        setError(null);
        abortRef.current = false;

        // Add empty assistant placeholder
        const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
        setMessages((prev) => [...prev, assistantMsg]);

        try {
            const stream = sendMessage(currentProvider, updatedMessages);
            let fullText = '';

            for await (const chunk of stream) {
                if (abortRef.current) break;
                fullText += chunk;
                // Update the last (assistant) message
                setMessages((prev) => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { role: 'assistant', content: fullText };
                    return newMsgs;
                });
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
            setIsStreaming(false);
        }
    }, [currentProvider]);

    // Send initial message on mount
    useEffect(() => {
        if (initialMessage.trim()) {
            doSend(initialMessage, []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const providerInfo = getModelFamily(currentProvider.family);

    return (
        <div className="flex flex-col h-screen bg-black relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.04] blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-4 w-px bg-white/10" />

                    {/* Model selector */}
                    <div className="relative" ref={modelMenuRef}>
                        <button
                            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                            className="flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-white/5"
                        >
                            <span
                                className="w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                                style={{ backgroundColor: providerInfo.color }}
                            />
                            <span className="font-medium">{currentProvider.label}</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isModelMenuOpen && (
                            <div className="absolute left-0 top-full mt-1 w-64 bg-[#111111] border border-white/10 rounded-xl shadow-2xl py-1 z-50 backdrop-blur-xl">
                                {providers.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setCurrentProvider(p);
                                            setIsModelMenuOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${currentProvider.id === p.id
                                            ? 'text-white bg-white/5'
                                            : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: getModelFamily(p.family).color }}
                                            />
                                            <span>{p.label}</span>
                                        </div>
                                        <span className="text-[10px] text-white/30">{p.model}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={onOpenSidebar}
                    className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
                >
                    <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                        <line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.5" />
                    </svg>
                </button>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 relative z-10">
                <div className="max-w-3xl mx-auto space-y-6">
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
                                    <div className="max-w-[85%] flex gap-3">
                                        <div
                                            className="w-6 h-6 rounded-full shrink-0 mt-1 flex items-center justify-center text-[10px] font-bold text-white/90"
                                            style={{ backgroundColor: providerInfo.color + '30', border: `1px solid ${providerInfo.color}40` }}
                                        >
                                            {providerInfo.name[0]}
                                        </div>
                                        <div className="text-sm text-white/80 leading-relaxed overflow-hidden">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={AnimatedMarkdownComponents}
                                            >
                                                {msg.content + (isStreaming && i === messages.length - 1 ? ' ▍' : '')}
                                            </ReactMarkdown>
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

            {/* Input */}
            <div className="shrink-0 border-t border-white/5 px-4 py-4 relative z-10">
                <form
                    onSubmit={handleSubmit}
                    className="max-w-3xl mx-auto flex items-center gap-3 bg-[#111111] border border-white/[0.06] rounded-2xl px-4 py-3"
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
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-white/70 transition-colors"
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
