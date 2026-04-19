import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Message {
    id: number
    content: string
    isBot: boolean
    timestamp: Date
}

interface ChatMessagesProps {
    messages: Message[]
    isLoading: boolean
}

function ChatMessages({
    messages,
    isLoading
}: ChatMessagesProps) {
    return (
        <div className='space-y-4'>
            <AnimatePresence initial={false}>
                {messages.map((message) => (
                    <motion.div
                        key={message.id}
                        className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                        initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 6, filter: 'blur(8px)' }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className={`max-w-[70%] rounded-lg p-4 ${message.isBot
                            ? 'bg-card border border-border text-foreground'
                            : 'bg-primary text-primary-foreground'
                            }`}>
                            <p className='text-sm leading-relaxed'>{message.content}</p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        className='flex justify-start'
                        initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 6, filter: 'blur(8px)' }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className='bg-card border border-border rounded-lg p-4'>
                            <p className='text-sm text-muted-foreground'>🤖 Searching through all your meetings...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    )
}

export default ChatMessages