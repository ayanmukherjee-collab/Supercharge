import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

export const userDocRef = (userId: string) => doc(db, 'users', userId)
export const chatsCollectionRef = (userId: string) => collection(db, 'users', userId, 'chats')
export const chatDocRef = (userId: string, chatId: string) => doc(db, 'users', userId, 'chats', chatId)
export const messagesCollectionRef = (userId: string, chatId: string) =>
    collection(db, 'users', userId, 'chats', chatId, 'messages')
export const messageDocRef = (userId: string, chatId: string, messageId: string) =>
    doc(db, 'users', userId, 'chats', chatId, 'messages', messageId)
export const memoryCollectionRef = (userId: string) => collection(db, 'users', userId, 'memory_nodes')
export const memoryDocRef = (userId: string, nodeId: string) => doc(db, 'users', userId, 'memory_nodes', nodeId)
