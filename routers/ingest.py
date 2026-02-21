"""
routers/ingest.py — Accept a PDF upload, parse it, and return metadata.
"""
from __future__ import annotations

import uuid
import logging
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from config import Settings, get_settings
from models.schemas import ParsedDocument, VoicePair
from services.pdf_parser import parse_pdf

logger = logging.getLogger(__name__)

# REMOVED prefix="/api" here because main.py handles it globally
router = APIRouter(tags=["ingest"])

@router.post("/ingest", response_model=ParsedDocument)
async def ingest_pdf(
    file:       UploadFile = File(..., description="PDF file to convert"),
    voice_pair: VoicePair  = Form(VoicePair.FM, description="Host voice pairing"),
    settings:   Settings   = Depends(get_settings),
) -> ParsedDocument:
    """
    Handle PDF upload and metadata storage.
    """
    # 1. Validation
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_pdf_size_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {size_mb:.1f} MB.",
        )

    # 2. Save file
    job_id   = str(uuid.uuid4())
    pdf_path = settings.upload_dir / f"{job_id}.pdf"

    try:
        pdf_path.write_bytes(content)
        logger.info(f"[{job_id}] Saved upload: {file.filename}")
    except IOError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # 3. Parse PDF
    try:
        parsed = parse_pdf(pdf_path, job_id=job_id)
    except Exception as e:
        pdf_path.unlink(missing_ok=True)
        logger.error(f"[{job_id}] PDF parsing failed: {e}")
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")

    # 4. Store Metadata
    meta_path = settings.upload_dir / f"{job_id}.meta.json"
    meta_path.write_text(json.dumps({
        "voice_pair": voice_pair.value,
        "filename": file.filename
    }))

    return parsed