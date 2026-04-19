'use client'

import { Button } from "@/components/ui/button"
import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs"
import { ArrowRight, Bot, CheckCircle, Moon, Play, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

export default function HeroSection() {
    const { isSignedIn } = useUser()
    const { setTheme } = useTheme()
    const [isRevealingTheme, setIsRevealingTheme] = useState(false)
    const [pendingTheme, setPendingTheme] = useState<'light' | 'dark' | null>(null)
    const [revealKey, setRevealKey] = useState(0)
    const revealCleanupTimeoutRef = useRef<number | null>(null)
    const reducedMotion = useReducedMotion()

    useEffect(() => {
        return () => {
            if (revealCleanupTimeoutRef.current !== null) {
                window.clearTimeout(revealCleanupTimeoutRef.current)
                revealCleanupTimeoutRef.current = null
            }
            document.documentElement.classList.remove('theme-reveal-active')
        }
    }, [])

    const toggleThemeWithReveal = () => {
        if (isRevealingTheme) return
        const isCurrentlyDark = document.documentElement.classList.contains('dark')
        const nextTheme: 'light' | 'dark' = isCurrentlyDark ? 'light' : 'dark'

        if (reducedMotion) {
            setTheme(nextTheme)
            return
        }

        document.documentElement.classList.add('theme-reveal-active')
        setPendingTheme(nextTheme)
        setRevealKey((k) => k + 1)
        setIsRevealingTheme(true)
    }

    return (
        <>
            <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50 transition-colors duration-700 ease-in-out">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <Link href="/" className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />

                            </div>
                            <span className="text-xl font-bold text-foreground">Meet Bot</span>

                        </Link>
                        <div className="flex items-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={toggleThemeWithReveal}
                                disabled={isRevealingTheme}
                                aria-label="Toggle theme"
                                title="Toggle theme"
                                className="relative"
                            >
                                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            </Button>
                            {isSignedIn ? (
                                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                                    <Link href="/home">Dashboard</Link>
                                </Button>
                            ) : (
                                <>
                                    <SignInButton mode="modal">
                                        <Button variant="outline" className="cursor-pointer">
                                            Sign In
                                        </Button>
                                    </SignInButton>

                                    <SignUpButton mode="modal">
                                        <Button className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
                                            Get Started
                                        </Button>
                                    </SignUpButton>
                                </>

                            )}

                        </div>

                    </div>
                </div>
            </nav>

            <section className="relative overflow-hidden py-20 px-4 bg-transparent transition-colors duration-700 ease-in-out">
                <div aria-hidden className="hero-grid absolute inset-0" />
                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
                        Transform Your{' '}
                        <span className="font-serif italic font-medium">Perfect</span>
                        <span className="block">
                            Meetings with{' '}
                            <span className="animate-gradient bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-[length:300%_100%] bg-clip-text text-transparent">
                                AI Magic
                            </span>
                        </span>
                    </h1>
                    <p className="text-lg max-w-2xl mx-auto mb-8 text-muted-foreground">
                        Automatic summaries, action items, and intelligent insights for every meeting.
                        Never miss important details again.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                        {isSignedIn ? (
                            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 px-8 py-4" >
                                <Link href="/home" className="group">
                                    <span>Dashboard</span>
                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />

                                </Link>
                            </Button>
                        ) : (
                            <SignUpButton mode="modal">
                                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-8 py-4 group cursor-pointer">
                                    <span>Start Free Trial</span>
                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </SignUpButton>
                        )}

                        <Button variant="outline" size="lg" className="px-8 py-4 cursor-pointer">
                            <Play className="w-5 h-5 mr-2" />
                            <span>Watch Demo</span>
                        </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span>Setup in 2 minutes</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span>Free forever plan</span>
                        </div>
                    </div>
                </div>
            </section>

            {isRevealingTheme && pendingTheme && (
                <div
                    key={revealKey}
                    className={`fixed inset-0 z-[100] pointer-events-none bg-background theme-reveal ${pendingTheme === 'dark' ? 'dark' : ''}`}
                    onAnimationEnd={() => {
                        setTheme(pendingTheme)

                        // Keep transitions disabled until the theme class has actually applied,
                        // otherwise some elements (like outline buttons) can briefly animate/blink.
                        revealCleanupTimeoutRef.current = window.setTimeout(() => {
                            setIsRevealingTheme(false)
                            setPendingTheme(null)
                            document.documentElement.classList.remove('theme-reveal-active')
                            revealCleanupTimeoutRef.current = null
                        }, 80)
                    }}
                />
            )}
        </>
    )
}