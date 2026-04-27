import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ApiKeyStoreProvider } from './lib/apiKeyStore.tsx'
import { AuthProvider } from './lib/AuthContext.tsx'
import { ChatHistoryProvider } from './hooks/useChatHistory'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <ChatHistoryProvider>
                <ApiKeyStoreProvider>
                    <App />
                </ApiKeyStoreProvider>
            </ChatHistoryProvider>
        </AuthProvider>
    </React.StrictMode>,
)

