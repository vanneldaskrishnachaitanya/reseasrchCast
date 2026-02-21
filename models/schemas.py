"""
models/schemas.py — All Pydantic models for the Paper-to-Podcast API.
"""
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class VoicePair(str, Enum):
    MM = "MM"   # Male   × Male
    FM = "FM"   # Female × Male
    FF = "FF"   # Female × Female


class JobStatus(str, Enum):
    PENDING    = "pending"
    PARSING    = "parsing"
    SCRIPTING  = "scripting"
    SYNTHESISING = "synthesising"
    MIXING     = "mixing"
    DONE       = "done"
    ERROR      = "error"


# ─── PDF Parsing ──────────────────────────────────────────────────────────────

class ParsedSection(BaseModel):
    """A logical section extracted from the PDF."""
    title: str
    body: str
    page_start: int
    page_end: int
    has_tables: bool = False
    has_equations: bool = False


class ParsedDocument(BaseModel):
    """Full structured output of the PDF parser."""
    job_id: str
    filename: str
    total_pages: int
    word_count: int
    sections: list[ParsedSection]
    raw_text: str           # Full concatenated text for RAG indexing
    metadata: dict          # Author, title, year, DOI if available


# ─── Script Generation ────────────────────────────────────────────────────────

class DialogueLine(BaseModel):
    """A single line of podcast dialogue."""
    host: str               # "A" or "B"
    text: str
    chapter_id: Optional[int] = None  # which chapter this line belongs to


class Chapter(BaseModel):
    """A logical chapter/topic within the podcast."""
    id: int
    title: str
    estimated_duration_sec: int
    line_start: int         # index into dialogue list
    line_end: int


class PodcastScript(BaseModel):
    """Complete two-host podcast script."""
    job_id: str
    paper_title: str
    paper_authors: str
    total_estimated_duration_sec: int
    chapters: list[Chapter]
    dialogue: list[DialogueLine]
    study_guide: str        # Markdown cheat sheet
    quiz_questions: list[QuizQuestion]


class QuizQuestion(BaseModel):
    question: str
    options: list[str]      # exactly 4 options
    correct_index: int      # 0-3
    explanation: str


# ─── Audio Generation ─────────────────────────────────────────────────────────

class CaptionCue(BaseModel):
    """A single WebVTT caption cue."""
    start_sec: float
    end_sec: float
    host: str               # "A" or "B"
    text: str


class TimestampedChapter(BaseModel):
    """Chapter with real audio timestamp after synthesis."""
    id: int
    title: str
    start_sec: float
    end_sec: float


class PodcastAudio(BaseModel):
    """Final audio artefact descriptor."""
    job_id: str
    audio_url: str          # relative URL to download the final MP3
    vtt_url: str            # relative URL to the WebVTT captions file
    duration_sec: float
    chapters: list[TimestampedChapter]


# ─── API Request / Response Wrappers ─────────────────────────────────────────

class IngestRequest(BaseModel):
    voice_pair: VoicePair = VoicePair.FM


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress_pct: int = 0
    message: str = ""
    result: Optional[PodcastAudio] = None
    script: Optional[PodcastScript] = None


class ChatRequest(BaseModel):
    # job_id path parameter is provided separately, so it's omitted here
    message: str
    history: list[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str


class QuizSubmission(BaseModel):
    # job_id is implied via the URL path; only answers are required
    answers: list[int]      # user's chosen option index for each question


class QuizResult(BaseModel):
    score: int
    total: int
    points_earned: int
    feedback: list[dict]    # per-question: correct, explanation
