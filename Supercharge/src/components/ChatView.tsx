import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, type ChatMessage } from '../lib/chatService';
import { useApiKeyStore, type ApiProvider } from '../lib/apiKeyStore';

import { useChatHistory } from '../hooks/useChatHistory';
import { useOutsideClick } from '../hooks/use-outside-click';
import { useViewportHeight } from '../hooks/useViewportHeight';
import { useAuth } from '../lib/AuthContext';
import { fetchAllMemory, executeMemoryOp, pruneExpiredNodes } from '../lib/memoryStore';
import { buildSystemPrompt } from '../lib/promptBuilder';
import { extractMemoryOp } from '../lib/pmlParser';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface ChatViewProps {
    provider: ApiProvider | null;
    initialMessage: string;
    activeChatId: string | null;
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

export function ChatView({ provider, initialMessage, activeChatId, onOpenSidebar }: ChatViewProps) {
    const MAX_TEXTAREA_HEIGHT = 180;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const fullStreamingTextRef = useRef('');
    const currentAnimatedLengthRef = useRef(0);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef(false);
    const streamFinishedRef = useRef(false);
    const { providers, activeProviderId, setActiveProviderId } = useApiKeyStore();
    const { fetchMessages, appendMessage, createChat, updateChatTitle } = useChatHistory();
    const currentChatIdRef = useRef<string | null>(activeChatId);
    const { user } = useAuth();
    const hasPrunedRef = useRef(false);
    const hasGeneratedTitleRef = useRef(false);

    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [pmlAlertDismissed, setPmlAlertDismissed] = useState(false);

    // Initial load of messages if activeChatId is provided
    useEffect(() => {
        let mounted = true;
        const loadMessages = async () => {
            setIsHistoryLoading(true);
            if (activeChatId) {
                currentChatIdRef.current = activeChatId;
                hasGeneratedTitleRef.current = true; // existing chat already has a title
                const dbMessages = await fetchMessages(activeChatId);
                if (mounted) {
                    setMessages(dbMessages);
                }
            } else {
                setMessages([]);
                currentChatIdRef.current = null;
                hasGeneratedTitleRef.current = false; // new chat, will need a title
            }
            if (mounted) setIsHistoryLoading(false);
        };
        loadMessages();
        return () => { mounted = false; };
    }, [activeChatId, fetchMessages]);

    // Prune expired/stale memory nodes once on mount
    useEffect(() => {
        if (user?.id && !hasPrunedRef.current) {
            hasPrunedRef.current = true;
            pruneExpiredNodes(user.id).catch((err) =>
                console.warn('[ChatView] Memory prune failed:', err)
            );
        }
    }, [user?.id]);

    // Model selector state within chat
    const currentProvider = providers.find((item) => item.id === activeProviderId) || provider || providers[0] || null;
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const modelMenuRef = useRef<HTMLDivElement>(null);
    useOutsideClick(modelMenuRef, () => setIsModelMenuOpen(false));

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const resizeInput = useCallback((element: HTMLTextAreaElement | null) => {
        if (!element) return;
        element.style.height = 'auto';
        const nextHeight = Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT);
        element.style.height = `${nextHeight}px`;
        element.style.overflowY = element.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
    }, []);

    const viewportHeight = useViewportHeight(() => {
        window.setTimeout(scrollToBottom, 50);
    });

    useEffect(() => {
        resizeInput(inputRef.current);
    }, [input, resizeInput]);

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
            // PML: build system prompt before sending
            let pmlSystemPrompt: string | undefined;
            if (user?.id) {
                try {
                    const pmlNodes = await fetchAllMemory(user.id);
                    console.log(`[PML] Loaded ${pmlNodes.length} memory nodes for prompt injection`);
                    pmlSystemPrompt = buildSystemPrompt({
                        nodes: pmlNodes,
                        userMessage: userText,
                        provider: currentProvider.family,
                        conversationLength: updatedMessages.length,
                    });
                    console.log(`[PML] System prompt built (${pmlSystemPrompt.length} chars)`);
                } catch (pmlErr) {
                    console.warn('[ChatView] PML prompt build failed, sending without memory:', pmlErr);
                }
            } else {
                console.warn('[PML] No user.id — PML memory system is inactive (login required)');
            }

            const stream = sendMessage(currentProvider, updatedMessages, pmlSystemPrompt, 15);
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

            // PML: extract MEMORY_OP from raw response
            const rawResponse = fullStreamingTextRef.current;
            const { displayText, commands } = extractMemoryOp(rawResponse);
            const finalContent = displayText;
            console.log(`[PML] Extracted ${commands.length} MEMORY_OP commands from response`);
            if (commands.length > 0) {
                console.log('[PML] Commands:', commands);
            }

            setMessages((prev) => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'assistant', content: finalContent };
                return newMsgs;
            });

            // Persist the clean assistant message (no PML)
            if (chatId && finalContent) {
                await appendMessage(chatId, { role: 'assistant', content: finalContent });
            }

            // Generate a smart title after 5 messages (3 user + 2 assistant)
            const currentMsgCount = updatedMessages.length + 1; // +1 for the assistant reply
            if (chatId && !hasGeneratedTitleRef.current && currentMsgCount >= 5) {
                hasGeneratedTitleRef.current = true;
                // Fire & forget — don't block the chat
                (async () => {
                    try {
                        const convoSnippet = [...updatedMessages, { role: 'assistant' as const, content: finalContent }]
                            .slice(0, 6)
                            .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
                            .join('\n');

                        const titleMessages: ChatMessage[] = [
                            { role: 'user', content: `Summarize this conversation in 4-6 words as a short title. Output ONLY the title, nothing else. No quotes, no punctuation at the end.\n\n${convoSnippet}` },
                        ];

                        let generatedTitle = '';
                        const titleStream = sendMessage(currentProvider, titleMessages, undefined, 1);
                        for await (const chunk of titleStream) {
                            generatedTitle += chunk;
                        }

                        generatedTitle = generatedTitle.trim().replace(/^["']|["']$/g, '').slice(0, 60);
                        if (generatedTitle) {
                            await updateChatTitle(chatId, generatedTitle);
                            console.log(`[ChatView] Auto-titled chat: "${generatedTitle}"`);
                        }
                    } catch (titleErr) {
                        console.warn('[ChatView] Auto-title generation failed:', titleErr);
                    }
                })();
            }

            // PML: persist new memories
            if (user?.id && commands.length > 0) {
                try {
                    const result = await executeMemoryOp(user.id, commands);
                    console.log(`[PML] Memory write: ${result.written} written, ${result.skipped} skipped`);
                    if (result.errors.length > 0) {
                        console.warn('[PML] Memory op errors:', result.errors);
                    }
                } catch (memErr) {
                    console.warn('[PML] Memory write failed:', memErr);
                }
            } else if (user?.id && commands.length === 0 && finalContent) {
                // LLM forgot MEMORY_OP — fire follow-up WITH conversation context
                console.log('[PML] No MEMORY_OP in response, firing follow-up with conversation context...');
                try {
                    // Small delay to avoid rate-limit 503 from the same model
                    await new Promise(r => setTimeout(r, 1500));

                    const followUpMessages: ChatMessage[] = [
                        { role: 'user', content: userText },
                        { role: 'assistant', content: finalContent },
                        { role: 'user', content: 'Based on the conversation above, output ONLY the MEMORY_OP block with any facts worth remembering. No other text. Use the format:\n```MEMORY_OP\nSTORE #category:path [item]\n```' },
                    ];
                    let followUpText = '';
                    const followUpStream = sendMessage(currentProvider, followUpMessages, pmlSystemPrompt, 1);
                    for await (const chunk of followUpStream) {
                        followUpText += chunk;
                    }
                    const followUp = extractMemoryOp(followUpText);
                    console.log(`[PML] Follow-up extracted ${followUp.commands.length} commands`);
                    if (followUp.commands.length > 0) {
                        const result = await executeMemoryOp(user.id, followUp.commands);
                        console.log(`[PML] Follow-up write: ${result.written} written, ${result.skipped} skipped`);
                    }
                } catch (followUpErr) {
                    console.warn('[PML] MEMORY_OP follow-up failed:', followUpErr);
                }
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
    }, [currentProvider, createChat, appendMessage, updateChatTitle, user?.id]);

    // Send initial message on mount
    const hasSentInitialMessageRef = useRef(false);
    useEffect(() => {
        if (!isHistoryLoading && initialMessage.trim() && !hasSentInitialMessageRef.current) {
            hasSentInitialMessageRef.current = true;
            doSend(initialMessage, messages);
        }
    }, [isHistoryLoading, initialMessage, doSend, messages]);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isStreaming) return;
        const text = input;
        setInput('');
        if (inputRef.current) {
            inputRef.current.style.height = '26px';
            inputRef.current.style.overflowY = 'hidden';
        }
        doSend(text, messages);
    };

    const handleStop = () => {
        abortRef.current = true;
    };

    return (
        <div className="fixed top-0 left-0 w-full flex flex-col bg-[#181818] overflow-hidden" style={{ height: viewportHeight }}>
            {/* Header */}
            <header className="h-14 flex items-center px-4 relative z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenSidebar}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                        <img src="/sidebar.svg" alt="Sidebar" className="w-5 h-5 opacity-80" />
                    </button>



                </div>
            </header>

            {/* Messages container - now taking up all space behind the footer */}
            <div className="flex-1 relative z-10 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto pt-10 pb-40 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {/* PML inactive alert for non-signed-in users */}
                        {!user && !pmlAlertDismissed && (
                            <div className="flex items-center gap-3 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-4 py-3">
                                <svg className="w-4 h-4 text-amber-400/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <p className="flex-1 text-[13px] text-amber-200/70 leading-snug">
                                    <span className="font-medium text-amber-200/90">PML is inactive.</span> Sign in to enable Persistent Memory across sessions.
                                </p>
                                <button onClick={() => setPmlAlertDismissed(true)} className="shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors">
                                    <svg className="w-3.5 h-3.5 text-amber-300/50 hover:text-amber-300/80 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                        )}
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
                                        <div className="max-w-[80%] bg-[#2d2d2d] rounded-2xl rounded-br-sm px-4 py-3 text-sm text-white/90 leading-relaxed shadow-md">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        <div className="max-w-[85%] flex gap-4">
                                            <div className="w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center relative">
                                                {isThinking && i === messages.length - 1 ? (
                                                    <div className="absolute inset-0 flex items-center justify-center scale-[1.35]">
                                                        <DotLottieReact src="/brain loading animation.lottie" loop autoplay className="w-full h-full opacity-90" />
                                                    </div>
                                                ) : (
                                                    <img src="/favicon.svg" alt="AI" className="w-6 h-6 opacity-90 object-contain" />
                                                )}
                                            </div>
                                            <div className="text-sm text-white/80 leading-relaxed overflow-hidden">
                                                {isThinking && i === messages.length - 1 ? null : (
                                                    <>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={AnimatedMarkdownComponents}
                                                        >
                                                            {(isStreaming && i === messages.length - 1 ? extractMemoryOp(streamingText).displayText : msg.content) + (isStreaming && i === messages.length - 1 ? ' ▍' : '')}
                                                        </ReactMarkdown>
                                                    </>
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
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-transparent flex flex-col items-center px-4">
                <form
                    onSubmit={handleSubmit}
                    className="relative w-full max-w-3xl rounded-3xl bg-[#2d2d2d] p-5 flex flex-col gap-8 focus-within:ring-1 focus-within:ring-white/10 transition-all shadow-2xl mt-6"
                >
                    {/* Top Row: Input Field */}
                    <div className="flex w-full relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                resizeInput(e.target);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e as any);
                                }
                            }}
                            rows={1}
                            placeholder={isStreaming ? 'Waiting for response...' : 'Ask anything...'}
                            disabled={isStreaming}
                            className="chat-scrollbar w-full bg-transparent text-[15px] sm:text-base text-white/90 placeholder:text-white/30 focus:outline-none disabled:opacity-50 resize-none overflow-y-auto p-0 leading-relaxed block text-left min-w-0"
                            style={{ minHeight: '26px', maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
                        />
                    </div>

                    {/* Bottom Row: Model Selector & Send Button */}
                    <div className="flex items-center justify-between w-full">
                        {/* Model Selector */}
                        <div className="relative flex items-center" ref={modelMenuRef}>
                            {providers.length > 0 && currentProvider && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                        className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white/80 transition-colors rounded-lg bg-transparent"
                                    >
                                        
                                        <span>{currentProvider.label}</span>
                                        <ChevronDown className={`w-3 h-3 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isModelMenuOpen && (
                                        <div className="absolute left-0 top-full mt-3 w-44 bg-[#252525] rounded-xl py-1.5 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                                            {providers.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveProviderId(p.id)
                                                        setIsModelMenuOpen(false)
                                                    }}
                                                    className={`w-[calc(100%-12px)] mx-1.5 text-left px-3 py-2 text-sm transition-colors flex items-center justify-between rounded-md ${currentProvider.id === p.id
                                                        ? 'text-white bg-white/10 font-medium'
                                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                                        }`}
                                                >
                                                    <span>{p.label}</span>
                                                    {currentProvider.id === p.id && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Send Button */}
                        <div className="shrink-0 flex items-center z-50">
                            {isStreaming ? (
                                <button
                                    type="button"
                                    onClick={handleStop}
                                    className="hover:scale-110 transition-transform flex items-center justify-center bg-transparent border-none shrink-0 group"
                                >
                                    <Square className="w-[18px] h-[18px] text-white/70 hover:text-white transition-colors" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="hover:scale-110 transition-transform disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center bg-transparent border-none shrink-0 group"
                                >
                                    <img src="/send.svg" alt="Send" className="w-[18px] h-[18px] opacity-70 group-hover:opacity-100 transition-opacity" />
                                </button>
                            )}
                        </div>
                    </div>
                </form>
                <div className="w-full max-w-3xl h-6 bg-[#181818] shrink-0" />
            </div>

        </div>
    );
}
