import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
    apiKey: 'AIzaSyAhgTNGWNGTm9D01pKwjLkWdFXiFToc-r4',
    authDomain: 'supercharge-ai.firebaseapp.com',
    projectId: 'supercharge-ai',
    storageBucket: 'supercharge-ai.firebasestorage.app',
    messagingSenderId: '821765277104',
    appId: '1:821765277104:web:9a8fe3c50dffc83a56c275',
    measurementId: 'G-BJC6ZCFD65',
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

export const analytics = typeof window !== 'undefined'
    ? isSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch((error) => {
            console.warn('Firebase analytics disabled:', error)
            return null
        })
    : null

setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('Failed to enable Firebase auth persistence:', error)
})
