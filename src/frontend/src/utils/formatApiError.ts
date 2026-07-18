/**
 * M3 mechanism-tier helper: safely convert any error value to a displayable string.
 *
 * Root cause (Phase 1): chatStore and other stores do
 *   state.error = (error as Error).message
 * but when FastAPI returns a 422 the body is
 *   {detail: [{type, loc, msg, input}, ...]}
 * (an object, not an Error). The .message access yields undefined and React
 * later crashes with "Objects are not valid as a React child" when the store
 * renders the value inside JSX.
 *
 * This helper normalizes every observed shape:
 *   - Error instance           -> .message
 *   - ApiError (code+message)  -> .message
 *   - String                   -> the string
 *   - {detail: string}         -> detail
 *   - {detail: [...]|[{...}]}  -> JSON of the first item (msg field if present)
 *   - {msg: 'x'}               -> 'x'
 *   - {message: 'x'}           -> 'x'
 *   - other object             -> JSON
 *   - null/undefined/number    -> String(value)
 */
export function formatApiError(err: unknown): string {
  if (err == null) return '未知错误'
  if (typeof err === 'string') return err
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err)
  }
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>
    // ApiError / Error — prefer .message
    if (typeof obj.message === 'string' && obj.message) return obj.message
    // Custom envelope with .msg
    if (typeof obj.msg === 'string' && obj.msg) return obj.msg
    // FastAPI 422 detail: string
    if (typeof obj.detail === 'string' && obj.detail) return obj.detail
    // FastAPI 422 detail: array of validation errors — render first item
    if (Array.isArray(obj.detail) && obj.detail.length > 0) {
      const first = obj.detail[0]
      if (first && typeof first === 'object') {
        const f = first as Record<string, unknown>
        if (typeof f.msg === 'string') {
          const loc = Array.isArray(f.loc) ? f.loc.join('.') : ''
          return loc ? `${loc}: ${f.msg}` : f.msg
        }
        return JSON.stringify(first)
      }
      return String(first)
    }
    // Bare error field
    if (typeof obj.error === 'object' && obj.error !== null) {
      const e = obj.error as Record<string, unknown>
      if (typeof e.message === 'string') return e.message
      return JSON.stringify(e)
    }
    if (typeof obj.error === 'string') return obj.error
    // Last-resort: JSON. Trim if very long.
    try {
      const j = JSON.stringify(err)
      return j.length > 500 ? j.slice(0, 497) + '...' : j
    } catch {
      return '未知错误'
    }
  }
  return '未知错误'
}

export default formatApiError