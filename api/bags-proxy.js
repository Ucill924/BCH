const BAGS_API = 'https://public-api-v2.bags.fm/api/v1'
const API_KEY = process.env.BAGS_API_KEY

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!API_KEY) return res.status(500).json({ success: false, error: 'API key not configured' })

  try {
    const { path, ...rest } = req.query
    const queryStr = new URLSearchParams(rest).toString()
    const url = `${BAGS_API}${path}${queryStr ? '?' + queryStr : ''}`

    const isMultipart = req.headers['content-type']?.includes('multipart/form-data')

    const fetchOptions = {
      method: req.method,
      headers: {
        'x-api-key': API_KEY,
        ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
      },
    }

    if (req.method === 'POST' && req.body) {
      if (isMultipart) {
        fetchOptions.body = req.body
        fetchOptions.headers['content-type'] = req.headers['content-type']
      } else {
        fetchOptions.body = JSON.stringify(req.body)
      }
    }

    const apiRes = await fetch(url, fetchOptions)
    let data = await apiRes.json()

    // Trim token feed
    if (path === '/token-launch/feed' && data.success && Array.isArray(data.response)) {
      data = {
        success: true,
        response: data.response.slice(0, 30).map(t => ({
          name: t.name, symbol: t.symbol, image: t.image,
          tokenMint: t.tokenMint, status: t.status,
        }))
      }
    }

    // Trim pools
    if (path === '/solana/bags/pools' && data.success && Array.isArray(data.response)) {
      data = {
        success: true,
        response: data.response.slice(0, 3).map(p => ({
          dbcConfigKey: p.dbcConfigKey,
          dbcPoolKey: p.dbcPoolKey,
          tokenMint: p.tokenMint,
        }))
      }
    }

    // Trim create-token-info
    if (path === '/token-launch/create-token-info' && data.success) {
      const r = data.response
      data = {
        success: true,
        response: {
          tokenMint: r?.tokenMint || r?.tokenLaunch?.tokenMint,
          tokenMetadata: r?.tokenMetadata || r?.tokenLaunch?.uri || r?.uri,
        }
      }
    }

    // Trim claim events
    if (path === '/fee-share/token/claim-events' && data.success) {
      const events = data.response?.events || []
      data = { success: true, response: { events: events.slice(0, 20) } }
    }

    return res.status(apiRes.status).json(data)
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}
