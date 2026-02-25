import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
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
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            })
            if (error) throw error
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
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                setMessage('Check your email for the confirmation link.')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-black p-4 overflow-hidden relative">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-white/[0.04] blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md z-10">
                <div className="mb-10 flex flex-col items-center justify-center">
                    <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-12 h-12 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] mb-4"
                    >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <h1 className="text-3xl font-medium tracking-tight mb-2 text-white">
                        {isLogin ? 'Welcome back' : 'Create an account'}
                    </h1>
                    <p className="text-white/50 text-sm">
                        {isLogin ? 'Enter your details to sign in.' : 'Start supercharging your workflow.'}
                    </p>
                </div>

                <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-[#111111]/80">
                    <form onSubmit={handleAuth} className="flex flex-col gap-4 relative z-10">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm p-3 rounded-xl">
                                {message}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-white/70 ml-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-white/70 ml-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full bg-white text-black font-medium rounded-xl px-4 py-3 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="flex items-center gap-4 my-6">
                        <div className="h-px bg-white/10 flex-1"></div>
                        <span className="text-xs text-white/50 uppercase tracking-wider">Or</span>
                        <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white/5 border border-white/10 text-white font-medium rounded-xl px-4 py-3 hover:bg-white/10 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="mt-4 flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError(null)
                                setMessage(null)
                            }}
                            className="text-xs text-white/50 hover:text-white transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                        </button>

                        <div className="w-px h-3 bg-white/20"></div>

                        <button
                            type="button"
                            onClick={skipLogin}
                            className="text-xs text-white/50 hover:text-white transition-colors"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
