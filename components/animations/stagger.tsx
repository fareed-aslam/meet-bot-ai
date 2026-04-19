"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

type StaggerProps = {
  children: React.ReactNode
  className?: string
  stagger?: number
  delayChildren?: number
  once?: boolean
}

export function Stagger({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0.05,
  once = true,
}: StaggerProps) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.2 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: stagger, delayChildren },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

type StaggerItemProps = {
  children: React.ReactNode
  className?: string
  y?: number
  duration?: number
}

export function StaggerItem({
  children,
  className,
  y = 12,
  duration = 0.35,
}: StaggerItemProps) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y, filter: "blur(8px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
