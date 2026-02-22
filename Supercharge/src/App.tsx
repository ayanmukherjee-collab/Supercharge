import { Plus, Mic } from 'lucide-react'
import { PlaceholdersAndVanishInput } from './components/ui/placeholders-and-vanish-input'

import { Sidebar } from './components/Sidebar'
import { useState } from 'react'

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    const placeholders = [
        "Ask anything ...",
        "Any advice for me?",
        "Some youtube video idea",
        "Life lessons from kratos",
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e.target.value);
    };
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log("submitted");
    };

    return (
        <div className="flex flex-col min-h-screen items-center justify-center p-4 relative overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Ambient Background Spotlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.06] blur-[120px] rounded-full pointer-events-none" />

            {/* Top Bar placeholders */}
            <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
                <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center glass cursor-pointer z-50">
                    <svg onClick={() => setIsSidebarOpen(true)} className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                        <line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.5" />
                    </svg>
                </div>
                <button className="flex items-center justify-center w-10 h-10 rounded-full glass hover:bg-white/10 transition-colors overflow-hidden">
                    <svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                </button>
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
                <div className="w-full max-w-[640px] flex flex-col gap-3 relative px-4 md:px-0">
                    {/* Active extensions indicator */}
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2 text-[#475569] hover:text-textMuted transition-colors cursor-pointer text-xs shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                            <span>Unlock more features with the Pro plan.</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#475569] text-xs shrink-0 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                            <span>Active extensions</span>
                        </div>
                    </div>

                    {/* Glowing Input Box */}
                    <div className="relative w-full rounded-[24px]">
                        <div className="w-full rounded-[24px] bg-[#111111] border border-white/[0.06]">
                            <div className="flex items-center gap-3 px-5 py-3">
                                <button className="text-textMuted hover:text-white transition-colors shrink-0">
                                    <Plus className="w-5 h-5 opacity-70" />
                                </button>

                                <div className="h-4 w-px bg-white/10 mx-1 shrink-0" />

                                <div className="flex-1 overflow-hidden">
                                    <PlaceholdersAndVanishInput
                                        placeholders={placeholders}
                                        onChange={handleChange}
                                        onSubmit={onSubmit}
                                    />
                                </div>

                                <button className="text-textMuted hover:text-white transition-colors shrink-0">
                                    <Mic className="w-[18px] h-[18px] opacity-70" />
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
