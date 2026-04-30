import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './lib/AuthContext'
import { lazy, Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useApiKeyStore } from './lib/apiKeyStore'
import { useOutsideClick } from './hooks/use-outside-click'

type ViewState = 'home' | 'settings' | 'chat' | 'manage-chats'

const ApiSettingsPage = lazy(async () => ({ default: (await import('./components/ApiSettingsPage')).ApiSettingsPage }))
const ChatView = lazy(async () => ({ default: (await import('./components/ChatView')).ChatView }))
const AuthScreen = lazy(async () => ({ default: (await import('./components/AuthScreen')).AuthScreen }))
const ManageChats = lazy(async () => ({ default: (await import('./components/ManageChats')).ManageChats }))

function ViewLoader() {
    return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-backgroundPrimary">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
    )
}

function App() {
    const MAX_TEXTAREA_HEIGHT = 180
    const { user, loading, isSkipped } = useAuth()
    const { providers, activeProviderId, setActiveProviderId } = useApiKeyStore()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
    const [view, setView] = useState<ViewState>('home')
    const selectedProvider = providers.find((provider) => provider.id === activeProviderId) || providers[0] || null
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
    const [pendingMessage, setPendingMessage] = useState('')
    const [activeChatId, setActiveChatId] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const homeInputRef = useRef<HTMLTextAreaElement>(null)

    // Auto-select first provider if none selected
    useEffect(() => {
        if (!activeProviderId && providers.length > 0) {
            setActiveProviderId(providers[0].id)
        }
    }, [providers, activeProviderId, setActiveProviderId])

    useOutsideClick(dropdownRef, () => setIsModelDropdownOpen(false))

    const resizeHomeInput = useCallback((element: HTMLTextAreaElement | null) => {
        if (!element) return
        element.style.height = 'auto'
        const nextHeight = Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)
        element.style.height = `${nextHeight}px`
        element.style.overflowY = element.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
    }, [])

    useEffect(() => {
        resizeHomeInput(homeInputRef.current)
    }, [pendingMessage, resizeHomeInput])

    const onSubmit = (value: string, e?: React.FormEvent<HTMLFormElement>) => {
        if (e && e.preventDefault) e.preventDefault()

        if (!value.trim()) return

        if (!selectedProvider) {
            // No API key configured — go to settings
            setView('settings')
            return
        }

        setPendingMessage(value.trim())
        if (homeInputRef.current) {
            homeInputRef.current.style.height = '26px'
            homeInputRef.current.style.overflowY = 'hidden'
        }
        setActiveChatId(null)
        setView('chat')
    }

    if (loading) {
        return <ViewLoader />
    }

    if (!user && !isSkipped) {
        return (
            <Suspense fallback={<ViewLoader />}>
                <AuthScreen />
            </Suspense>
        )
    }

    // ── Settings View ──
    if (view === 'settings') {
        return (
            <Suspense fallback={<ViewLoader />}>
                <div className="flex flex-col min-h-[100dvh] bg-backgroundPrimary">
                    <Sidebar
                        isOpen={isSidebarOpen}
                        onClose={() => setIsSidebarOpen(false)}
                        setView={setView}
                        onSelectChat={setActiveChatId}
                    />
                    <ApiSettingsPage onBack={() => setView('home')} onOpenSidebar={() => setIsSidebarOpen(true)} />
                </div>
            </Suspense>
        )
    }

    // ── Manage Chats View ──
    if (view === 'manage-chats') {
        return (
            <Suspense fallback={<ViewLoader />}>
                <div className="flex flex-col min-h-[100dvh] bg-backgroundPrimary">
                    <Sidebar
                        isOpen={isSidebarOpen}
                        onClose={() => setIsSidebarOpen(false)}
                        setView={setView}
                        onSelectChat={setActiveChatId}
                    />
                    <ManageChats
                        onBack={() => setView('home')}
                        onOpenSidebar={() => setIsSidebarOpen(true)}
                        onSelectChat={(id) => {
                            setActiveChatId(id)
                            setView('chat')
                        }}
                    />
                </div>
            </Suspense>
        )
    }

    // ── Chat View ──
    if (view === 'chat' && (selectedProvider || activeChatId)) {
        return (
            <Suspense fallback={<ViewLoader />}>
                <div className="flex flex-col h-[100dvh] bg-backgroundPrimary overflow-hidden relative">
                    <Sidebar
                        isOpen={isSidebarOpen}
                        onClose={() => setIsSidebarOpen(false)}
                        setView={setView}
                        onSelectChat={setActiveChatId}
                    />
                    <ChatView
                        provider={selectedProvider}
                        initialMessage={pendingMessage}
                        activeChatId={activeChatId}
                        onOpenSidebar={() => setIsSidebarOpen(true)}
                    />
                </div>
            </Suspense>
        )
    }

    // ── Home View ──
    return (
        <div className="flex flex-col min-h-[100dvh] items-center justify-center p-4 relative overflow-hidden bg-[#181818]">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                setView={setView}
                onSelectChat={setActiveChatId}
            />

            {/* Top Bar */}
            <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
                <img src="/sidebar.svg" alt="Menu" onClick={() => setIsSidebarOpen(true)} className="w-5 h-5 opacity-80 cursor-pointer z-50 hover:opacity-100 transition-opacity" />

                <button 
                    onClick={() => setIsInfoModalOpen(true)}
                    className="px-4 py-2 bg-[#e0e0e0] text-[#121214] text-sm font-semibold rounded-xl hover:bg-white transition-colors shadow-lg z-50 relative"
                >
                    Know More
                </button>
            </div>

            {/* Main Content */}
            <main className="w-full max-w-2xl flex flex-col items-center mt-[-2vh]">
                {/* Hero Text */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <h1
                        className="text-[40px] md:text-[48px] leading-tight tracking-tight mb-3 text-white font-black not-italic"
                    >
                        Supercharge
                    </h1>
                </div>

                {/* Input Area */}
                <div className="w-full max-w-3xl flex flex-col relative px-4 md:px-0">
                    <form
                        onSubmit={(e) => onSubmit(pendingMessage, e)}
                        className="w-full rounded-3xl bg-[#2d2d2d] p-5 flex flex-col gap-8 focus-within:ring-1 focus-within:ring-white/10 transition-all"
                    >
                        {/* Top Row: Input Field */}
                        <div className="flex w-full">
                            <textarea
                                ref={homeInputRef}
                                value={pendingMessage}
                                onChange={(e) => {
                                    setPendingMessage(e.target.value)
                                    resizeHomeInput(e.target)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        onSubmit(pendingMessage, e as any)
                                    }
                                }}
                                rows={1}
                                placeholder="Ask anything..."
                                className="chat-scrollbar w-full bg-transparent text-white text-[15px] outline-none placeholder:text-white/30 text-left min-w-0 resize-none overflow-y-auto leading-relaxed"
                                style={{ minHeight: '26px', maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
                            />
                        </div>

                        {/* Bottom Row: Model Selector & Send Button */}
                        <div className="flex items-center justify-between w-full">
                            {/* Model Selector */}
                            <div className="relative flex items-center" ref={dropdownRef}>
                                {providers.length > 0 && selectedProvider ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                            className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white/80 transition-colors rounded-lg bg-transparent"
                                        >
                                            
                                            <span>{selectedProvider.label}</span>
                                            <ChevronDown className={`w-3 h-3 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isModelDropdownOpen && (
                                            <div className="absolute left-0 top-full mt-3 w-44 bg-[#252525] rounded-xl py-1.5 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                                                {providers.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveProviderId(p.id)
                                                            setIsModelDropdownOpen(false)
                                                        }}
                                                        className={`w-[calc(100%-12px)] mx-1.5 text-left px-3 py-2 text-sm transition-colors flex items-center justify-between rounded-md ${selectedProvider.id === p.id
                                                            ? 'text-white bg-white/10 font-medium'
                                                            : 'text-white/60 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <span>{p.label}</span>
                                                        {selectedProvider.id === p.id && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setView('settings')}
                                        className="flex items-center gap-2 text-xs text-amber-400/70 hover:text-amber-400 transition-colors rounded-lg bg-transparent"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                                        <span>Add an API key to start</span>
                                    </button>
                                )}
                            </div>

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={!pendingMessage.trim() || !selectedProvider}
                                className="hover:scale-110 transition-transform disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center bg-transparent border-none shrink-0 group"
                            >
                                <img src="/send.svg" alt="Send" className="w-[18px] h-[18px] opacity-70 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            {/* macOS Style Info Modal */}
            <AnimatePresence>
                {isInfoModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        {/* Backdrop - Transparent as requested */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsInfoModalOpen(false)}
                            className="absolute inset-0 bg-transparent"
                        />
                        
                        {/* Modal Content - Increased transparency for glassmorphism */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.1, x: '40vw', y: '-40vh' }}
                            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                            exit={{ opacity: 0, scale: 0.1, x: '40vw', y: '-40vh' }}
                            transition={{ type: "spring", damping: 25, stiffness: 250 }}
                            className="relative w-full max-w-4xl bg-backgroundSurface/30 backdrop-blur-3xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden flex flex-col z-10"
                        >
                            {/* macOS Header */}
                            <div className="h-14 bg-[#2a2a32]/20 border-b border-white/10 flex items-center px-4 relative select-none">
                                {/* Traffic Lights - All close the modal */}
                                <div className="flex items-center gap-2.5 absolute left-5">
                                    <button onClick={() => setIsInfoModalOpen(false)} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 flex items-center justify-center group transition-colors">
                                        <svg className="w-2.5 h-2.5 text-black/50 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                    <button onClick={() => setIsInfoModalOpen(false)} className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 flex items-center justify-center group transition-colors">
                                        <svg className="w-2.5 h-2.5 text-black/50 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12h16"/></svg>
                                    </button>
                                    <button onClick={() => setIsInfoModalOpen(false)} className="w-3.5 h-3.5 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 flex items-center justify-center group transition-colors">
                                        <svg className="w-2.5 h-2.5 text-black/50 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                    </button>
                                </div>
                                {/* Title */}
                                <div className="w-full text-center text-white/70 text-sm font-semibold tracking-wider">
                                    About Supercharge
                                </div>
                            </div>
                            
                            {/* Modal Body */}
                            <div className="p-8 md:p-10 text-white/80 md:grid md:grid-cols-2 gap-12 items-center">
                                {/* Left Side: Text */}
                                <div className="space-y-6 text-[15px] leading-relaxed">
                                    <h2 className="text-3xl text-white mb-2 tracking-tight font-extrabold">
                                        What is Supercharge?
                                    </h2>
                                    <p>
                                        Supercharge is a premium AI interface built for power users. It strips away visual clutter, leaving only what matters most: <strong className="text-white">Speed and Intelligence</strong>.
                                    </p>
                                    <p>
                                        The secret is our <strong>Persistent Memory Layer (PML)</strong>. Standard AI models suffer from "amnesia" between sessions, forcing you to repeatedly provide the same context. This wastes both your time and expensive tokens.
                                    </p>
                                    <p>
                                        PML operates like a local long-term memory drive. It intelligently extracts and stores key facts, preferences, and code snippets. When relevant, this memory is automatically injected into new conversations without you having to lift a finger.
                                    </p>
                                </div>

                                {/* Right Side: Graphs */}
                                <div className="space-y-8 bg-black/10 p-6 rounded-2xl border border-white/5 shadow-inner">
                                    {/* Token Usage Graph */}
                                    <div>
                                        <h3 className="text-white font-medium mb-5 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            API Token Usage Over Time
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between text-xs text-white/50">
                                                    <span>Standard AI (Full Context Window)</span>
                                                    <span>100%</span>
                                                </div>
                                                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: "100%" }}
                                                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                                        className="h-full bg-red-400/80 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-white">With PML (Dynamic Injection)</span>
                                                    <span className="text-emerald-400">~25%</span>
                                                </div>
                                                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: "25%" }}
                                                        transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                                                        className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] rounded-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Context Retention Graph */}
                                    <div className="pt-4 border-t border-white/10">
                                        <h3 className="text-white font-medium mb-6 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            Context Retention Between Sessions
                                        </h3>
                                        <div className="flex items-end h-28 gap-4 px-2">
                                            {/* Session 1 */}
                                            <div className="flex-1 flex flex-col justify-end gap-3 group h-full">
                                                <div className="flex-1 w-full relative">
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "100%" }}
                                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                                                        className="w-[45%] bg-white/10 rounded-t-md group-hover:opacity-50 transition-opacity absolute bottom-0 left-0"
                                                    />
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "100%" }}
                                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                                                        className="w-[45%] bg-blue-500 rounded-t-md shadow-[0_0_12px_rgba(59,130,246,0.6)] absolute bottom-0 right-0 z-10"
                                                    />
                                                </div>
                                                <span className="text-[11px] font-medium text-white/40 text-center border-t border-white/10 pt-2 shrink-0">Session 1</span>
                                            </div>
                                            {/* Session 2 */}
                                            <div className="flex-1 flex flex-col justify-end gap-3 group h-full">
                                                <div className="flex-1 w-full relative">
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "40%" }}
                                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                                                        className="w-[45%] bg-white/10 rounded-t-md group-hover:opacity-50 transition-opacity absolute bottom-0 left-0"
                                                    />
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "100%" }}
                                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                                                        className="w-[45%] bg-blue-500 rounded-t-md shadow-[0_0_12px_rgba(59,130,246,0.6)] absolute bottom-0 right-0 z-10"
                                                    />
                                                </div>
                                                <span className="text-[11px] font-medium text-white/40 text-center border-t border-white/10 pt-2 shrink-0">Session 2</span>
                                            </div>
                                            {/* Session 3 */}
                                            <div className="flex-1 flex flex-col justify-end gap-3 group h-full">
                                                <div className="flex-1 w-full relative">
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "10%" }}
                                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
                                                        className="w-[45%] bg-white/10 rounded-t-md group-hover:opacity-50 transition-opacity absolute bottom-0 left-0"
                                                    />
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "100%" }}
                                                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
                                                        className="w-[45%] bg-blue-500 rounded-t-md shadow-[0_0_12px_rgba(59,130,246,0.6)] absolute bottom-0 right-0 z-10"
                                                    />
                                                </div>
                                                <span className="text-[11px] font-medium text-white/40 text-center border-t border-white/10 pt-2 shrink-0">Session 3</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-center gap-8 mt-5 text-xs font-medium">
                                            <div className="flex items-center gap-2 text-white/40"><span className="w-2.5 h-2.5 rounded-full bg-white/20"></span> Standard</div>
                                            <div className="flex items-center gap-2 text-blue-400"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span> Supercharge PML</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default App
