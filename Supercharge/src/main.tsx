import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ApiKeyStoreProvider } from './lib/apiKeyStore.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ApiKeyStoreProvider>
            <App />
        </ApiKeyStoreProvider>
    </React.StrictMode>,
)

