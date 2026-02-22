import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOutsideClick } from "../../hooks/use-outside-click";

export function ExpandableCards() {
    const [active, setActive] = useState<(typeof cards)[number] | boolean | null>(
        null
    );
    const ref = useRef<HTMLDivElement>(null);
    const id = useId();

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setActive(false);
            }
        }

        if (active && typeof active === "object") {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [active]);

    useOutsideClick(ref, () => setActive(null));

    return (
        <>
            <AnimatePresence>
                {active && typeof active === "object" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm h-full w-full z-10"
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {active && typeof active === "object" ? (
                    <div className="fixed inset-0 grid place-items-center z-[100]">
                        <motion.button
                            key={`button-${active.title}-${id}`}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{
                                opacity: 0,
                                transition: { duration: 0.05 },
                            }}
                            className="flex absolute top-4 right-4 items-center justify-center bg-white/10 hover:bg-white/20 transition-colors rounded-full h-8 w-8 z-50 text-white"
                            onClick={() => setActive(null)}
                        >
                            <CloseIcon />
                        </motion.button>
                        <motion.div
                            layoutId={`card-${active.title}-${id}`}
                            ref={ref}
                            className="w-full max-w-[500px] h-full md:h-fit md:max-h-[90%] flex flex-col bg-[#111111] border border-white/10 sm:rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <motion.div layoutId={`image-${active.title}-${id}`}>
                                <div className="w-full h-40 lg:h-48 sm:rounded-tr-3xl sm:rounded-tl-3xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center">
                                    <div className="text-6xl">{active.icon}</div>
                                </div>
                            </motion.div>

                            <div>
                                <div className="flex justify-between items-start p-6">
                                    <div>
                                        <motion.h3
                                            layoutId={`title-${active.title}-${id}`}
                                            className="font-medium text-white text-xl"
                                        >
                                            {active.title}
                                        </motion.h3>
                                        <motion.p
                                            layoutId={`description-${active.description}-${id}`}
                                            className="text-textMuted text-sm mt-1 font-mono bg-white/5 py-1 px-2 rounded-md border border-white/5 inline-block"
                                        >
                                            {active.description}
                                        </motion.p>
                                    </div>

                                    <motion.button
                                        layoutId={`button-${active.title}-${id}`}
                                        className="px-4 py-2 text-sm rounded-xl font-medium bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        {active.ctaText}
                                    </motion.button>
                                </div>
                                <div className="pt-2 relative px-6 pb-6 border-t border-white/5 mt-2">
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-white/70 text-sm h-40 flex flex-col items-start gap-4 overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch]"
                                    >
                                        {typeof active.content === "function"
                                            ? active.content()
                                            : active.content}
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                ) : null}
            </AnimatePresence>
            <ul className="w-full max-w-sm mx-auto flex flex-col gap-3">
                {cards.map((card) => (
                    <motion.div
                        layoutId={`card-${card.title}-${id}`}
                        key={`card-${card.title}-${id}`}
                        onClick={() => setActive(card)}
                        className="p-3 flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-2xl cursor-pointer transition-colors"
                    >
                        <motion.div layoutId={`image-${card.title}-${id}`} className="shrink-0 w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-xl">
                            {card.icon}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                            <motion.h3
                                layoutId={`title-${card.title}-${id}`}
                                className="font-medium text-white text-sm truncate"
                            >
                                {card.title}
                            </motion.h3>
                            <motion.p
                                layoutId={`description-${card.description}-${id}`}
                                className="text-textMuted text-xs truncate mt-0.5"
                            >
                                {card.description}
                            </motion.p>
                        </div>
                        <motion.button
                            layoutId={`button-${card.title}-${id}`}
                            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-white/5 text-white/80 border border-white/5 hover:bg-white/10 transition-colors shadow-none shrink-0"
                        >
                            {card.ctaText}
                        </motion.button>
                    </motion.div>
                ))}
            </ul>
        </>
    );
}

export const CloseIcon = () => {
    return (
        <motion.svg
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
        </motion.svg>
    );
};

const cards = [
    {
        description: "sk-proj-*****************",
        title: "OpenAI ChatGPT-4o",
        icon: "🤖",
        ctaText: "Active",
        content: () => {
            return (
                <div className="flex flex-col gap-4 w-full">
                    <p>This is your primary text generation model connected via standard API key.</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-textMuted mb-1">Tokens Used (30d)</div>
                            <div className="text-2xl font-medium text-white">45,102</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-textMuted mb-1">Estimated Cost</div>
                            <div className="text-2xl font-medium text-white">$ 0.42</div>
                        </div>
                    </div>
                    <p className="text-xs text-textMuted mt-2">Key was last used today at 10:45 AM.</p>
                </div>
            );
        },
    },
    {
        description: "sk-ant-*****************",
        title: "Anthropic Claude 3.5 Sonnet",
        icon: "🧠",
        ctaText: "Select",
        content: () => {
            return (
                <div className="flex flex-col gap-4 w-full">
                    <p>Excellent for complex reasoning and large context windows.</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-textMuted mb-1">Tokens Used (30d)</div>
                            <div className="text-2xl font-medium text-white">12,450</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-textMuted mb-1">Estimated Cost</div>
                            <div className="text-2xl font-medium text-white">$ 0.08</div>
                        </div>
                    </div>
                </div>
            );
        },
    },
    {
        description: "AIza********************",
        title: "Google Gemini 1.5 Pro",
        icon: "✨",
        ctaText: "Select",
        content: () => {
            return (
                <div className="flex flex-col gap-4 w-full">
                    <p>Incredible massive context window and fast multimodal native processing.</p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-center mt-2 h-24">
                        <div className="text-sm text-textMuted">No usage data in the last 30 days.</div>
                    </div>
                </div>
            );
        },
    }
];
