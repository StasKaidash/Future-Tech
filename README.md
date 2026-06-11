# Future1Tech

Multi-page tech-news website with an integrated **AI summary feature** (Anthropic Claude via Netlify Functions).

## 🔗 Live Demo
https://future1tech.netlify.app/

## 📄 Description
Future1Tech is a 6-page static website built with HTML, SCSS and vanilla JS. The blog page includes an AI-powered **TL;DR** button that summarizes the article via a serverless proxy to the Claude API — the API key lives only in the Netlify environment, never in the browser.

## 🚀 Features
- Multi-page structure (6 pages)
- Responsive design (mobile / tablet / desktop)
- Form validation (client-side)
- Navigation between pages
- **AI article summary (TL;DR drawer)** powered by Claude Haiku 4.5 via Netlify Function

## 🛠 Tech Stack
- HTML5 · SCSS (modular BEM structure) · JavaScript (ES6)
- Webpack 5 (dev server + production bundle)
- **Netlify Functions** (Node 18, serverless) — proxy to Anthropic API
- **Anthropic Claude** (`claude-haiku-4-5-20251001`)

## 🤖 AI Feature — TL;DR

On `blog.html`, the **✦ TL;DR — AI Summary** button next to the article title opens a right-side drawer with a 3–5 sentence AI summary.

### How it works

```
 ┌─────────┐   POST /.netlify/        ┌──────────────────┐    POST /v1/messages    ┌────────────┐
 │ browser │ ───── functions/tldr ──▶ │ Netlify Function │ ────── + api key ─────▶ │ Anthropic  │
 └─────────┘ ◀────── { summary } ──── │  (Node 18, ESM)  │ ◀────── { content } ─── └────────────┘
                                      └──────────────────┘
                                       reads ANTHROPIC_API_KEY
                                       from env (never exposed)
```

The function (`netlify/functions/tldr.js`) validates input (≤ 50 000 chars), aborts upstream after 25 s, and sanitizes errors before returning them to the client.

### Local development with AI

`npm start` (webpack-dev-server) cannot run Netlify Functions. Use `netlify dev` instead:

```bash
npm install -g netlify-cli      # once
cp .env.example .env            # then paste real ANTHROPIC_API_KEY into .env
netlify dev                     # serves site + functions on :8888
```

Open `http://localhost:8888/blog.html`, click ✦ TL;DR.

### Production

1. In Netlify → **Site settings → Environment variables** add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-…` key
2. Trigger a deploy. Build settings come from `netlify.toml` (`npm run build` → publish `dist/`).

## 💡 What I Learned
- Building scalable multi-page websites
- Working with SCSS architecture
- Implementing form validation
- Integrating LLM APIs through a serverless proxy (key never exposed to the browser)
- Webpack 5 production build configuration

## 📦 Deployment
Deployed via Netlify (continuous deployment from GitHub).
