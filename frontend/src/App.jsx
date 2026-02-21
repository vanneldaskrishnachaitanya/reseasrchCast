import { useState, useRef, useEffect } from "react";
import { uploadPDF, startGeneration, pollStatus, sendChat, submitQuiz, audioUrl, downloadUrl, captionsUrl } from "./api.js";
import { auth, googleProvider, db } from "./firebase.js";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  Upload: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>),
  Play: () => (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8 5.14v14l11-7-11-7z" /></svg>),
  Pause: () => (<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>),
  Download: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>),
  Chat: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>),
  Trophy: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>),
  Send: () => (<svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>),
  Close: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>),
  SkipBack10: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /><text x="12" y="16" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">10</text></svg>),
  SkipForward10: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /><text x="12" y="16" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">10</text></svg>),
  Book: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>),
  Google: () => (<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>),
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
    :root {
      --bg: #0d0d0f;
      --surface: #161618;
      --surface2: #1e1e21;
      --border: #2a2a2e;
      --fg: #f0ede8;
      --fg-muted: #6b6872;
      --accent: #f59e0b;
      --accent2: #f97316;
      --green: #10b981;
      --red: #ef4444;
      --font-display: 'Playfair Display', Georgia, serif;
      --font-body: 'DM Sans', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    body { background: var(--bg); color: var(--fg); font-family: var(--font-body); overflow: hidden; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    @keyframes wave { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    .fade-in { animation: fadeIn 0.4s ease forwards; }
    .slide-in { animation: slideIn 0.3s ease forwards; }
  `}</style>
);

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ isPlaying }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "32px" }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{
          width: "3px", borderRadius: "2px", background: "var(--accent)",
          height: `${12 + Math.sin(i * 0.9) * 10}px`,
          opacity: isPlaying ? 0.9 : 0.2,
          animation: isPlaying ? `wave ${0.5 + (i % 4) * 0.15}s ease-in-out infinite` : "none",
          animationDelay: `${i * 40}ms`,
        }} />
      ))}
    </div>
  );
}

// ─── Upload Screen ────────────────────────────────────────────────────────────
function UploadScreen({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [voicePair, setVoicePair] = useState("FM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file."); return;
    }
    setLoading(true); setError("");
    try {
      const doc = await uploadPDF(file, voicePair);
      onUpload(doc.job_id, doc, voicePair);
    } catch (e) {
      setError("Upload failed: " + e.message);
      setLoading(false);
    }
  };

  const voiceOptions = [
    { id: "MM", emoji: "👨👨", label: "Male × Male" },
    { id: "FM", emoji: "👩👨", label: "Female × Male" },
    { id: "FF", emoji: "👩👩", label: "Female × Female" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{ position: "absolute", top: "20%", left: "20%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.08), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "20%", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.05), transparent)", pointerEvents: "none" }} />

      <div style={{ maxWidth: "560px", width: "100%", position: "relative", zIndex: 1 }} className="fade-in">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "12px" }}>✦ AI-Powered Learning ✦</p>
          <h1 style={{ fontSize: "52px", fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--fg)", lineHeight: 1.1, marginBottom: "12px" }}>
            Paper to <span style={{ color: "var(--accent)" }}>Podcast</span>
          </h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "17px", fontFamily: "var(--font-body)" }}>
            Drop a dense research paper. Get an engaging, gamified podcast.
          </p>
        </div>

        {/* Drop Zone */}
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
        <div
          onClick={() => !loading && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "20px",
            padding: "48px 32px",
            textAlign: "center",
            cursor: loading ? "wait" : "pointer",
            background: dragging ? "rgba(245,158,11,0.04)" : "var(--surface)",
            transition: "all 0.25s ease",
            marginBottom: "20px",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ color: "var(--fg-muted)", fontFamily: "var(--font-body)" }}>Uploading & analysing PDF…</p>
            </div>
          ) : (
            <>
              <div style={{ display: "inline-flex", padding: "16px", borderRadius: "14px", background: "rgba(245,158,11,0.1)", color: "var(--accent)", marginBottom: "16px" }}>
                <Icons.Upload />
              </div>
              <p style={{ fontSize: "17px", fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-display)", marginBottom: "6px" }}>Drop your PDF here</p>
              <p style={{ fontSize: "13px", color: "var(--fg-muted)" }}>or click to browse · Max 50MB</p>
            </>
          )}
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: "13px", textAlign: "center", marginBottom: "12px" }}>{error}</p>}

        {/* Voice Pair */}
        <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fg-muted)", fontFamily: "var(--font-mono)", textAlign: "center", marginBottom: "12px" }}>Host Voice Pairing</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "28px" }}>
          {voiceOptions.map(opt => (
            <button key={opt.id} onClick={() => setVoicePair(opt.id)} style={{
              padding: "14px 10px", borderRadius: "14px", border: `1px solid ${voicePair === opt.id ? "var(--accent)" : "var(--border)"}`,
              background: voicePair === opt.id ? "rgba(245,158,11,0.12)" : "var(--surface)",
              color: voicePair === opt.id ? "var(--accent)" : "var(--fg-muted)",
              cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500,
              transition: "all 0.2s ease",
            }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>{opt.emoji}</div>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
          {["Synced Captions", "Chapter Navigation", "AI Chatbot", "Post-Quiz", "Leaderboard", "Offline Download"].map(f => (
            <span key={f} style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "20px", background: "var(--surface)", color: "var(--fg-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Processing Screen ────────────────────────────────────────────────────────
function ProcessingScreen({ jobId, onDone }) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Starting generation…");
  const [stepsDone, setStepsDone] = useState(0);

  const steps = [
    "Parsing PDF structure & equations",
    "Planning podcast chapters",
    "Writing two-host dialogue",
    "Building study guide & quiz",
    "Mixing audio with Lo-Fi music",
  ];

  useEffect(() => {
    startGeneration(jobId).catch((err) => {
      console.error(err);
      setMessage("Failed to start generation. Check connection.");
    });

    const interval = setInterval(async () => {
      try {
        const status = await pollStatus(jobId);
        const pct = status.progress_pct || 0;
        setProgress(pct);
        setMessage(status.message || "Working…");
        setStepsDone(Math.floor((pct / 100) * steps.length));

        if (status.status === "done") { clearInterval(interval); onDone(status.result, status.script); }
        if (status.status === "error") { clearInterval(interval); alert("Error: " + status.message); }
      } catch (e) {
        console.error("Poll error:", e);
        setMessage("Connection error. Retrying...");
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "24px" }}>
      <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }} className="fade-in">
        {/* Spinner */}
        <div style={{ position: "relative", width: "88px", height: "88px", margin: "0 auto 28px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(245,158,11,0.1)" }} />
          <div style={{ position: "absolute", inset: "8px", border: "3px solid transparent", borderTop: "3px solid var(--accent)", borderRight: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>🎙️</div>
        </div>

        <h2 style={{ fontSize: "30px", fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--fg)", marginBottom: "8px" }}>Brewing your podcast</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: "14px", marginBottom: "24px", fontFamily: "var(--font-body)" }}>{message}</p>

        {/* Progress bar */}
        <div style={{ height: "6px", borderRadius: "3px", background: "var(--surface)", marginBottom: "28px", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, var(--accent), var(--accent2))", width: `${progress}%`, transition: "width 0.6s ease" }} />
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: i < stepsDone ? "var(--accent)" : "var(--surface)",
                border: i < stepsDone ? "none" : "1px solid var(--border)",
                transition: "all 0.3s ease",
              }}>
                {i < stepsDone && <span style={{ fontSize: "11px", fontWeight: 700, color: "#000" }}>✓</span>}
                {i === stepsDone && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)", animation: "wave 0.8s ease infinite" }} />}
              </div>
              <span style={{ fontSize: "14px", color: i <= stepsDone ? "var(--fg)" : "var(--fg-muted)", fontFamily: "var(--font-body)", transition: "color 0.3s" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel({ jobId, onClose }) {
  const [msgs, setMsgs] = useState([{ role: "ai", text: "Hi! Ask me anything about this paper 📄" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput(""); setLoading(true);
    setMsgs(m => [...m, { role: "user", text: userMsg }]);
    try {
      const history = msgs.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
      const res = await sendChat(jobId, userMsg, history);
      setMsgs(m => [...m, { role: "ai", text: res.reply }]);
    } catch { setMsgs(m => [...m, { role: "ai", text: "Connection error. Try again." }]); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--surface)" }} className="slide-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent)" }}>
          <Icons.Chat />
          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--fg)", fontFamily: "var(--font-display)" }}>Paper Chatbot</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", padding: "4px" }}><Icons.Close /></button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: "14px", fontSize: "13px", lineHeight: 1.5,
              background: m.role === "user" ? "var(--accent)" : "var(--surface2)",
              color: m.role === "user" ? "#000" : "var(--fg)",
              fontFamily: "var(--font-body)",
            }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: "14px", background: "var(--surface2)", color: "var(--fg-muted)", fontSize: "13px" }}>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about the paper…"
          style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)", fontSize: "13px", outline: "none", fontFamily: "var(--font-body)" }} />
        <button onClick={send} style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--accent)", border: "none", cursor: "pointer", color: "#000", display: "flex", alignItems: "center" }}><Icons.Send /></button>
      </div>
    </div>
  );
}

// ─── Quiz Modal ───────────────────────────────────────────────────────────────
function QuizModal({ questions, jobId, user, onClose, onComplete }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);

  const q = questions[current];
  if (!q) return null;

  const choose = (i) => { if (selected !== null) return; setSelected(i); };

  const next = async () => {
    const newAnswers = [...answers, selected ?? 0];
    if (current < questions.length - 1) {
      setAnswers(newAnswers); setCurrent(c => c + 1); setSelected(null);
    } else {
      let finalResult;
      try {
        const res = await submitQuiz(jobId, newAnswers);
        setResult(res);
        finalResult = res;
      } catch {
        const score = newAnswers.filter((a, i) => a === questions[i].correct_index).length;
        finalResult = { score, total: questions.length, points_earned: score, feedback: [] };
        setResult(finalResult);
      }

      // Save points to Firebase Firestore if logged in
      if (user?.uid) {
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          const currentTotal = snap.exists() ? (snap.data().totalPoints || 0) : 0;
          const pointsEarned = finalResult?.points_earned ?? newAnswers.filter((a, i) => a === questions[i].correct_index).length;

          await setDoc(userRef, { totalPoints: currentTotal + pointsEarned }, { merge: true });
        } catch (err) {
          console.error("Failed to save points to Firestore:", err);
        }
      }

      setDone(true);
      onComplete(finalResult?.score ?? 0);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div style={{ width: "100%", maxWidth: "500px", borderRadius: "20px", background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }} className="fade-in">
        <div style={{ padding: "28px" }}>
          {!done ? (
            <>
              {/* Progress */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>Question {current + 1} / {questions.length}</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {questions.map((_, i) => <div key={i} style={{ width: "24px", height: "3px", borderRadius: "2px", background: i <= current ? "var(--accent)" : "var(--border)", transition: "background 0.3s" }} />)}
                </div>
              </div>

              <p style={{ fontSize: "17px", fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-display)", marginBottom: "20px", lineHeight: 1.4 }}>{q.question}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {q.options.map((opt, i) => {
                  let bg = "var(--bg)", border = "var(--border)", color = "var(--fg)";
                  if (selected !== null) {
                    if (i === q.correct_index) { bg = "rgba(16,185,129,0.12)"; border = "var(--green)"; color = "var(--green)"; }
                    else if (i === selected) { bg = "rgba(239,68,68,0.12)"; border = "var(--red)"; color = "var(--red)"; }
                  } else if (selected === i) { bg = "rgba(245,158,11,0.1)"; border = "var(--accent)"; }
                  return (
                    <button key={i} onClick={() => choose(i)} style={{ textAlign: "left", padding: "12px 16px", borderRadius: "12px", border: `1px solid ${border}`, background: bg, color, cursor: "pointer", fontSize: "14px", fontFamily: "var(--font-body)", transition: "all 0.2s" }}>
                      <span style={{ fontWeight: 700, marginRight: "8px", color: "var(--accent)" }}>{["A", "B", "C", "D"][i]}.</span>{opt}
                    </button>
                  );
                })}
              </div>

              {selected !== null && (
                <button onClick={next} style={{ marginTop: "20px", width: "100%", padding: "14px", borderRadius: "12px", background: "var(--accent)", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "15px", color: "#000", fontFamily: "var(--font-display)" }}>
                  {current < questions.length - 1 ? "Next Question →" : "See Results"}
                </button>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: "56px", marginBottom: "16px" }}>{result?.score === questions.length ? "🏆" : result?.score >= questions.length / 2 ? "🎉" : "📚"}</div>
              <h3 style={{ fontSize: "28px", fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--fg)", marginBottom: "8px" }}>{result?.score} / {result?.total} Correct</h3>
              <p style={{ color: "var(--fg-muted)", fontSize: "15px", marginBottom: "24px" }}>You earned <span style={{ color: "var(--accent)", fontWeight: 700 }}>+{result?.points_earned} points!</span></p>
              <button onClick={onClose} style={{ padding: "14px 32px", borderRadius: "12px", background: "var(--accent)", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "15px", color: "#000", fontFamily: "var(--font-display)" }}>Back to Player</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Player Screen ────────────────────────────────────────────────────────────
function PlayerScreen({ jobId, podcastData, script, docInfo, user }) {
  const audioRef = useRef();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState("chapters");
  const [showChat, setShowChat] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [points, setPoints] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const [showReminder, setShowReminder] = useState(false);
  const [caption, setCaption] = useState({ host: "A", text: "Press play to begin your podcast! 🎙️" });
  const [cues, setCues] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Get real data
  const chapters = podcastData?.chapters || [];
  const dialogue = script?.dialogue || [];
  const questions = script?.quiz_questions || [];
  const studyGuide = script?.study_guide || "";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Restore resume position
  useEffect(() => {
    const saved = localStorage.getItem(`resume_${jobId}`);
    if (saved && audioRef.current) {
      audioRef.current.currentTime = parseFloat(saved);
    }
  }, [jobId]);

  // Reminder after 8s of pausing mid-podcast
  useEffect(() => {
    if (!isPlaying && currentTime > 10) {
      const t = setTimeout(() => setShowReminder(true), 8000);
      return () => clearTimeout(t);
    }
  }, [isPlaying, currentTime]);

  // Fetch Firestore Leaderboard
  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const fetchLeaderboard = async () => {
      try {
        const q = query(collection(db, "users"), orderBy("totalPoints", "desc"), limit(10));
        const snapshot = await getDocs(q);
        const leaders = snapshot.docs.map(doc => ({
          uid: doc.id,
          name: doc.data().displayName || "Unknown Scholar",
          score: doc.data().totalPoints || 0,
          photo: doc.data().photoURL
        }));
        setLeaderboard(leaders);
      } catch (err) {
        console.error("Failed to fetch leaderboard", err);
      }
    };
    fetchLeaderboard();
  }, [activeTab]);

  // Fetch and parse VTT captions
  useEffect(() => {
    if (!jobId) return;
    const loadVtt = async () => {
      try {
        const res = await fetch(captionsUrl(jobId));
        if (!res.ok) return;
        const text = await res.text();
        const parsed = parseVTT(text);
        setCues(parsed);
      } catch (err) {
        console.error("Failed to load VTT", err);
      }
    };
    loadVtt();
  }, [jobId]);

  // Sync captions with audio current time
  useEffect(() => {
    if (cues.length === 0) return;
    const activeCue = cues.find(c => currentTime >= c.start && currentTime <= c.end);
    if (activeCue && activeCue.text !== caption.text) {
      setCaption({ host: activeCue.host, text: activeCue.text });
    }
  }, [currentTime, cues]);

  // Update active chapter based on current time
  useEffect(() => {
    if (chapters.length === 0) return;
    const idx = chapters.findIndex((ch, i) => {
      const next = chapters[i + 1];
      return currentTime >= ch.start_sec && (!next || currentTime < next.start_sec);
    });
    if (idx !== -1) setActiveChapter(idx);
  }, [currentTime, chapters]);

  // Helper: parse rudimentary WebVTT
  const parseVTT = (vttText) => {
    const blocks = vttText.split(/\n\s*\n/);
    const parsed = [];
    const timeRegex = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/;
    const hostRegex = /\[([^\]]+)\]:\s*(.*)/;

    blocks.forEach(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      let startTime = 0, endTime = 0, host = "A", text = "";

      for (const line of lines) {
        const timeMatch = line.match(timeRegex);
        if (timeMatch) {
          startTime = parseTime(timeMatch[1]);
          endTime = parseTime(timeMatch[2]);
          continue;
        }
        const hostMatch = line.match(hostRegex);
        if (hostMatch) {
          host = hostMatch[1];
          text = hostMatch[2];
        } else if (!timeMatch && !line.match(/^\d+$/) && !line.includes("WEBVTT")) {
          // fallback if no host tag
          text += (text ? " " : "") + line;
        }
      }
      if (text) {
        parsed.push({ start: startTime, end: endTime, host, text });
      }
    });
    return parsed;
  };

  const parseTime = (timeStr) => {
    const [h, m, s] = timeStr.split(':');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(e => console.error("Play error:", e)); setIsPlaying(true); }
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    localStorage.setItem(`resume_${jobId}`, String(t));
  };

  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const seekToChapter = (ch) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = ch.start_sec;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const tabs = [
    { id: "chapters", label: "Chapters", icon: "≡" },
    { id: "study", label: "Study Guide", icon: "📋" },
    { id: "leaderboard", label: "Score", icon: "🏆" },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      {/* Hidden audio */}
      <audio
        ref={audioRef}
        src={audioUrl(jobId)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onEnded={() => setIsPlaying(false)}
        onError={e => console.error("Audio error:", e)}
      />

      {/* Reminder toast */}
      {showReminder && (
        <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 50, maxWidth: "280px", borderRadius: "16px", padding: "16px", background: "var(--surface)", border: "1px solid var(--accent)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", gap: "12px", alignItems: "flex-start" }} className="slide-in">
          <span style={{ fontSize: "24px" }}>🎧</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--fg)", fontFamily: "var(--font-display)", marginBottom: "4px" }}>Still there?</p>
            <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginBottom: "10px" }}>Your podcast is paused. Resume where you left off!</p>
            <button onClick={() => { setShowReminder(false); togglePlay(); }}
              style={{ fontSize: "12px", fontWeight: 700, padding: "6px 14px", borderRadius: "8px", background: "var(--accent)", border: "none", cursor: "pointer", color: "#000" }}>
              Resume Now
            </button>
          </div>
          <button onClick={() => setShowReminder(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", padding: "2px" }}><Icons.Close /></button>
        </div>
      )}

      {/* Quiz modal */}
      {showQuiz && questions.length > 0 && (
        <QuizModal questions={questions} jobId={jobId} user={user} onClose={() => setShowQuiz(false)} onComplete={(s) => { setPoints(p => p + s); setShowQuiz(false); }} />
      )}

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <h1 style={{ fontSize: "22px", fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--fg)" }}>
          Paper<span style={{ color: "var(--accent)" }}>Cast</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "20px", background: "rgba(245,158,11,0.1)" }}>
            <Icons.Trophy />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{points} pts</span>
          </div>
          <button onClick={() => setShowChat(s => !s)} style={{
            padding: "8px", borderRadius: "10px", border: "1px solid var(--border)", cursor: "pointer",
            background: showChat ? "var(--accent)" : "var(--surface)", color: showChat ? "#000" : "var(--fg-muted)",
            display: "flex", alignItems: "center", transition: "all 0.2s",
          }}><Icons.Chat /></button>
        </div>
      </header>

      {/* Main layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left: Player */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Paper info + controls */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            {/* Paper title */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>Now Playing</p>
                <h2 style={{ fontSize: "16px", fontWeight: 900, color: "var(--fg)", fontFamily: "var(--font-display)", lineHeight: 1.3, marginBottom: "4px" }}>
                  {script?.paper_title || docInfo?.metadata?.title || "Your Podcast"}
                </h2>
                <p style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{script?.paper_authors || docInfo?.metadata?.authors || ""} · {docInfo?.total_pages || "?"} pages</p>
              </div>
              <a href={downloadUrl(jobId)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-muted)", textDecoration: "none", fontSize: "12px", flexShrink: 0 }}>
                <Icons.Download /><span>MP3</span>
              </a>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{fmt(currentTime)}</span>
                <span style={{ fontSize: "11px", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{fmt(duration)}</span>
              </div>
              <div onClick={seek} style={{ height: "6px", borderRadius: "3px", background: "var(--surface)", cursor: "pointer", position: "relative" }}>
                <div style={{ height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, var(--accent), var(--accent2))", width: `${progress}%`, transition: "width 0.1s linear" }} />
                {/* Chapter markers */}
                {chapters.map((ch) => (
                  <div key={ch.id} title={ch.title} style={{
                    position: "absolute", top: "-3px", width: "3px", height: "12px",
                    background: "var(--fg-muted)", borderRadius: "2px",
                    left: duration > 0 ? `${(ch.start_sec / duration) * 100}%` : "0%",
                  }} />
                ))}
              </div>
            </div>

            {/* Play button + waveform */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" }}>
              <button onClick={skipBackward} title="Skip backward 10 seconds" style={{
                background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-muted)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", transition: "color 0.2s"
              }} onMouseEnter={e => e.currentTarget.style.color = "var(--fg)"} onMouseLeave={e => e.currentTarget.style.color = "var(--fg-muted)"}>
                <Icons.SkipBack10 />
              </button>
              <button onClick={togglePlay} style={{
                width: "56px", height: "56px", borderRadius: "50%", border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "#000",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 20px rgba(245,158,11,0.3)", transition: "transform 0.15s",
              }}>
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>
              <button onClick={skipForward} title="Skip forward 10 seconds" style={{
                background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-muted)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", transition: "color 0.2s"
              }} onMouseEnter={e => e.currentTarget.style.color = "var(--fg)"} onMouseLeave={e => e.currentTarget.style.color = "var(--fg-muted)"}>
                <Icons.SkipForward10 />
              </button>
              <Waveform isPlaying={isPlaying} />
            </div>
          </div>

          {/* Live Captions */}
          <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "rgba(245,158,11,0.02)", flexShrink: 0 }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--fg-muted)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
              🎙 Live Captions
            </p>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                background: caption.host === "A" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
              }}>
                {caption.host === "A" ? "🎙" : "🎤"}
              </div>
              <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--fg)", fontFamily: "var(--font-body)" }}>
                <span style={{ fontWeight: 700, marginRight: "6px", color: caption.host === "A" ? "var(--accent)" : "var(--green)" }}>
                  Host {caption.host}:
                </span>
                {caption.text}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: "12px 8px", border: "none", cursor: "pointer",
                background: "transparent", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-mono)",
                color: activeTab === tab.id ? "var(--accent)" : "var(--fg-muted)",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "all 0.2s",
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>

            {/* Chapters tab */}
            {activeTab === "chapters" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {chapters.length > 0 ? chapters.map((ch, i) => (
                  <button key={ch.id} onClick={() => { setActiveChapter(i); seekToChapter(ch); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
                      borderRadius: "12px", border: `1px solid ${activeChapter === i ? "var(--accent)" : "transparent"}`,
                      background: activeChapter === i ? "rgba(245,158,11,0.08)" : "transparent",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s", width: "100%",
                    }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", width: "36px", flexShrink: 0 }}>{fmt(ch.start_sec)}</span>
                    <span style={{ fontSize: "14px", color: "var(--fg)", fontFamily: "var(--font-body)", fontWeight: activeChapter === i ? 700 : 400, flex: 1 }}>{ch.title}</span>
                    {activeChapter === i && isPlaying && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "wave 0.8s ease infinite" }} />}
                  </button>
                )) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fg-muted)", fontSize: "14px" }}>
                    <p style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</p>
                    <p>Chapters will appear here once audio is generated.</p>
                    <p style={{ fontSize: "12px", marginTop: "8px" }}>If audio generation is skipped, chapters come from the script.</p>
                  </div>
                )}
              </div>
            )}

            {/* Study guide tab */}
            {activeTab === "study" && (
              <div>
                {studyGuide ? (
                  <div style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--fg)", fontFamily: "var(--font-body)" }}>
                    {studyGuide.split("\n").map((line, i) => {
                      if (line.startsWith("## ")) return <h3 key={i} style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-display)", marginTop: "20px", marginBottom: "8px" }}>{line.replace("## ", "")}</h3>;
                      if (line.startsWith("# ")) return <h2 key={i} style={{ fontSize: "18px", fontWeight: 900, color: "var(--fg)", fontFamily: "var(--font-display)", marginBottom: "12px" }}>{line.replace("# ", "")}</h2>;
                      if (line === "") return <br key={i} />;
                      return <p key={i} style={{ marginBottom: "6px" }}>{line}</p>;
                    })}
                  </div>
                ) : (
                  <p style={{ color: "var(--fg-muted)", textAlign: "center", padding: "40px", fontSize: "14px" }}>Study guide is being generated…</p>
                )}
              </div>
            )}

            {/* Leaderboard / score tab */}
            {activeTab === "leaderboard" && (
              <div>
                <div style={{ textAlign: "center", padding: "20px", borderRadius: "16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: "20px" }}>
                  <p style={{ fontSize: "40px", fontWeight: 900, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{points}</p>
                  <p style={{ color: "var(--fg-muted)", fontSize: "13px" }}>Points Earned this Session</p>
                  <p style={{ color: "var(--fg-muted)", fontSize: "12px", marginTop: "4px" }}>{questions.length > 0 ? `${questions.length} questions available` : "No quiz available yet"}</p>
                </div>

                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-display)", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>Global Leaderboard</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {leaderboard.length > 0 ? leaderboard.map((leader, i) => (
                    <div key={leader.uid} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", background: leader.uid === user?.uid ? "rgba(245,158,11,0.1)" : "var(--surface)", border: leader.uid === user?.uid ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border)" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--fg-muted)", width: "20px" }}>#{i + 1}</span>
                      {leader.photo ? (
                        <img src={leader.photo} alt={leader.name} style={{ width: "28px", height: "28px", borderRadius: "50%" }} />
                      ) : (
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--border)", color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>{leader.name.charAt(0)}</div>
                      )}
                      <span style={{ flex: 1, fontSize: "14px", fontWeight: leader.uid === user?.uid ? 700 : 500, color: "var(--fg)", fontFamily: "var(--font-body)" }}>
                        {leader.uid === user?.uid ? "You" : leader.name.split(" ")[0]}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{leader.score}</span>
                    </div>
                  )) : (
                    <p style={{ color: "var(--fg-muted)", fontSize: "13px", textAlign: "center", padding: "16px 0" }}>Loading leaderboard...</p>
                  )}
                </div>

                <button onClick={() => questions.length > 0 ? setShowQuiz(true) : alert("Quiz not available yet — ensure generation completed successfully.")}
                  style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "linear-gradient(135deg, var(--accent), var(--accent2))", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "15px", color: "#000", fontFamily: "var(--font-display)" }}>
                  🎯 Take the Quiz — Earn Points!
                </button>
              </div>
            )}
          </div>

          {/* Quiz CTA bar */}
          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <button onClick={() => questions.length > 0 ? setShowQuiz(true) : alert("Quiz not ready yet.")}
              style={{ width: "100%", padding: "13px", borderRadius: "12px", background: "linear-gradient(135deg, var(--accent), var(--accent2))", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "14px", color: "#000", fontFamily: "var(--font-display)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Icons.Trophy /> Test Your Knowledge — Take the Quiz
            </button>
          </div>
        </main>

        {/* Right: Chat sidebar */}
        {showChat && (
          <aside style={{ width: "300px", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <ChatPanel jobId={jobId} onClose={() => setShowChat(false)} />
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    // Mock execution for email
    setTimeout(() => {
      setLoading(false);
      onLogin({ displayName: "Test User", email });
    }, 1000);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists, else create user doc in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      const userData = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString()
      };

      if (!userSnap.exists()) {
        userData.createdAt = new Date().toISOString();
        await setDoc(userRef, userData);
      } else {
        await setDoc(userRef, userData, { merge: true });
      }

      onLogin(userData);
    } catch (err) {
      console.error("Google Login Failed:", err);
      setError(err.message || "Google Login failed");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{ position: "absolute", top: "10%", right: "10%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.08), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "10%", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.05), transparent)", pointerEvents: "none" }} />

      <div style={{ maxWidth: "420px", width: "100%", position: "relative", zIndex: 1 }} className="fade-in">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>✦ Welcome to ✦</p>
          <h1 style={{ fontSize: "42px", fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--fg)", lineHeight: 1.1 }}>
            Paper<span style={{ color: "var(--accent)" }}>Cast</span>
          </h1>
        </div>

        <div style={{
          background: "var(--surface)",
          borderRadius: "24px",
          padding: "32px",
          border: "1px solid var(--border)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}>
          {/* Toggle */}
          <div style={{ display: "flex", background: "var(--surface2)", borderRadius: "12px", padding: "4px", marginBottom: "24px" }}>
            <button onClick={() => { setIsLogin(true); setError(""); }} style={{
              flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
              background: isLogin ? "rgba(245,158,11,0.15)" : "transparent",
              color: isLogin ? "var(--accent)" : "var(--fg-muted)",
              fontWeight: isLogin ? 700 : 500, fontSize: "14px", fontFamily: "var(--font-body)",
              transition: "all 0.2s"
            }}>Log In</button>
            <button onClick={() => { setIsLogin(false); setError(""); }} style={{
              flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
              background: !isLogin ? "rgba(245,158,11,0.15)" : "transparent",
              color: !isLogin ? "var(--accent)" : "var(--fg-muted)",
              fontWeight: !isLogin ? 700 : 500, fontSize: "14px", fontFamily: "var(--font-body)",
              transition: "all 0.2s"
            }}>Sign Up</button>
          </div>

          {/* Google Button */}
          <button type="button" onClick={handleGoogleLogin} disabled={loading} style={{
            width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid var(--border)",
            background: "var(--surface2)", cursor: loading ? "wait" : "pointer",
            fontWeight: 600, fontSize: "14px", color: "var(--fg)", fontFamily: "var(--font-body)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            marginBottom: "20px", transition: "all 0.2s"
          }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "var(--border)")}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = "var(--surface2)")}
          >
            <Icons.Google />
            Sign in with Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>or continue with email</span>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          </div>

          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--fg-muted)", marginBottom: "6px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--border)",
                  background: "var(--bg)", color: "var(--fg)", fontSize: "14px", fontFamily: "var(--font-body)",
                  outline: "none", transition: "border 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--fg-muted)", marginBottom: "6px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--border)",
                  background: "var(--bg)", color: "var(--fg)", fontSize: "14px", fontFamily: "var(--font-body)",
                  outline: "none", transition: "border 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            {error && <p style={{ color: "var(--red)", fontSize: "13px", textAlign: "center", marginTop: "4px" }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              marginTop: "8px", width: "100%", padding: "14px", borderRadius: "12px",
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              border: "none", cursor: loading ? "wait" : "pointer",
              fontWeight: 700, fontSize: "15px", color: "#000", fontFamily: "var(--font-display)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              opacity: loading ? 0.7 : 1, transition: "opacity 0.2s"
            }}>
              {loading ? (
                <div style={{ width: "20px", height: "20px", border: "2px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              ) : (
                isLogin ? "Sign In →" : "Create Account →"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth");
  const [jobId, setJobId] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [podcastData, setPodcastData] = useState(null);
  const [script, setScript] = useState(null);
  const [user, setUser] = useState(null);

  const handleLogOut = async () => {
    try {
      if (auth.currentUser) await signOut(auth);
      setUser(null);
      setScreen("auth");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  return (
    <>
      <GlobalStyles />

      {/* Top Bar / Profile Info (only show when not auth screen) */}
      {screen !== "auth" && user && (
        <div style={{ position: "fixed", top: "16px", right: "24px", zIndex: 100, display: "flex", alignItems: "center", gap: "12px", background: "var(--surface)", padding: "6px 16px 6px 6px", borderRadius: "30px", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{ width: "28px", height: "28px", borderRadius: "50%" }} />
          ) : (
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--accent)", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
              {user.displayName?.charAt(0) || "U"}
            </div>
          )}
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-body)" }}>
            {user.displayName?.split(" ")[0] || "User"}
          </span>
          <button onClick={handleLogOut} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-muted)", fontSize: "12px", marginLeft: "4px", padding: "4px" }}>
            <Icons.Close />
          </button>
        </div>
      )}

      {screen === "auth" && (
        <AuthScreen onLogin={(userData) => { setUser(userData); setScreen("upload"); }} />
      )}

      {screen === "upload" && (
        <UploadScreen onUpload={(id, parsedDoc) => {
          setJobId(id); setDocFile(parsedDoc); setScreen("processing");
        }} />
      )}

      {screen === "processing" && (
        <ProcessingScreen jobId={jobId} onDone={(result, scriptData) => {
          setPodcastData(result);
          setScript(scriptData);
          setScreen("player");
        }} />
      )}

      {screen === "player" && (
        <PlayerScreen
          jobId={jobId}
          podcastData={podcastData}
          script={script}
          docInfo={docFile}
          user={user}
        />
      )}
    </>
  );
}