import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { ChatMessage } from '../lib/chatService'

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

export function useChatHistory() {
    const { user } = useAuth()
    const [chats, setChats] = useState<ChatSession[]>([])
    const [loadingChats, setLoadingChats] = useState(true)

    // Fetch all chats for the current user
    const fetchChats = useCallback(async () => {
        if (!user) {
            setChats([])
            setLoadingChats(false)
            return
        }

        try {
            setLoadingChats(true)
            const { data, error } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setChats(data || [])
        } catch (error) {
            console.error('Error fetching chats:', error)
        } finally {
            setLoadingChats(false)
        }
    }, [user])

    // Load chats on mount
    useEffect(() => {
        fetchChats()
    }, [fetchChats])

    // Create a new chat session
    const createChat = useCallback(async (title: string = 'New Chat'): Promise<ChatSession | null> => {
        if (!user) {
            console.error('Cannot create chat: No user logged in')
            return null
        }

        try {
            console.log('Creating new chat for user:', user.id, title)
            const { data, error } = await supabase
                .from('chats')
                .insert([{ user_id: user.id, title }])
                .select()
                .single()

            if (error) {
                console.error('Supabase error creating chat:', error)
                throw error
            }

            console.log('Successfully created chat:', data)
            // Optimitically update list
            setChats(prev => [data, ...prev])
            return data
        } catch (error) {
            console.error('Error creating chat:', error)
            return null
        }
    }, [user])

    // Delete a chat session
    const deleteChat = async (chatId: string) => {
        try {
            const { error } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatId)

            if (error) throw error
            setChats(prev => prev.filter(c => c.id !== chatId))
        } catch (error) {
            console.error('Error deleting chat:', error)
        }
    }

    // Update chat title
    const updateChatTitle = async (chatId: string, title: string) => {
        try {
            const { error } = await supabase
                .from('chats')
                .update({ title })
                .eq('id', chatId)

            if (error) throw error
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c))
        } catch (error) {
            console.error('Error updating chat title:', error)
        }
    }

    // Fetch messages for a specific chat
    const fetchMessages = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
        try {
            console.log('Fetching messages for chat:', chatId)
            const { data, error } = await supabase
                .from('messages')
                .select('role, content')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Supabase error fetching messages:', error)
                throw error
            }

            console.log('Fetched messages:', data?.length)
            return data as ChatMessage[]
        } catch (error) {
            console.error('Error fetching messages:', error)
            return []
        }
    }, [])

    // Append a message to a chat
    const appendMessage = useCallback(async (chatId: string, message: ChatMessage) => {
        try {
            console.log('Appending message to chat:', chatId, message.role)
            const { error, data } = await supabase
                .from('messages')
                .insert([{
                    chat_id: chatId,
                    role: message.role,
                    content: message.content
                }])
                .select()

            if (error) {
                console.error('Supabase error appending message:', error)
                throw error
            }
            console.log('Successfully appended message', data)
        } catch (error) {
            console.error('Error appending message:', error)
        }
    }, [])

    return {
        chats,
        loadingChats,
        fetchChats,
        createChat,
        deleteChat,
        updateChatTitle,
        fetchMessages,
        appendMessage
    }
}
