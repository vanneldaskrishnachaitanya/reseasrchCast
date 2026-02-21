"""
services/tts_service.py — Converts PodcastScript dialogue into audio via ElevenLabs.
"""
from __future__ import annotations

import asyncio
import io
import logging
import random
from dataclasses import dataclass

import httpx
from pydub import AudioSegment
from pydub.generators import Sine

from config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()

ELEVENLABS_BASE   = "https://api.elevenlabs.io/v1"
TTS_MODEL         = "eleven_turbo_v2"
PAUSE_HOST_SWITCH = 600  # ms


class TTSFailure(Exception):
    pass


@dataclass
class SynthesisedLine:
    host:        str
    text:        str
    audio:       AudioSegment
    duration_ms: int
    chapter_id:  int | None = None
    synthetic:   bool = False


# ── Public API ────────────────────────────────────────────────────────────────

async def synthesise_script(script, voice_pair: str = "FM") -> list[SynthesisedLine]:
    """
    Accept a PodcastScript object and synthesise every dialogue line.
    """
    # Extract dialogue lines from PodcastScript object
    if not hasattr(script, "dialogue"):
        raise RuntimeError(f"Expected PodcastScript object, got {type(script).__name__}")

    dialogue = script.dialogue
    if not dialogue:
        logger.error("Script has no dialogue lines.")
        return []

    voice_a, voice_b = settings.voice_ids_for_pair(voice_pair)
    voice_map = {"A": voice_a, "B": voice_b}

    synthesised: list[SynthesisedLine] = []

    async with httpx.AsyncClient(timeout=60.0) as http:
        for idx, line in enumerate(dialogue):
            # Support both object and dict formats
            if hasattr(line, "host"):
                host       = str(line.host).upper()
                text       = str(line.text).strip()
                chapter_id = getattr(line, "chapter_id", None)
            elif isinstance(line, dict):
                host       = str(line.get("host", "A")).upper()
                text       = str(line.get("text", "")).strip()
                chapter_id = line.get("chapter_id")
            else:
                continue

            if not text:
                continue

            voice_id = voice_map.get(host, voice_a)
            logger.info(f"Synthesising line {idx+1}/{len(dialogue)} for Host {host}")

            audio, synthetic = await _tts_with_retry(http, voice_id, text)

            synthesised.append(SynthesisedLine(
                host        = host,
                text        = text,
                audio       = audio,
                duration_ms = len(audio),
                chapter_id  = chapter_id,
                synthetic   = synthetic,
            ))

            await asyncio.sleep(0.2)

    logger.info(f"TTS complete: {len(synthesised)} segments synthesised.")
    return synthesised


# ── Internal Helpers ──────────────────────────────────────────────────────────

async def _tts_with_retry(
    http:     httpx.AsyncClient,
    voice_id: str,
    text:     str,
) -> tuple[AudioSegment, bool]:

    # No API key — use synthetic fallback
    if not settings.elevenlabs_api_key:
        logger.warning("No ElevenLabs API key — using synthetic audio")
        return _generate_synthetic_speech(text), True

    url     = f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key":   settings.elevenlabs_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text":           text,
        "model_id":       TTS_MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    for attempt in range(3):
        try:
            resp = await http.post(url, headers=headers, json=payload)

            if resp.status_code == 429:
                await asyncio.sleep(2 ** attempt)
                continue

            if resp.status_code != 200:
                body = resp.text[:200]
                raise TTSFailure(f"ElevenLabs returned {resp.status_code}: {body}")

            audio = AudioSegment.from_file(io.BytesIO(resp.content), format="mp3")
            return audio, False

        except TTSFailure:
            raise
        except Exception as e:
            logger.warning(f"TTS attempt {attempt+1} failed: {e}")
            if attempt == 2:
                raise TTSFailure(f"ElevenLabs failed after 3 attempts: {e}")
            await asyncio.sleep(1)

    raise TTSFailure("Unable to synthesise speech")


def _generate_synthetic_speech(text: str) -> AudioSegment:
    """Fallback: generate beep tones when no ElevenLabs key is available."""
    word_count       = len(text.split())
    total_duration   = max(1000, word_count * 150)
    output           = AudioSegment.empty()
    time_ms          = 0

    while time_ms < total_duration:
        freq     = random.randint(200, 800)
        duration = random.randint(100, 300)
        gap      = random.randint(50, 150)
        tone     = Sine(freq, sample_rate=22050).to_audio_segment(duration=duration)
        tone     = tone.apply_gain(random.uniform(-3, 0))
        output  += tone + AudioSegment.silent(duration=gap)
        time_ms += duration + gap

    return output.fade_in(100).fade_out(100)