"""
main.py — FastAPI application entrypoint for Paper to Podcast.
"""
from __future__ import annotations

import logging
import sys
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import generate, ingest, podcast

# ── Logging Setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    stream = sys.stdout,
)
logger = logging.getLogger(__name__)

# ── Lifespan Management ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    
    # Auto-create necessary folders for the Gemini processing pipeline
    for directory in [settings.upload_dir, settings.output_dir, settings.audio_assets_dir]:
        os.makedirs(directory, exist_ok=True)
        
    logger.info("Paper to Podcast API starting up (Gemini Mode)")
    yield
    logger.info("Paper to Podcast API shutting down")

# ── App Initialization ──────────────────────────────────────────────────────
app = FastAPI(
    title       = "Paper to Podcast API",
    version     = "1.0.0",
    lifespan    = lifespan,
)

# ── CORS Configuration (Crucial for Port 5173) ─────────────────────────────
settings = get_settings()
origins = [
    "https://research-cast.vercel.app",
    "https://research-cast-v9sa.vercel.app",
    "http://localhost:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # IMPORTANT
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
# main.py adds /api globally. Router files should only have /ingest, /generate, etc.
app.include_router(ingest.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(podcast.router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "gemini-2.0-flash"}

@app.get("/")
async def root():
    return {"message": "API is running", "docs": "/docs"}