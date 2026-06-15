# Future1Tech

Multi-page tech-news website with an integrated **AI summary feature** (Anthropic Claude via Vercel Serverless Functions).

## 🔗 Live Demo
https://future1tech.netlify.app/

## 📄 Description
Future1Tech is a 6-page static website built with HTML, SCSS and vanilla JS. The blog page includes an AI-powered **TL;DR** button that summarizes the article via a serverless proxy to the Claude API — the API key lives only on the server, never in the browser.

## 🚀 Features
- Multi-page structure (6 pages)
- Responsive design (mobile / tablet / desktop)
- Form validation (client-side)
- Navigation between pages
- **AI article summary (TL;DR drawer)** powered by Claude Sonnet 4.6 via Vercel Serverless Function

## 🛠 Tech Stack
- HTML5 · SCSS (modular BEM structure) · JavaScript (ES6)
- Webpack 5 (dev server + production bundle)
- **Vercel Serverless Functions** (Node, CommonJS) — proxy to Anthropic API
- **Anthropic Claude** (`claude-sonnet-4-6`)

## 🤖 AI Summarizer

On `blog.html`, the **✦ TL;DR — AI Summary** button next to the article title opens a right-side drawer with a 3–5 sentence AI summary of the post.

- **Model:** `claude-sonnet-4-6` (Anthropic Claude 4.6 Sonnet)
- **Function code:** [`api/tldr.js`](api/tldr.js) — Vercel serverless handler (CommonJS)
- **Frontend caller:** [`js/TldrButton.js`](js/TldrButton.js) — `POST /api/tldr` with `{ title, content }`
- **Security:** `ANTHROPIC_API_KEY` lives only in Vercel env vars — never shipped to the browser. Server-side input validation (≤ 50 000 chars), 25 s upstream timeout, sanitized error responses.

### Flow

```
 ┌─────────┐       POST /api/tldr        ┌────────────────────┐    POST /v1/messages    ┌────────────┐
 │ browser │ ─── { title, content } ───▶ │  Vercel Function   │ ────── + api key ─────▶ │ Anthropic  │
 └─────────┘ ◀──────── { summary } ───── │   (api/tldr.js)    │ ◀────── { content } ─── └────────────┘
                                          └────────────────────┘
                                           reads ANTHROPIC_API_KEY
                                           from env (never exposed)
```

### Local development with AI

`npm start` (webpack-dev-server) cannot run serverless functions. Use `vercel dev` instead:

```bash
npm install -g vercel           # once
cp .env.example .env.local      # then paste real ANTHROPIC_API_KEY into .env.local
vercel dev                      # serves site + functions on :3000
```

Open `http://localhost:3000/blog.html`, click ✦ TL;DR.

### Production

1. Import the repo in Vercel.
2. Project → **Settings → Environment Variables** → add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-…` key
3. Deploy. Build settings come from `vercel.json` (`npm run build` → publish `dist/`).

## 💡 What I Learned
- Building scalable multi-page websites
- Working with SCSS architecture
- Implementing form validation
- Integrating LLM APIs through a serverless proxy (key never exposed to the browser)
- Webpack 5 production build configuration
- Migrating a serverless backend from Netlify Functions to Vercel Serverless Functions

## 📦 Deployment
Deployed via Vercel (continuous deployment from GitHub).
