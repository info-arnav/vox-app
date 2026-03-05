# Vox

[![Latest Release](https://img.shields.io/github/v/release/info-arnav/vox-app?style=flat-square)](https://github.com/info-arnav/vox-app/releases/latest)
[![Release Build](https://img.shields.io/github/actions/workflow/status/info-arnav/vox-app/release.yml?style=flat-square&label=release%20build)](https://github.com/info-arnav/vox-app/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/info-arnav/vox-app?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)](#download)

Vox is an AI desktop copilot that can see your screen, work with your local files, run commands, search the web, and delegate long jobs to background workers.

## What Vox Can Actually Do

- Talk in real time (text + voice) with streaming responses.
- Trigger by shortcut (`Cmd/Ctrl+Alt+V`, fallback `Cmd/Ctrl+Shift+Space`) and optional wake word.
- See your full desktop with screenshot capture.
- Read and write local files, including docs like PDF/DOCX/PPTX.
- Browse local directories and delete files/folders when asked.
- Run local shell commands on your machine.
- Index your workspace and answer from your own files.
- Offload bigger jobs to background worker tasks and track progress.
- Use cloud/server tools for web search, webpage reading, code execution, and task memory.

## Tooling Surface

### Desktop tools (executed locally in Electron)

| Tool | What it does |
|---|---|
| `capture_full_screen` | Captures the full visible desktop for analysis |
| `list_indexed_files` | Lists files from the local index manifest |
| `read_indexed_file` | Reads indexed file content by absolute path |
| `write_local_file` | Creates/updates local files (text or base64) |
| `read_local_file` | Reads local files and extracts text from common document formats |
| `list_local_directory` | Lists files/folders from a local directory |
| `delete_local_path` | Deletes local files/folders (with safeguards) |
| `run_local_command` | Executes shell commands locally |
| `create_word_document` | Generates styled `.docx` documents |
| `create_pdf_document` | Generates styled `.pdf` documents |
| `create_presentation_document` | Generates styled `.pptx` decks |

### Server/cloud tools (executed in Vox backend)

| Tool | What it does |
|---|---|
| `get_context` | Semantic retrieval from your knowledge base |
| `web_search` | Current web search results |
| `fetch_webpage` | Reads and extracts webpage text |
| `execute_code` | Runs commands in an isolated sandbox container |
| `search_tasks` | Finds similar past background tasks |
| `get_task` | Retrieves full details of a specific task |
| `save_user_info` | Stores user preferences/profile memory |
| `spawn_task` | Starts a background worker for multi-step jobs |

## Example Things To Ask Vox

- "Read this error on screen and fix the project."
- "Create a quarterly report in `/Users/me/Desktop/report.docx`."
- "Search the web for latest Postgres vector indexing benchmarks and summarize."
- "Find my last task where we edited a spreadsheet and show the exact result."
- "Index my `~/Projects` folder and answer based on those files only."

## Download

Get the latest release from [Releases](https://github.com/info-arnav/vox-app/releases).

| Platform | File |
|---|---|
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` or `.deb` |

> Note: Credit purchases are temporarily disabled while billing is being tested. Existing credits still work normally.
>
> macOS note: The current release is unsigned. Right click app -> Open -> Open anyway.
>
> Windows note: SmartScreen may show "Unknown publisher". Click More info -> Run anyway.

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Git

On Linux, also install native audio deps:

```bash
sudo apt-get install libasound2-dev libpulse-dev
```

### 1) Clone

```bash
git clone https://github.com/info-arnav/vox-app.git
cd vox-app
```

### 2) Install

```bash
npm install
```

### 3) Configure `.env`

```env
# Optional wake word key (console.picovoice.ai)
PORCUPINE_ACCESS_KEY=your_key_here

# Optional local backend override
VOX_API_BASE_URL=http://localhost:8000
VOX_WS_BASE_URL=ws://localhost:17300
```

If `VOX_API_BASE_URL` and `VOX_WS_BASE_URL` are omitted, app uses `https://api.vox-ai.chat`.

### 4) Run

```bash
npm run dev
```

Main-process edits restart Electron. Renderer edits hot reload in place.

### Build installers

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

## Architecture Snapshot

```text
src/
├── main/
│   ├── auth/       Login, session refresh, token state
│   ├── chat/       WebSocket session + tool bridge
│   ├── indexing/   Local file indexing and retrieval
│   ├── ipc/        Renderer <-> main IPC handlers
│   └── voice/      Wake word, global shortcut, voice window
├── preload/        Safe API bridge to renderer
└── renderer/       React UI (chat, knowledge, runtime, voice)
```

Transport:

- HTTP: auth, profile, model metadata
- WebSocket: chat stream, tool calls, task events, voice audio stream

## Contributing

Contributions are welcome. Please target `develop`.

### Workflow

1. Fork and branch from `develop`
2. Make changes
3. Run `npm run lint`
4. Use conventional commits
5. Open PR to `develop`

### In scope

- New desktop tools in `src/main/chat/tools/`
- Chat/voice UX improvements
- Cross-platform reliability fixes
- Performance work
- Documentation improvements

### Out of scope

- Cloud backend auth/billing internals

### Bug reports should include

- OS + version
- Repro steps
- Expected vs actual behavior
- Console errors (`F12` DevTools)

## License

MIT - see [LICENSE](LICENSE)
