const AGENTROUTER_KEY = process.env.OPENROUTER_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!AGENTROUTER_KEY) return res.status(500).json({ error: 'API key not configured' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token data required' })

  const lifetimeFeeSol = (Number(token.lifetimeFees || 0) / 1e9).toFixed(4)

  const prompt = `You are a crypto analyst. Analyze this Solana meme token on Bags.fm:

TOKEN: ${token.name} ($${token.symbol})
Description: ${token.description || 'No description'}
Status: ${token.status || 'UNKNOWN'}
Lifetime Fees: ${lifetimeFeeSol} SOL (1% from every trade, higher = more volume)

Give:
1. 📊 Summary (2 sentences)
2. ⚠️ Risk: LOW / MEDIUM / HIGH + reason
3. 💡 Verdict: BUY / HOLD / SKIP + reason

Max 120 words. Direct, crypto-native tone.`

  try {
    // AgentRouter pakai OpenAI-compatible format
    const aiRes = await fetch('https://agentrouter.org/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v3.1',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await aiRes.json()
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
    const text = data.choices?.[0]?.message?.content || 'No analysis available'
    return res.status(200).json({ result: text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
