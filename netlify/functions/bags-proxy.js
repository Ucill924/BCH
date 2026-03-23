const BAGS_API = 'https://public-api-v2.bags.fm/api/v1'
const API_KEY = process.env.BAGS_API_KEY

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'API key not configured on server' }),
    }
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters || {})
    const path = params.get('path') || ''
    params.delete('path')

    const queryStr = params.toString()
    const url = `${BAGS_API}${path}${queryStr ? '?' + queryStr : ''}`

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

    if (path === '/token-launch/feed' && data.success && Array.isArray(data.response)) {
      data = {
        success: true,
        response: data.response.slice(0, 30).map(t => ({
          name: t.name,
          symbol: t.symbol,
          image: t.image,
          tokenMint: t.tokenMint,
          status: t.status,
          description: t.description?.slice(0, 100),
        }))
      }
    }

    const body = JSON.stringify(data)

    if (body.length > 5000000) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
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
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    }
  }
}
