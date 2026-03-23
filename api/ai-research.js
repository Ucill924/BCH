const OPENROUTER_KEY = process.env.OPENROUTER_KEY
const BIRDEYE_KEY = process.env.BIRDEYE_KEY || 'b4e0543ac3274d1d90dfc0e690e2e03f'

async function getTokenOverview(tokenMint) {
  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${tokenMint}`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_KEY,
          'x-chain': 'solana',
        },
      }
    )
    const data = await res.json()
    return data.success ? data.data : null
  } catch {
    return null
  }
}

async function getTokenSecurity(tokenMint) {
  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/token_security?address=${tokenMint}`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_KEY,
          'x-chain': 'solana',
        },
      }
    )
    const data = await res.json()
    return data.success ? data.data : null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: 'OpenRouter key not configured' })
  }

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token data required' })

  try {
    // Ambil data onchain dari Birdeye
    const [overview, security] = await Promise.all([
      getTokenOverview(token.tokenMint),
      getTokenSecurity(token.tokenMint),
    ])

    const lifetimeFeeSol = (Number(token.lifetimeFees || 0) / 1e9).toFixed(4)

    // Format data untuk AI
    const tokenData = {
      name: token.name,
      symbol: token.symbol,
      description: token.description || 'No description',
      status: token.status,
      lifetimeFees: `${lifetimeFeeSol} SOL`,
      // Data dari Birdeye
      price: overview?.price ? `$${overview.price.toFixed(8)}` : 'N/A',
      priceChange24h: overview?.priceChange24hPercent ? `${overview.priceChange24hPercent.toFixed(2)}%` : 'N/A',
      liquidity: overview?.liquidity ? `$${overview.liquidity.toFixed(0)}` : 'N/A',
      marketCap: overview?.mc ? `$${overview.mc.toFixed(0)}` : 'N/A',
      holders: overview?.holder || security?.ownerCount || 'N/A',
      volume24h: overview?.v24hUSD ? `$${overview.v24hUSD.toFixed(0)}` : 'N/A',
      buyCount24h: overview?.buy24h || 'N/A',
      sellCount24h: overview?.sell24h || 'N/A',
      // Security
      top10HolderPercent: security?.top10HolderPercent ? `${(security.top10HolderPercent * 100).toFixed(1)}%` : 'N/A',
      creatorBalance: security?.creatorPercentage ? `${(security.creatorPercentage * 100).toFixed(1)}%` : 'N/A',
      isMintable: security?.mintAuthority ? 'YES ⚠️' : 'No',
      isFreezeAuthority: security?.freezeAuthority ? 'YES ⚠️' : 'No',
    }

    const prompt = `You are a crypto analyst. Analyze this Solana meme token and give a concise research report:

TOKEN: ${tokenData.name} ($${tokenData.symbol})
Description: ${tokenData.description}

MARKET DATA:
- Price: ${tokenData.price} (24h: ${tokenData.priceChange24h})
- Market Cap: ${tokenData.marketCap}
- Liquidity: ${tokenData.liquidity}
- Volume 24h: ${tokenData.volume24h}
- Holders: ${tokenData.holders}
- Buys/Sells 24h: ${tokenData.buyCount24h} / ${tokenData.sellCount24h}
- Lifetime Fees: ${tokenData.lifetimeFees}

SECURITY:
- Top 10 holders: ${tokenData.top10HolderPercent}
- Creator holds: ${tokenData.creatorBalance}
- Mintable: ${tokenData.isMintable}
- Freeze authority: ${tokenData.isFreezeAuthority}

Give:
1. 📊 Summary (2 sentences)
2. ⚠️ Risk: LOW / MEDIUM / HIGH (with reason)
3. 💡 Verdict: BUY / HOLD / SKIP (with reason)

Be direct. Max 150 words. Crypto-native tone.`

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bch-gamma.vercel.app',
        'X-Title': 'Bags Creator Hub',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
      }),
    })

    const aiData = await aiRes.json()
    if (aiData.error) throw new Error(aiData.error.message)
    const text = aiData.choices?.[0]?.message?.content || 'No analysis available'

    return res.status(200).json({
      result: text,
      data: tokenData,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
