const rootSelector = '[data-js-tldr-button]'
const PANEL_ID = 'tldrPanelRoot'

const TLDR_ENDPOINT = '/api/tldr'
const MAX_CONTENT_LENGTH = 50000

class TldrButton {
    selectors = {
        root: rootSelector,
    }

    stateClasses = {
        isLoading: 'is-loading',
    }

    constructor(buttonElement) {
        this.buttonElement = buttonElement
        this.sourceSelector = buttonElement.dataset.jsTldrSource || '.blog-details__content'
        this.titleSelector = buttonElement.dataset.jsTldrTitle || '.blog-details__title'
        this.bindEvents()
    }

    bindEvents() {
        this.buttonElement.addEventListener('click', () => this.onClick())
    }

    collectArticleText() {
        const titleEl = document.querySelector(this.titleSelector)
        const sourceEl = document.querySelector(this.sourceSelector)
        const title = titleEl ? titleEl.textContent.trim() : ''
        const content = sourceEl ? sourceEl.innerText.replace(/\s+/g, ' ').trim() : ''
        return { title, content: content.slice(0, MAX_CONTENT_LENGTH) }
    }

    async onClick() {
        const panel = TldrPanel.getInstance()
        panel.open()
        panel.setLoading('Reading the article…')

        const { title, content } = this.collectArticleText()
        if (!content) {
            panel.setError('Nothing to summarize', 'Article body is empty.')
            return
        }

        this.buttonElement.classList.add(this.stateClasses.isLoading)
        this.buttonElement.setAttribute('disabled', '')

        try {
            const summary = await this.requestSummary({ title, content })
            panel.setResult(title, summary)
        } catch (err) {
            panel.setError('Could not generate summary', err.message || String(err))
        } finally {
            this.buttonElement.classList.remove(this.stateClasses.isLoading)
            this.buttonElement.removeAttribute('disabled')
        }
    }

    async requestSummary({ title, content }) {
        let response
        try {
            response = await fetch(TLDR_ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title, content }),
            })
        } catch (networkErr) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                throw new Error(
                    "Run 'netlify dev' to test the AI feature locally — 'npm start' does not host Netlify Functions."
                )
            }
            throw new Error('Network error — check your connection.')
        }

        let data = null
        try {
            data = await response.json()
        } catch {
            // non-JSON response, keep data null
        }

        if (!response.ok) {
            const message = data && data.error ? data.error : 'Failed to generate summary. Try again later.'
            throw new Error(message)
        }

        const summary = data && data.summary ? String(data.summary).trim() : ''
        if (!summary) {
            throw new Error('Failed to generate summary. Try again later.')
        }
        return summary
    }
}

class TldrPanel {
    static instance = null

    static getInstance() {
        if (!TldrPanel.instance) TldrPanel.instance = new TldrPanel()
        return TldrPanel.instance
    }

    constructor() {
        this.root = document.getElementById(PANEL_ID) || this.build()
        this.contentEl = this.root.querySelector('[data-js-tldr-panel-content]')
        this.closeBtn = this.root.querySelector('[data-js-tldr-panel-close]')
        this.backdrop = this.root.querySelector('[data-js-tldr-panel-backdrop]')
        this.closeBtn.addEventListener('click', () => this.close())
        this.backdrop.addEventListener('click', () => this.close())
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.root.classList.contains('is-open')) this.close()
        })
    }

    build() {
        const wrap = document.createElement('div')
        wrap.id = PANEL_ID
        wrap.className = 'tldr-panel'
        wrap.setAttribute('role', 'dialog')
        wrap.setAttribute('aria-modal', 'true')
        wrap.setAttribute('aria-labelledby', 'tldrPanelTitle')
        wrap.innerHTML = `
            <div class="tldr-panel__backdrop" data-js-tldr-panel-backdrop></div>
            <aside class="tldr-panel__drawer">
                <header class="tldr-panel__header">
                    <h3 class="tldr-panel__heading" id="tldrPanelTitle">
                        <span class="tldr-panel__spark" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 1.5L12.4142 5.08579L16 6.5L12.4142 7.91421L11 11.5L9.58579 7.91421L6 6.5L9.58579 5.08579L11 1.5Z" fill="currentColor"/>
                                <path d="M5 11L5.70711 12.7929L7.5 13.5L5.70711 14.2071L5 16L4.29289 14.2071L2.5 13.5L4.29289 12.7929L5 11Z" fill="currentColor"/>
                                <path d="M15 13L15.5303 14.4697L17 15L15.5303 15.5303L15 17L14.4697 15.5303L13 15L14.4697 14.4697L15 13Z" fill="currentColor"/>
                            </svg>
                        </span>
                        Article Summary
                    </h3>
                    <button class="tldr-panel__close" type="button" aria-label="Close summary" data-js-tldr-panel-close>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </header>
                <div class="tldr-panel__content" data-js-tldr-panel-content></div>
                <footer class="tldr-panel__footer">
                    <small>Powered by Claude Haiku 4.5</small>
                </footer>
            </aside>
        `
        document.body.appendChild(wrap)
        return wrap
    }

    open() {
        this.root.classList.add('is-open')
        document.body.style.overflow = 'hidden'
    }

    close() {
        this.root.classList.remove('is-open')
        document.body.style.overflow = ''
    }

    setLoading(message) {
        this.contentEl.innerHTML = `
            <div class="tldr-panel__loader">
                <div class="tldr-panel__spinner" aria-hidden="true"></div>
                <p class="tldr-panel__loader-text">${message}</p>
            </div>
        `
    }

    setResult(title, summary) {
        const safeTitle = this.escape(title)
        // Server returns prose (3-5 sentences). Split into sentences so each renders
        // as its own bullet, keeping the existing visual style.
        const sentences = summary
            .replace(/\s+/g, ' ')
            .split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/)
            .map((s) => s.trim())
            .filter(Boolean)
        const bullets = sentences
            .map((s) => `<li>${this.escape(s.replace(/^[•\-\*]\s*/, ''))}</li>`)
            .join('')
        this.contentEl.innerHTML = `
            <p class="tldr-panel__subtitle">${safeTitle}</p>
            <ul class="tldr-panel__bullets">${bullets}</ul>
        `
    }

    setError(headline, detail) {
        this.contentEl.innerHTML = `
            <div class="tldr-panel__error">
                <p class="tldr-panel__error-headline">${this.escape(headline)}</p>
                <p class="tldr-panel__error-detail">${this.escape(detail)}</p>
            </div>
        `
    }

    escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }
}

class TldrButtonCollection {
    constructor() {
        this.init()
    }

    init() {
        const buttons = document.querySelectorAll(rootSelector)
        buttons.forEach((el) => new TldrButton(el))
    }
}

export default TldrButtonCollection
