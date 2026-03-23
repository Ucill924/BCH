const BAGS_API = 'https://public-api-v2.bags.fm/api/v1'
const API_KEY = process.env.BAGS_API_KEY

export const config = {
  api: {
    bodyParser: false,
  },
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

    const contentType = req.headers['content-type'] || ''

    const fetchOptions = {
      method: req.method,
      headers: {
        'x-api-key': API_KEY,
      },
    }

    if (req.method === 'POST') {
      // Baca raw body
      const chunks = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      const rawBody = Buffer.concat(chunks)

      fetchOptions.body = rawBody
      fetchOptions.headers['content-type'] = contentType
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

    // Trim claimable positions
    if (path === '/token-launch/claimable-positions' && data.success && Array.isArray(data.response)) {
      data = {
        success: true,
        response: data.response.map(p => ({
          baseMint: p.baseMint,
          totalClaimableLamportsUserShare: p.totalClaimableLamportsUserShare,
          claimableDisplayAmount: p.claimableDisplayAmount,
          user: p.user,
        }))
      }
    }

    return res.status(apiRes.status).json(data)
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}
