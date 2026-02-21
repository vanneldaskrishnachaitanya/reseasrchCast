"""
services/script_generator.py - Gemini with retry logic
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from google import genai
from google.genai import types

from config import get_settings
from models.schemas import (
    Chapter, DialogueLine, ParsedDocument,
    PodcastScript, QuizQuestion,
)

logger   = logging.getLogger(__name__)
settings = get_settings()

# IMPORTANT: Do NOT change this from "gemini-flash-latest".
# The specific Google API key in use has a quota limit of 0 for "gemini-2.5-flash",
# which causes a hard 429 quota block. "gemini-flash-latest" bypasses this.
MODEL = "gemini-flash-latest"


import asyncio

def _get_client():
    if not settings.google_api_key:
        raise RuntimeError("No GOOGLE_API_KEY set in .env file.")
    return genai.Client(api_key=settings.google_api_key)


async def _ask(prompt: str, retries: int = 4) -> str:
    """Call Gemini with automatic retry on rate limits."""
    client = _get_client()
    for attempt in range(retries):
        try:
            response = await client.aio.models.generate_content(
                model    = MODEL,
                contents = prompt,
                config   = types.GenerateContentConfig(
                    temperature        = 0.7,
                    response_mime_type = "application/json",
                ),
            )
            return response.text.strip()
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                wait = 60 * (attempt + 1)
                logger.warning(f"Rate limit hit. Waiting {wait}s (attempt {attempt+1}/{retries})...")
                await asyncio.sleep(wait)
            else:
                logger.error(f"Gemini error: {e}")
                raise RuntimeError(f"Gemini generation failed: {e}")
    raise RuntimeError("Gemini rate limit exceeded after all retries. Please wait 2 minutes and try again.")



def _safe_json(text: str, default: Any = None) -> Any:
    """Parse JSON safely, stripping markdown fences if present."""
    if default is None:
        default = {}
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$",           "", text, flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed: {e} | snippet: {text[:200]}")
        return default


def _to_string(value: Any) -> str:
    """
    Safely convert any value to a string.
    Gemini sometimes returns study_guide as a dict instead of a string.
    """
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        # Convert dict keys/values into readable markdown sections
        return "\n\n".join(
            f"## {k.replace('_', ' ').title()}\n{v}"
            for k, v in value.items()
        )
    return str(value)


async def generate_script(doc: ParsedDocument) -> PodcastScript:
    """Generate a full podcast script from a parsed document."""
    if not settings.google_api_key:
        raise RuntimeError("No GOOGLE_API_KEY set in .env file.")

    logger.info(f"[{doc.job_id}] Starting script generation with LLM")

    # ── Step 1: Chapter structure ─────────────────────────────────────────────
    logger.info(f"[{doc.job_id}] Step 1: Generating structure...")
    chapters_data = await _generate_chapters(doc)
    logger.info(f"[{doc.job_id}] Got {len(chapters_data)} chapters")

    await asyncio.sleep(8)

    # ── Step 2: Dialogue ──────────────────────────────────────────────────────
    logger.info(f"[{doc.job_id}] Step 2: Generating dialogue...")
    all_lines = await _generate_dialogue(doc, chapters_data)
    logger.info(f"[{doc.job_id}] Got {len(all_lines)} dialogue lines")

    await asyncio.sleep(8)

    # ── Step 3: Study guide + quiz ────────────────────────────────────────────
    logger.info(f"[{doc.job_id}] Step 3: Generating study guide...")
    guide, quiz = await _generate_study_materials(doc)
    logger.info(f"[{doc.job_id}] Study guide and {len(quiz)} quiz questions ready")

    # ── Assemble final script ─────────────────────────────────────────────────
    total_words = sum(len(l.text.split()) for l in all_lines)
    total_secs  = int(total_words / 2.5)
    chapters    = _build_chapters(chapters_data, all_lines)

    result = PodcastScript(
        job_id                       = doc.job_id,
        paper_title                  = doc.metadata.get("title", doc.filename),
        paper_authors                = doc.metadata.get("authors", "Unknown"),
        total_estimated_duration_sec = total_secs,
        chapters                     = chapters,
        dialogue                     = all_lines,
        study_guide                  = guide,
        quiz_questions               = quiz,
    )

    logger.info(f"[{doc.job_id}] ✓ Script generation complete: {len(all_lines)} lines, {len(chapters)} chapters")
    return result


async def _generate_chapters(doc: ParsedDocument) -> list[dict]:
    """Generate chapter structure from document sections."""
    sections = "\n".join(f"- {s.title}: {s.body[:150]}..." for s in doc.sections[:15])

    prompt = f"""Create a comprehensive list of podcast chapters for this academic paper.
Determine the appropriate number of chapters (minimum 3, up to 10) depending on the document's complexity and length.

Title: {doc.metadata.get('title', 'Unknown')}
Authors: {doc.metadata.get('authors', 'Unknown')}
Sections found: {sections}

Return ONLY a JSON object with no markdown:
{{
  "chapters": [
    {{
      "id": 1,
      "title": "Short catchy chapter title",
      "hook": "Surprising opening question or fact",
      "concepts": ["concept1", "concept2"]
    }}
  ]
}}"""

    raw      = await _ask(prompt)
    data     = _safe_json(raw, default={"chapters": []})
    chapters = data.get("chapters", [])

    for i, ch in enumerate(chapters):
        ch["id"] = i + 1

    if not chapters:
        logger.warning("No chapters returned — using fallback")
        chapters = [
            {"id": 1, "title": "Introduction",  "hook": "What makes this paper special?",      "concepts": ["overview"]},
            {"id": 2, "title": "Core Concepts", "hook": "Here is the key idea explained",      "concepts": ["methodology"]},
            {"id": 3, "title": "Key Takeaways", "hook": "What should you remember from this?", "concepts": ["results"]},
        ]

    return chapters


async def _generate_dialogue(doc: ParsedDocument, chapters: list) -> list[DialogueLine]:
    """Generate dialogue lines for all chapters with delays between calls."""
    all_lines = []
    context   = "\n\n".join(s.body[:1000] for s in doc.sections[:8])

    for i, chapter in enumerate(chapters):
        is_first = i == 0
        is_last  = i == len(chapters) - 1

        intro = "Open with a podcast welcome and tease the paper's most interesting finding." if is_first else ""
        outro = "End with an encouraging sign-off and tell listeners to take the quiz!" if is_last else "End by teasing the next chapter."

        prompt = f"""Write podcast dialogue between two hosts discussing an academic paper.

Host A: Curious, funny, asks simple relatable questions.
Host B: Knowledgeable expert, explains clearly with fun analogies.

Chapter: "{chapter.get('title', 'Discussion')}"
Opening hook: "{chapter.get('hook', 'Let us explore this topic')}"
Key concepts: {', '.join(chapter.get('concepts', ['the main ideas']))}

Paper context:
{context[:1500]}

Instructions:
1. {intro}
2. Host A opens with the hook in their very first line
3. Include one funny joke or analogy
4. {outro}
5. Write a natural, engaging conversation. Aim for 12 to 20 lines total, alternating A and B.

Return ONLY a JSON array with no markdown:
[
  {{"host": "A", "text": "line here"}},
  {{"host": "B", "text": "line here"}}
]"""

        raw   = await _ask(prompt)
        lines = _safe_json(raw, default=[])

        if not isinstance(lines, list):
            logger.warning(f"Chapter {i+1} dialogue was not a list — skipping")
            lines = []

        for line in lines:
            if isinstance(line, dict) and "host" in line and "text" in line:
                all_lines.append(DialogueLine(
                    host       = str(line["host"]).upper(),
                    text       = str(line["text"]).strip(),
                    chapter_id = chapter["id"],
                ))

        logger.info(f"Chapter {chapter['id']} — {len(lines)} lines generated")

        if i < len(chapters) - 1:
            logger.info("Waiting 10s between chapter calls...")
            await asyncio.sleep(10)

    return all_lines


async def _generate_study_materials(doc: ParsedDocument) -> tuple[str, list[QuizQuestion]]:
    """Generate study guide and quiz questions."""
    # Use up to ~80k characters from the PDF (which is well within Gemini 2 Flash limits)
    text_sample = doc.raw_text[:80000]

    prompt = f"""Create HIGHLY DETAILED and COMPREHENSIVE study materials for this academic paper.

Paper: "{doc.metadata.get('title', 'Research Paper')}" by {doc.metadata.get('authors', 'Unknown')}

Text excerpt (up to 80,000 characters):
{text_sample}

Return ONLY a JSON object with no markdown:
{{
  "study_guide": "## Core Contribution\\nA thorough 4-5 sentence explanation.\\n\\n## Key Methodology\\nDetailed breakdown of how they did it, including parameters or data sources.\\n\\n## Important Results\\nA comprehensive list of the key numbers, datasets, and discoveries.\\n\\n## Why It Matters\\nBroad implications and real world impact.",
  "quiz": [
    {{
      "question": "Clear question about the paper?",
      "options": ["A. first", "B. second", "C. third", "D. fourth"],
      "correct_index": 0,
      "explanation": "Why this answer is correct."
    }}
  ]
}}

Write between 6 and 10 quiz questions depending on the length and density of the paper."""

    raw  = await _ask(prompt)
    data = _safe_json(raw, default={"study_guide": "Study guide unavailable.", "quiz": []})

    # ── Fix: Gemini sometimes returns study_guide as a dict ───────────────────
    raw_guide = data.get("study_guide", "Study guide unavailable.")
    guide     = _to_string(raw_guide)

    raw_quiz   = data.get("quiz", [])
    questions  = []

    for q in raw_quiz:
        try:
            questions.append(QuizQuestion(
                question      = q["question"],
                options       = q["options"],
                correct_index = int(q["correct_index"]),
                explanation   = q.get("explanation", ""),
            ))
        except Exception as e:
            logger.warning(f"Skipping bad quiz question: {e}")

    return guide, questions


def _build_chapters(chapters_data: list[dict], lines: list[DialogueLine]) -> list[Chapter]:
    """Map chapter metadata to dialogue line indices."""
    chapters = []
    for i, ch in enumerate(chapters_data):
        cid        = ch["id"]
        start_idx  = next((j for j, l in enumerate(lines) if l.chapter_id == cid), 0)
        next_id    = chapters_data[i+1]["id"] if i+1 < len(chapters_data) else None
        end_idx    = next((j for j, l in enumerate(lines) if l.chapter_id == next_id), len(lines)) - 1 if next_id else len(lines) - 1
        word_count = sum(len(lines[j].text.split()) for j in range(start_idx, min(end_idx+1, len(lines))))

        chapters.append(Chapter(
            id                     = cid,
            title                  = ch.get("title", f"Chapter {cid}"),
            estimated_duration_sec = int(word_count / 2.5),
            line_start             = start_idx,
            line_end               = max(end_idx, start_idx),
        ))
    return chapters