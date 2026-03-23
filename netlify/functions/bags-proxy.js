const BAGS_API = 'https://public-api-v2.bags.fm/api/v1'
const API_KEY = process.env.BAGS_API_KEY

export async function handler(event) {
  // CORS headers
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
    // Ambil path dari query string: ?path=/token-launch/feed
    const params = new URLSearchParams(event.queryStringParameters || {})
    const path = params.get('path') || ''
    params.delete('path')

    // Build URL dengan sisa query params
    const queryStr = params.toString()
    const url = `${BAGS_API}${path}${queryStr ? '?' + queryStr : ''}`

    // Tentukan content type
    const isMultipart = event.headers['content-type']?.includes('multipart/form-data')

    const fetchOptions = {
      method: event.httpMethod,
      headers: {
        'x-api-key': API_KEY,
        ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
      },
    }

    // Attach body untuk POST
    if (event.httpMethod === 'POST' && event.body) {
      if (isMultipart) {
        // Decode base64 body untuk multipart
        fetchOptions.body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
        fetchOptions.headers['content-type'] = event.headers['content-type']
      } else {
        fetchOptions.body = event.body
      }
    }

    const res = await fetch(url, fetchOptions)
    const data = await res.json()

    return {
      statusCode: res.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    }
  }
}
