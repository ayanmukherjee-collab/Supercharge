import { Mic, ChevronDown, Send } from 'lucide-react'
import { PlaceholdersAndVanishInput } from './components/ui/placeholders-and-vanish-input'
import { Sidebar } from './components/Sidebar'
import { ApiSettingsPage } from './components/ApiSettingsPage'
import { ChatView } from './components/ChatView'
import { AuthScreen } from './components/AuthScreen'
import { useAuth } from './lib/AuthContext'
import { useState, useRef, useEffect } from 'react'
import { useApiKeyStore, getModelFamily, type ApiProvider } from './lib/apiKeyStore'
import { ProviderIcons } from './components/icons/ProviderIcons'
import { ManageChats } from './components/ManageChats'

type ViewState = 'home' | 'settings' | 'chat' | 'manage-chats'

function App() {
    const { user, loading } = useAuth()
    const { providers } = useApiKeyStore()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [view, setView] = useState<ViewState>('home')
    const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null)
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
    const [pendingMessage, setPendingMessage] = useState('')
    const [activeChatId, setActiveChatId] = useState<string | null>(null)
    const [inputValue, setInputValue] = useState('')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Auto-select first provider if none selected
    useEffect(() => {
        if (!selectedProvider && providers.length > 0) {
            setSelectedProvider(providers[0])
        }
        // If the selected provider was deleted, fall back
        if (selectedProvider && !providers.find((p) => p.id === selectedProvider.id)) {
            setSelectedProvider(providers[0] || null)
        }
    }, [providers, selectedProvider])

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsModelDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const placeholders = [
        "Ask anything ...",
        "Any advice for me?",
        "Some youtube video idea",
        "Life lessons from kratos",
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Get value from the input
        const form = e.currentTarget;
        const input = form.querySelector('input') as HTMLInputElement;
        const value = input?.value?.trim();
        if (!value) return;

        if (!selectedProvider) {
            // No API key configured — go to settings
            setView('settings');
            return;
        }

        setPendingMessage(value);
        setActiveChatId(null);
        setView('chat');
        setInputValue('');
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black">
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!user) {
        return <AuthScreen />
    }

    // ── Settings View ──
    if (view === 'settings') {
        return (
            <div className="flex flex-col min-h-screen bg-black">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    setView={setView}
                    onSelectChat={setActiveChatId}
                />
                <ApiSettingsPage onBack={() => setView('home')} onOpenSidebar={() => setIsSidebarOpen(true)} />
            </div>
        )
    }

    // ── Manage Chats View ──
    if (view === 'manage-chats') {
        return (
            <div className="flex flex-col min-h-screen bg-black">
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
                        setActiveChatId(id);
                        setView('chat');
                    }}
                />
            </div>
        )
    }

    // ── Chat View ──
    if (view === 'chat' && (selectedProvider || activeChatId)) {
        return (
            <div className="flex flex-col h-screen bg-black overflow-hidden relative">
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
                    onBack={() => {
                        setView('home');
                        setPendingMessage('');
                        setActiveChatId(null);
                    }}
                    onOpenSidebar={() => setIsSidebarOpen(true)}
                />
            </div>
        )
    }

    // ── Home View ──
    return (
        <div className="flex flex-col min-h-screen items-center justify-center p-4 relative overflow-hidden">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                setView={setView}
                onSelectChat={setActiveChatId}
            />

            {/* Ambient Background Spotlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.06] blur-[120px] rounded-full pointer-events-none" />

            {/* Top Bar */}
            <div className="absolute top-0 w-full p-6 flex justify-start items-center z-10">
                <div onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center glass-hover cursor-pointer z-50">
                    <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                        <line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.5" />
                    </svg>
                </div>
            </div>

            {/* Main Content */}
            <main className="w-full max-w-2xl flex flex-col items-center mt-[-8vh]">
                {/* Logo */}
                <div className="mb-10 flex items-center justify-center">
                    <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-12 h-12 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
                    >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                </div>

                {/* Hero Text */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <h1 className="text-[40px] md:text-[48px] leading-tight font-medium tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500">
                        {(() => {
                            const hour = new Date().getHours();
                            if (hour < 12) return 'Good morning';
                            if (hour < 18) return 'Good afternoon';
                            return 'Good evening';
                        })()}
                    </h1>
                    <h2 className="text-base md:text-lg font-medium text-white/60">
                        how may I help you today?
                    </h2>
                </div>

                {/* Input Area */}
                <div className="w-full max-w-3xl flex flex-col gap-3 relative px-4 md:px-0">
                    {/* Model Selector */}
                    <div className="flex items-center px-1" ref={dropdownRef}>
                        <div className="relative">
                            {providers.length > 0 && selectedProvider ? (
                                <>
                                    <button
                                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                        className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors py-1.5 px-3 rounded-full hover:bg-white/5"
                                    >
                                        {ProviderIcons[selectedProvider.family as keyof typeof ProviderIcons]
                                            ? ProviderIcons[selectedProvider.family as keyof typeof ProviderIcons]({ className: "w-3 h-3 text-white/80" })
                                            : <span
                                                className="w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                                                style={{ backgroundColor: getModelFamily(selectedProvider.family).color }}
                                            />}
                                        <span>{selectedProvider.label}</span>
                                        <ChevronDown className={`w-3 h-3 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isModelDropdownOpen && (
                                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl py-1 z-50 backdrop-blur-xl">
                                            {providers.map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedProvider(p)
                                                        setIsModelDropdownOpen(false)
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between rounded-full ${selectedProvider.id === p.id
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
                                                    {selectedProvider.id === p.id && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <button
                                    onClick={() => setView('settings')}
                                    className="flex items-center gap-2 text-xs text-amber-400/70 hover:text-amber-400 transition-colors py-1 px-2 rounded-lg hover:bg-white/5"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                                    <span>Add an API key to start chatting</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Glowing Input Box */}
                    <div className="relative w-full rounded-full">
                        <div className="w-full rounded-full bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl">
                            <div className="flex items-center gap-3 px-5 py-3">




                                <div className="flex-1 overflow-hidden">
                                    <PlaceholdersAndVanishInput
                                        placeholders={placeholders}
                                        onChange={handleChange}
                                        onSubmit={onSubmit}
                                    />
                                </div>

                                <button
                                    className="text-textMuted hover:text-white transition-colors shrink-0"
                                    type={inputValue.trim() ? "submit" : "button"}
                                >
                                    {inputValue.trim() ? (
                                        <Send className="w-[18px] h-[18px] opacity-70" />
                                    ) : (
                                        <Mic className="w-[18px] h-[18px] opacity-70" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default App
