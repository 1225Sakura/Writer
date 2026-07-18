/**
 * M3 mechanism-tier regression: formatApiError must handle every observed error shape.
 *
 * Root cause (Phase 1): stores did `state.error = (error as Error).message`
 * but when FastAPI returns a 422 the body is `{detail: [...]}` (object, not Error).
 * The `.message` access yielded undefined and React later crashed with
 * "Objects are not valid as a React child".
 *
 * formatApiError normalizes every observed shape to a string so the value
 * is safe to render in JSX and to surface in ErrorBoundary's <pre>.
 *
 * 4 cases cover the canonical shapes encountered in Phase 1 walkthrough.
 */
import { describe, it, expect } from 'vitest'
import { formatApiError } from '@/utils/formatApiError'

describe('M3 formatApiError', () => {
  it('case 1: plain Error instance returns its .message', () => {
    const err = new Error('boom')
    expect(formatApiError(err)).toBe('boom')
  })

  it('case 2: FastAPI 422 detail array yields readable loc:msg string', () => {
    const err = {
      detail: [
        {
          type: 'missing',
          loc: ['body', 'project_id'],
          msg: 'Field required',
          input: {},
        },
      ],
    }
    expect(formatApiError(err)).toBe('body.project_id: Field required')
  })

  it('case 3: ApiError-like {code, message} object returns the message', () => {
    const err = { code: 'VALIDATION_ERROR', message: '请求参数错误', statusCode: 400 }
    expect(formatApiError(err)).toBe('请求参数错误')
  })

  it('case 4: null / undefined / number / arbitrary object return a string fallback', () => {
    expect(formatApiError(null)).toBe('未知错误')
    expect(formatApiError(undefined)).toBe('未知错误')
    expect(formatApiError(42)).toBe('42')
    // Object with no recognizable fields falls back to JSON serialization
    const weird = { foo: 'bar', baz: 1 }
    expect(formatApiError(weird)).toBe(JSON.stringify(weird))
  })
})