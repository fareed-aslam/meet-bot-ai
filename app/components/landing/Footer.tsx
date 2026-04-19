import { Bot } from 'lucide-react'
import React from 'react'

function Footer() {
    return (
        <footer className='border-t border-border py-5 bg-transparent'>
            <div className='max-w-6xl mx-auto px-4'>
                <div className='flex flex-col md:flex-row justify-between items-center'>
                    <div className='flex items-center space-x-2 mb-4 md:mb-0'>
                        <div className='w-8 h-8 bg-muted rounded-lg flex items-center justify-center'>
                            <Bot className='w-5 h-5 text-muted-foreground' />
                        </div>
                        <span className='text-xl font-bold text-foreground'>Meet Bot</span>
                    </div>
                    <div className='text-muted-foreground text-sm'>
                        &copy; {new Date().getFullYear()} Meet Bot. Made with ❤️ by Fareed Aslam.
                    </div>
                </div>
            </div>
        </footer>
    )
}

export default Footer