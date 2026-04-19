const MODE_ITEMS = ['Execute mode', 'Plan mode', 'Merge mode']
const STEP_DOTS = Array.from({ length: 8 })
const SIDEBAR_ICONS = ['VS', 'SC', 'RG', 'EX']

export default function Home() {
  return (
    <main className="how-it-works-page">
      <header className="top-nav">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            R
          </div>
          <div>
            <p className="brand-title">How it works</p>
            <p className="brand-subtitle">
              Watch an agent run from prompt to merged PR
            </p>
          </div>
        </div>

        <nav className="mode-switches" aria-label="Workflow modes">
          {MODE_ITEMS.map((mode, index) => (
            <button
              className={`mode-pill ${index === 0 ? 'active' : ''}`}
              key={mode}
              type="button"
            >
              {mode}
            </button>
          ))}
        </nav>

        <div className="top-meta">
          <span className="page-counter">1 / 9</span>
          <button
            aria-label="Close walkthrough"
            className="icon-button"
            type="button"
          >
            ×
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="How it works workspace preview">
        <article className="chat-panel">
          <span className="panel-tag">CHAT • RECODEE</span>
          <div className="chat-thread">
            <p className="chat-bubble">
              You: Port the dashboard usage slice from Python to Rust. Keep
              tests green.
            </p>
            <p className="chat-meta">gpt-5.4 • reasoning high • On-request</p>
          </div>
          <div className="dot-track" aria-hidden>
            {STEP_DOTS.map((_, index) => (
              <span className={`dot ${index < 2 ? 'active' : ''}`} key={index} />
            ))}
          </div>
        </article>

        <article className="editor-shell">
          <div className="editor-topbar">
            <span className="editor-project">recodee — VS Code</span>
          </div>
          <div className="editor-body">
            <aside className="activity-rail" aria-label="Activity rail">
              {SIDEBAR_ICONS.map((icon) => (
                <span className="rail-icon" key={icon}>
                  {icon}
                </span>
              ))}
            </aside>

            <section className="source-panel">
              <p className="source-title">SOURCE CONTROL</p>
              <div className="source-branch">dev</div>
              <p className="source-note">Baseline branch - no agent activity.</p>
            </section>

            <section className="code-panel" aria-label="Code preview">
              <code>{`// Open a file in the Source Control panel\n// or advance the tutorial to watch an agent\n// spin up a sandbox worktree and edit code.`}</code>
            </section>
          </div>
        </article>
      </section>

      <footer className="stepbar">
        <div className="step-description">
          <p className="step-id">Step 01</p>
          <p className="step-title">Prompt the agent</p>
          <p className="step-copy">
            Every session starts with a prompt. Pick your model, effort, and
            access mode, then type what you need.
          </p>
        </div>

        <div className="step-actions">
          <button className="ghost-btn" type="button">
            ← Back
          </button>
          <button className="ghost-btn" type="button">
            Reset
          </button>
          <button className="cta-btn" type="button">
            Next step →
          </button>
        </div>
      </footer>
    </main>
  )
}
