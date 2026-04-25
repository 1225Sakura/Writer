/**
 * LoadingOverlayVariants - LoadingOverlay 变体组件
 *
 * 提供多种加载状态样式：品牌动画、进度指示、骨架屏等
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Feather, BookOpen, Pen, Sparkles } from 'lucide-react'

export type LoadingVariant = 'feather' | 'book' | 'pen' | 'sparkle' | 'orbit' | 'bars' | 'pulseRing' | 'gradientSpinner' | 'textSkeleton'

interface LoadingOverlayVariantProps {
  message?: string
  progress?: number
  variant?: LoadingVariant
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

/**
 * FeatherSpinner - 羽毛图标旋转动画
 */
function FeatherSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      <Feather className="opacity-80" style={{ width: iconSize, height: iconSize, color }} />
    </motion.div>
  )
}

/**
 * BookSpinner - 书本翻页动画
 */
function BookSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 28, md: 40, lg: 56 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 40

  return (
    <div className="relative" style={{ width: iconSize, height: iconSize }}>
      <motion.div
        className="absolute inset-0"
        animate={{ rotateY: [0, -30, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ perspective: 100 }}
      >
        <BookOpen style={{ width: iconSize, height: iconSize, color }} />
      </motion.div>
    </div>
  )
}

/**
 * PenSpinner - 笔动画
 */
function PenSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <motion.div
      animate={{ rotate: [0, 15, -15, 0], y: [0, -4, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Pen style={{ width: iconSize, height: iconSize, color }} />
    </motion.div>
  )
}

/**
 * SparkleSpinner - 闪光动画
 */
function SparkleSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <Sparkles style={{ width: iconSize, height: iconSize, color }} />
    </motion.div>
  )
}

/**
 * OrbitSpinner - 轨道旋转动画
 */
function OrbitSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 32, md: 48, lg: 64 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 48

  return (
    <div className="relative" style={{ width: iconSize, height: iconSize }}>
      <motion.div
        className="absolute inset-0 border-2 border-dashed rounded-full"
        style={{ borderColor: `${color}40` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-1"
        animate={{ rotate: -360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color, position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}
        />
      </motion.div>
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Feather style={{ width: iconSize * 0.4, height: iconSize * 0.4, color }} />
      </motion.div>
    </div>
  )
}

/**
 * BarsSpinner - 进度条动画
 */
function BarsSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <div className="flex items-center gap-1" style={{ height: iconSize }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: color, height: '60%' }}
          animate={{ scaleY: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/**
 * PulseRingSpinner - 脉冲环动画（多层扩散环）
 */
function PulseRingSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 48, md: 64, lg: 88 }
  const containerSize = sizeMap[size as keyof typeof sizeMap] ?? 64
  const ringCount = 3

  return (
    <div className="relative flex items-center justify-center" style={{ width: containerSize, height: containerSize }}>
      {Array.from({ length: ringCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: containerSize * (0.4 + i * 0.25),
            height: containerSize * (0.4 + i * 0.25),
            border: `2px solid ${color}`,
            opacity: 0.6 - i * 0.15,
          }}
          animate={{
            scale: [1, 1.4 + i * 0.1, 1],
            opacity: [0.6 - i * 0.15, 0, 0.6 - i * 0.15],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
      {/* Center dot */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: containerSize * 0.12,
          height: containerSize * 0.12,
          backgroundColor: color,
          boxShadow: `0 0 ${containerSize * 0.15}px ${color}60`,
        }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

/**
 * GradientSpinner - 渐变旋转器（锥形渐变旋转环）
 */
function GradientSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 40, md: 56, lg: 80 }
  const spinnerSize = sizeMap[size as keyof typeof sizeMap] ?? 56
  const borderWidth = Math.max(2, spinnerSize / 14)

  return (
    <div className="relative flex items-center justify-center" style={{ width: spinnerSize, height: spinnerSize }}>
      {/* Outer rotating gradient ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: spinnerSize,
          height: spinnerSize,
          background: `conic-gradient(from 0deg, ${color}, ${color}40, ${color}10, ${color}40, ${color})`,
          mask: `radial-gradient(circle, transparent ${spinnerSize / 2 - borderWidth}px, black ${spinnerSize / 2 - borderWidth + 0.5}px)`,
          WebkitMask: `radial-gradient(circle, transparent ${spinnerSize / 2 - borderWidth}px, black ${spinnerSize / 2 - borderWidth + 0.5}px)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      {/* Inner glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: spinnerSize * 0.6,
          height: spinnerSize * 0.6,
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: spinnerSize * 0.1,
          height: spinnerSize * 0.1,
          backgroundColor: color,
          boxShadow: `0 0 ${spinnerSize * 0.12}px ${color}50`,
        }}
      />
    </div>
  )
}

/**
 * TextSkeletonSpinner - 文字骨架屏加载（带shimmer扫光）
 */
function TextSkeletonSpinner({ size = 'md', color = 'var(--accent-primary)' }: { size?: string; color?: string }) {
  const sizeMap = { sm: 160, md: 240, lg: 320 }
  const width = sizeMap[size as keyof typeof sizeMap] ?? 240
  const lineHeights = size === 'sm' ? [12, 10, 10] : size === 'lg' ? [20, 14, 14, 14] : [16, 12, 12, 12]
  const lineWidths = size === 'sm' ? ['70%', '100%', '85%'] : size === 'lg' ? ['60%', '100%', '90%', '75%'] : ['65%', '100%', '88%', '80%']

  return (
    <div className="flex flex-col items-center gap-3" style={{ width }}>
      <div className="w-full space-y-2.5">
        {lineHeights.map((h, i) => (
          <div key={i} className="relative overflow-hidden rounded-md" style={{ width: lineWidths[i], height: h }}>
            <div
              className="absolute inset-0 animate-shimmer motion-reduce:animate-none"
              style={{
                background: `linear-gradient(90deg, ${color}10, ${color}25, ${color}10)`,
                backgroundSize: '200% 100%',
              }}
            />
          </div>
        ))}
      </div>
      {/* Animated dots below */}
      <div className="flex gap-1.5 mt-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  )
}

const spinners: Record<LoadingVariant, React.FC<{ size?: string; color?: string }>> = {
  feather: FeatherSpinner,
  book: BookSpinner,
  pen: PenSpinner,
  sparkle: SparkleSpinner,
  orbit: OrbitSpinner,
  bars: BarsSpinner,
  pulseRing: PulseRingSpinner,
  gradientSpinner: GradientSpinner,
  textSkeleton: TextSkeletonSpinner,
}

/**
 * LoadingOverlayVariant - 加载遮罩变体
 *
 * 支持多种变体：feather, book, pen, sparkle, orbit, bars
 */
export function LoadingOverlayVariant({
  message = '加载中...',
  progress,
  variant = 'feather',
  size = 'md',
  color = 'var(--accent-primary)',
}: LoadingOverlayVariantProps) {
  const Spinner = spinners[variant]

  return (
    <div className="flex flex-col items-center justify-center">
      <Spinner size={size} color={color} />

      {message && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="mt-4 text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {message}
        </motion.p>
      )}

      {progress !== undefined && (
        <div className="w-48 mt-4">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-1.5 mt-4"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

/**
 * InlineLoadingVariant - 内联加载指示器
 */
export function InlineLoadingVariant({
  message = '加载中...',
  variant = 'bars',
  size = 'sm',
}: {
  message?: string
  variant?: LoadingVariant
  size?: 'sm' | 'md'
}) {
  const Spinner = spinners[variant]
  const iconSize = size === 'sm' ? 'sm' : 'md'

  return (
    <div className="inline-flex items-center gap-2">
      <Spinner size={iconSize} />
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {message}
      </span>
    </div>
  )
}

/**
 * BrandLoadingScreen - 品牌加载屏幕（全屏品牌动画）
 */
export function BrandLoadingScreen({
  visible,
  message = '正在启动...',
  progress,
}: {
  visible: boolean
  message?: string
  progress?: number
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--elevation-1) 0%, var(--elevation-2) 100%)',
          }}
        >
          {/* Background glow */}
          <motion.div
            className="absolute w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(94, 106, 210, 0.15) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Logo animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-8"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--accent-muted)',
                border: '1px solid rgba(94, 106, 210, 0.3)',
                boxShadow: '0 0 40px rgba(94, 106, 210, 0.3)',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              >
                <Feather style={{ width: 40, height: 40, color: 'var(--accent-primary)' }} />
              </motion.div>
            </div>
          </motion.div>

          {/* Brand name */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            自动化写作软件
          </motion.h1>

          {/* Loading message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm mb-6"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {message}
          </motion.p>

          {/* Progress bar */}
          {progress !== undefined && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 240 }}
              transition={{ delay: 0.4 }}
              className="w-60"
            >
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </motion.div>
          )}

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-1.5 mt-6"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                animate={{
                  opacity: [0.2, 1, 0.2],
                  scale: [0.8, 1.3, 0.8],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * SkeletonOverlay - 骨架屏遮罩
 */
export function SkeletonOverlay({
  message = '加载中...',
  variant = 'text',
}: {
  message?: string
  variant?: 'text' | 'card' | 'detail'
}) {
  const content = {
    text: (
      <div className="w-full space-y-3 max-w-xs">
        <div className="h-4 rounded-md animate-shimmer motion-reduce:animate-none w-3/4" />
        <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-full" />
        <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-5/6" />
        <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-4/5" />
      </div>
    ),
    card: (
      <div className="grid gap-4 w-full max-w-sm">
        <div className="h-32 rounded-xl animate-shimmer motion-reduce:animate-none" style={{ backgroundColor: 'var(--elevation-3)' }} />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-lg animate-shimmer motion-reduce:animate-none" style={{ backgroundColor: 'var(--elevation-3)' }} />
          <div className="h-20 rounded-lg animate-shimmer motion-reduce:animate-none" style={{ backgroundColor: 'var(--elevation-3)' }} />
          <div className="h-20 rounded-lg animate-shimmer motion-reduce:animate-none" style={{ backgroundColor: 'var(--elevation-3)' }} />
        </div>
      </div>
    ),
    detail: (
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full animate-shimmer motion-reduce:animate-none" style={{ backgroundColor: 'var(--elevation-3)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded-md animate-shimmer motion-reduce:animate-none w-1/3" />
            <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-1/2" />
          </div>
        </div>
        <div className="h-40 rounded-lg animate-shimmer motion-reduce:animate-none" style={{ backgroundColor: 'var(--elevation-3)' }} />
        <div className="space-y-2">
          <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-full" />
          <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-5/6" />
          <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-4/5" />
        </div>
      </div>
    ),
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {content[variant]}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {message}
      </motion.p>
    </div>
  )
}