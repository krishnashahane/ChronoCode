# ChronoCode

ChronoCode is a local Git history explorer. Point it at a Git working tree and it turns commit history into an interactive timeline, dependency view, commit-impact list, and codebase-growth chart.

Repository history is analyzed locally by the bundled Node.js server.

## Features

- **Architecture timeline** — monthly commit activity, lines changed, new directories, and heuristic structural/tooling events.
- **Dependency evolution** — reads historical `package.json` snapshots and reports added, removed, and changed Node dependencies.
- **Commit impact analysis** — scores commits using changed-file breadth, line changes, critical configuration files, and directory breadth.
- **Codebase growth** — visualizes cumulative file count and monthly LOC delta.
- **Heuristic explanations** — explains a selected commit locally without an external AI service.
- **Reduced-motion support** — the decorative Canvas background respects `prefers-reduced-motion`.

## Requirements

- Node.js 18+
- Git installed and available on `PATH`
- A local Git working tree to analyze

## Run

```bash
git clone https://github.com/krishnashahane/ChronoCode.git
cd ChronoCode
npm start
```

Open **http://127.0.0.1:3000**.

For development with automatic restarts:

```bash
npm run dev
```

There are no third-party runtime dependencies. The application uses Node's standard library for the server and native browser SVG/Canvas APIs for visualizations.

## Use

Enter a local repository path, for example:

```text
/Users/you/Projects/my-repository
```

ChronoCode verifies that the directory exists and that Git recognizes it as a working tree before analysis starts.

## Security

ChronoCode is designed to run locally.

- Git commands use Node's `execFile` with argument arrays; repository paths are never interpolated into shell command strings.
- The server binds to `127.0.0.1` by default.
- API calls require a ChronoCode client header to reduce cross-site drive-by requests.
- JSON request bodies are limited to 32 KiB.
- Static paths are resolved and checked to block directory traversal.
- Responses include common browser security headers and a restrictive Content Security Policy.
- Git metadata inserted into the UI is HTML-escaped.

Do not expose the server publicly or bind it to `0.0.0.0` without adding an authentication and network-security layer.

## Project structure

```text
ChronoCode/
├── index.html
├── server.js
├── package.json
├── css/
│   ├── main.css
│   ├── components.css
│   └── timeline.css
└── js/
    ├── api.js
    ├── app.js
    ├── utils/
    │   ├── color-scale.js
    │   ├── date-utils.js
    │   └── dom.js
    └── visualizations/
        ├── d3-dependency.js
        ├── d3-file-growth.js
        ├── d3-timeline.js
        └── three-scene.js
```

The visualization filenames remain for compatibility with the existing project layout. They no longer depend on D3.js or Three.js.

## Analysis limits

- Maximum 5,000 commits per analysis session.
- Maximum 200 changed files retained per commit.
- Dependency history samples the 30 most recent `package.json` changes.

These limits keep memory and UI rendering bounded.

## Limitations

Architecture detection and impact scoring are heuristics, not formal architecture metrics.

Dependency tracking currently targets Node projects that commit `package.json`. Projects using only `requirements.txt`, `go.mod`, `Cargo.toml`, or other manifests will not receive the same dependency history.

## License

MIT
