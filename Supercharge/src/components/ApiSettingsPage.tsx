import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ExpandableCards } from './ui/expandable-cards';

interface ApiSettingsPageProps {
    onBack: () => void;
    onOpenSidebar: () => void;
}

export function ApiSettingsPage({ onBack, onOpenSidebar }: ApiSettingsPageProps) {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-[#181818] overflow-hidden relative">

            {/* Top Bar — matches home view */}
            <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Back</span>
                </button>

                <button
                    onClick={onOpenSidebar}
                    className="sm:hidden px-4 py-2 bg-[#e0e0e0] text-[#121214] text-sm font-semibold rounded-xl hover:bg-white transition-colors shadow-lg z-50 relative"
                >
                    Menu
                </button>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto px-4 py-24 md:px-8 max-w-3xl mx-auto w-full">

                {/* Title */}
                <div className="mb-10">
                    <h1 
                        className="text-[40px] md:text-[48px] leading-tight tracking-tight mb-3 text-white font-black"
                    >
                        API Settings
                    </h1>
                    <p className="text-white/40 text-sm">
                        Manage preset providers, custom endpoints, API keys, and model preferences.
                        Changes are saved automatically to your local session.
                    </p>
                </div>

                {/* Models Card */}
                <div className="rounded-3xl bg-[#2d2d2d] p-5 mb-6">
                    <ExpandableCards />
                </div>

                {/* No API Key Card */}
                <div className="rounded-3xl bg-[#2d2d2d] p-6 mb-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <h4 className="text-white font-semibold mb-2 relative z-10">
                        No API key?
                    </h4>
                    <p className="text-sm text-white/40 leading-relaxed mb-4 relative z-10">
                        Easily get a free API key from our supported providers — we recommend <strong className="text-white/70">OpenRouter</strong> for a unified experience and access to multiple models.
                    </p>
                    <a
                        href="https://openrouter.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-all active:scale-95 w-fit relative z-10"
                    >
                        Get Free API Key
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>

                {/* Advanced Info */}
                <div className="pb-20">
                    <h3
                        className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4"
                    >
                        Advanced Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-[#2d2d2d]">
                            <h4 className="text-white font-medium mb-1 text-sm">Local Storage</h4>
                            <p className="text-xs text-white/40 leading-relaxed">Your API keys are stored only in your browser's local storage and are never sent to our servers.</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-[#2d2d2d]">
                            <h4 className="text-white font-medium mb-1 text-sm">Usage Quotas</h4>
                            <p className="text-xs text-white/40 leading-relaxed">Usage limits are determined by your specific API plan with each provider. Check their dashboards for billing.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
