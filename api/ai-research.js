const OPENROUTER_KEY = process.env.OPENROUTER_KEY
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'OpenRouter key not configured' })
 
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token data required' })
 
  const lifetimeFeeSol = (Number(token.lifetimeFees || 0) / 1e9).toFixed(4)
 
  const prompt = `You are a crypto analyst. Analyze this Solana meme token on Bags.fm:
 
TOKEN: ${token.name} ($${token.symbol})
Description: ${token.description || 'No description'}
Status: ${token.status || 'UNKNOWN'}
Lifetime Fees Earned: ${lifetimeFeeSol} SOL (fees collected from ALL trades ever)
 
Note: Bags.fm tokens earn 1% from every trade forever. Higher lifetime fees = more trading volume = more community interest.
 
Based on this data, give:
1. 📊 Summary (2 sentences max)
2. ⚠️ Risk Level: LOW / MEDIUM / HIGH + 1 reason
3. 💡 Verdict: BUY / HOLD / SKIP + 1 reason
 
Keep it under 120 words. Be direct, crypto-native. No fluff.`
 
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
        model: 'google/gemma-3-27b-it:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
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
 
