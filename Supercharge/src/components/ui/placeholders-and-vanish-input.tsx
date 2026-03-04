"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Send } from "lucide-react";
import { cn } from "../../lib/utils";

const slideUpStyle = `
@keyframes slideUpChar {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

export function PlaceholdersAndVanishInput({
    placeholders,
    onChange,
    onSubmit,
}: {
    placeholders: string[];
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (value: string, e?: React.FormEvent<HTMLFormElement>) => void;
}) {
    const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showExpandButton, setShowExpandButton] = useState(false);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startAnimation = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
            setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
        }, 3000);
    };
    const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible" && intervalRef.current) {
            clearInterval(intervalRef.current); // Clear the interval when the tab is not visible
            intervalRef.current = null;
        } else if (document.visibilityState === "visible") {
            startAnimation(); // Restart the interval when the tab becomes visible
        }
    };

    useEffect(() => {
        startAnimation();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [placeholders]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const newDataRef = useRef<any[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState("");
    const [animating, setAnimating] = useState(false);

    const draw = useCallback(() => {
        if (!inputRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 800;
        canvas.height = 800;
        ctx.clearRect(0, 0, 800, 800);
        const computedStyles = getComputedStyle(inputRef.current);

        const fontSize = parseFloat(computedStyles.getPropertyValue("font-size"));
        ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`;
        ctx.fillStyle = "#FFF";
        ctx.fillText(value, 16, 40);

        const imageData = ctx.getImageData(0, 0, 800, 800);
        const pixelData = imageData.data;
        const newData: any[] = [];

        for (let t = 0; t < 800; t++) {
            let i = 4 * t * 800;
            for (let n = 0; n < 800; n++) {
                let e = i + 4 * n;
                if (
                    pixelData[e] !== 0 &&
                    pixelData[e + 1] !== 0 &&
                    pixelData[e + 2] !== 0
                ) {
                    newData.push({
                        x: n,
                        y: t,
                        color: [
                            pixelData[e],
                            pixelData[e + 1],
                            pixelData[e + 2],
                            pixelData[e + 3],
                        ],
                    });
                }
            }
        }

        newDataRef.current = newData.map(({ x, y, color }) => ({
            x,
            y,
            r: 1,
            color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`,
        }));
    }, [value]);

    useEffect(() => {
        draw();
    }, [value, draw]);

    const animate = (start: number) => {
        const animateFrame = (pos: number = 0) => {
            requestAnimationFrame(() => {
                const newArr = [];
                for (let i = 0; i < newDataRef.current.length; i++) {
                    const current = newDataRef.current[i];
                    if (current.x < pos) {
                        newArr.push(current);
                    } else {
                        if (current.r <= 0) {
                            current.r = 0;
                            continue;
                        }
                        current.x += Math.random() > 0.5 ? 1 : -1;
                        current.y += Math.random() > 0.5 ? 1 : -1;
                        current.r -= 0.05 * Math.random();
                        newArr.push(current);
                    }
                }
                newDataRef.current = newArr;
                const ctx = canvasRef.current?.getContext("2d");
                if (ctx) {
                    ctx.clearRect(pos, 0, 800, 800);
                    newDataRef.current.forEach((t) => {
                        const { x: n, y: i, r: s, color: color } = t;
                        if (n > pos) {
                            ctx.beginPath();
                            ctx.rect(n, i, s, s);
                            ctx.fillStyle = color;
                            ctx.strokeStyle = color;
                            ctx.stroke();
                        }
                    });
                }
                if (newDataRef.current.length > 0) {
                    animateFrame(pos - 8);
                } else {
                    setValue("");
                    setAnimating(false);
                }
            });
        };
        animateFrame(start);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !animating) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const vanishAndSubmit = (currentValue: string) => {
        if (currentValue.includes('\n') || currentValue.length > 50) {
            // Skip vanish animation for long/multi-line text
            setValue("");
            setIsExpanded(false);
            if (inputRef.current) inputRef.current.style.height = 'auto';
            return;
        }

        setAnimating(true);
        draw();

        if (currentValue && inputRef.current) {
            const maxX = newDataRef.current.reduce(
                (prev, current) => (current.x > prev ? current.x : prev),
                0
            );
            animate(maxX);
        }
    };

    const handleSubmit = (e?: React.FormEvent<HTMLFormElement> | React.FormEvent) => {
        if (e) e.preventDefault();
        const currentValue = inputRef.current?.value || "";
        if (!currentValue.trim() || animating) return;
        vanishAndSubmit(currentValue);
        onSubmit && onSubmit(currentValue, e as any);
    };
    return (
        <div className="relative w-full">
            <form
                className={cn(
                    "w-full relative max-w-xl mx-auto bg-transparent transition duration-200 px-4 py-4",
                    value && "bg-transparent"
                )}
                onSubmit={(e) => handleSubmit(e)}
            >
                <style>{slideUpStyle}</style>
                <canvas
                    className={cn(
                        "absolute pointer-events-none text-base transform scale-50 top-[18px] left-4 origin-top-left filter invert dark:invert-0",
                        !animating ? "opacity-0" : "opacity-100"
                    )}
                    ref={canvasRef}
                />
                <textarea
                    onChange={(e) => {
                        if (!animating) {
                            setValue(e.target.value);
                            e.target.style.height = 'auto';
                            const scrollHeight = e.target.scrollHeight;
                            e.target.style.height = `${Math.min(scrollHeight, 180)}px`;
                            if (scrollHeight > 35) {
                                setShowExpandButton(true);
                            } else if (e.target.value.trim() === '') {
                                setShowExpandButton(false);
                            }
                            onChange && onChange(e as any);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    ref={inputRef}
                    value={value}
                    rows={1}
                    className={cn(
                        "w-full bg-transparent text-[15px] sm:text-base z-50 border-none focus:outline-none focus:ring-0 caret-white/70 resize-none p-0 pr-12 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-200 block",
                        animating ? "text-transparent" : "text-textPrimary"
                    )}
                    style={{ minHeight: isExpanded ? '50vh' : '26px', maxHeight: isExpanded ? '50vh' : '180px' }}
                />

                <div className="absolute inset-0 flex items-start px-4 py-4 pointer-events-none">
                    <AnimatePresence mode="wait">
                        {!value && (
                            <motion.p
                                initial={{ y: 5, opacity: 0 }}
                                key={`current-placeholder-${currentPlaceholder}`}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -15, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "linear" }}
                                className="text-textMuted/40 text-[15px] sm:text-base md:text-lg font-medium text-left w-full truncate pr-12"
                            >
                                {placeholders[currentPlaceholder]}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                {/* Maximize Button - Top Right */}
                <AnimatePresence>
                    {(showExpandButton || isExpanded) && !animating && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/5 hover:bg-white/10 text-white/50 hover:text-white/90 transition-all z-50"
                            title={isExpanded ? "Minimize" : "Expand"}
                        >
                            {isExpanded ? <Minimize2 className="w-[14px] h-[14px]" /> : <Maximize2 className="w-[14px] h-[14px]" />}
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Send Button - Bottom Right */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center justify-center z-50">
                    <button
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                        type={value.trim() ? "submit" : "button"}
                        disabled={animating}
                    >
                        {value.trim() ? (
                            <Send className="w-[17px] h-[17px] opacity-70" />
                        ) : (
                            <svg className="w-[17px] h-[17px] opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                        )}
                    </button>
                </div>
            </form>

        </div>
    );
}
