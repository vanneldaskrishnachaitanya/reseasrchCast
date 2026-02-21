"""
services/audio_mixer.py — Blends Gemini speech segments with Lo-Fi background music.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from pydub import AudioSegment
from pydub.effects import normalize

from config import get_settings
from models.schemas import CaptionCue, PodcastScript, TimestampedChapter
from services.tts_service import SynthesisedLine

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Mixing Constants ──────────────────────────────────────────────────────────
MUSIC_VOLUME_DB     = -24    # Background music baseline
MUSIC_DUCK_DB       = -32    # Music level during active speech
INTRO_MUSIC_MS      = 4000   # Music-only intro
FADE_MS             = 1000   # Crossfade duration

def mix_podcast(
    script: PodcastScript,
    synthesised: list[SynthesisedLine],
    job_id: str,
) -> tuple[Path, Path, list[TimestampedChapter]]:
    """
    Assembles the final podcast MP3 and associated metadata.
    """
    logger.info(f"Starting final audio mix for job {job_id}...")
    
    # ... rest of the function remains exactly the same ...

    # 1. Build the speech track
    speech_track = AudioSegment.silent(duration=0)
    cues = []
    
    for sl in synthesised:
        start_ms = len(speech_track)
        speech_track += sl.audio
        # Add a natural 600ms pause between speakers
        speech_track += AudioSegment.silent(duration=600)
        
        cues.append(CaptionCue(
            start_sec = start_ms / 1000.0,
            end_sec   = (start_ms + sl.duration_ms) / 1000.0,
            host      = sl.host,
            text      = sl.text
        ))

    # 2. Prepare background music
    music = _load_music(len(speech_track) + 10000)
    
    # 3. Apply ducking (Simplified)
    # We overlay the speech onto the ducked music track
    main_body = music[:len(speech_track)].apply_gain(MUSIC_DUCK_DB - MUSIC_VOLUME_DB)
    combined = main_body.overlay(speech_track)
    
    # 4. Add Intro swell
    intro = music[:INTRO_MUSIC_MS].fade_in(1000).fade_out(FADE_MS)
    final_audio = intro + combined
    
    # 5. Export
    final_audio = normalize(final_audio)
    audio_path = settings.output_dir / f"{job_id}.mp3"
    final_audio.export(str(audio_path), format="mp3", bitrate="128k")
    
    # 6. Generate VTT Captions (Adjusted for Intro)
    vtt_path = settings.output_dir / f"{job_id}.vtt"
    _write_vtt(vtt_path, cues, offset_ms=INTRO_MUSIC_MS)
    
    # Standard chapters for the demo
    ts_chapters = [TimestampedChapter(id=0, title="Introduction", start_sec=0, end_sec=len(final_audio)/1000)]

    return audio_path, vtt_path, ts_chapters

def _load_music(duration_ms: int) -> AudioSegment:
    asset_path = settings.audio_assets_dir / "background_music.mp3"
    if asset_path.exists():
        music = AudioSegment.from_file(str(asset_path))
    else:
        logger.warning("No background_music.mp3 found. Using silence.")
        return AudioSegment.silent(duration=duration_ms)
        
    # Loop music to match length
    while len(music) < duration_ms:
        music += music
    return music[:duration_ms] + MUSIC_VOLUME_DB

def _write_vtt(path: Path, cues: list[CaptionCue], offset_ms: int):
    lines = ["WEBVTT\n"]
    offset = offset_ms / 1000.0
    for i, cue in enumerate(cues, start=1):
        start = _format_time(cue.start_sec + offset)
        end   = _format_time(cue.end_sec + offset)
        lines.append(f"\n{i}\n{start} --> {end}\n[{cue.host}]: {cue.text}\n")
    path.write_text("".join(lines), encoding="utf-8")

def _format_time(seconds: float) -> str:
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}.{int((s % 1) * 1000):03d}"