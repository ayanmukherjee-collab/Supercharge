import { ArrowLeft, Menu } from 'lucide-react';
import { ExpandableCards } from './ui/expandable-cards';

interface ApiSettingsPageProps {
    onBack: () => void;
    onOpenSidebar: () => void;
}

export function ApiSettingsPage({ onBack, onOpenSidebar }: ApiSettingsPageProps) {
    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-black relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.04] blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 relative z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-all flex items-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="hidden sm:inline font-medium text-sm">Back</span>
                    </button>
                    <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />
                    <h1 className="text-lg font-medium text-white tracking-tight">API Settings</h1>
                </div>

                <button
                    onClick={onOpenSidebar}
                    className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-all sm:hidden"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto relative z-10 px-4 py-8 md:px-8 max-w-4xl mx-auto w-full">
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-white mb-2">Configure Models</h2>
                    <p className="text-textMuted text-sm">
                        Manage your connected AI providers, API keys and model preferences.
                        Changes are saved automatically to your local session.
                    </p>
                </div>

                <div className="border-t border-white/10 pt-6">
                    <ExpandableCards />
                </div>
                <div className="border-b border-white/10 mt-6" />

                <div className="mt-12 pt-8 border-t border-white/5 pb-20">
                    <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-6">Advanced Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
                            <h4 className="text-white font-medium mb-1">Local Storage</h4>
                            <p className="text-xs text-textMuted leading-relaxed">Your API keys are stored only in your browser's local storage and are never sent to our servers.</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
                            <h4 className="text-white font-medium mb-1">Usage Quotas</h4>
                            <p className="text-xs text-textMuted leading-relaxed">Usage limits are determined by your specific API plan with each provider. Check their dashboards for billing.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
