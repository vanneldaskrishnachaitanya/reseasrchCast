from fastapi.testclient import TestClient

from main import app
from routers.generate import _JOB_STORE
from models.schemas import (
    PodcastScript, QuizQuestion, Chapter, DialogueLine,
    QuizResult
)

client = TestClient(app)


def seed_job_with_quiz(job_id: str):
    """Helper to inject a job with one quiz question into the in-memory store."""
    # minimal dummy script
    script = PodcastScript(
        job_id=job_id,
        paper_title="Dummy Title",
        paper_authors="Author X",
        total_estimated_duration_sec=10,
        chapters=[Chapter(id=1, title="Intro", estimated_duration_sec=10, line_start=0, line_end=0)],
        dialogue=[DialogueLine(host="A", text="Hello")],
        study_guide="Just notes",
        quiz_questions=[
            QuizQuestion(
                question="What number is one?",
                options=["0", "1", "2", "3"],
                correct_index=1,
                explanation="Because one is one."
            )
        ],
    )
    # create a fake status response with script attached
    from models.schemas import JobStatusResponse, JobStatus
    job = JobStatusResponse(
        job_id=job_id,
        status=JobStatus.DONE,
        progress_pct=100,
        message="ready",
        script=script,
    )
    _JOB_STORE[job_id] = job


def test_quiz_submit_missing_body_returns_422():
    job_id = "test123"
    seed_job_with_quiz(job_id)
    # empty body
    response = client.post(f"/api/podcast/{job_id}/quiz", json={})
    assert response.status_code == 422


def test_quiz_submit_correct_answers():
    job_id = "test456"
    seed_job_with_quiz(job_id)
    # send valid payload; no job_id field required
    payload = {"answers": [1]}
    response = client.post(f"/api/podcast/{job_id}/quiz", json=payload)
    assert response.status_code == 200
    data = response.json()
    # verify the returned score matches expected
    assert data["score"] == 1
    assert data["total"] == 1
    assert data["points_earned"] == 1
    assert isinstance(data["feedback"], list)
