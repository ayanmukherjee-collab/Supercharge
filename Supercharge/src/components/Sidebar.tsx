import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Settings, LogOut, ChevronDown, Lock, LogIn, Search, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { signOut } from 'firebase/auth';
import { useChatHistory } from '../hooks/useChatHistory';
import { useAuth } from '../lib/AuthContext';
import { auth } from '../lib/firebase';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    setView: (view: 'home' | 'settings' | 'chat' | 'manage-chats') => void;
    onSelectChat: (chatId: string | null) => void;
}

export function Sidebar({ isOpen, onClose, setView, onSelectChat }: SidebarProps) {
    const [viewMode, setViewMode] = useState<'default' | 'history'>('default');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    
    const { chats, deleteChat } = useChatHistory();
    const { user } = useAuth();

    const filteredChats = useMemo(() => {
        if (!searchQuery.trim()) return chats;
        return chats.filter(chat => chat.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [chats, searchQuery]);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedChats);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedChats(next);
    };

    const handleDeleteSelected = async () => {
        for (const id of Array.from(selectedChats)) {
            await deleteChat(id);
        }
        setSelectedChats(new Set());
        setIsSelectionMode(false);
    };

    const resetHistoryState = () => {
        setViewMode('default');
        setSearchQuery('');
        setIsSelectionMode(false);
        setSelectedChats(new Set());
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-transparent"
                    />

                    {/* Sidebar Drawer */}
                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                        layout
                        className={`fixed top-4 left-4 z-50 bg-[#1c1c1e]/60 backdrop-blur-3xl border border-white/10 rounded-[20px] flex flex-col overflow-hidden shadow-2xl ${
                            viewMode === 'history' ? 'w-[450px] h-[75vh]' : 'w-[280px] h-[50vh]'
                        }`}
                    >
                        {viewMode === 'history' ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 shrink-0 bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={resetHistoryState}
                                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <ChevronDown className="w-5 h-5 rotate-90 text-white" />
                                        </button>
                                        <span className="font-semibold text-white">Chat History</span>
                                    </div>
                                    <div>
                                        {isSelectionMode ? (
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setIsSelectionMode(false);
                                                        setSelectedChats(new Set());
                                                    }}
                                                    className="text-xs text-white/60 hover:text-white px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                                                >
                                                    Cancel
                                                </button>
                                                {selectedChats.size > 0 && (
                                                    <button 
                                                        onClick={handleDeleteSelected}
                                                        className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors font-medium"
                                                    >
                                                        Delete ({selectedChats.size})
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setIsSelectionMode(true)}
                                                className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 font-medium"
                                            >
                                                Select
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Search Bar */}
                                <div className="px-4 pb-3 pt-1 shrink-0">
                                    <div className="relative flex items-center w-full bg-black/20 border border-white/5 rounded-xl overflow-hidden focus-within:border-white/20 transition-colors">
                                        <div className="pl-3 pr-2 flex items-center justify-center">
                                            <Search className="w-4 h-4 text-white/40" />
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Search conversations..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-transparent py-2.5 text-sm text-white placeholder-white/30 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
                                    {filteredChats.map(chat => (
                                        <div key={chat.id} className="flex items-center group px-2">
                                            {isSelectionMode && (
                                                <button 
                                                    onClick={() => toggleSelect(chat.id)}
                                                    className="p-2 mr-1 shrink-0"
                                                >
                                                    <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                                                        selectedChats.has(chat.id) 
                                                            ? 'bg-blue-500 border-blue-500' 
                                                            : 'border-white/20 group-hover:border-white/40'
                                                    }`}>
                                                        {selectedChats.has(chat.id) && (
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </div>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (isSelectionMode) {
                                                        toggleSelect(chat.id);
                                                    } else {
                                                        onSelectChat(chat.id);
                                                        setView('chat');
                                                        onClose();
                                                    }
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors truncate ${
                                                    isSelectionMode 
                                                        ? 'hover:bg-transparent cursor-default' 
                                                        : 'hover:bg-white/10 text-white/80 hover:text-white'
                                                }`}
                                            >
                                                <MessageSquare className="w-4 h-4 shrink-0 text-white/40" />
                                                <span className="truncate flex-1 text-left">{chat.title}</span>
                                            </button>
                                            {!isSelectionMode && (
                                                <button 
                                                    onClick={() => deleteChat(chat.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all shrink-0"
                                                    title="Delete chat"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {filteredChats.length === 0 && (
                                        <div className="text-center py-10 px-4">
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                                <Search className="w-5 h-5 text-white/30" />
                                            </div>
                                            <div className="text-sm font-medium text-white/60">No conversations found</div>
                                            <div className="text-xs text-white/30 mt-1">Try adjusting your search query.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* New Chat Button */}
                                <div className="p-4 shrink-0">
                                    <button
                                        onClick={() => {
                                            onSelectChat(null);
                                            setView('home');
                                            onClose();
                                        }}
                                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-neutral-200 transition-all shadow-lg shadow-white/5 group"
                                    >
                                        <Plus className="w-5 h-5 text-black" />
                                        <span>New Chat</span>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
                                    {/* Utility Links Section */}
                                    <div className="space-y-1">
                                        <button
                                            onClick={() => {
                                                setView('settings');
                                                onClose();
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm text-white/80 hover:text-white transition-colors"
                                        >
                                            <Settings className="w-4 h-4 shrink-0 text-white/50" />
                                            <div className="flex-1 flex items-center justify-between text-left">
                                                <span>API Settings</span>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Chat History Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white/40">
                                            <span>Chat History</span>
                                            {!user && <Lock className="w-3 h-3" />}
                                        </div>

                                        {user && (
                                            <div className="space-y-0.5">
                                                {chats.length === 0 ? (
                                                    <div className="px-3 py-4 text-xs text-white/40 text-center">No recent chats</div>
                                                ) : (
                                                    <>
                                                        {chats.slice(0, 5).map(chat => (
                                                            <button
                                                                key={chat.id}
                                                                onClick={() => {
                                                                    onSelectChat(chat.id);
                                                                    setView('chat');
                                                                    onClose();
                                                                }}
                                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm text-white/80 hover:text-white transition-colors truncate"
                                                            >
                                                                <MessageSquare className="w-4 h-4 shrink-0 text-white/40" />
                                                                <span className="truncate text-left">{chat.title}</span>
                                                            </button>
                                                        ))}
                                                        
                                                        {/* Always show this if there are any chats, so user can access the new history modal */}
                                                        <button
                                                            onClick={() => setViewMode('history')}
                                                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mt-1 rounded-xl hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors"
                                                        >
                                                            <span>Show More</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* User Info Bottom Section - Card Layout */}
                                <div className="p-4 shrink-0">
                                    {user ? (
                                        <div className="bg-white/[0.03] rounded-[16px] p-3">
                                            <div className="flex items-center gap-3 mb-3">
                                                {user.photoURL ? (
                                                    <img
                                                        src={user.photoURL}
                                                        alt="Profile"
                                                        className="w-8 h-8 rounded-full shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-white/50 font-bold uppercase overflow-hidden">
                                                        {user.displayName?.[0] || user.email?.[0] || 'U'}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-white truncate">
                                                        {user.displayName || 'Profile'}
                                                    </div>
                                                    <div className="text-xs text-white/40 truncate">{user.email || 'user@example.com'}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => signOut(auth)}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span>Sign Out</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-white/[0.03] rounded-[16px] p-3 flex flex-col items-center">
                                            <div className="text-sm font-medium text-white mb-1">Not Signed In</div>
                                            <div className="text-xs text-white/40 mb-3 text-center">Sign in to sync your chats across devices</div>
                                            <button
                                                onClick={() => {
                                                    window.location.reload();
                                                }}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 transition-all text-sm font-medium"
                                            >
                                                <LogIn className="w-4 h-4" />
                                                <span>Sign In</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
