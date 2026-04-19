'use client'

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function AmbientGradients() {
    const reducedMotion = useReducedMotion()

    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
            <motion.div
                className="absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent blur-3xl"
                animate={
                    reducedMotion
                        ? undefined
                        : {
                            x: [0, -20, 0],
                            y: [0, 14, 0],
                            scale: [1, 1.04, 1],
                        }
                }
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
                className="absolute -bottom-48 -left-48 h-[36rem] w-[36rem] rounded-full bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent blur-3xl"
                animate={
                    reducedMotion
                        ? undefined
                        : {
                            x: [0, 18, 0],
                            y: [0, -12, 0],
                            scale: [1, 1.03, 1],
                        }
                }
                transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
                className="absolute top-[40%] -right-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-bl from-primary/15 via-primary/8 to-transparent blur-3xl"
                animate={
                    reducedMotion
                        ? undefined
                        : {
                            x: [0, -10, 0],
                            y: [0, 10, 0],
                        }
                }
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
        </div>
    )
}
