/**
 * Sentry beforeSend redaction unit tests (Phase 2.1).
 *
 * These tests pin the behaviour of the redactor used in src/lib/sentry.ts.
 * The actual Sentry.init() flow is not exercised here — we test the helper
 * functions directly, since wiring Sentry in jsdom would require a fake
 * transport.
 */
import { describe, it, expect } from 'vitest'
import { redactObject, API_KEY_REGEX } from '@/lib/sentry'

describe('sentry redactObject', () => {
  it('redacts top-level sensitive keys', () => {
    const input = {
      prompt: 'write a haiku about autumn',
      response: 'leaves fall gently...',
      api_key: 'sk-cp-real-key-1234567890',
      safeField: 'keep me',
    }
    redactObject(input)
    expect(input.prompt).toBe('***')
    expect(input.response).toBe('***')
    expect(input.api_key).toBe('***')
    expect(input.safeField).toBe('keep me')
  })

  it('redacts nested sensitive keys', () => {
    const input = {
      request: {
        data: {
          authorization: 'Bearer xyz',
          prompt: 'hidden',
        },
      },
    } as Record<string, unknown>
    redactObject(input)
    const data = (input.request as Record<string, unknown>).data as Record<string, unknown>
    expect(data.authorization).toBe('***')
    expect(data.prompt).toBe('***')
  })

  it('redacts inline sk-... API keys inside string fields', () => {
    const input = {
      note: 'pre-seeded with sk-cp-QYLHlhhJRjuRCw-zQjGdAl-QO1zbfMyOmuuoPIKhAisTtfNXsErI3_keoAhl399lkto_kQKDWYlHLLQ_jS9rluNgZMKuz6G21W4ScNhPZl5sSi4KGUCVOaU',
    }
    redactObject(input)
    expect(input.note).not.toContain('sk-cp-QYLHlhhJRjuRCw')
    expect(input.note).toContain('sk-***')
  })

  it('handles deeply nested objects without crashing', () => {
    const input = { a: { b: { c: { d: { prompt: 'deep' } } } } } as Record<string, unknown>
    redactObject(input)
    const deep = (((input.a as Record<string, unknown>).b as Record<string, unknown>).c as Record<string, unknown>).d as Record<string, unknown>
    expect(deep.prompt).toBe('***')
  })

  it('redacts camelCase apiKey and x-api-key variants', () => {
    const input = {
      apiKey: 'sk-cp-foo-bar-123456789012345678',
      'x-api-key': 'sk-cp-baz-qux-123456789012345678',
      xAnthropicApiKey: 'sk-cp-anthropic-123456789012345678',
    } as Record<string, unknown>
    redactObject(input)
    expect(input.apiKey).toBe('***')
    expect(input['x-api-key']).toBe('***')
    expect(input.xAnthropicApiKey).toBe('***')
  })

  it('passes through non-sensitive fields unchanged', () => {
    const input = {
      url: '/api/projects/42',
      method: 'POST',
      statusCode: 500,
    }
    redactObject(input)
    expect(input.url).toBe('/api/projects/42')
    expect(input.method).toBe('POST')
    expect(input.statusCode).toBe(500)
  })
})

describe('API_KEY_REGEX', () => {
  it('matches Anthropic sk-cp-... keys', () => {
    const key = 'sk-cp-QYLHlhhJRjuRCw-zQjGdAl-QO1zbfMyOmuuoPIKhAisTtfNXsErI3_keoAhl399lkto_kQKDWYlHLLQ_jS9rluNgZMKuz6G21W4ScNhPZl5sSi4KGUCVOaU'
    const replaced = key.replace(API_KEY_REGEX, 'sk-***')
    expect(replaced).toBe('sk-***')
    expect(replaced).not.toContain('QYLHlhhJRjuRCw')
  })

  it('does not match short tokens (avoids false positives)', () => {
    const short = 'sk-abc'
    expect(short.replace(API_KEY_REGEX, 'sk-***')).toBe('sk-abc')
  })
})