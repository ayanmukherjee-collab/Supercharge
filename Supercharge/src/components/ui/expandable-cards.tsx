import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOutsideClick } from "../../hooks/use-outside-click";
import { Pencil, Plus, Trash2, Eye, EyeOff, Check, ChevronDown, Search, ArrowLeft, Star } from "lucide-react";
import {
    useApiKeyStore,
    getModelFamily,
    getPopularFamilies,
    searchFamilies,
    MODEL_FAMILIES,

    type ModelFamily,
    type ApiProvider,
    type SourceType,
} from "../../lib/apiKeyStore";

export function ExpandableCards() {
    const { providers, addProvider, updateProvider, deleteProvider } = useApiKeyStore();
    const [active, setActive] = useState<ApiProvider | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const id = useId();

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setActive(null);
                setIsAdding(false);
            }
        }

        if (active || isAdding) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [active, isAdding]);

    useOutsideClick(ref, () => {
        setActive(null);
        setIsAdding(false);
    });

    return (
        <>
            {/* ── Expanded Card Overlay ── */}
            <AnimatePresence>
                {active && (
                    <ExpandedProviderCard
                        key={active.id}
                        provider={active}
                        layoutId={id}
                        innerRef={ref}
                        onClose={() => setActive(null)}
                        onSave={(updated) => {
                            updateProvider(updated);
                            setActive(null);
                        }}
                        onDelete={() => {
                            deleteProvider(active.id);
                            setActive(null);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ── Add Model Modal ── */}
            <AnimatePresence>
                {isAdding && (
                    <AddModelModal
                        innerRef={ref}
                        onClose={() => setIsAdding(false)}
                        onAdd={(data) => {
                            addProvider(data);
                            setIsAdding(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ── Card List ── */}
            <ul className="w-full flex flex-col">
                {providers.length === 0 && (
                    <div className="py-12 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-white/30" />
                        </div>
                        <div>
                            <p className="text-sm text-white/50 font-medium">No AI models configured</p>
                            <p className="text-xs text-white/30 mt-1">Add a model below to start chatting</p>
                        </div>
                    </div>
                )}

                {providers.map((provider, index) => {
                    const family = getModelFamily(provider.family);
                    return (
                        <motion.div
                            layoutId={`card-${provider.id}-${id}`}
                            key={provider.id}
                            onClick={() => setActive(provider)}
                            className={`py-4 px-2 flex items-center gap-4 hover:bg-white/[0.03] cursor-pointer transition-colors rounded-lg ${index < providers.length - 1 ? "border-b border-white/5" : ""
                                }`}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                style={{
                                    backgroundColor: family.color + "15",
                                    border: `1px solid ${family.color}25`,
                                    color: family.color,
                                }}
                            >
                                {family.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <motion.h3
                                    layoutId={`title-${provider.id}-${id}`}
                                    className="font-medium text-white text-sm truncate"
                                >
                                    {provider.label}
                                </motion.h3>
                                <motion.p
                                    layoutId={`desc-${provider.id}-${id}`}
                                    className="text-textMuted text-xs truncate mt-0.5"
                                >
                                    {maskKey(provider.apiKey)} · {provider.model} · <span className="capitalize">{provider.source}</span>
                                </motion.p>
                            </div>
                            <motion.button
                                layoutId={`btn-${provider.id}-${id}`}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors shadow-none shrink-0"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </motion.button>
                        </motion.div>
                    );
                })}

                {/* Add New */}
                <button
                    onClick={() => setIsAdding(true)}
                    className="py-4 px-2 flex items-center gap-4 hover:bg-white/[0.03] cursor-pointer transition-all group rounded-lg border-t border-white/5 mt-1"
                >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-white/50 group-hover:text-white transition-colors">
                            Add AI Model
                        </div>
                        <div className="text-xs text-textMuted mt-0.5">
                            Connect any AI model service
                        </div>
                    </div>
                </button>
            </ul>
        </>
    );
}

// ── Expanded Provider Card ────────────────────────────────────

function ExpandedProviderCard({
    provider,
    layoutId,
    innerRef,
    onClose,
    onSave,
    onDelete,
}: {
    provider: ApiProvider;
    layoutId: string;
    innerRef: React.RefObject<HTMLDivElement>;
    onClose: () => void;
    onSave: (p: ApiProvider) => void;
    onDelete: () => void;
}) {
    const [apiKey, setApiKey] = useState(provider.apiKey);
    const [model, setModel] = useState(provider.model);
    const [label, setLabel] = useState(provider.label);
    const [source, setSource] = useState<SourceType>(provider.source);
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const family = getModelFamily(provider.family);

    const handleSave = () => {
        onSave({ ...provider, apiKey, model, label, source });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div className="fixed inset-0 grid place-items-center z-[100]">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                layoutId={`card-${provider.id}-${layoutId}`}
                ref={innerRef}
                className="relative w-full max-w-[460px] flex flex-col bg-[#111111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl m-4"
            >
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start p-6">
                        <div>
                            <motion.h3
                                layoutId={`title-${provider.id}-${layoutId}`}
                                className="font-medium text-white text-xl"
                            >
                                {provider.label}
                            </motion.h3>
                            <motion.p
                                layoutId={`desc-${provider.id}-${layoutId}`}
                                className="text-xs mt-1 px-2 py-0.5 rounded-md inline-block font-medium"
                                style={{
                                    backgroundColor: family.color + "15",
                                    color: family.color,
                                    border: `1px solid ${family.color}25`,
                                }}
                            >
                                {family.name}
                            </motion.p>
                        </div>
                        <motion.button
                            layoutId={`btn-${provider.id}-${layoutId}`}
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                        >
                            <CloseIcon />
                        </motion.button>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 px-6 pb-4 border-t border-white/5 mt-2 pt-4 space-y-4">
                        {/* Label */}
                        <div>
                            <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Label</label>
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
                            />
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="text-xs text-white/40 uppercase tracking-wider font-medium">API Key</label>
                            <div className="relative mt-1.5">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-white/20 transition-colors pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors"
                                >
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Model */}
                        <div>
                            <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Model</label>
                            <div className="relative mt-1.5">
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer transition-colors"
                                >
                                    {family.variants.map((m) => (
                                        <option key={m.value} value={m.value} className="bg-[#111] text-white">
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                            </div>
                        </div>

                        {/* Provider Source */}
                        <div>
                            <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Provider</label>
                            <div className="relative mt-1.5">
                                <select
                                    value={source}
                                    onChange={(e) => setSource(e.target.value as SourceType)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer transition-colors"
                                >
                                    {family.sources.map((s) => (
                                        <option
                                            key={s.sourceType}
                                            value={s.sourceType}
                                            disabled={s.comingSoon}
                                            className="bg-[#111] text-white"
                                        >
                                            {s.label}{s.comingSoon ? ' (Coming Soon)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/5 hover:border-white/10 transition-all"
                        >
                            {saved ? (
                                <>
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    <span className="text-emerald-400">Saved</span>
                                </>
                            ) : (
                                <span>Save Changes</span>
                            )}
                        </button>
                    </div>

                    {/* Delete */}
                    <div className="px-6 pb-6 pt-2 mt-auto">
                        <button
                            onClick={onDelete}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete API Key</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ── Add Model Modal ───────────────────────────────────────────

function AddModelModal({
    innerRef,
    onClose,
    onAdd,
}: {
    innerRef: React.RefObject<HTMLDivElement>;
    onClose: () => void;
    onAdd: (data: Omit<ApiProvider, "id">) => void;
}) {
    const [selectedFamily, setSelectedFamily] = useState<ModelFamily | null>(null);
    const [search, setSearch] = useState("");
    const [label, setLabel] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("");
    const [source, setSource] = useState<SourceType>("official");
    const [showKey, setShowKey] = useState(false);

    const popular = getPopularFamilies();
    const filteredFamilies = search.trim()
        ? searchFamilies(search).filter((f) => !f.popular)
        : MODEL_FAMILIES.filter((f) => !f.popular);

    const handleSelectFamily = (family: ModelFamily) => {
        setSelectedFamily(family);
        setLabel(family.name);
        setModel(family.variants[0]?.value || "");
        // Default to official if available, otherwise openrouter
        const defaultSource = family.sources.find(s => !s.comingSoon);
        setSource(defaultSource?.sourceType || "official");
        setApiKey("");
        setShowKey(false);
    };

    const handleBack = () => {
        setSelectedFamily(null);
        setSearch("");
    };

    const handleSubmit = () => {
        if (!apiKey.trim() || !selectedFamily) return;
        onAdd({
            family: selectedFamily.id,
            source,
            label: label.trim() || selectedFamily.name,
            apiKey: apiKey.trim(),
            model,
        });
    };

    return (
        <div className="fixed inset-0 grid place-items-center z-[100]">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                ref={innerRef}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-[460px] flex flex-col bg-[#111111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl m-4 max-h-[85vh]"
            >
                <AnimatePresence mode="wait">
                    {!selectedFamily ? (
                        <FamilySelectStep
                            key="select"
                            popular={popular}
                            filteredFamilies={filteredFamilies}
                            search={search}
                            onSearchChange={setSearch}
                            onSelect={handleSelectFamily}
                            onClose={onClose}
                        />
                    ) : (
                        <ModelConfigStep
                            key="config"
                            family={selectedFamily}
                            label={label}
                            apiKey={apiKey}
                            model={model}
                            source={source}
                            showKey={showKey}
                            onLabelChange={setLabel}
                            onApiKeyChange={setApiKey}
                            onModelChange={setModel}
                            onSourceChange={setSource}
                            onToggleKey={() => setShowKey(!showKey)}
                            onBack={handleBack}
                            onSubmit={handleSubmit}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

// ── Step 1: Family Selection ──────────────────────────────────

function FamilySelectStep({
    popular,
    filteredFamilies,
    search,
    onSearchChange,
    onSelect,
    onClose,
}: {
    popular: ModelFamily[];
    filteredFamilies: ModelFamily[];
    search: string;
    onSearchChange: (q: string) => void;
    onSelect: (family: ModelFamily) => void;
    onClose: () => void;
}) {
    const searchRef = useRef<HTMLInputElement>(null);
    const isSearching = search.trim().length > 0;

    useEffect(() => {
        const t = setTimeout(() => searchRef.current?.focus(), 200);
        return () => clearTimeout(t);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
        >
            {/* Header */}
            <div className="flex justify-between items-center p-6 pb-4">
                <h3 className="font-medium text-white text-lg">Add AI Model</h3>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                    <CloseIcon />
                </button>
            </div>

            {/* Popular */}
            {!search.trim() && (
                <div className="px-6 pb-3">
                    <div className="flex items-center gap-1.5 mb-2.5">
                        <Star className="w-3 h-3 text-amber-400/60" />
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Popular</span>
                    </div>
                    <div className="flex gap-2">
                        {popular.map((family) => (
                            <button
                                key={family.id}
                                onClick={() => onSelect(family)}
                                className="flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-all group"
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                                    style={{
                                        backgroundColor: family.color + "15",
                                        border: `1px solid ${family.color}25`,
                                        color: family.color,
                                    }}
                                >
                                    {family.name[0]}
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">{family.name}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="px-6 pb-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search AI models..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
                    />
                </div>
            </div>

            {/* Family List */}
            <div className="px-6 pb-6 max-h-[40vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
                {!isSearching && (
                    <div className="flex items-center gap-1.5 mb-2 mt-1">
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">All AI Models</span>
                    </div>
                )}
                <div className="space-y-0.5">
                    {isSearching ? (
                        searchFamilies(search).map((family) => (
                            <FamilyRow key={family.id} family={family} onSelect={onSelect} />
                        ))
                    ) : (
                        filteredFamilies.map((family) => (
                            <FamilyRow key={family.id} family={family} onSelect={onSelect} />
                        ))
                    )}
                    {isSearching && searchFamilies(search).length === 0 && (
                        <div className="py-8 text-center">
                            <p className="text-sm text-white/30">No AI models found</p>
                            <p className="text-xs text-white/20 mt-1">Try a different search term</p>
                        </div>
                    )}

                    {/* "More coming soon" note */}
                    {!isSearching && (
                        <div className="py-6 text-center">
                            <p className="text-xs text-white/30 font-medium">More AI models coming soon!</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function FamilyRow({ family, onSelect }: { family: ModelFamily; onSelect: (f: ModelFamily) => void }) {
    return (
        <button
            onClick={() => onSelect(family)}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
        >
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                    backgroundColor: family.color + "12",
                    border: `1px solid ${family.color}20`,
                    color: family.color,
                }}
            >
                {family.name[0]}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/70 group-hover:text-white transition-colors flex items-center gap-2">
                    {family.name}
                    {family.popular && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-400/70 border border-amber-400/10 font-semibold">
                            POPULAR
                        </span>
                    )}
                </div>
                <div className="text-xs text-white/30 truncate">{family.description}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white/15 -rotate-90 shrink-0 group-hover:text-white/40 transition-colors" />
        </button>
    );
}

// ── Step 2: Model Configuration ───────────────────────────────

function ModelConfigStep({
    family,
    label,
    apiKey,
    model,
    source,
    showKey,
    onLabelChange,
    onApiKeyChange,
    onModelChange,
    onSourceChange,
    onToggleKey,
    onBack,
    onSubmit,
}: {
    family: ModelFamily;
    label: string;
    apiKey: string;
    model: string;
    source: SourceType;
    showKey: boolean;
    onLabelChange: (v: string) => void;
    onApiKeyChange: (v: string) => void;
    onModelChange: (v: string) => void;
    onSourceChange: (v: SourceType) => void;
    onToggleKey: () => void;
    onBack: () => void;
    onSubmit: () => void;
}) {

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-6 pb-4">
                <button
                    onClick={onBack}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all -ml-1"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                        style={{
                            backgroundColor: family.color + "15",
                            border: `1px solid ${family.color}25`,
                            color: family.color,
                        }}
                    >
                        {family.name[0]}
                    </div>
                    <h3 className="font-medium text-white text-lg">{family.name}</h3>
                </div>
            </div>

            <div className="px-6 pb-6 space-y-4 border-t border-white/5 pt-4">
                {/* Label */}
                <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Label</label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => onLabelChange(e.target.value)}
                        placeholder={family.name}
                        className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
                    />
                </div>

                {/* API Key */}
                <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider font-medium">API Key</label>
                    <div className="relative mt-1.5">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                            placeholder="Paste your API key here..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors pr-10"
                        />
                        <button
                            type="button"
                            onClick={onToggleKey}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors"
                        >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Model Variant */}
                <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Model</label>
                    <div className="relative mt-1.5">
                        <select
                            value={model}
                            onChange={(e) => onModelChange(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer transition-colors"
                        >
                            {family.variants.map((m) => (
                                <option key={m.value} value={m.value} className="bg-[#111] text-white">
                                    {m.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                </div>

                {/* Provider Source */}
                <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Provider</label>
                    <div className="relative mt-1.5">
                        <select
                            value={source}
                            onChange={(e) => onSourceChange(e.target.value as SourceType)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer transition-colors"
                        >
                            {family.sources.map((s) => (
                                <option
                                    key={s.sourceType}
                                    value={s.sourceType}
                                    disabled={s.comingSoon}
                                    className="bg-[#111] text-white"
                                >
                                    {s.label}{s.comingSoon ? ' (Coming Soon)' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                </div>

                {/* Submit */}
                <button
                    onClick={onSubmit}
                    disabled={!apiKey.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add AI Model</span>
                </button>
            </div>
        </motion.div>
    );
}

// ── Helpers ───────────────────────────────────────────────────

function maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

const CloseIcon = () => (
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
