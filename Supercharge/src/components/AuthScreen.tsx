import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signInWithPopup,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'

export const AuthScreen: React.FC = () => {
    const { skipLogin } = useAuth()
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const handleGoogleLogin = async () => {
        try {
            setLoading(true)
            setError(null)
            setMessage(null)
            await signInWithPopup(auth, googleProvider)
        } catch (err: any) {
            setError(err.message || 'An error occurred during Google sign in')
            setLoading(false)
        }
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password)
            } else {
                const credential = await createUserWithEmailAndPassword(auth, email, password)
                await sendEmailVerification(credential.user).catch(() => undefined)
                setMessage('Account created. Check your inbox if email verification is enabled in Firebase.')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#181818] p-4 overflow-hidden relative">
            {/* macOS-style Auth Window */}
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="relative w-full max-w-[440px] bg-[#1e1e1e]/60 backdrop-blur-3xl rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] border border-white/[0.12] overflow-hidden z-10"
            >
                {/* macOS Title Bar */}
                <div className="h-14 bg-[#2a2a32]/20 border-b border-white/10 flex items-center px-4 relative select-none">
                    {/* Traffic Lights */}
                    <div className="flex items-center gap-2.5 absolute left-5">
                        <button onClick={skipLogin} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 flex items-center justify-center group transition-colors">
                            <svg className="w-2.5 h-2.5 text-black/50 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                        <button onClick={skipLogin} className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 flex items-center justify-center group transition-colors">
                            <svg className="w-2.5 h-2.5 text-black/50 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12h16"/></svg>
                        </button>
                        <button onClick={skipLogin} className="w-3.5 h-3.5 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 flex items-center justify-center group transition-colors">
                            <svg className="w-2.5 h-2.5 text-black/50 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                    </div>
                    {/* Title */}
                    <div className="w-full text-center text-white/70 text-sm font-semibold tracking-wider">
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </div>
                </div>

                {/* Window Body */}
                <div className="p-8 pt-7">
                    {/* Icon + Heading */}
                    <div className="flex flex-col items-center mb-7">
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4">
                            <img src="/favicon.svg" alt="Supercharge" className="w-7 h-7 opacity-90 object-contain" />
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight text-white mb-1">
                            {isLogin ? 'Welcome back' : 'Get started'}
                        </h1>
                        <p className="text-white/40 text-[13px]">
                            {isLogin ? 'Enter your details to sign in.' : 'Create your account to begin.'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl">
                                {message}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-white/50 ml-1 uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-white/50 ml-1 uppercase tracking-wider">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 w-full bg-white text-black font-medium rounded-xl px-4 py-3 text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-5">
                        <div className="h-px bg-white/[0.08] flex-1" />
                        <span className="text-[11px] text-white/30 uppercase tracking-widest">Or</span>
                        <div className="h-px bg-white/[0.08] flex-1" />
                    </div>

                    {/* Google */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white/[0.04] border border-white/[0.08] text-white font-medium rounded-xl px-4 py-3 text-sm hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Footer Links */}
                    <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError(null)
                                setMessage(null)
                            }}
                            className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                        </button>

                        <div className="w-px h-3 bg-white/10" />

                        <button
                            type="button"
                            onClick={skipLogin}
                            className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
