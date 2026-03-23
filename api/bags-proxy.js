const BAGS_API = 'https://public-api-v2.bags.fm/api/v1'
const API_KEY = process.env.BAGS_API_KEY

export const config = { api: { bodyParser: false } }

// In-memory cache (resets on cold start, good enough for rate limit)
const cache = new Map()
const CACHE_TTL = {
  '/token-launch/feed': 60_000,          // 1 minute
  '/token-launch/lifetime-fees': 120_000, // 2 minutes
  '/token-launch/claim-stats': 60_000,
  '/fee-share/token/claim-events': 60_000,
  '/solana/bags/pools': 300_000,          // 5 minutes
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) { cache.delete(key); return null }
  return entry.data
}

function setCache(key, data, ttl) {
  cache.set(key, { data, expires: Date.now() + ttl })
}

function trimResponse(path, data) {
  if (path.includes('/token-launch/feed')) {
    const list = Array.isArray(data) ? data : (data.response || [])
    return list.slice(0, 30).map(t => ({ name: t.name, symbol: t.symbol, image: t.image, tokenMint: t.tokenMint, status: t.status, description: t.description }))
  }
  if (path.includes('/solana/bags/pools')) {
    const list = Array.isArray(data) ? data : (data.response || [])
    return list.slice(0, 3).map(p => ({ dbcConfigKey: p.dbcConfigKey, dbcPoolKey: p.dbcPoolKey, tokenMint: p.tokenMint }))
  }
  if (path.includes('/fee-share/token/claim-events')) {
    const events = data.response?.events || data.events || []
    return { events: events.slice(0, 20) }
  }
  if (path.includes('/token-launch/claimable-positions')) {
    const list = Array.isArray(data) ? data : (data.response || [])
    return list.map(p => ({ baseMint: p.baseMint, totalClaimableLamportsUserShare: p.totalClaimableLamportsUserShare, claimableDisplayAmount: p.claimableDisplayAmount, user: p.user }))
  }
  return data
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!API_KEY) return res.status(500).json({ success: false, error: 'API key not configured' })

  try {
    const { path, ...rest } = req.query
    const queryStr = new URLSearchParams(rest).toString()
    const url = `${BAGS_API}${path}${queryStr ? '?' + queryStr : ''}`

    // Check cache for GET requests
    const cacheKey = url
    const ttl = Object.entries(CACHE_TTL).find(([k]) => path?.includes(k))?.[1]
    if (req.method === 'GET' && ttl) {
      const cached = getCached(cacheKey)
      if (cached) {
        return res.status(200).json({ success: true, response: cached, cached: true })
      }
    }

    const contentType = req.headers['content-type'] || ''
    const fetchOptions = { method: req.method, headers: { 'x-api-key': API_KEY } }

    if (req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      const rawBody = Buffer.concat(chunks)
      fetchOptions.body = rawBody
      if (contentType.includes('application/json')) {
        fetchOptions.headers['Content-Type'] = 'application/json'
      } else if (contentType.includes('multipart/form-data')) {
        fetchOptions.headers['Content-Type'] = contentType
      }
    }

    const upstream = await fetch(url, fetchOptions)
    const text = await upstream.text()

    let parsed
    try { parsed = JSON.parse(text) } catch { return res.status(200).send(text) }

    const raw = parsed.response ?? parsed
    const trimmed = trimResponse(path, raw)

    // Cache successful GET responses
    if (req.method === 'GET' && ttl && upstream.ok) {
      setCache(cacheKey, trimmed, ttl)
    }

    return res.status(upstream.status).json({ success: upstream.ok, response: trimmed })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
}
