import { useEffect, useState, useRef } from 'react'

export interface TypewriterTextProps {
  text: string
  speed?: number
  delay?: number
  showCursor?: boolean
  className?: string
  onComplete?: () => void
}

export function TypewriterText({
  text,
  speed = 50,
  delay = 0,
  showCursor = true,
  className,
  onComplete,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const indexRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    indexRef.current = 0
    setDisplayedText('')

    const startTyping = () => {
      const typeNext = () => {
        if (indexRef.current < text.length) {
          indexRef.current += 1
          setDisplayedText(text.slice(0, indexRef.current))
          timeoutRef.current = setTimeout(typeNext, speed)
        } else {
          onComplete?.()
        }
      }
      typeNext()
    }

    timeoutRef.current = setTimeout(startTyping, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [text, speed, delay, onComplete])

  // Cursor blink
  useEffect(() => {
    if (!showCursor) return
    const interval = setInterval(() => {
      setCursorVisible(v => !v)
    }, 530)
    return () => clearInterval(interval)
  }, [showCursor])

  return (
    <span className={className}>
      {displayedText}
      {showCursor && (
        <span
          className="inline-block w-[2px] ml-[1px] align-middle"
          style={{
            backgroundColor: cursorVisible ? 'currentColor' : 'transparent',
            height: '1em',
            transition: 'background-color 100ms',
          }}
        />
      )}
    </span>
  )
}
