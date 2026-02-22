import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ApiKeyStoreProvider } from './lib/apiKeyStore.tsx'
import { AuthProvider } from './lib/AuthContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <ApiKeyStoreProvider>
                <App />
            </ApiKeyStoreProvider>
        </AuthProvider>
    </React.StrictMode>,
)

