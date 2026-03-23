const BAGS_API = 'https://public-api-v2.bags.fm/api/v1'
const API_KEY = process.env.BAGS_API_KEY

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (!API_KEY) return {
    statusCode: 500, headers,
    body: JSON.stringify({ success: false, error: 'API key not configured' }),
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters || {})
    const path = params.get('path') || ''
    params.delete('path')

    const url = `${BAGS_API}${path}${params.toString() ? '?' + params.toString() : ''}`
    const isMultipart = event.headers['content-type']?.includes('multipart/form-data')

    const fetchOptions = {
      method: event.httpMethod,
      headers: {
        'x-api-key': API_KEY,
        ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
      },
    }

    if (event.httpMethod === 'POST' && event.body) {
      if (isMultipart) {
        fetchOptions.body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
        fetchOptions.headers['content-type'] = event.headers['content-type']
      } else {
        fetchOptions.body = event.body
      }
    }

    const res = await fetch(url, fetchOptions)
    let data = await res.json()

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

    // Trim pools - hanya ambil 1 pool dengan field yang diperlukan saja
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
      data = {
        success: true,
        response: { events: events.slice(0, 20) }
      }
    }

    const body = JSON.stringify(data)

    if (body.length > 5500000) {
      return {
        statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Response too large' }),
      }
    }

    return {
      statusCode: res.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
    }
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ success: false, error: err.message }),
    }
  }
}
