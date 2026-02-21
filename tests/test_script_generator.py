import pytest

from services.script_generator import generate_script
from models.schemas import ParsedDocument, ParsedSection
from config import get_settings

# Create a minimal dummy doc for testing
dummy_doc = ParsedDocument(
    job_id="test",
    filename="dummy.pdf",
    total_pages=1,
    word_count=10,
    sections=[ParsedSection(title="Intro", body="Text", page_start=1, page_end=1)],
    raw_text="Text",
    metadata={"title": "Dummy", "authors": "X"},
)


def test_generate_script_fails_without_any_key(monkeypatch):
    # ensure both keys are blank so the early config check fails
    settings = get_settings()
    monkeypatch.setattr(settings, "google_api_key", "")

    with pytest.raises(Exception) as exc:
        # run synchronously
        import asyncio
        asyncio.run(generate_script(dummy_doc))

    # error message should indicate no API key configured
    assert "No GOOGLE_API_KEY set in .env file." in str(exc.value)


def test_generate_script_accepts_google_key(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "google_api_key", "sk-test")

    # patch _ask to avoid real network
    import services.script_generator as sg
    async def mock_ask(prompt): return "{}"
    monkeypatch.setattr(sg, "_ask", mock_ask)

    import asyncio
    result = asyncio.run(generate_script(dummy_doc))
    # should at least produce a PodcastScript object with dialogue (fallback empty)
    assert hasattr(result, "dialogue")
