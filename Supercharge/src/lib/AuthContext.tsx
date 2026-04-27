import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from './firebase'

export interface AppUser {
    id: string
    email: string | null
    displayName: string | null
    photoURL: string | null
}

interface AuthContextType {
    user: AppUser | null
    firebaseUser: FirebaseUser | null
    loading: boolean
    isSkipped: boolean
    skipLogin: () => void
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    firebaseUser: null,
    loading: true,
    isSkipped: false,
    skipLogin: () => { },
})

const mapUser = (user: FirebaseUser): AppUser => ({
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
    const [user, setUser] = useState<AppUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSkipped, setIsSkipped] = useState(false)

    const skipLogin = () => setIsSkipped(true)

    useEffect(() => {
        let mounted = true

        const timeoutId = setTimeout(() => {
            if (mounted) setLoading(false)
        }, 5000)

        const unsubscribe = onAuthStateChanged(
            auth,
            (nextUser) => {
                if (!mounted) return
                setFirebaseUser(nextUser)
                setUser(nextUser ? mapUser(nextUser) : null)
                setLoading(false)
                clearTimeout(timeoutId)
            },
            () => {
                if (!mounted) return
                setLoading(false)
                clearTimeout(timeoutId)
            }
        )

        return () => {
            mounted = false
            unsubscribe()
            clearTimeout(timeoutId)
        }
    }, [])

    return (
        <AuthContext.Provider value={{ user, firebaseUser, loading, isSkipped, skipLogin }}>
            {children}
        </AuthContext.Provider>
    )
}
