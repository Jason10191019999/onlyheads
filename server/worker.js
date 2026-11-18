// Cloudflare Worker: a tiny shared leaderboard for ONLYheads.
// Storage: one KV namespace bound as BOARD. Deploy steps in README.md.
//
// GET  /scores  -> [{ name, score, tier, headshots, at }, ...] sorted, top 50
// POST /scores  -> { name, score, tier, headshots, at }  (validated, capped)

const MAX_ENTRIES = 50
const MAX_SCORE = 100 * 400 // 400 headshots in 60s is already impossible; anything above is fake
const MAX_NAME = 12

function cors(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
  }
}

async function readBoard(env) {
  const raw = await env.BOARD.get('top')
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function sanitizeName(value) {
  const text = typeof value === 'string' ? value.trim().slice(0, MAX_NAME) : ''
  return text.length > 0 ? text : 'Player'
}

export default {
  async fetch(request, env) {
    const headers = cors(env)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers })
    if (url.pathname !== '/scores') return new Response('not found', { status: 404, headers })

    if (request.method === 'GET') {
      return Response.json(await readBoard(env), { headers })
    }

    if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers })

    let body
    try {
      body = await request.json()
    } catch {
      return new Response('bad json', { status: 400, headers })
    }

    const score = Number(body?.score)
    const headshots = Number(body?.headshots)
    const tier = Number(body?.tier)
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      return new Response('bad score', { status: 400, headers })
    }
    if (!Number.isFinite(headshots) || headshots < 0 || headshots > 400) {
      return new Response('bad headshots', { status: 400, headers })
    }
    // a round can never pay more than 100 per headshot
    if (Math.abs(score - headshots * 100) > 100) {
      return new Response('score does not match headshots', { status: 400, headers })
    }

    const entry = {
      name: sanitizeName(body?.name),
      score: Math.round(score),
      tier: Number.isFinite(tier) ? Math.min(2, Math.max(0, Math.round(tier))) : 1,
      headshots: Math.round(headshots),
      at: Date.now(),
    }

    const board = await readBoard(env)
    board.push(entry)
    board.sort((a, b) => b.score - a.score || a.at - b.at)
    const top = board.slice(0, MAX_ENTRIES)
    await env.BOARD.put('top', JSON.stringify(top))

    const rank = top.indexOf(entry) + 1
    return Response.json({ ok: true, rank }, { headers })
  },
}
