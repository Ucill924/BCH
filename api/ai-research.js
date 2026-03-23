const OPENROUTER_KEY = process.env.OPENROUTER_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: 'OpenRouter key not configured' })
  }

  const { token } = req.body
  const prompt = `Analyze this Solana meme token on Bags.fm:
Token: ${token.name} ($${token.symbol})
Description: ${token.description || 'N/A'}
Lifetime Fees: ${(Number(token.lifetimeFees || 0) / 1e9).toFixed(4)} SOL
Status: ${token.status}

Give: 1) Quick summary 2) Risk: Low/Med/High 3) BUY or SKIP with reason. Max 120 words. Be direct and crypto-native.`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bch-gamma.vercel.app',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      }),
    })
    const data = await aiRes.json()
    const text = data.choices?.[0]?.message?.content || 'AI analysis failed'
    return res.status(200).json({ result: text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
