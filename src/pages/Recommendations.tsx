// File: src/pages/Recommendations.tsx

import { useState } from 'react';
import ResumeInput from '../components/ResumeInput';
import RecommendationCard from '../components/RecommendationCard';
import {
  getJobRecommendations,
  isApiKeyConfigured,
  ApiKeyMissingError,
} from '../services/aiService';
import type { RecommendationResult } from '../services/aiService';

const LEVEL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  Beginner:     { label: 'Beginner',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  Intermediate: { label: 'Intermediate', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  Advanced:     { label: 'Advanced',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
};

type Phase = 'input' | 'loading' | 'results';

// ── Setup Banner — shown when VITE_OPENAI_API_KEY is not configured ────────
function ApiKeySetupBanner() {
  return (
    <div className="setup-banner" role="alert" aria-label="API key setup required">
      <div className="setup-banner-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <div className="setup-banner-body">
        <p className="setup-banner-title">Gemini API Key Not Configured</p>
        <p className="setup-banner-desc">
          To generate job recommendations, add your Gemini API key to a <code>.env</code> file
          in the project root.
        </p>

        <div className="setup-banner-steps">
          <div className="setup-step">
            <span className="setup-step-num">1</span>
            <div>
              <p className="setup-step-label">Create <code>.env</code> file</p>
              <p className="setup-step-hint">
                In <code>d:\Academics\TektonAI\</code> (same folder as <code>package.json</code>)
              </p>
            </div>
          </div>

          <div className="setup-step">
            <span className="setup-step-num">2</span>
            <div>
              <p className="setup-step-label">Add this line inside it:</p>
              <code className="setup-code-block">
                VITE_GEMINI_API_KEY=your-gemini-key-here
              </code>
            </div>
          </div>

          <div className="setup-step">
            <span className="setup-step-num">3</span>
            <div>
              <p className="setup-step-label">Restart the dev server:</p>
              <code className="setup-code-block">npm run dev</code>
            </div>
          </div>
        </div>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="setup-banner-link"
        >
          Get your free Gemini API key →
        </a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Recommendations() {
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [phase,  setPhase]  = useState<Phase>('input');
  const [error,  setError]  = useState<string | null>(null);
  const [isKeyError, setIsKeyError] = useState(false);

  // Detect missing key immediately (before the user even uploads)
  const apiKeyMissing = !isApiKeyConfigured();

  const handleAnalyze = async (resumeText: string) => {
    // Guard: do not proceed if key is absent
    if (apiKeyMissing) return;

    setPhase('loading');
    setError(null);
    setIsKeyError(false);
    setResult(null);

    try {
      const data = await getJobRecommendations(resumeText);
      setResult(data);
      setPhase('results');
    } catch (err) {
      // Distinguish ApiKeyMissingError from other errors
      if (err instanceof ApiKeyMissingError) {
        setIsKeyError(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
      setPhase('input');
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setIsKeyError(false);
    setPhase('input');
  };

  const levelInfo = result
    ? LEVEL_BADGE[result.level] ?? {
        label: result.level,
        color: '#86868b',
        bg: 'rgba(134,134,139,0.1)',
      }
    : null;

  return (
    <div className="rec-page">

      {/* ── Page Header ── */}
      <div className="rec-page-header">
        <div className="rec-page-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div>
          <h1 className="rec-page-title">Job Recommendations</h1>
          <p className="rec-page-subtitle">
          Upload your resume image — Gemini AI extracts content and finds your best job matches.
          </p>
        </div>
      </div>

      {/* ── API Key Setup Banner (shown when key is absent) ── */}
      {(apiKeyMissing || isKeyError) && <ApiKeySetupBanner />}

      {/* ── Runtime Error Banner ── */}
      {error && !isKeyError && (
        <div className="rec-error" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button
            className="rec-error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Upload + OCR Input Panel (always shown when not in results/loading) ── */}
      {phase === 'input' && (
        <ResumeInput
          onAnalyze={handleAnalyze}
          isLoading={false}
          disabled={apiKeyMissing}
        />
      )}

      {/* ── Full-page Loading State ── */}
      {phase === 'loading' && (
        <div className="rec-ai-loading">
          <div className="ai-loading-ring">
            <span className="ai-loading-spinner" />
          </div>
          <p className="ai-loading-title">Analyzing your resume...</p>
          <p className="ai-loading-subtitle">
            AI is matching your skills, projects, and experience to job roles.
          </p>
          <div className="ai-loading-steps">
            <span className="ai-step done">✓ Image uploaded</span>
            <span className="ai-step done">✓ Text extracted via OCR</span>
            <span className="ai-step active">
              <span className="ai-step-dot" /> Generating recommendations
            </span>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'results' && result && (
        <div className="rec-results">
          <div className="rec-results-header">
            <div className="rec-results-meta">
              <span className="rec-results-count">
                {result.recommendations.length} Job Matches Found
              </span>
              {levelInfo && (
                <span
                  className="rec-level-badge"
                  style={{ color: levelInfo.color, background: levelInfo.bg }}
                >
                  {levelInfo.label} Level
                </span>
              )}
            </div>
            <button
              id="rec-reset-btn"
              className="rec-reset-btn"
              onClick={handleReset}
              aria-label="Upload a new resume"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.58" />
              </svg>
              New Resume
            </button>
          </div>

          <div className="rec-cards-grid">
            {result.recommendations.map((job, idx) => (
              <RecommendationCard key={idx} job={job} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
