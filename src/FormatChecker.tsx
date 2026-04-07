import { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreLabel = 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';

interface FormatIssue {
  category: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  location?: string;
}

interface CategoryScore {
  name: string;
  score: number;
  status: 'good' | 'average' | 'poor';
  icon: string;
}

interface FormatReport {
  overallScore: number;
  label: ScoreLabel;
  summary: string;
  documentType: string;
  categoryScores: CategoryScore[];
  issues: FormatIssue[];
  strengths: string[];
}

interface ProcessingState {
  stage: 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';
  progress: number;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLabel(score: number): ScoreLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Improvement';
}

function scoreColor(label: ScoreLabel) {
  const map: Record<ScoreLabel, string> = {
    Excellent: 'score-excellent',
    Good: 'score-good',
    Average: 'score-average',
    'Needs Improvement': 'score-poor',
  };
  return map[label];
}

function severityColor(s: 'high' | 'medium' | 'low') {
  if (s === 'high') return 'sev-high';
  if (s === 'medium') return 'sev-medium';
  return 'sev-low';
}

function severityLabel(s: 'high' | 'medium' | 'low') {
  if (s === 'high') return 'Critical';
  if (s === 'medium') return 'Moderate';
  return 'Minor';
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

interface PageData {
  pageNum: number;
  text: string;
  lineCount: number;
}

async function extractPDFData(file: File): Promise<{ pages: PageData[]; fullText: string }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const pages: PageData[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items.map((it: any) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    const lineCount = content.items.length;
    pages.push({ pageNum: i, text: lines, lineCount });
  }

  return {
    pages,
    fullText: pages.map((p) => p.text).join('\n\n'),
  };
}

// ─── Groq analysis ────────────────────────────────────────────────────────────

async function analyzeFormatWithGroq(
  pages: PageData[],
  fullText: string,
  apiKey: string
): Promise<FormatReport> {
  const preview = fullText.slice(0, 4000);
  const pageCount = pages.length;
  const avgLineCount = Math.round(pages.reduce((s, p) => s + p.lineCount, 0) / pageCount);

  const prompt = `You are a professional document formatting expert. Analyze the following extracted text from a ${pageCount}-page PDF document (avg ${avgLineCount} text items/page) and produce a comprehensive formatting quality report.

DOCUMENT TEXT PREVIEW (first 4000 chars):
"""
${preview}
"""

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "overallScore": <integer 0-100>,
  "documentType": "<detected type: Resume | Report | Academic Paper | Letter | Other>",
  "summary": "<2-sentence overall assessment>",
  "categoryScores": [
    { "name": "Font Consistency", "score": <0-100>, "status": "<good|average|poor>", "icon": "Aa" },
    { "name": "Line Spacing", "score": <0-100>, "status": "<good|average|poor>", "icon": "≡" },
    { "name": "Paragraph Structure", "score": <0-100>, "status": "<good|average|poor>", "icon": "¶" },
    { "name": "Text Alignment", "score": <0-100>, "status": "<good|average|poor>", "icon": "◼" },
    { "name": "Heading Hierarchy", "score": <0-100>, "status": "<good|average|poor>", "icon": "H" },
    { "name": "Overall Layout", "score": <0-100>, "status": "<good|average|poor>", "icon": "⊞" }
  ],
  "issues": [
    {
      "category": "<category name>",
      "severity": "<high|medium|low>",
      "description": "<what is wrong>",
      "suggestion": "<how to fix it>",
      "location": "<optional: page or section reference>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", ...]
}

Rules:
- Issues array: list only REAL problems you can infer from the text structure (max 8 issues). If none, use [].
- Strengths: list 2-4 positive aspects.
- Be precise and actionable in suggestions.
- Infer line spacing / font consistency from text density patterns and whitespace.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_completion_tokens: 2048,
    }),
  });

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const label = scoreLabel(parsed.overallScore ?? 50);
  return { ...parsed, label } as FormatReport;
}

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: ScoreLabel }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const colorMap: Record<ScoreLabel, string> = {
    Excellent: '#22c55e',
    Good: '#3b82f6',
    Average: '#f59e0b',
    'Needs Improvement': '#ef4444',
  };
  const color = colorMap[label];

  return (
    <div className="score-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--glass-border)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <text x="70" y="66" textAnchor="middle" fill="var(--text-main)" fontSize="26" fontWeight="600" fontFamily="Inter,sans-serif">
          {score}
        </text>
        <text x="70" y="84" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="Inter,sans-serif">
          / 100
        </text>
      </svg>
      <span className={`score-label-pill ${scoreColor(label)}`}>{label}</span>
    </div>
  );
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cat }: { cat: CategoryScore }) {
  const colorMap: Record<string, string> = { good: '#22c55e', average: '#f59e0b', poor: '#ef4444' };
  const color = colorMap[cat.status] || '#86868b';
  return (
    <div className="cat-bar-item">
      <div className="cat-bar-header">
        <span className="cat-icon">{cat.icon}</span>
        <span className="cat-name">{cat.name}</span>
        <span className="cat-score" style={{ color }}>{cat.score}</span>
      </div>
      <div className="cat-bar-track">
        <div
          className="cat-bar-fill"
          style={{ width: `${cat.score}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormatChecker() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    stage: 'idle', progress: 0, message: '',
  });
  const [report, setReport] = useState<FormatReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') { setFile(f); setReport(null); setProcessingState({ stage: 'idle', progress: 0, message: '' }); }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setReport(null); setProcessingState({ stage: 'idle', progress: 0, message: '' }); }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      setProcessingState({ stage: 'error', progress: 0, message: 'Missing Groq API key. Check your .env file.' });
      return;
    }

    try {
      setProcessingState({ stage: 'extracting', progress: 15, message: 'Extracting document structure…' });
      const { pages, fullText } = await extractPDFData(file);

      if (!fullText.trim()) {
        setProcessingState({ stage: 'error', progress: 0, message: 'No readable text found in this PDF.' });
        return;
      }

      setProcessingState({ stage: 'analyzing', progress: 45, message: 'Running AI formatting analysis…' });
      const result = await analyzeFormatWithGroq(pages, fullText, apiKey);

      setProcessingState({ stage: 'analyzing', progress: 90, message: 'Generating report…' });
      await new Promise(r => setTimeout(r, 600));

      setReport(result);
      setProcessingState({ stage: 'done', progress: 100, message: '' });
    } catch (err: any) {
      setProcessingState({ stage: 'error', progress: 0, message: err.message || 'Analysis failed.' });
    }
  };

  const resetAll = () => {
    setFile(null); setReport(null);
    setProcessingState({ stage: 'idle', progress: 0, message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isProcessing = processingState.stage === 'extracting' || processingState.stage === 'analyzing';

  return (
    <div className="fc-page">

      {/* ── Header ── */}
      <div className="fc-header">
        <div className="fc-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
          Format Checker
        </div>
        <h1 className="fc-title">Document Format Analysis</h1>
        <p className="fc-subtitle">Upload a PDF to evaluate formatting quality — font consistency, spacing, alignment, and more.</p>
      </div>

      {/* ── Upload zone (hidden when results shown) ── */}
      {processingState.stage !== 'done' && (
        <div
          className={`fc-upload-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} id="fc-pdf-input" />

          {!file ? (
            <div className="fc-upload-prompt">
              <div className="fc-upload-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="fc-upload-main">Drop your PDF here</p>
              <p className="fc-upload-sub">or <span className="fc-upload-link">browse files</span></p>
              <p className="fc-upload-hint">Supports PDF documents up to 50 MB</p>
            </div>
          ) : (
            <div className="fc-file-row">
              <div className="fc-file-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="fc-file-info">
                <span className="fc-file-name">{file.name}</span>
                <span className="fc-file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button className="fc-file-remove" onClick={e => { e.stopPropagation(); resetAll(); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Processing panel ── */}
      {isProcessing && (
        <div className="fc-processing">
          <div className="fc-proc-header">
            <div className="fc-spinner" />
            <span>{processingState.message}</span>
          </div>
          <div className="fc-prog-track"><div className="fc-prog-fill" style={{ width: `${processingState.progress}%` }} /></div>
          <span className="fc-prog-label">{processingState.progress}%</span>
        </div>
      )}

      {/* ── Error banner ── */}
      {processingState.stage === 'error' && (
        <div className="fc-banner fc-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {processingState.message}
        </div>
      )}

      {/* ── Analyze button ── */}
      {file && processingState.stage === 'idle' && (
        <button className="fc-analyze-btn" onClick={handleAnalyze} id="fc-analyze-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Check Formatting
        </button>
      )}

      {/* ── Results Dashboard ── */}
      {processingState.stage === 'done' && report && (
        <div className="fc-results">

          {/* Top bar */}
          <div className="fc-results-topbar">
            <div className="fc-doc-type">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Detected: <strong>{report.documentType}</strong>
            </div>
            <button className="fc-reset-btn" onClick={resetAll} id="fc-reset-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/>
              </svg>
              New Analysis
            </button>
          </div>

          {/* Score + summary */}
          <div className="fc-score-card">
            <ScoreRing score={report.overallScore} label={report.label} />
            <div className="fc-score-info">
              <h2 className="fc-score-heading">Formatting Score</h2>
              <p className="fc-score-summary">{report.summary}</p>

              {report.strengths.length > 0 && (
                <div className="fc-strengths">
                  <span className="fc-strengths-label">✦ Strengths</span>
                  <ul className="fc-strengths-list">
                    {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Category scores */}
          <div className="fc-section">
            <h3 className="fc-section-title">Category Breakdown</h3>
            <div className="fc-cat-grid">
              {report.categoryScores.map((cat, i) => <CategoryBar key={i} cat={cat} />)}
            </div>
          </div>

          {/* Issues */}
          {report.issues.length > 0 && (
            <div className="fc-section">
              <h3 className="fc-section-title">
                Formatting Issues
                <span className="fc-issue-count">{report.issues.length}</span>
              </h3>
              <div className="fc-issue-list">
                {report.issues.map((issue, i) => (
                  <div key={i} className="fc-issue-card" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="fc-issue-head">
                      <span className="fc-issue-cat">{issue.category}</span>
                      <span className={`fc-sev-badge ${severityColor(issue.severity)}`}>{severityLabel(issue.severity)}</span>
                      {issue.location && <span className="fc-issue-loc">{issue.location}</span>}
                    </div>
                    <p className="fc-issue-desc">{issue.description}</p>
                    <div className="fc-issue-fix">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {issue.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.issues.length === 0 && (
            <div className="fc-no-issues">
              <span className="fc-no-issues-icon">✅</span>
              <p>No significant formatting issues detected.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
