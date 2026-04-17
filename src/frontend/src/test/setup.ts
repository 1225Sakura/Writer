import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach as cleanupHooks } from 'vitest'

afterEach(() => {
  cleanup()
})
