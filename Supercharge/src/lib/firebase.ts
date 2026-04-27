import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const missingConfig = Object.entries(firebaseConfig)
    .filter(([key, value]) => key !== 'measurementId' && !value)
    .map(([key]) => key)

const fallbackFirebaseConfig = {
    apiKey: 'missing-api-key',
    authDomain: 'missing-auth-domain.firebaseapp.com',
    projectId: 'missing-project-id',
    storageBucket: 'missing-project-id.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
}

const resolvedFirebaseConfig =
    missingConfig.length > 0
        ? { ...fallbackFirebaseConfig, measurementId: undefined }
        : firebaseConfig

if (missingConfig.length > 0) {
    console.warn(
        `Missing Firebase environment variables: ${missingConfig.join(', ')}. ` +
        'Running with safe fallback values so the app does not crash in production.'
    )
}

const app = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

export const analytics = typeof window !== 'undefined'
    ? isSupported()
        .then((supported) => {
            if (!supported || !firebaseConfig.measurementId || missingConfig.length > 0) {
                return null
            }
            return getAnalytics(app)
        })
        .catch((error) => {
            console.warn('Firebase analytics disabled:', error)
            return null
        })
    : null

setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('Failed to enable Firebase auth persistence:', error)
})
