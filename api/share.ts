import { kv } from '@vercel/kv'
import { nanoid } from 'nanoid'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Short-link backend for recipe sharing. The frontend can put the whole
 * compressed payload in a URL fragment with no backend at all — but those URLs
 * get long. This optional endpoint stashes the payload in Vercel KV under a
 * short id so the shared link stays tidy. Links expire so the store stays small.
 *
 *   POST /api/share  { data }     -> { id, expiresInDays }
 *   GET  /api/share?id=<id>       -> { data }
 *
 * If KV isn't configured the frontend silently falls back to fragment links.
 */

const TTL_DAYS = 30
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60
const MAX_BYTES = 64 * 1024 // a payload this large means something is off

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const data = (req.body as { data?: unknown })?.data
      if (typeof data !== 'string' || data.length === 0) {
        return res.status(400).json({ error: 'Missing data' })
      }
      if (data.length > MAX_BYTES) {
        return res.status(413).json({ error: 'Payload too large' })
      }
      const id = nanoid(10)
      await kv.set(`share:${id}`, data, { ex: TTL_SECONDS })
      return res.status(200).json({ id, expiresInDays: TTL_DAYS })
    }

    if (req.method === 'GET') {
      const id = req.query.id
      if (typeof id !== 'string' || !id) {
        return res.status(400).json({ error: 'Missing id' })
      }
      const data = await kv.get<string>(`share:${id}`)
      if (data == null) return res.status(404).json({ error: 'Not found or expired' })
      return res.status(200).json({ data })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    // KV unconfigured / network error — let the client fall back to fragments.
    console.error('[api/share]', err)
    return res.status(503).json({ error: 'Share service unavailable' })
  }
}
