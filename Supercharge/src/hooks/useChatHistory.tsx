import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import {
    addDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch,
} from 'firebase/firestore'
import { useAuth } from '../lib/AuthContext'
import { chatDocRef, chatsCollectionRef, messageDocRef, messagesCollectionRef, userDocRef } from '../lib/firestorePaths'
import type { ChatMessage } from '../lib/chatService'
import { db } from '../lib/firebase'

export interface ChatSession {
    id: string
    user_id: string
    title: string
    created_at: string
}

export interface DbMessage extends ChatMessage {
    id: string
    chat_id: string
    created_at: string
}

const asIsoString = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
        return (value as any).toDate().toISOString()
    }
    return new Date().toISOString()
}

interface ChatHistoryContextType {
    chats: ChatSession[]
    loadingChats: boolean
    fetchChats: () => Promise<void>
    createChat: (title?: string) => Promise<ChatSession | null>
    deleteChat: (chatId: string) => Promise<void>
    updateChatTitle: (chatId: string, title: string) => Promise<void>
    fetchMessages: (chatId: string) => Promise<ChatMessage[]>
    appendMessage: (chatId: string, message: ChatMessage) => Promise<void>
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined)

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [chats, setChats] = useState<ChatSession[]>([])
    const [loadingChats, setLoadingChats] = useState(true)

    useEffect(() => {
        if (!user) {
            setChats([])
            setLoadingChats(false)
            return
        }

        setLoadingChats(true)
        const q = query(chatsCollectionRef(user.id), orderBy('created_at', 'desc'))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const nextChats = snapshot.docs.map((docSnapshot) => {
                const data = docSnapshot.data()
                return {
                    id: docSnapshot.id,
                    user_id: user.id,
                    title: typeof data.title === 'string' ? data.title : 'New Chat',
                    created_at: asIsoString(data.created_at),
                } satisfies ChatSession
            })
            setChats(nextChats)
            setLoadingChats(false)
        }, (err) => {
            console.error('Error listening to chats:', err)
            setLoadingChats(false)
        })

        return () => unsubscribe()
    }, [user])

    const fetchChats = useCallback(async () => {
        // Now handled by onSnapshot automatically
    }, [])

    const createChat = useCallback(async (title: string = 'New Chat'): Promise<ChatSession | null> => {
        if (!user) {
            console.error('Cannot create chat: No user logged in')
            return null
        }

        try {
            const createdAt = new Date().toISOString()
            await setDoc(userDocRef(user.id), {
                email: user.email ?? null,
                display_name: user.displayName ?? null,
                photo_url: user.photoURL ?? null,
                created_at: createdAt,
                last_active_at: createdAt,
            }, { merge: true })

            const docRef = await addDoc(chatsCollectionRef(user.id), {
                title,
                created_at: createdAt,
                updated_at: createdAt,
                last_message_at: createdAt,
            })

            const chat: ChatSession = {
                id: docRef.id,
                user_id: user.id,
                title,
                created_at: createdAt,
            }

            // Note: We don't need to manually setChats here because the onSnapshot listener will pick it up
            return chat
        } catch (error) {
            console.error('Error creating chat:', error)
            return null
        }
    }, [user])

    const deleteChat = async (chatId: string) => {
        if (!user) return

        try {
            const messagesSnapshot = await getDocs(messagesCollectionRef(user.id, chatId))
            const batch = writeBatch(db)

            messagesSnapshot.docs.forEach((message) => {
                batch.delete(messageDocRef(user.id, chatId, message.id))
            })
            batch.delete(chatDocRef(user.id, chatId))
            await batch.commit()

            // Note: We don't manually filter chats because onSnapshot listener picks it up
        } catch (error) {
            console.error('Error deleting chat:', error)
        }
    }

    const updateChatTitle = async (chatId: string, title: string) => {
        if (!user) return

        try {
            await updateDoc(chatDocRef(user.id, chatId), {
                title,
                updated_at: new Date().toISOString(),
            })

            // Note: We don't manually map chats because onSnapshot listener picks it up
        } catch (error) {
            console.error('Error updating chat title:', error)
        }
    }

    const fetchMessages = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
        if (!user) return []

        try {
            const snapshot = await getDocs(query(messagesCollectionRef(user.id, chatId), orderBy('created_at', 'asc')))
            return snapshot.docs.map((docSnapshot) => {
                const data = docSnapshot.data()
                return {
                    role: data.role,
                    content: data.content,
                } as ChatMessage
            })
        } catch (error) {
            console.error('Error fetching messages:', error)
            return []
        }
    }, [user])

    const appendMessage = useCallback(async (chatId: string, message: ChatMessage) => {
        if (!user) return

        try {
            const createdAt = new Date().toISOString()
            await addDoc(messagesCollectionRef(user.id, chatId), {
                role: message.role,
                content: message.content,
                created_at: createdAt,
                server_created_at: serverTimestamp(),
            })

            await updateDoc(chatDocRef(user.id, chatId), {
                updated_at: createdAt,
                last_message_at: createdAt,
            })
        } catch (error) {
            console.error('Error appending message:', error)
        }
    }, [user])

    return (
        <ChatHistoryContext.Provider
            value= {{
        chats,
            loadingChats,
            fetchChats,
            createChat,
            deleteChat,
            updateChatTitle,
            fetchMessages,
            appendMessage,
            }
}
        >
    { children }
    </ChatHistoryContext.Provider>
    )
}

export function useChatHistory() {
    const context = useContext(ChatHistoryContext)
    if (context === undefined) {
        throw new Error('useChatHistory must be used within a ChatHistoryProvider')
    }
    return context
}
