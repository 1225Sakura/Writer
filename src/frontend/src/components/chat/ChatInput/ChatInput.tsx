/**
 * InputField (Phase 0b.2 split) — re-exports the legacy public name.
 *
 * The original 826-line InputField.tsx was decomposed into:
 *   - types.ts                (slash-command catalog + shared props)
 *   - ChatVoiceHook.ts        (useVoiceRecognition hook)
 *   - useInputInteractions.ts (mention/command detect + keyboard nav)
 *   - ChatCommandPalette.tsx  (slash /command popup)
 *   - ChatAutocomplete.tsx    (#entity mention popup)
 *   - ChatToolbar.tsx         (action buttons + send)
 *   - ChatTextArea.tsx        (textarea + char counter)
 *
 * This file owns the orchestrator: textarea ref, focus state, voice
 * wiring, and the JSX layout that stitches the sub-components together.
 *
 * Public name `InputField` is preserved for backwards compatibility
 * with existing imports (e.g. UserInputPanel.tsx).
 */
import { useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChatStore } from '@/store/chatStore'
import { useVoiceRecognition } from './ChatVoiceHook'
import { useInputInteractions } from './useInputInteractions'
import { CommandPalette } from './ChatCommandPalette'
import { AutocompletePopup } from './ChatAutocomplete'
import { ChatToolbar } from './ChatToolbar'
import { ChatTextArea } from './ChatTextArea'
import { MAX_INPUT_LENGTH, slashCommands, type InputFieldProps } from './types'

export type { InputFieldProps }
export { MAX_INPUT_LENGTH, slashCommands }

export function InputField({
  input,
  onInputChange,
  onSend,
  onNewChat,
  onAttachClick,
  onExportOutline,
  onClearChat,
  isLoading,
  isStreaming,
  canSend,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const extractedEntities = useChatStore((state) => state.extractedEntities)

  // Voice recognition
  const handleVoiceResult = (text: string) => {
    if (text.length <= MAX_INPUT_LENGTH) {
      onInputChange(text)
    }
  }
  const { isRecording, toggleRecording } = useVoiceRecognition(handleVoiceResult)

  const interactions = useInputInteractions({
    input,
    onInputChange,
    onSend,
    onExportOutline,
    onClearChat,
    extractedEntities,
  })

  return (
    <div className="flex gap-2 items-end">
      <ChatToolbar
        onNewChat={onNewChat}
        onAttachClick={onAttachClick}
        onSend={onSend}
        onVoiceToggle={toggleRecording}
        isLoading={isLoading}
        isStreaming={isStreaming}
        isRecording={isRecording}
        canSend={canSend}
      />

      <div className="flex-1 relative min-w-0">
        <AnimatePresence>
          {interactions.commandVisible && interactions.filteredCommands.length > 0 && (
            <CommandPalette
              commands={slashCommands}
              query={interactions.commandQuery}
              selectedIndex={interactions.commandSelectedIndex}
              onSelect={interactions.handleCommandSelect}
              visible={interactions.commandVisible}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {interactions.autocompleteVisible && extractedEntities.length > 0 && (
            <AutocompletePopup
              entities={extractedEntities}
              query={interactions.autocompleteQuery}
              selectedIndex={interactions.selectedIndex}
              onSelect={interactions.handleSelect}
              visible={interactions.autocompleteVisible}
            />
          )}
        </AnimatePresence>

        <ChatTextArea
          ref={textareaRef}
          value={input}
          onChange={interactions.handleTextareaChange}
          onKeyDown={interactions.handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            interactions.handleBlur()
          }}
          isFocused={isFocused}
        />
      </div>
    </div>
  )
}