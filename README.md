# Vox

[![Latest Release](https://img.shields.io/github/v/release/info-arnav/vox-app?style=flat-square)](https://github.com/info-arnav/vox-app/releases/latest)
[![Release Build](https://img.shields.io/github/actions/workflow/status/info-arnav/vox-app/release.yml?style=flat-square&label=release%20build)](https://github.com/info-arnav/vox-app/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/info-arnav/vox-app?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)](#download)

Vox is an AI-powered desktop assistant with voice mode, screen awareness, and task execution. It connects to the Vox cloud backend and runs on macOS, Windows, and Linux.

## Download

Get the latest release from the [Releases](https://github.com/info-arnav/vox-app/releases) page.

| Platform | File |
|---|---|
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` or `.deb` |

> **Note:** Credit purchases are temporarily disabled while billing is being tested. The app is fully functional — existing credits work normally.

> **macOS note:** The current release is unsigned. To open it, right-click the app → Open → Open anyway. A notarized build is coming soon.

> **Windows note:** SmartScreen may show an "Unknown publisher" warning. Click More info → Run anyway.

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Git

On **Linux**, also install these packages for the native voice recorder:

```bash
sudo apt-get install libasound2-dev libpulse-dev
```

### 1. Clone

```bash
git clone https://github.com/info-arnav/vox-app.git
cd vox-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the project root:

```env
# Wake word detection — get a free key at console.picovoice.ai (optional)
PORCUPINE_ACCESS_KEY=your_key_here

# Backend URLs — omit both to use the production API
VOX_API_BASE_URL=http://localhost:8000
VOX_WS_BASE_URL=ws://localhost:17300
```

If you omit `VOX_API_BASE_URL` / `VOX_WS_BASE_URL` the app connects to `https://api.vox-ai.chat`. You'll need a Vox account to use it.

### 4. Run

```bash
npm run dev
```

The app starts with hot reload. Main process changes restart Electron; renderer changes hot-reload in place.

### Build installers

```bash
npm run build:mac    # produces dist/*.dmg
npm run build:win    # produces dist/*.exe
npm run build:linux  # produces dist/*.AppImage + dist/*.deb
```

---

## Architecture

```
src/
├── main/           Electron main process (Node.js)
│   ├── auth/       Login, session refresh, token state
│   ├── chat/       WebSocket connection, message handling, AI tools
│   ├── config/     Environment, window size constants
│   ├── indexing/   Local file indexing for knowledge base
│   ├── ipc/        IPC handler registration
│   └── voice/      Wake word (Porcupine), tray, voice window
├── preload/        Exposes window.api bridge to renderer (context isolation)
└── renderer/       React frontend
    └── src/
        ├── features/
        │   ├── chat/       Chat UI, message state, task history
        │   ├── knowledge/  File knowledge base
        │   ├── runtime/    Background task activity
        │   └── voice/      Voice mode UI, audio capture, TTS playback
        └── views/          Auth, verification screens
```

The app talks to the server over:
- **HTTP** — auth (`/auth/*`), user info, model list
- **WebSocket** — real-time chat, tool calls, TTS audio streaming

---

## Contributing

Contributions are welcome. Please target the `develop` branch.

### Workflow

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature develop`
3. Make your changes
4. Run `npm run lint` — fix all warnings before committing
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add clipboard read tool
   fix: prevent double mic permission prompt on Windows
   chore: update electron to v34
   ```
6. Push and open a PR against `develop`

### What's in scope for contributions

- New AI desktop tools (`src/main/chat/tools/`)
- UI improvements to the chat or voice widget
- Cross-platform fixes
- Performance improvements
- Documentation

### What's out of scope

- Changes to server-side AI logic (that lives in the private backend repo)
- Billing or auth system changes

### Reporting bugs

Open an issue and include:
- OS and version (e.g. macOS 15.3, Windows 11, Ubuntu 24.04)
- Steps to reproduce
- What you expected vs what happened
- Console errors if any (`F12` in the app to open DevTools)

---

## License

MIT — see [LICENSE](LICENSE)
