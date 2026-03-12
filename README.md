<p align="center">
  <img src="https://img.shields.io/badge/⏳-ChronoCode-blueviolet?style=for-the-badge&labelColor=0a0e17" alt="ChronoCode" height="40"/>
</p>

<h1 align="center">ChronoCode</h1>
<h3 align="center">The AI-Powered Codebase Time Machine</h3>

<p align="center">
  <strong>Turn thousands of commits into a visual story of how your architecture evolved.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="#api">API</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node 18+"/>
  <img src="https://img.shields.io/badge/zero%20config-just%20run-blue?style=flat-square" alt="Zero Config"/>
  <img src="https://img.shields.io/badge/dependencies-3-purple?style=flat-square" alt="3 Dependencies"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License"/>
</p>

---

## The Problem

You join a new team. The codebase has 5,000 commits. Someone says *"the auth system was rewritten twice"* and *"we migrated from REST to GraphQL last year."*

**Where? When? Why?** Good luck finding that in `git log`.

## The Solution

ChronoCode reads your Git history and reconstructs the **architectural story** of your codebase:

- **When** was Docker introduced? When did testing start?
- **What** were the biggest refactors? Which commits reshaped the project?
- **How** did dependencies evolve? What got added, removed, upgraded?
- **Why** did it happen? AI-powered explanations for every major change.

All visualized in an interactive timeline. No more archaeology through commit messages.

---

## Quick Start

```bash
git clone https://github.com/your-username/chronocode.git
cd chronocode
npm install
npm start
```

Open **http://localhost:3000**, paste any Git repo path, and hit Analyze.

That's it. No database, no build step, no config files.

---

## Features

### Architecture Timeline
Interactive D3.js timeline showing commit density, lines-of-code changes, and architectural events over time. Hover for details, zoom to explore.

### Architectural Event Detection
Automatically detects:
- **Framework introductions** — TypeScript, Docker, CI/CD, testing frameworks, ORMs
- **Major restructures** — when the directory tree fundamentally changes
- **Large-scale refactors** — balanced add/delete across many files
- **Project milestones** — 100th, 500th, 1000th commit

Each event is severity-scored (1-5) and pinned to the timeline.

### Dependency Evolution Graph
Force-directed D3.js graph of your current dependencies, color-coded by category (framework, testing, build, database, utility). Scrub through the dependency timeline to see what was added, removed, or upgraded at each point.

### Commit Impact Analysis
Every commit gets an **impact score (0-100)** based on:
- Files changed & lines modified
- Critical files touched (package.json, Dockerfile, CI configs)
- Directory breadth
- New directory introduction

Sort by impact to find the commits that actually shaped your codebase.

### AI Explanations
Click any commit to get an **AI-generated architectural explanation**. Works with:
- **OpenAI API** (GPT-4o-mini) when `OPENAI_API_KEY` is set
- **Smart heuristic fallback** when no API key is available — still useful

### Codebase Growth Visualization
Stacked area chart showing file count and LOC delta over time. See exactly when your codebase grew (or shrank).

### Three.js Background
Subtle particle field with orbital rings. Respects `prefers-reduced-motion`. Purely aesthetic, zero performance impact on the analysis.

---

## How It Works

```
Your Git Repo
     |
     v
  git log --numstat --all     (parsed with custom delimiters)
  git ls-tree -r              (file trees at sample points)
  git show <hash>:package.json (dependency snapshots)
     |
     v
  ┌──────────────────────────────────────────┐
  │  Timeline Builder     → time segments    │
  │  Architecture Detector → events          │
  │  Dependency Tracker   → dep snapshots    │
  │  Impact Analyzer      → scored commits   │
  │  AI Explainer         → explanations     │
  └──────────────────────────────────────────┘
     |
     v
  Interactive Dashboard (D3.js + Three.js)
```

**Security**: All git commands use `child_process.execFile` (not `exec`) to prevent shell injection. Paths are validated and sanitized. No data leaves your machine (unless AI mode is enabled).

**Performance**: Handles repos with 5,000+ commits. Large repos are parsed in under 30 seconds. File trees are sampled (not computed for every commit) to keep analysis fast.

---

## AI Mode (Optional)

```bash
cp .env.example .env
# Add your OpenAI API key
OPENAI_API_KEY=sk-...
```

Without an API key, ChronoCode uses heuristic analysis that's still surprisingly insightful. AI mode adds natural-language architectural reasoning.

---

## API

All data is available via REST endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/repo/analyze` | POST | Start analysis. Body: `{ "path": "/repo" }` |
| `/api/repo/status/:sessionId` | GET | Poll analysis progress |
| `/api/timeline/:sessionId` | GET | Timeline segments + architectural events |
| `/api/commits/:sessionId` | GET | Impact-scored commits (paginated) |
| `/api/dependencies/:sessionId` | GET | Dependency snapshots + graph data |
| `/api/impact/:sessionId/:hash` | GET | Detailed impact for a specific commit |
| `/api/explain` | POST | AI/heuristic explanation. Body: `{ "sessionId", "commitHash" }` |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | Node.js + Express | Fast, minimal, ES modules |
| Git Parsing | Native `git` CLI via `execFile` | No heavy library, direct control |
| Visualization | D3.js v7 | Industry standard for data viz |
| 3D Effects | Three.js | Lightweight WebGL particles |
| AI | OpenAI-compatible API | Optional, with heuristic fallback |
| Dependencies | **3 total** (express, uuid, dotenv) | Minimal footprint |

No build step. No webpack. No TypeScript compilation. Just `npm start`.

---

## Project Structure

```
chronocode/
├── server/
│   ├── index.js              # Express server
│   ├── config.js             # Configuration
│   ├── routes/               # API endpoints
│   ├── services/
│   │   ├── git-parser.js     # Git history extraction
│   │   ├── timeline-builder.js
│   │   ├── architecture-detector.js
│   │   ├── dependency-tracker.js
│   │   ├── impact-analyzer.js
│   │   └── ai-explainer.js
│   ├── utils/
│   │   ├── git-commands.js   # Secure git command wrapper
│   │   ├── cache.js          # In-memory LRU cache
│   │   └── sanitize.js       # Path validation
│   └── middleware/
│       └── error-handler.js
├── public/
│   ├── index.html
│   ├── css/                  # Dark theme design system
│   └── js/
│       ├── app.js            # Main application
│       ├── api.js            # API client
│       ├── visualizations/   # D3.js + Three.js renderers
│       └── utils/            # Helpers
└── package.json              # 3 dependencies
```

---

## Requirements

- **Node.js 18+**
- **Git** installed and available in PATH
- A Git repository to analyze

---

## Contributing

PRs welcome! Some ideas:

- [ ] **Multi-language support** — track `requirements.txt`, `go.mod`, `Cargo.toml` dependency changes
- [ ] **Architecture regression detection** — alert when complexity metrics degrade
- [ ] **Bug introduction prediction** — correlate high-churn files with bug-fix commits
- [ ] **Team dynamics** — who works on what, knowledge silos, bus factor
- [ ] **Export** — generate PDF/PNG reports of the timeline
- [ ] **Monorepo support** — analyze multiple `package.json` files
- [ ] **VS Code extension** — ChronoCode integrated into your editor

---

## License

MIT

---

<p align="center">
  <strong>ChronoCode</strong> — Because every codebase has a story. Yours deserves to be visualized.
</p>
