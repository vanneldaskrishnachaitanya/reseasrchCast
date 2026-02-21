"""
routers/podcast.py — Post-generation endpoints: Audio, Captions, and Gemini Chat.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from google import genai  # Modern Gemini SDK

from config import Settings, get_settings
from models.schemas import (
    ChatRequest, ChatResponse,
    QuizResult, QuizSubmission,
)
from routers.generate import _JOB_STORE  # Shared in-memory state

logger = logging.getLogger(__name__)

# FIXED: Removed "/api" from the prefix as main.py adds it globally
router = APIRouter(prefix="/podcast", tags=["podcast"])

_LEADERBOARD: list[dict] = [
    {"name": "ResearchBot99", "score": 41, "papers": 7},
    {"name": "StudyQueen",    "score": 38, "papers": 6},
]
_USER_SCORE: dict[str, int] = {}

# ── Audio & Captions ──────────────────────────────────────────────────────────

@router.get("/{job_id}/audio")
async def stream_audio(job_id: str, settings: Settings = Depends(get_settings)):
    path = settings.output_dir / f"{job_id}.mp3"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not ready.")
    return FileResponse(path=str(path), media_type="audio/mpeg")

@router.get("/{job_id}/download")
async def download_audio(job_id: str, settings: Settings = Depends(get_settings)):
    """Download the generated podcast as MP3."""
    path = settings.output_dir / f"{job_id}.mp3"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not ready.")
    return FileResponse(path=str(path), media_type="audio/mpeg", filename=f"podcast_{job_id}.mp3")

@router.get("/{job_id}/captions")
async def get_captions(job_id: str, settings: Settings = Depends(get_settings)):
    path = settings.output_dir / f"{job_id}.vtt"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Captions not ready.")
    return PlainTextResponse(content=path.read_text(encoding="utf-8"), media_type="text/vtt")

# ── Gemini RAG Chatbot ────────────────────────────────────────────────────────

@router.post("/{job_id}/chat", response_model=ChatResponse)
async def chat(
    job_id:   str,
    req:      ChatRequest,
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    """
    Answer user questions about the paper using Gemini 2.0 Flash.
    """
    job = _JOB_STORE.get(job_id)
    if not job or not job.script:
        raise HTTPException(status_code=404, detail="Podcast data not found.")

    # Using the study guide as context for the AI
    context = job.script.study_guide[:3000]
    
    # Initialize the modern Gemini client
    client = genai.Client(api_key=settings.google_api_key)
    
    system_instruction = f"""
    You are a helpful study assistant for the paper: "{job.job_id}".
    Ground your answers strictly in the following context:
    {context}
    
    If the answer isn't in the context, say you don't know. Be concise.
    """

    try:
        # Generate response using modern SDK
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=req.message,
            config={'system_instruction': system_instruction}
        )
        return ChatResponse(reply=response.text.strip())
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Gemini failed to respond.")

# ── Quiz & Leaderboard ────────────────────────────────────────────────────────

@router.post("/{job_id}/quiz", response_model=QuizResult)
async def submit_quiz(job_id: str, sub: QuizSubmission) -> QuizResult:
    job = _JOB_STORE.get(job_id)
    if not job or not job.script:
        raise HTTPException(status_code=404, detail="Podcast not found.")

    questions = job.script.quiz_questions
    score = sum(1 for q, ans in zip(questions, sub.answers) if ans == q.correct_index)
    _USER_SCORE[job_id] = _USER_SCORE.get(job_id, 0) + score

    return QuizResult(
        score=score,
        total=len(questions),
        points_earned=score,
        feedback=[] # Simplified for brevity
    )

@router.get("/leaderboard")
async def get_leaderboard():
    total_user_score = sum(_USER_SCORE.values())
    combined = [{"name": "You", "score": total_user_score}] + _LEADERBOARD
    return {"leaderboard": combined}