/**
 * SearchReplaceBar - Floating search/replace bar for the editor
 *
 * Triggered by Ctrl+F. Shows at top of editor area.
 * Features: search input, replace input, regex toggle, case sensitive toggle.
 * Results: highlight matches, show count "3/17".
 * Navigation: Enter/Shift+Enter to jump between matches.
 * Replace: single replace, replace all.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Replace,
  ChevronUp,
  ChevronDown,
  X,
  Regex,
  CaseSensitive,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { getEditorInstance } from '@/store/editorRegistry'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface SearchMatch {
  from: number
  to: number
}

export function SearchReplaceBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [isCaseSensitive, setIsCaseSensitive] = useState(false)
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Find matches when search query changes
  const findMatches = useCallback(() => {
    const editor = getEditorInstance()
    if (!editor || !searchQuery) {
      setMatches([])
      setCurrentMatchIndex(-1)
      return
    }

    const doc = editor.state.doc
    const text = doc.textContent
    const newMatches: SearchMatch[] = []

    try {
      if (isRegex) {
        const flags = isCaseSensitive ? 'g' : 'gi'
        const regex = new RegExp(searchQuery, flags)
        let match: RegExpExecArray | null

        while ((match = regex.exec(text)) !== null) {
          // Convert text position to document position
          const from = match.index
          const matchLength = match[0].length

          // Find actual document positions
          let docFrom = -1
          let docTo = -1

          doc.descendants((node, pos) => {
            if (node.isText && node.text) {
              const nodeText = node.text
              const nodeStart = text.indexOf(nodeText)

              if (nodeStart !== -1 && from >= nodeStart && from < nodeStart + nodeText.length) {
                docFrom = pos + (from - nodeStart)
                docTo = docFrom + matchLength
                return false
              }
            }
            return true
          })

          if (docFrom !== -1 && docTo !== -1) {
            newMatches.push({ from: docFrom, to: docTo })
          }
        }
      } else {
        // Simple string search
        const searchText = isCaseSensitive ? searchQuery : searchQuery.toLowerCase()
        const textToSearch = isCaseSensitive ? text : text.toLowerCase()

        let index = 0
        while ((index = textToSearch.indexOf(searchText, index)) !== -1) {
          const from = index
          const matchLength = searchText.length

          // Find actual document positions
          let docFrom = -1
          let docTo = -1

          doc.descendants((node, pos) => {
            if (node.isText && node.text) {
              const nodeText = node.text
              const nodeStart = text.indexOf(nodeText)

              if (nodeStart !== -1 && from >= nodeStart && from < nodeStart + nodeText.length) {
                docFrom = pos + (from - nodeStart)
                docTo = docFrom + matchLength
                return false
              }
            }
            return true
          })

          if (docFrom !== -1 && docTo !== -1) {
            newMatches.push({ from: docFrom, to: docTo })
          }

          index += matchLength
        }
      }
    } catch {
      // Invalid regex
      setMatches([])
      setCurrentMatchIndex(-1)
      return
    }

    setMatches(newMatches)
    setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1)

    // Scroll to first match
    if (newMatches.length > 0) {
      scrollToMatch(newMatches[0])
    }
  }, [searchQuery, isRegex, isCaseSensitive])

  // Find matches when query or options change
  useEffect(() => {
    const debounceTimer = setTimeout(findMatches, 300)
    return () => clearTimeout(debounceTimer)
  }, [findMatches])

  // Scroll to a specific match
  const scrollToMatch = useCallback((match: SearchMatch) => {
    const editor = getEditorInstance()
    if (!editor) return

    // Select the match
    editor.commands.setTextSelection({ from: match.from, to: match.to })

    // Scroll into view
    const { node } = editor.view.domAtPos(match.from)
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return

    const nextIndex = (currentMatchIndex + 1) % matches.length
    setCurrentMatchIndex(nextIndex)
    scrollToMatch(matches[nextIndex])
  }, [matches, currentMatchIndex, scrollToMatch])

  // Navigate to previous match
  const goToPreviousMatch = useCallback(() => {
    if (matches.length === 0) return

    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length
    setCurrentMatchIndex(prevIndex)
    scrollToMatch(matches[prevIndex])
  }, [matches, currentMatchIndex, scrollToMatch])

  // Replace current match
  const replaceCurrentMatch = useCallback(() => {
    const editor = getEditorInstance()
    if (!editor || currentMatchIndex === -1 || matches.length === 0) return

    const match = matches[currentMatchIndex]
    editor.commands.deleteRange({ from: match.from, to: match.to })
    editor.commands.insertContentAt(match.from, replaceQuery)

    // Find new matches
    findMatches()
  }, [currentMatchIndex, matches, replaceQuery, findMatches])

  // Replace all matches
  const replaceAllMatches = useCallback(() => {
    const editor = getEditorInstance()
    if (!editor || matches.length === 0) return

    // Replace from end to start to maintain positions
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from)

    sortedMatches.forEach((match) => {
      editor.commands.deleteRange({ from: match.from, to: match.to })
      editor.commands.insertContentAt(match.from, replaceQuery)
    })

    // Find new matches
    findMatches()
  }, [matches, replaceQuery, findMatches])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setIsOpen(true)
        setShowReplace(false)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }

      // Ctrl+H to open replace
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        setIsOpen(true)
        setShowReplace(true)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }

      // Enter to go to next match
      if (e.key === 'Enter' && isOpen && document.activeElement === searchInputRef.current) {
        e.preventDefault()
        if (e.shiftKey) {
          goToPreviousMatch()
        } else {
          goToNextMatch()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, goToNextMatch, goToPreviousMatch])

  // Highlight matches in editor (using custom event for now)
  useEffect(() => {
    const editor = getEditorInstance()
    if (!editor) return

    // Dispatch custom event for search highlights
    if (matches.length > 0 && searchQuery) {
      window.dispatchEvent(new CustomEvent('search-highlight', {
        detail: { matches, currentMatchIndex }
      }))
    } else {
      window.dispatchEvent(new CustomEvent('search-highlight', {
        detail: { matches: [], currentMatchIndex: -1 }
      }))
    }
  }, [matches, currentMatchIndex, searchQuery])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        className="absolute top-2 right-2 z-50"
      >
        <div
          className="rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-float)',
            minWidth: '320px',
          }}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 p-2">
            {/* Search input */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-base)' }}>
              <Icon icon={Search} size="sm" style={{ color: 'var(--text-tertiary)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="搜索"
                placeholder="搜索..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
              />
              {searchQuery && (
                <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
                  {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
                </span>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsRegex(!isRegex)}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  background: isRegex ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' : 'transparent',
                  color: isRegex ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                }}
                title="正则表达式"
              >
                <Icon icon={Regex} size="sm" />
              </button>
              <button
                onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  background: isCaseSensitive ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' : 'transparent',
                  color: isCaseSensitive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                }}
                title="区分大小写"
              >
                <Icon icon={CaseSensitive} size="sm" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={goToPreviousMatch}
                disabled={matches.length === 0}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                title="上一个 (Shift+Enter)"
              >
                <Icon icon={ChevronUp} size="sm" />
              </button>
              <button
                onClick={goToNextMatch}
                disabled={matches.length === 0}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                title="下一个 (Enter)"
              >
                <Icon icon={ChevronDown} size="sm" />
              </button>
            </div>

            {/* Toggle replace */}
            <button
              onClick={() => setShowReplace(!showReplace)}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              title="替换"
            >
              <Icon icon={Replace} size="sm" />
            </button>

            {/* Close */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              title="关闭 (Escape)"
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>

          {/* Replace bar */}
          <AnimatePresence>
            {showReplace && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-2 pb-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-base)' }}>
                    <Icon icon={Replace} size="sm" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                      ref={replaceInputRef}
                      type="text"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      placeholder="替换..."
                      aria-label="替换"
                      className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={replaceCurrentMatch}
                      disabled={matches.length === 0 || currentMatchIndex === -1}
                      className="px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                        color: 'var(--accent-primary)',
                      }}
                      title="替换当前"
                    >
                      替换
                    </button>
                    <button
                      onClick={replaceAllMatches}
                      disabled={matches.length === 0}
                      className="px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                        color: 'var(--accent-primary)',
                      }}
                      title="全部替换"
                    >
                      全部
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
