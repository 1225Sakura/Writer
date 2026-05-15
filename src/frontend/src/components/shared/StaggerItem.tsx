/**
 * StaggerItem - 配合 StaggerChildren 使用的子元素包装器
 *
 * 必须作为 StaggerChildren 的直接子元素使用
 */

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { type StaggerPreset, presetVariants } from './StaggerConfig'

export function StaggerItem({
  children,
  className,
  preset = 'fade-up',
}: {
  children: ReactNode
  className?: string
  preset?: StaggerPreset
}) {
  const presetData = presetVariants[preset]

  return (
    <motion.div
      variants={presetData.child}
      className={cn(className)}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  )
}
