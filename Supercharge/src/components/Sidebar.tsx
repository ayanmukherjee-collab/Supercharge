import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Settings, LogOut, ChevronDown, List } from 'lucide-react';
import { useState } from 'react';
import { ExpandableCards } from './ui/expandable-cards';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
    const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);

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
                                    console.log('New chat clicked');
                                    onClose();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors text-white text-sm font-medium shadow-none"
                            >
                                <Plus className="w-5 h-5 text-white" />
                                <span>New Chat</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6">
                            {/* Utility Links Section */}
                            <div className="px-2 space-y-1 mt-2">
                                <button className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors">
                                    <List className="w-4 h-4 shrink-0 text-white/50" />
                                    <span>Manage Chats</span>
                                </button>
                                <button
                                    onClick={() => setIsApiSettingsOpen(true)}
                                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors"
                                >
                                    <Settings className="w-4 h-4 shrink-0 text-white/50" />
                                    <div className="flex-1 flex items-center justify-between">
                                        <span>API Settings</span>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/70">OpenAI</span>
                                    </div>
                                </button>
                            </div>

                            {/* Chat History Section */}
                            <div className="space-y-1 border-t border-white/10 pt-4">
                                <button
                                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                    className="w-full flex items-center justify-between px-2 py-2 text-xs font-medium text-textMuted hover:text-white transition-colors group"
                                >
                                    <span>Chat History</span>
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                <AnimatePresence>
                                    {isHistoryExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-0.5">
                                                {/* Mock History Items */}
                                                <div className="px-2 py-1.5 text-xs text-textMuted font-medium mt-1">Today</div>
                                                <button className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors truncate">
                                                    <MessageSquare className="w-4 h-4 shrink-0 text-white/40" />
                                                    <span className="truncate">React Optimization Tips</span>
                                                </button>
                                                <button className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors truncate">
                                                    <MessageSquare className="w-4 h-4 shrink-0 text-white/40" />
                                                    <span className="truncate">Explain Quantum Computing</span>
                                                </button>

                                                <div className="px-2 py-1.5 text-xs text-textMuted font-medium mt-4">Yesterday</div>
                                                <button className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 text-sm text-white/80 hover:text-white transition-colors truncate">
                                                    <MessageSquare className="w-4 h-4 shrink-0 text-white/40" />
                                                    <span className="truncate">Dinner Recipes</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* User Info Bottom Section - Card Layout */}
                        <div className="p-4 border-t border-white/10">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 backdrop-blur-xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">User Name</div>
                                        <div className="text-xs text-textMuted truncate">user@example.com</div>
                                    </div>
                                </div>
                                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-sm text-textMuted hover:text-white transition-all">
                                    <LogOut className="w-4 h-4" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}

            {isApiSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsApiSettingsOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl bg-backgroundSurface border border-white/10 rounded-2xl shadow-2xl p-6 m-4 z-10 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div>
                                <h2 className="text-xl font-medium text-white">API Settings</h2>
                                <p className="text-sm text-textMuted mt-1">Manage your connected AI models and API keys.</p>
                            </div>
                            <button
                                onClick={() => setIsApiSettingsOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 1L1 13M1 1l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 relative">
                            <ExpandableCards />
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
