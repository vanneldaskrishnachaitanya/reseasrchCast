"""
routers/generate.py — Pipeline management for script and audio generation.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from config import Settings, get_settings
from models.schemas import (
    JobStatus, JobStatusResponse, PodcastAudio,
)
from services.audio_mixer import mix_podcast
from services.script_generator import generate_script
from services.tts_service import synthesise_script

logger = logging.getLogger(__name__)
router = APIRouter(tags=["generate"])

# In-memory job store
_JOB_STORE: dict[str, JobStatusResponse] = {}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/generate/{job_id}", response_model=JobStatusResponse)
async def start_generation(
    job_id:     str,
    background: BackgroundTasks,
    settings:   Settings = Depends(get_settings),
) -> JobStatusResponse:
    pdf_path  = settings.upload_dir / f"{job_id}.pdf"
    meta_path = settings.upload_dir / f"{job_id}.meta.json"

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Upload a PDF first.")

    # If already running or done, return current state
    if job_id in _JOB_STORE and _JOB_STORE[job_id].status not in (JobStatus.ERROR,):
        return _JOB_STORE[job_id]

    meta       = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    voice_pair = meta.get("voice_pair", "FM")

    job = JobStatusResponse(
        job_id       = job_id,
        status       = JobStatus.PENDING,
        progress_pct = 0,
        message      = "Generation queued...",
    )
    _JOB_STORE[job_id] = job

    background.add_task(_run_pipeline, job_id, pdf_path, voice_pair, settings)
    return job


@router.get("/generate/{job_id}/status", response_model=JobStatusResponse)
async def get_status(job_id: str) -> JobStatusResponse:
    if job_id not in _JOB_STORE:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = _JOB_STORE[job_id]
    # Always return script so frontend gets chapters + quiz + captions
    return JobStatusResponse(
        job_id       = job.job_id,
        status       = job.status,
        progress_pct = job.progress_pct,
        message      = job.message,
        result       = job.result,
        script       = job.script,
    )


# ── Background pipeline ───────────────────────────────────────────────────────

async def _run_pipeline(
    job_id:     str,
    pdf_path:   Path,
    voice_pair: str,
    settings:   Settings,
) -> None:

    def update(status: JobStatus, pct: int, msg: str):
        if job_id in _JOB_STORE:
            _JOB_STORE[job_id].status       = status
            _JOB_STORE[job_id].progress_pct = pct
            _JOB_STORE[job_id].message      = msg
            logger.info(f"[{job_id}] [{pct}%] {msg}")

    try:
        # ── Stage 1: Parse PDF ────────────────────────────────────────────────
        update(JobStatus.PARSING, 5, "Parsing PDF...")
        from services.pdf_parser import parse_pdf
        doc = parse_pdf(pdf_path, job_id=job_id)
        update(JobStatus.PARSING, 15, f"Parsed {doc.total_pages} pages, {len(doc.sections)} sections.")

        if not settings.google_api_key:
            raise RuntimeError("No GOOGLE_API_KEY set in .env file.")

        # ── Stage 2: Generate script ──────────────────────────────────────────
        update(JobStatus.SCRIPTING, 20, "Generating podcast script with Gemini...")
        script = await generate_script(doc)

        # Save script to job store immediately so status endpoint returns it
        _JOB_STORE[job_id].script = script
        update(JobStatus.SCRIPTING, 50, f"Script ready: {len(script.dialogue)} lines, {len(script.chapters)} chapters.")

        # ── Stage 3: TTS Synthesis ────────────────────────────────────────────
        update(JobStatus.SYNTHESISING, 55, "Synthesising voices with ElevenLabs...")
        synthesised = await synthesise_script(script, voice_pair=voice_pair)
        update(JobStatus.SYNTHESISING, 80, f"Synthesis complete: {len(synthesised)} segments.")

       # ── Stage 4: Audio Mixing ─────────────────────────────────────────────
        update(JobStatus.MIXING, 80, "Mixing final audio...")
        
        # Ensure doc.job_id is passed here!
        audio_path, vtt_path, ts_chapters = mix_podcast(script, synthesised, job_id=job_id)

        # ── Stage 5: Done ─────────────────────────────────────────────────────
        duration_sec = sum(ch.end_sec - ch.start_sec for ch in ts_chapters)

        result = PodcastAudio(
            job_id       = job_id,
            audio_url    = f"/api/podcast/{job_id}/audio",
            vtt_url      = f"/api/podcast/{job_id}/captions",
            duration_sec = round(duration_sec, 2),
            chapters     = ts_chapters,
        )

        # Update chapters in script with real audio timestamps
        script.chapters = [
            type(script.chapters[0])(
                id                     = ch.id,
                title                  = ch.title,
                estimated_duration_sec = int(ch.end_sec - ch.start_sec),
                line_start             = script.chapters[i].line_start if i < len(script.chapters) else 0,
                line_end               = script.chapters[i].line_end   if i < len(script.chapters) else 0,
            )
            for i, ch in enumerate(ts_chapters)
        ] if ts_chapters and script.chapters else script.chapters

        _JOB_STORE[job_id].result = result
        _JOB_STORE[job_id].script = script  # re-save with updated chapters
        update(JobStatus.DONE, 100, "Podcast ready!")
        logger.info(f"[{job_id}] Pipeline complete. Duration: {duration_sec:.0f}s")

    except Exception as e:
        logger.error(f"[{job_id}] Pipeline error: {e}", exc_info=True)
        update(JobStatus.ERROR, 0, f"Error: {str(e)}")