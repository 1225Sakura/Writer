/**
 * InputField.tsx — backwards-compatible re-export shim.
 *
 * Phase 0b.2 split: this file used to host 826 lines of monolithic
 * InputField logic. After splitting into 5 sub-components under
 * src/components/chat/ChatInput/, this file is now a 1-line re-export
 * to keep `import { InputField } from './InputField'` working for all
 * existing callers (e.g. UserInputPanel.tsx).
 */
export { InputField } from './ChatInput/ChatInput'
export type { InputFieldProps } from './ChatInput/types'
export { MAX_INPUT_LENGTH, slashCommands } from './ChatInput/types'