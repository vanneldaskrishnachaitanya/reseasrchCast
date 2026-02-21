// API Base URL - Uses environment variable in production, falls back to local proxy during development
const BASE = import.meta.env.VITE_API_URL || "/api";

export async function uploadPDF(file, voicePair = "FM") {
  const form = new FormData();
  form.append("file", file);
  form.append("voice_pair", voicePair); // E.g., 'FM', 'MM', 'FF'

  const res = await fetch(`${BASE}/ingest`, {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    // Cleanly parse the FastAPI error so it doesn't look like raw code on the UI
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server returned status ${res.status}`);
  }
  return res.json();
}

export async function startGeneration(jobId) {
  const res = await fetch(`${BASE}/generate/${jobId}`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start generation");
  }
  return res.json();
}

export async function pollStatus(jobId) {
  const res = await fetch(`${BASE}/generate/${jobId}/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function sendChat(jobId, message, history) {
  const res = await fetch(`${BASE}/podcast/${jobId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ChatRequest no longer includes job_id (path param supplies it)
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

export async function submitQuiz(jobId, answers) {
  const res = await fetch(`${BASE}/podcast/${jobId}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Only send the answers array (job_id is provided via URL)
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("Failed to submit quiz");
  return res.json();
}

export async function getStudyGuide(jobId) {
  const res = await fetch(`${BASE}/podcast/${jobId}/study-guide`);
  if (!res.ok) throw new Error("Failed to load study guide");
  return res.json();
}

export async function getLeaderboard() {
  const res = await fetch(`${BASE}/podcast/leaderboard`);
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

// Helper functions for media URLs
export function audioUrl(jobId) { return `${BASE}/podcast/${jobId}/audio`; }
export function captionsUrl(jobId) { return `${BASE}/podcast/${jobId}/captions`; }
export function downloadUrl(jobId) { return `${BASE}/podcast/${jobId}/download`; }