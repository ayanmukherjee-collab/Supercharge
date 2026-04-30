import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOutsideClick } from "../../hooks/use-outside-click";
import { ArrowLeft, Check, ChevronDown, Eye, EyeOff, Pencil, Plus, Search, Settings2, Star, Trash2 } from "lucide-react";
import {
    useApiKeyStore,
    getModelFamily,
    getPopularFamilies,
    searchFamilies,
    MODEL_FAMILIES,
    type ApiProvider,
    type CustomProviderConfig,
    type ModelFamily,
    type SourceType,
} from "../../lib/apiKeyStore";
import { ProviderIcons } from "../icons/ProviderIcons";

type AddMode = "choose" | "preset" | "custom";
type NormalizerId = CustomProviderConfig["normalizer"];

const NORMALIZER_OPTIONS: Array<{ value: NormalizerId; label: string; description: string }> = [
    { value: "openai-chat", label: "OpenAI-compatible", description: "For OpenAI, OpenRouter-style, Groq-style, and similar chat APIs." },
    { value: "anthropic-chat", label: "Anthropic SSE", description: "For Anthropic message streaming format." },
    { value: "gemini-chat", label: "Gemini SSE", description: "For Google Gemini streaming format." },
    { value: "cohere-chat", label: "Cohere SSE", description: "For Cohere v2 chat streaming format." },
];

const DEFAULT_CUSTOM_HEADERS = {
    "Content-Type": "application/json",
    Authorization: "Bearer {api_key}",
};

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

        document.body.style.overflow = active || isAdding ? "hidden" : "auto";
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [active, isAdding]);

    useOutsideClick(ref, () => {
        setActive(null);
        setIsAdding(false);
    });

    return (
        <>
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

            <ul className="w-full flex flex-col">
                {providers.length === 0 && (
                    <div className="py-12 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-white/30" />
                        </div>
                        <div>
                            <p className="text-sm text-white/50 font-medium">No AI models configured</p>
                            <p className="text-xs text-white/30 mt-1">Add a preset provider or a custom OpenAI-compatible endpoint</p>
                        </div>
                    </div>
                )}

                {providers.map((provider, index) => {
                    const family = getModelFamily(provider.family);
                    const ProviderIcon = ProviderIcons[family.id as keyof typeof ProviderIcons];
                    return (
                        <motion.div
                            layoutId={`card-${provider.id}-${id}`}
                            key={provider.id}
                            onClick={() => setActive(provider)}
                            className={`py-4 px-2 flex items-center gap-4 hover:bg-white/[0.03] cursor-pointer transition-colors rounded-lg ${index < providers.length - 1 ? "border-b border-white/5" : ""}`}
                        >
                            <div className="shrink-0 flex items-center justify-center">
                                {ProviderIcon ? <ProviderIcon className="w-5 h-5 text-white" /> : <span className="text-sm font-bold text-white">{family.name[0]}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <motion.h3 layoutId={`title-${provider.id}-${id}`} className="font-medium text-white text-sm truncate">
                                    {provider.label}
                                </motion.h3>
                                <motion.p layoutId={`desc-${provider.id}-${id}`} className="text-textMuted text-xs truncate mt-0.5">
                                    {maskKey(provider.apiKey)} · {provider.model} · <span className="capitalize">{provider.source}</span>
                                </motion.p>
                            </div>
                            <motion.button layoutId={`btn-${provider.id}-${id}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors shadow-none shrink-0">
                                <Pencil className="w-3.5 h-3.5" />
                            </motion.button>
                        </motion.div>
                    );
                })}

                <button
                    onClick={() => setIsAdding(true)}
                    className="py-4 px-2 flex items-center gap-4 hover:bg-white/[0.03] cursor-pointer transition-all group rounded-lg border-t border-white/5 mt-1"
                >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-white/50 group-hover:text-white transition-colors">Add AI Model</div>
                        <div className="text-xs text-textMuted mt-0.5">Choose a preset or connect a custom endpoint</div>
                    </div>
                </button>
            </ul>
        </>
    );
}

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
    innerRef: RefObject<HTMLDivElement>;
    onClose: () => void;
    onSave: (provider: ApiProvider) => void;
    onDelete: () => void;
}) {
    const family = getModelFamily(provider.family);
    const ProviderIcon = ProviderIcons[family.id as keyof typeof ProviderIcons];
    const [label, setLabel] = useState(provider.label);
    const [apiKey, setApiKey] = useState(provider.apiKey);
    const [model, setModel] = useState(provider.model);
    const [source, setSource] = useState<SourceType>(provider.source);
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const [baseUrl, setBaseUrl] = useState(provider.custom?.baseUrl ?? "");
    const [chatPath, setChatPath] = useState(provider.custom?.chatPath ?? "/v1/chat/completions");
    const [headersText, setHeadersText] = useState(formatHeaders(provider.custom?.headers));
    const [normalizer, setNormalizer] = useState<NormalizerId>(provider.custom?.normalizer ?? "openai-chat");
    const [configError, setConfigError] = useState<string | null>(null);

    const availableSources = family.sources.filter((item) => !item.comingSoon);

    const handleSave = () => {
        if (source === "custom") {
            const parsedHeaders = parseHeadersInput(headersText);
            if (!parsedHeaders.ok) {
                setConfigError(parsedHeaders.error);
                return;
            }

            if (!baseUrl.trim() || !chatPath.trim() || !model.trim() || !apiKey.trim()) {
                setConfigError("Base URL, chat path, API key, and model are all required for custom providers.");
                return;
            }

            onSave({
                ...provider,
                family: "custom",
                source: "custom",
                label: label.trim() || "Custom Provider",
                apiKey: apiKey.trim(),
                model: model.trim(),
                custom: {
                    baseUrl: baseUrl.trim(),
                    chatPath: chatPath.trim(),
                    headers: parsedHeaders.value,
                    normalizer,
                },
            });
        } else {
            onSave({
                ...provider,
                label: label.trim() || family.name,
                apiKey: apiKey.trim(),
                model,
                source,
                custom: undefined,
            });
        }

        setConfigError(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const headerTextLabel = source === "custom" ? "Headers JSON" : "API Key";

    return (
        <div className="fixed inset-0 grid place-items-center z-[100]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div layoutId={`card-${provider.id}-${layoutId}`} ref={innerRef} className="relative w-full max-w-[520px] flex flex-col glass rounded-3xl overflow-hidden shadow-2xl m-4 max-h-[90vh]">
                <div className="flex-1 flex flex-col overflow-y-auto">
                    <div className="flex justify-between items-start p-6">
                        <div>
                            <motion.h3 layoutId={`title-${provider.id}-${layoutId}`} className="font-medium text-white text-xl">{provider.label}</motion.h3>
                            <motion.div layoutId={`desc-${provider.id}-${layoutId}`} className="mt-2.5 inline-flex items-center gap-2">
                                {ProviderIcon ? <ProviderIcon className="w-4 h-4 text-white/90" /> : <span className="text-sm font-bold text-white/90">{family.name[0]}</span>}
                                <span className="text-sm font-medium text-white/90">{family.name}</span>
                            </motion.div>
                        </div>
                        <motion.button layoutId={`btn-${provider.id}-${layoutId}`} onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0">
                            <CloseIcon />
                        </motion.button>
                    </div>

                    <div className="flex-1 px-6 pb-4 border-t border-white/5 mt-2 pt-4 space-y-4">
                        <Field label="Label">
                            <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} className={inputClassName} />
                        </Field>

                        {source !== "custom" && (
                            <>
                                <Field label="Model">
                                    <div className="relative">
                                        <select value={model} onChange={(event) => setModel(event.target.value)} className={selectClassName}>
                                            {family.variants.map((variant) => (
                                                <option key={variant.value} value={variant.value} className="bg-[#111] text-white">
                                                    {variant.label}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                    </div>
                                </Field>

                                <Field label="Provider">
                                    <div className="relative">
                                        <select value={source} onChange={(event) => setSource(event.target.value as SourceType)} className={selectClassName}>
                                            {availableSources.map((item) => (
                                                <option key={item.sourceType} value={item.sourceType} className="bg-[#111] text-white">
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                    </div>
                                </Field>
                            </>
                        )}

                        <Field label="API Key">
                            <div className="relative">
                                <input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} className={`${inputClassName} pr-10 font-mono`} />
                                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors">
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </Field>

                        {source === "custom" && (
                            <>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                                    <div className="flex items-center gap-2 text-sm text-white/80">
                                        <Settings2 className="w-4 h-4" />
                                        <span>Custom transport settings</span>
                                    </div>

                                    <Field label="Base URL">
                                        <input type="text" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" className={inputClassName} />
                                    </Field>

                                    <Field label="Chat Endpoint">
                                        <input type="text" value={chatPath} onChange={(event) => setChatPath(event.target.value)} placeholder="/v1/chat/completions" className={inputClassName} />
                                    </Field>

                                    <Field label="Model">
                                        <input type="text" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o-mini" className={inputClassName} />
                                    </Field>

                                    <Field label="Response Format">
                                        <div className="relative">
                                            <select value={normalizer} onChange={(event) => setNormalizer(event.target.value as NormalizerId)} className={selectClassName}>
                                                {NORMALIZER_OPTIONS.map((item) => (
                                                    <option key={item.value} value={item.value} className="bg-[#111] text-white">
                                                        {item.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                        </div>
                                        <p className="text-[11px] text-white/35 mt-1">{NORMALIZER_OPTIONS.find((item) => item.value === normalizer)?.description}</p>
                                    </Field>

                                    <Field label={headerTextLabel}>
                                        <textarea value={headersText} onChange={(event) => setHeadersText(event.target.value)} rows={6} className={`${inputClassName} rounded-2xl min-h-[140px] font-mono text-xs`} />
                                        <p className="text-[11px] text-white/35 mt-1">Use placeholders like <code>{`{api_key}`}</code> inside header values.</p>
                                    </Field>
                                </div>
                            </>
                        )}

                        {configError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{configError}</div>}

                        <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium bg-white/[0.05] hover:bg-white/15 text-white border border-white/5 hover:border-white/10 transition-all">
                            {saved ? <><Check className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Saved</span></> : <span>Save Changes</span>}
                        </button>
                    </div>

                    <div className="px-6 pb-6 pt-2 mt-auto">
                        <button onClick={onDelete} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all">
                            <Trash2 className="w-4 h-4" />
                            <span>Delete API Key</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function AddModelModal({
    innerRef,
    onClose,
    onAdd,
}: {
    innerRef: RefObject<HTMLDivElement>;
    onClose: () => void;
    onAdd: (data: Omit<ApiProvider, "id">) => void;
}) {
    const [mode, setMode] = useState<AddMode>("choose");
    const [selectedFamily, setSelectedFamily] = useState<ModelFamily | null>(null);
    const [search, setSearch] = useState("");
    const [label, setLabel] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("");
    const [source, setSource] = useState<SourceType>("official");
    const [showKey, setShowKey] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");
    const [chatPath, setChatPath] = useState("/v1/chat/completions");
    const [headersText, setHeadersText] = useState(formatHeaders(DEFAULT_CUSTOM_HEADERS));
    const [normalizer, setNormalizer] = useState<NormalizerId>("openai-chat");
    const [configError, setConfigError] = useState<string | null>(null);

    const popular = useMemo(() => getPopularFamilies(), []);
    const filteredFamilies = search.trim() ? searchFamilies(search).filter((family) => !family.popular && family.id !== "custom") : MODEL_FAMILIES.filter((family) => !family.popular && family.id !== "custom");

    const handleSelectFamily = (family: ModelFamily) => {
        setSelectedFamily(family);
        setMode("preset");
        setLabel(family.name);
        setModel(family.variants[0]?.value || "");
        const defaultSource = family.sources.find((item) => !item.comingSoon);
        setSource(defaultSource?.sourceType || "official");
        setApiKey("");
        setShowKey(false);
        setConfigError(null);
    };

    const handleSubmitPreset = () => {
        if (!selectedFamily || !apiKey.trim()) return;

        onAdd({
            family: selectedFamily.id,
            source,
            label: label.trim() || selectedFamily.name,
            apiKey: apiKey.trim(),
            model,
        });
    };

    const handleSubmitCustom = () => {
        const parsedHeaders = parseHeadersInput(headersText);
        if (!parsedHeaders.ok) {
            setConfigError(parsedHeaders.error);
            return;
        }

        if (!label.trim() || !apiKey.trim() || !model.trim() || !baseUrl.trim() || !chatPath.trim()) {
            setConfigError("Label, API key, model, base URL, and chat endpoint are required.");
            return;
        }

        onAdd({
            family: "custom",
            source: "custom",
            label: label.trim(),
            apiKey: apiKey.trim(),
            model: model.trim(),
            custom: {
                baseUrl: baseUrl.trim(),
                chatPath: chatPath.trim(),
                headers: parsedHeaders.value,
                normalizer,
            },
        });
    };

    const handleBack = () => {
        if (mode === "preset" && selectedFamily) {
            setMode("choose");
            setSelectedFamily(null);
            setSearch("");
            setConfigError(null);
            return;
        }

        if (mode === "custom") {
            setMode("choose");
            setConfigError(null);
        }
    };

    return (
        <div className="fixed inset-0 grid place-items-center z-[100]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div ref={innerRef} initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full max-w-[560px] flex flex-col glass rounded-3xl overflow-hidden shadow-2xl m-4 max-h-[88vh]">
                <AnimatePresence mode="wait">
                    {mode === "choose" && (
                        <ChooseModeStep key="choose" popular={popular} filteredFamilies={filteredFamilies} search={search} onSearchChange={setSearch} onSelectFamily={handleSelectFamily} onSelectCustom={() => {
                            setMode("custom");
                            setLabel("Custom Provider");
                            setShowKey(false);
                            setConfigError(null);
                        }} onClose={onClose} />
                    )}

                    {mode === "preset" && selectedFamily && (
                        <PresetConfigStep
                            key="preset"
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
                            onSubmit={handleSubmitPreset}
                        />
                    )}

                    {mode === "custom" && (
                        <CustomConfigStep
                            key="custom"
                            label={label}
                            apiKey={apiKey}
                            model={model}
                            baseUrl={baseUrl}
                            chatPath={chatPath}
                            headersText={headersText}
                            normalizer={normalizer}
                            showKey={showKey}
                            configError={configError}
                            onLabelChange={setLabel}
                            onApiKeyChange={setApiKey}
                            onModelChange={setModel}
                            onBaseUrlChange={setBaseUrl}
                            onChatPathChange={setChatPath}
                            onHeadersChange={setHeadersText}
                            onNormalizerChange={setNormalizer}
                            onToggleKey={() => setShowKey(!showKey)}
                            onBack={handleBack}
                            onSubmit={handleSubmitCustom}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

function ChooseModeStep({
    popular,
    filteredFamilies,
    search,
    onSearchChange,
    onSelectFamily,
    onSelectCustom,
    onClose,
}: {
    popular: ModelFamily[];
    filteredFamilies: ModelFamily[];
    search: string;
    onSearchChange: (value: string) => void;
    onSelectFamily: (family: ModelFamily) => void;
    onSelectCustom: () => void;
    onClose: () => void;
}) {
    const searchRef = useRef<HTMLInputElement>(null);
    const isSearching = search.trim().length > 0;
    const searchResults = searchFamilies(search).filter((family) => family.id !== "custom");

    useEffect(() => {
        const timeout = setTimeout(() => searchRef.current?.focus(), 200);
        return () => clearTimeout(timeout);
    }, []);

    return (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
            <div className="flex justify-between items-center p-6 pb-4">
                <h3 className="font-medium text-white text-lg">Add AI Model</h3>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all">
                    <CloseIcon />
                </button>
            </div>

            <div className="px-6 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={onSelectCustom} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 text-left hover:border-white/20 hover:bg-white/[0.08] transition-all">
                        <div className="flex items-center gap-2 text-white">
                            <ProviderIcons.custom className="w-5 h-5" />
                            <span className="font-medium">Custom Provider</span>
                        </div>
                        <p className="text-xs text-white/45 mt-2 leading-relaxed">Bring any OpenAI-compatible base URL, endpoint path, model, and headers.</p>
                    </button>

                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 text-white/80">
                            <Star className="w-4 h-4 text-amber-400/70" />
                            <span className="font-medium text-sm">Preset Providers</span>
                        </div>
                        <p className="text-xs text-white/40 mt-2 leading-relaxed">Choose a built-in provider family, then pick official access or OpenRouter where available.</p>
                    </div>
                </div>
            </div>

            {!search.trim() && (
                <div className="px-6 pb-3">
                    <div className="flex items-center gap-1.5 mb-2.5">
                        <Star className="w-3 h-3 text-amber-400/60" />
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Popular Presets</span>
                    </div>
                    <div className="flex gap-2">
                        {popular.map((family) => (
                            <button key={family.id} onClick={() => onSelectFamily(family)} className="flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-all group">
                                <div className="flex items-center justify-center mb-1">
                                    {ProviderIcons[family.id as keyof typeof ProviderIcons]
                                        ? ProviderIcons[family.id as keyof typeof ProviderIcons]({ className: "w-6 h-6 text-white" })
                                        : <span className="text-lg font-bold text-white">{family.name[0]}</span>}
                                </div>
                                <div className="text-xs font-medium text-white/70 group-hover:text-white transition-colors text-center">{family.name}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="px-6 pb-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input ref={searchRef} type="text" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search preset AI models..." className="w-full bg-white/[0.05] border border-white/10 rounded-full pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors" />
                </div>
            </div>

            <div className="px-6 pb-6 max-h-[42vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
                {!isSearching && <div className="flex items-center gap-1.5 mb-2 mt-1"><span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">All Preset Models</span></div>}
                <div className="space-y-0.5">
                    {(isSearching ? searchResults : filteredFamilies).map((family) => (
                        <FamilyRow key={family.id} family={family} onSelect={onSelectFamily} />
                    ))}
                    {isSearching && searchResults.length === 0 && (
                        <div className="py-8 text-center">
                            <p className="text-sm text-white/30">No preset models found</p>
                            <p className="text-xs text-white/20 mt-1">Try another search, or use a custom provider above.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function PresetConfigStep({
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
    onLabelChange: (value: string) => void;
    onApiKeyChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onSourceChange: (value: SourceType) => void;
    onToggleKey: () => void;
    onBack: () => void;
    onSubmit: () => void;
}) {
    const ProviderIcon = ProviderIcons[family.id as keyof typeof ProviderIcons];

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
            <div className="flex items-center gap-3 p-6 pb-4">
                <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all -ml-1">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center">
                        {ProviderIcon ? <ProviderIcon className="w-5 h-5 text-white" /> : <span className="text-sm font-bold text-white">{family.name[0]}</span>}
                    </div>
                    <h3 className="font-medium text-white text-lg">{family.name}</h3>
                </div>
            </div>

            <div className="px-6 pb-6 space-y-4 border-t border-white/5 pt-4">
                <Field label="Label">
                    <input type="text" value={label} onChange={(event) => onLabelChange(event.target.value)} placeholder={family.name} className={inputClassName} />
                </Field>

                <Field label="API Key">
                    <div className="relative">
                        <input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="Paste your API key here..." className={`${inputClassName} pr-10 font-mono`} />
                        <button type="button" onClick={onToggleKey} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors">
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </Field>

                <Field label="Model">
                    <div className="relative">
                        <select value={model} onChange={(event) => onModelChange(event.target.value)} className={selectClassName}>
                            {family.variants.map((variant) => (
                                <option key={variant.value} value={variant.value} className="bg-[#111] text-white">
                                    {variant.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                </Field>

                <Field label="Provider">
                    <div className="relative">
                        <select value={source} onChange={(event) => onSourceChange(event.target.value as SourceType)} className={selectClassName}>
                            {family.sources.map((item) => (
                                <option key={item.sourceType} value={item.sourceType} disabled={item.comingSoon} className="bg-[#111] text-white">
                                    {item.label}{item.comingSoon ? " (Coming Soon)" : ""}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                </Field>

                <button onClick={onSubmit} disabled={!apiKey.trim()} className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium bg-white text-black hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-2">
                    <Plus className="w-4 h-4" />
                    <span>Add Preset Provider</span>
                </button>
            </div>
        </motion.div>
    );
}

function CustomConfigStep({
    label,
    apiKey,
    model,
    baseUrl,
    chatPath,
    headersText,
    normalizer,
    showKey,
    configError,
    onLabelChange,
    onApiKeyChange,
    onModelChange,
    onBaseUrlChange,
    onChatPathChange,
    onHeadersChange,
    onNormalizerChange,
    onToggleKey,
    onBack,
    onSubmit,
}: {
    label: string;
    apiKey: string;
    model: string;
    baseUrl: string;
    chatPath: string;
    headersText: string;
    normalizer: NormalizerId;
    showKey: boolean;
    configError: string | null;
    onLabelChange: (value: string) => void;
    onApiKeyChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onBaseUrlChange: (value: string) => void;
    onChatPathChange: (value: string) => void;
    onHeadersChange: (value: string) => void;
    onNormalizerChange: (value: NormalizerId) => void;
    onToggleKey: () => void;
    onBack: () => void;
    onSubmit: () => void;
}) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
            <div className="flex items-center gap-3 p-6 pb-4">
                <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all -ml-1">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2.5">
                    <ProviderIcons.custom className="w-5 h-5 text-white" />
                    <h3 className="font-medium text-white text-lg">Custom Provider</h3>
                </div>
            </div>

            <div className="px-6 pb-6 space-y-4 border-t border-white/5 pt-4 overflow-y-auto max-h-[74vh]">
                <Field label="Label">
                    <input type="text" value={label} onChange={(event) => onLabelChange(event.target.value)} placeholder="My Hosted Model" className={inputClassName} />
                </Field>

                <Field label="Base URL">
                    <input type="text" value={baseUrl} onChange={(event) => onBaseUrlChange(event.target.value)} placeholder="https://api.example.com" className={inputClassName} />
                </Field>

                <Field label="Chat Endpoint">
                    <input type="text" value={chatPath} onChange={(event) => onChatPathChange(event.target.value)} placeholder="/v1/chat/completions" className={inputClassName} />
                </Field>

                <Field label="Model">
                    <input type="text" value={model} onChange={(event) => onModelChange(event.target.value)} placeholder="gpt-4o-mini" className={inputClassName} />
                </Field>

                <Field label="API Key">
                    <div className="relative">
                        <input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="Paste your API key here..." className={`${inputClassName} pr-10 font-mono`} />
                        <button type="button" onClick={onToggleKey} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors">
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </Field>

                <Field label="Response Format">
                    <div className="relative">
                        <select value={normalizer} onChange={(event) => onNormalizerChange(event.target.value as NormalizerId)} className={selectClassName}>
                            {NORMALIZER_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value} className="bg-[#111] text-white">
                                    {item.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-white/35 mt-1">{NORMALIZER_OPTIONS.find((item) => item.value === normalizer)?.description}</p>
                </Field>

                <Field label="Headers JSON">
                    <textarea value={headersText} onChange={(event) => onHeadersChange(event.target.value)} rows={7} className={`${inputClassName} rounded-2xl min-h-[160px] font-mono text-xs`} />
                    <p className="text-[11px] text-white/35 mt-1">The generic caller replaces placeholders like <code>{`{api_key}`}</code>, <code>{`{model}`}</code>, and <code>{`{messages}`}</code> safely.</p>
                </Field>

                {configError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{configError}</div>}

                <button onClick={onSubmit} className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium bg-white text-black hover:bg-white/90 transition-all mt-2">
                    <Plus className="w-4 h-4" />
                    <span>Add Custom Provider</span>
                </button>
            </div>
        </motion.div>
    );
}

function FamilyRow({ family, onSelect }: { family: ModelFamily; onSelect: (family: ModelFamily) => void }) {
    return (
        <button onClick={() => onSelect(family)} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left">
            <div className="shrink-0 flex items-center justify-center">
                {ProviderIcons[family.id as keyof typeof ProviderIcons]
                    ? ProviderIcons[family.id as keyof typeof ProviderIcons]({ className: "w-5 h-5 text-white" })
                    : <span className="text-sm font-bold text-white">{family.name[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/70 group-hover:text-white transition-colors flex items-center gap-2">
                    {family.name}
                    {family.popular && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-400/70 border border-amber-400/10 font-semibold">POPULAR</span>}
                </div>
                <div className="text-xs text-white/30 truncate">{family.description}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white/15 -rotate-90 shrink-0 group-hover:text-white/40 transition-colors" />
        </button>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <label className="text-xs text-white/40 uppercase tracking-wider font-medium">{label}</label>
            <div className="mt-1.5">{children}</div>
        </div>
    );
}

function parseHeadersInput(value: string): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { ok: false, error: "Headers must be a JSON object." };
        }

        const normalizedEntries = Object.entries(parsed).map(([key, entryValue]) => {
            if (typeof entryValue !== "string") {
                throw new Error(`Header "${key}" must have a string value.`);
            }
            return [key, entryValue];
        });

        return { ok: true, value: Object.fromEntries(normalizedEntries) };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Invalid headers JSON." };
    }
}

function formatHeaders(headers?: Record<string, string>): string {
    return JSON.stringify(headers ?? DEFAULT_CUSTOM_HEADERS, null, 2);
}

function maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

const inputClassName = "w-full bg-white/[0.05] border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors";
const selectClassName = `${inputClassName} appearance-none cursor-pointer`;

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
