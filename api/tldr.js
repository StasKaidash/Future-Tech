// Vercel API route: proxy to Anthropic Messages API.
// Keeps the API key server-side. Called by js/TldrButton.js.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 500
const MAX_CONTENT_LENGTH = 50000
const FETCH_TIMEOUT_MS = 25000

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
    if (!apiKey) {
        console.error('[tldr] ANTHROPIC_API_KEY env variable is not set')
        return res.status(500).json({ error: 'Server not configured' })
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

        if (upstream.status === 401) {
            return res.status(500).json({ error: 'Server auth error' })
        }
        if (upstream.status === 429) {
            return res.status(429).json({ error: 'Rate limit, try again later' })
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
