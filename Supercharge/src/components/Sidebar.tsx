import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Settings, LogOut, ChevronDown, List, Lock, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useChatHistory } from '../hooks/useChatHistory';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    setView: (view: 'home' | 'settings' | 'chat' | 'manage-chats') => void;
    onSelectChat: (chatId: string | null) => void;
}

export function Sidebar({ isOpen, onClose, setView, onSelectChat }: SidebarProps) {
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
    const { chats } = useChatHistory();
    const { user } = useAuth();

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Sidebar Drawer */}
                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-4 left-4 z-50 w-[280px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[28px] flex flex-col overflow-hidden shadow-2xl"
                    >
                        {/* New Chat Button */}
                        <div className="p-4">
                            <button
                                onClick={() => {
                                    onSelectChat(null);
                                    setView('home');
                                    onClose();
                                }}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-all shadow-lg shadow-white/5 group"
                            >
                                <Plus className="w-5 h-5 text-black" />
                                <span>New Chat</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6">
                            {/* Utility Links Section */}
                            <div className="px-2 space-y-1 mt-2">
                                <button
                                    onClick={() => {
                                        setView('manage-chats');
                                        onClose();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors"
                                >
                                    <List className="w-4 h-4 shrink-0 text-white/50" />
                                    <span>Manage Chats</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setView('settings');
                                        onClose();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors"
                                >
                                    <Settings className="w-4 h-4 shrink-0 text-white/50" />
                                    <div className="flex-1 flex items-center justify-between text-left">
                                        <span>API Settings</span>
                                    </div>
                                </button>
                            </div>

                            {/* Chat History Section */}
                            <div className="space-y-1 border-t border-white/10 pt-4">
                                <button
                                    onClick={() => user && setIsHistoryExpanded(!isHistoryExpanded)}
                                    className={`w-full flex items-center justify-between px-2 py-2 text-xs font-medium transition-colors group ${!user ? 'text-white/30 cursor-not-allowed' : 'text-textMuted hover:text-white'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>Chat History</span>
                                        {!user && <Lock className="w-3 h-3" />}
                                    </div>
                                    {user && (
                                        <ChevronDown
                                            className={`w-4 h-4 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`}
                                        />
                                    )}
                                </button>

                                <AnimatePresence>
                                    {isHistoryExpanded && user && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-0.5 mt-2">
                                                {chats.length === 0 ? (
                                                    <div className="px-2 py-4 text-xs text-textMuted text-center">No recent chats</div>
                                                ) : (
                                                    chats.map(chat => (
                                                        <button
                                                            key={chat.id}
                                                            onClick={() => {
                                                                onSelectChat(chat.id);
                                                                setView('chat');
                                                                onClose();
                                                            }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors truncate"
                                                        >
                                                            <MessageSquare className="w-4 h-4 shrink-0 text-white/40" />
                                                            <span className="truncate">{chat.title}</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* User Info Bottom Section - Card Layout */}
                        <div className="p-4 border-t border-white/10">
                            {user ? (
                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        {user.user_metadata?.avatar_url ? (
                                            <img
                                                src={user.user_metadata.avatar_url}
                                                alt="Profile"
                                                className="w-8 h-8 rounded-full border border-white/20 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 shrink-0 flex items-center justify-center text-white/50 font-bold uppercase overflow-hidden">
                                                {user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U'}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white truncate">
                                                {user.user_metadata?.full_name || 'Profile'}
                                            </div>
                                            <div className="text-xs text-textMuted truncate">{user.email || 'user@example.com'}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => supabase.auth.signOut()}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-sm text-textMuted hover:text-white transition-all"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 backdrop-blur-xl flex flex-col items-center">
                                    <div className="text-sm font-medium text-white mb-1">Not Signed In</div>
                                    <div className="text-xs text-textMuted mb-3 text-center">Sign in to sync your chats across devices</div>
                                    <button
                                        onClick={() => {
                                            // Optional: If you want clicking this to redirect them to the auth screen, 
                                            // you can implement a method to clear the "skipped" state.
                                            // Depending on how AuthContext is set up, a page reload works best for now:
                                            window.location.reload();
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-white text-black hover:bg-neutral-200 transition-all text-sm font-medium"
                                    >
                                        <LogIn className="w-4 h-4" />
                                        <span>Sign In</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
