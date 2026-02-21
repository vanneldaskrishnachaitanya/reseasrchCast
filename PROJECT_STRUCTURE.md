# PaperCast — Project Structure

```
papercast/
├── .env                    # Environment variables (API keys, paths) — not committed
├── .gitignore
├── .python-version         # Python version for tooling
├── config.py               # Pydantic settings (API keys, upload/output dirs, CORS, voice IDs)
├── main.py                 # FastAPI app entrypoint, CORS, lifespan, router mounting
├── requirements.txt       # Python dependencies
│
├── routers/                # API route modules
│   ├── generate.py         # POST /api/generate/{job_id}, GET .../status — pipeline trigger & polling
│   ├── ingest.py           # POST /api/ingest — PDF upload, parse, save meta
│   └── podcast.py          # /api/podcast — audio, captions, download, chat, quiz, leaderboard
│
├── services/               # Business logic
│   ├── audio_mixer.py      # Mix TTS segments + background music → MP3, write VTT captions
│   ├── pdf_parser.py       # PDF extraction (PyMuPDF + pdfplumber), sections, tables, equations
│   ├── script_generator.py # Gemini: chapters → dialogue → study guide + quiz
│   └── tts_service.py      # ElevenLabs TTS for dialogue lines
│
├── models/
│   └── schemas.py          # Pydantic models (ParsedDocument, PodcastScript, JobStatus, etc.)
│
├── tests/
│   ├── test_podcast_endpoints.py
│   └── test_script_generator.py
│
├── frontend/               # React + Vite + Tailwind
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js      # Dev server, proxy /api → backend
│   ├── tailwind.config.js
│   ├── eslint.config.js
│   ├── src/
│   │   ├── main.jsx        # React root
│   │   ├── App.jsx         # Screens: Auth → Upload → Processing → Player (chat, quiz, leaderboard)
│   │   ├── App.css
│   │   ├── index.css       # Tailwind import
│   │   ├── api.js          # API client (upload, generate, status, chat, quiz, media URLs)
│   │   └── firebase.js     # Firebase Auth + Firestore (Google sign-in, leaderboard)
│   └── dist/               # Production build (generated)
│
├── uploads/                # Uploaded PDFs + meta JSON (created at runtime, gitignored)
├── outputs/                # Generated MP3 + VTT (created at runtime, gitignored)
├── audio_assets/           # e.g. background_music.mp3 (gitignored)
│
├── test_gemini.py          # Ad-hoc Gemini tests
├── test_gemini_15.py
├── test_gemini_25.py
├── test_models.py
├── DEPLOYMENT_GUIDE.md
├── PROJECT_STRUCTURE.md    # This file
└── README.md               # (if present)
```

## Backend (Python)

| Path | Purpose |
|------|--------|
| `main.py` | FastAPI app, CORS, lifespan (creates uploads/outputs/audio_assets), mounts routers under `/api`. |
| `config.py` | Settings from `.env`: Google/ElevenLabs keys, upload/output/audio_assets dirs, voice IDs, CORS origins. |
| `routers/ingest.py` | PDF upload → save file, parse with `pdf_parser`, write `{job_id}.meta.json` (voice_pair, filename). |
| `routers/generate.py` | Start generation (background pipeline): parse → script (Gemini) → TTS (ElevenLabs) → mix → store result in `_JOB_STORE`. |
| `routers/podcast.py` | Serve audio/VTT, download, chat (Gemini RAG), quiz submit, leaderboard. |
| `services/pdf_parser.py` | Parse PDF → `ParsedDocument` (sections, raw text, metadata). |
| `services/script_generator.py` | Gemini: chapters → dialogue → study guide + quiz → `PodcastScript`. |
| `services/tts_service.py` | Turn `PodcastScript.dialogue` into audio via ElevenLabs. |
| `services/audio_mixer.py` | Combine TTS segments + music, export MP3 and VTT. |
| `models/schemas.py` | Pydantic: `ParsedDocument`, `PodcastScript`, `JobStatus`, `ChatRequest`, `QuizResult`, etc. |

## Frontend (React)

| Path | Purpose |
|------|--------|
| `src/App.jsx` | Flow: Auth → Upload (voice pair) → Processing (poll status) → Player (audio, captions, chapters, study guide, chat, quiz, leaderboard). |
| `src/api.js` | `uploadPDF`, `startGeneration`, `pollStatus`, `sendChat`, `submitQuiz`, `audioUrl`, `captionsUrl`, `downloadUrl` (all use `/api`). |
| `src/firebase.js` | Firebase app, Auth, Google provider, Firestore (leaderboard / user points). |
| `vite.config.js` | Dev server port 5173, proxy `/api` to `http://127.0.0.1:8000`. |

## Runtime directories (gitignored)

- **uploads/** — `{job_id}.pdf`, `{job_id}.meta.json`
- **outputs/** — `{job_id}.mp3`, `{job_id}.vtt`
- **audio_assets/** — optional `background_music.mp3`
- **venv/** — Python virtual environment
- **frontend/node_modules/** — npm dependencies
- **frontend/dist/** — Vite build output
