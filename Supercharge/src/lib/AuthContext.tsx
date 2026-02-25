import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
    session: Session | null
    user: User | null
    loading: boolean
    isSkipped: boolean
    skipLogin: () => void
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    isSkipped: false,
    skipLogin: () => { },
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSkipped, setIsSkipped] = useState(false)

    const skipLogin = () => setIsSkipped(true)

    useEffect(() => {
        let mounted = true;

        // Safety timeout: if Supabase hangs (e.g. invalid URL), stop loading after 5s
        const timeoutId = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 5000);

        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (mounted) {
                    setSession(session)
                    setUser(session?.user ?? null)
                    setLoading(false)
                    clearTimeout(timeoutId)
                }
            })
            .catch(() => {
                if (mounted) {
                    setLoading(false)
                    clearTimeout(timeoutId)
                }
            });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session)
                setUser(session?.user ?? null)
                setLoading(false)
                clearTimeout(timeoutId)
            }
        })

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(timeoutId);
        }
    }, [])

    return (
        <AuthContext.Provider value={{ session, user, loading, isSkipped, skipLogin }}>
            {children}
        </AuthContext.Provider>
    )
}
