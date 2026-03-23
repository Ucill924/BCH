const OPENROUTER_KEY = process.env.OPENROUTER_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'API key not configured' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token data required' })

  const lifetimeFeeSol = (Number(token.lifetimeFees || 0) / 1e9).toFixed(4)

  const prompt = `Analyze this Solana meme token on Bags.fm:
TOKEN: ${token.name} ($${token.symbol})
Description: ${token.description || 'No description'}
Lifetime Fees: ${lifetimeFeeSol} SOL (1% from every trade = higher means more volume)
Status: ${token.status}

Give in 100 words max:
1. 📊 Summary
2. ⚠️ Risk: LOW/MEDIUM/HIGH + why
3. 💡 BUY / HOLD / SKIP + why`

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bch-gamma.vercel.app',
        'X-Title': 'Bags Creator Hub',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-001', // $0.075/M tokens — sangat murah
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await aiRes.json()
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('No response from AI')
    return res.status(200).json({ result: text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
