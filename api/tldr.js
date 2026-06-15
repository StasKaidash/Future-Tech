// Vercel API route: proxy to Anthropic Messages API.
// Keeps the API key server-side. Called by js/TldrButton.js.
//
// Graceful degradation: when the upstream is unreachable, unauthorized,
// rate-limited or out of credit (or the key isn't configured at all), the
// handler still returns 200 with a labeled demo summary so the feature stays
// demonstrable. The frontend renders a visible "Demo response" badge.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 500
const MAX_CONTENT_LENGTH = 50000
const FETCH_TIMEOUT_MS = 25000
const DEMO_SOURCE_LIMIT = 600

function getDegradeReason({ apiKey, upstreamStatus, upstreamDetail }) {
    if (process.env.FORCE_DEMO === '1') return 'forced'
    if (!apiKey) return 'missing_key'
    if (upstreamStatus === 401) return 'invalid_key'
    if (upstreamStatus === 429) return 'rate_limited'
    if (
        upstreamStatus === 400 &&
        typeof upstreamDetail === 'string' &&
        upstreamDetail.toLowerCase().includes('credit balance is too low')
    ) {
        return 'api_budget_exhausted'
    }
    return null
}

function buildDemoSummary(content) {
    const snippet = (content || '').slice(0, DEMO_SOURCE_LIMIT).trim()
    if (!snippet) {
        return 'Demo response — the AI service is currently unavailable.'
    }
    const sentences = snippet
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    if (sentences.length === 0) return snippet
    return sentences.slice(0, 3).join(' ')
}

function respondDemo(res, content, reason) {
    const summary = buildDemoSummary(content)
    console.warn(`[tldr] demo_fallback reason=${reason} length=${summary.length}`)
    return res.status(200).json({ summary, demo: true, reason, model: 'demo' })
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    let payload
    try {
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' })
    }

    const title = typeof payload.title === 'string' ? payload.title.trim() : ''
    const content = typeof payload.content === 'string' ? payload.content.trim() : ''

    if (!content) {
        return res.status(400).json({ error: 'Field "content" is required' })
    }
    if (content.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({
            error: `Content too long (max ${MAX_CONTENT_LENGTH} chars, got ${content.length})`,
        })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    // Pre-flight degrade: forced demo, or key not configured at all.
    const preDegrade = getDegradeReason({ apiKey, upstreamStatus: null, upstreamDetail: null })
    if (preDegrade) {
        return respondDemo(res, content, preDegrade)
    }

    const prompt =
        `Summarize this article in 3-5 concise sentences for a busy reader. ` +
        `Focus on key facts and takeaways. Plain prose, no bullet points, no preamble.\n\n` +
        `Article title: ${title || '(untitled)'}\n\n` +
        `Article:\n${content}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let upstream
    try {
        upstream = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: controller.signal,
        })
    } catch (err) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
            console.error('[tldr] upstream timeout after', FETCH_TIMEOUT_MS, 'ms')
            return res.status(504).json({ error: 'AI service timeout, try again later' })
        }
        console.error('[tldr] upstream fetch failed:', err)
        return res.status(502).json({ error: 'AI service unreachable' })
    }
    clearTimeout(timeoutId)

    if (!upstream.ok) {
        let detail = ''
        try {
            const errJson = await upstream.json()
            detail = errJson?.error?.message || JSON.stringify(errJson)
        } catch {
            try {
                detail = await upstream.text()
            } catch {}
        }
        console.error('[tldr] upstream error', upstream.status, detail)

        const reason = getDegradeReason({
            apiKey,
            upstreamStatus: upstream.status,
            upstreamDetail: detail,
        })
        if (reason) {
            return respondDemo(res, content, reason)
        }
        return res.status(502).json({ error: 'AI service error' })
    }

    let data
    try {
        data = await upstream.json()
    } catch (err) {
        console.error('[tldr] failed to parse upstream JSON:', err)
        return res.status(502).json({ error: 'AI service error' })
    }

    const summary = data?.content?.[0]?.text?.trim()
    if (!summary) {
        console.error('[tldr] empty summary in upstream response:', JSON.stringify(data))
        return res.status(502).json({ error: 'AI service error' })
    }

    return res.status(200).json({ summary })
}
