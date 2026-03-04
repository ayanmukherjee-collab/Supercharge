import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Search, MessageSquare, AlertTriangle } from 'lucide-react';
import { useChatHistory } from '../hooks/useChatHistory';

interface ManageChatsProps {
    onBack: () => void;
    onOpenSidebar: () => void;
    onSelectChat: (chatId: string) => void;
}

export function ManageChats({ onBack, onOpenSidebar, onSelectChat }: ManageChatsProps) {
    const { chats, deleteChat, loadingChats } = useChatHistory();
    const [searchQuery, setSearchQuery] = useState('');
    const [chatToDelete, setChatToDelete] = useState<string | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
    const [isMultiDeleteModalOpen, setIsMultiDeleteModalOpen] = useState(false);

    const [viewportHeight, setViewportHeight] = useState('100dvh');

    useEffect(() => {
        const visualViewport = window.visualViewport;
        const updateHeight = () => {
            if (visualViewport) {
                setViewportHeight(`${visualViewport.height}px`);
            } else {
                setViewportHeight(`${window.innerHeight}px`);
            }
        };

        updateHeight();

        if (visualViewport) {
            visualViewport.addEventListener('resize', updateHeight);
            visualViewport.addEventListener('scroll', updateHeight);
        } else {
            window.addEventListener('resize', updateHeight);
        }

        return () => {
            if (visualViewport) {
                visualViewport.removeEventListener('resize', updateHeight);
                visualViewport.removeEventListener('scroll', updateHeight);
            } else {
                window.removeEventListener('resize', updateHeight);
            }
        };
    }, []);

    const filteredChats = chats.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevents clicking the chat row
        setChatToDelete(id);
    };

    const confirmDelete = async () => {
        if (chatToDelete) {
            await deleteChat(chatToDelete);
            setChatToDelete(null);
        }
    };

    const toggleSelectAll = () => {
        if (selectedChats.size === filteredChats.length) {
            setSelectedChats(new Set());
        } else {
            setSelectedChats(new Set(filteredChats.map(c => c.id)));
        }
    };

    const confirmMultiDelete = async () => {
        for (const id of selectedChats) {
            await deleteChat(id);
        }
        setSelectedChats(new Set());
        setIsMultiDeleteModalOpen(false);
        setIsSelectionMode(false);
    };

    return (
        <div className="fixed top-0 left-0 w-full flex flex-col bg-black overflow-hidden" style={{ height: viewportHeight }}>
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.04] blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <h1 className="text-sm font-medium text-white/90">
                        {isSelectionMode ? `${selectedChats.size} Selected` : 'Manage Chats'}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                        <>
                            <button
                                onClick={toggleSelectAll}
                                className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                {selectedChats.size === filteredChats.length && filteredChats.length > 0 ? 'Deselect All' : 'Select All'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsSelectionMode(false);
                                    setSelectedChats(new Set());
                                }}
                                className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsSelectionMode(true)}
                            className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            disabled={filteredChats.length === 0}
                        >
                            Select
                        </button>
                    )}
                    <button
                        onClick={onOpenSidebar}
                        className="w-9 h-9 ml-1 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                            <line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.5" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search your conversations..."
                            className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-white/20 transition-colors placeholder:text-white/30"
                        />
                    </div>

                    {/* Chat List */}
                    <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
                        {loadingChats ? (
                            <div className="p-8 text-center text-sm text-white/50">
                                Loading chats...
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center">
                                <MessageSquare className="w-10 h-10 text-white/10 mb-4" />
                                <h3 className="text-white/80 font-medium mb-1">No chats found</h3>
                                <p className="text-sm text-white/40">
                                    {searchQuery ? "Try adjusting your search terms." : "You haven't started any conversations yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {filteredChats.map((chat) => (
                                    <div
                                        key={chat.id}
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                const newSelected = new Set(selectedChats);
                                                if (newSelected.has(chat.id)) newSelected.delete(chat.id);
                                                else newSelected.add(chat.id);
                                                setSelectedChats(newSelected);
                                            } else {
                                                onSelectChat(chat.id);
                                            }
                                        }}
                                        className={`group p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedChats.has(chat.id) ? 'bg-white/[0.05]' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden pr-4">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${selectedChats.has(chat.id)
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-white/20'
                                                    }`}>
                                                    {selectedChats.has(chat.id) && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                    <MessageSquare className="w-5 h-5 text-white/50" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-medium text-white/90 truncate mb-1">
                                                    {chat.title}
                                                </h3>
                                                <p className="text-xs text-white/40">
                                                    {new Date(chat.created_at).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {!isSelectionMode && (
                                            <button
                                                onClick={(e) => handleDelete(chat.id, e)}
                                                className="w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-white/40 transition-all shrink-0"
                                                title="Delete Chat"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {/* Spacer for bottom action bar when in selection mode */}
                {isSelectionMode && <div className="h-20" />}
            </main>

            {/* Selection Mode Bottom Bar */}
            <AnimatePresence>
                {isSelectionMode && selectedChats.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 p-4 z-40 bg-gradient-to-t from-black via-black/90 to-transparent"
                    >
                        <div className="max-w-3xl mx-auto flex items-center justify-center">
                            <button
                                onClick={() => setIsMultiDeleteModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shadow-2xl backdrop-blur-xl"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Delete {selectedChats.size} Chat{selectedChats.size > 1 ? 's' : ''}</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {chatToDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setChatToDelete(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 text-red-400">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">Delete Chat</h2>
                            <p className="text-sm text-textMuted mb-6 leading-relaxed">
                                Are you sure you want to delete this chat? This action cannot be undone and will remove all messages within.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setChatToDelete(null)}
                                    className="flex-1 px-4 py-2.5 rounded-full border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {isMultiDeleteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsMultiDeleteModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 text-red-400">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">Delete Multiple Chats</h2>
                            <p className="text-sm text-white/50 mb-6 leading-relaxed">
                                Are you sure you want to delete {selectedChats.size} selected chat{selectedChats.size > 1 ? 's' : ''}? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsMultiDeleteModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-full border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmMultiDelete}
                                    className="flex-1 px-4 py-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                >
                                    Delete All
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
