import { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up the PDF.js worker using the local bundled file (no CDN needed)
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

interface GrammarError {
  lineNumber: number;
  original: string;
  errorHighlight: string;
  errorType: string;
  suggestion: string;
}

interface ProcessingState {
  stage: 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';
  progress: number;
  message: string;
}

export default function GrammarCheck() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    stage: 'idle',
    progress: 0,
    message: '',
  });
  const [errors, setErrors] = useState<GrammarError[]>([]);
  const [totalSentences, setTotalSentences] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setErrors([]);
      setProcessingState({ stage: 'idle', progress: 0, message: '' });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrors([]);
      setProcessingState({ stage: 'idle', progress: 0, message: '' });
    }
  };

  const extractTextFromPDF = async (pdfFile: File): Promise<string[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const sentences: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Split into sentences
      const pageSentences = pageText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      sentences.push(...pageSentences);
    }

    return sentences;
  };

  const checkGrammarWithGroq = async (sentences: string[]): Promise<GrammarError[]> => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) throw new Error('Missing Groq API key');

    // Process in batches of 15 sentences to avoid token limits
    const batchSize = 15;
    const allErrors: GrammarError[] = [];
    let globalLineNum = 1;

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);
      const numbered = batch.map((s, idx) => `${globalLineNum + idx}. ${s}`).join('\n');

      const prompt = `You are an expert grammar checker. Analyze the following numbered sentences for grammatical errors. 

IMPORTANT: Only return sentences that have ACTUAL grammatical errors. Skip correct sentences entirely.

For each erroneous sentence, respond with a valid JSON array. Each object must have EXACTLY these fields:
- "lineNumber": (the original sentence number as integer)
- "original": (the original sentence text)
- "errorHighlight": (the specific wrong word or phrase, e.g. "go" or "has went")
- "errorType": (brief label like "Wrong tense", "Subject-verb agreement", "Missing article", etc.)
- "suggestion": (the fully corrected sentence)

If no sentences have errors, return an empty array [].

Sentences to check:
${numbered}

Respond ONLY with a valid JSON array. No markdown, no explanation, just raw JSON.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_completion_tokens: 2048,
        }),
      });

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '[]';

      try {
        // Strip any markdown code fences if present
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed: GrammarError[] = JSON.parse(cleaned);
        allErrors.push(...parsed);
      } catch {
        // Skip unparseable batches
      }

      globalLineNum += batch.length;

      // Update progress
      const progress = Math.round(((i + batchSize) / sentences.length) * 100);
      setProcessingState({
        stage: 'analyzing',
        progress: Math.min(progress, 95),
        message: `Analyzing sentences ${i + 1}–${Math.min(i + batchSize, sentences.length)} of ${sentences.length}…`,
      });
    }

    return allErrors;
  };

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      // Stage 1: Extract text
      setProcessingState({ stage: 'extracting', progress: 10, message: 'Extracting text from PDF…' });
      const sentences = await extractTextFromPDF(file);
      setTotalSentences(sentences.length);

      if (sentences.length === 0) {
        setProcessingState({ stage: 'error', progress: 0, message: 'No readable text found in this PDF.' });
        return;
      }

      // Stage 2: Grammar check
      setProcessingState({ stage: 'analyzing', progress: 20, message: 'Starting grammar analysis…' });
      const grammarErrors = await checkGrammarWithGroq(sentences);

      setErrors(grammarErrors);
      setProcessingState({
        stage: 'done',
        progress: 100,
        message: '',
      });
    } catch (err: any) {
      setProcessingState({ stage: 'error', progress: 0, message: err.message || 'An error occurred.' });
    }
  };

  const resetAll = () => {
    setFile(null);
    setErrors([]);
    setTotalSentences(0);
    setProcessingState({ stage: 'idle', progress: 0, message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isProcessing = processingState.stage === 'extracting' || processingState.stage === 'analyzing';

  return (
    <div className="grammar-page">
      {/* Header */}
      <div className="grammar-header">
        <div className="grammar-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
          Grammar Check
        </div>
        <h1 className="grammar-title">Document Grammar Analysis</h1>
        <p className="grammar-subtitle">Upload a PDF to detect grammatical errors with AI-powered precision.</p>
      </div>

      {/* Upload Zone */}
      {processingState.stage !== 'done' && (
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="pdf-upload"
          />

          {!file ? (
            <div className="upload-prompt">
              <div className="upload-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="upload-main-text">Drop your PDF here</p>
              <p className="upload-sub-text">or <span className="upload-link">browse files</span></p>
              <p className="upload-hint">Supports PDF documents up to 50MB</p>
            </div>
          ) : (
            <div className="file-selected">
              <div className="file-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button className="file-remove" onClick={(e) => { e.stopPropagation(); resetAll(); }} title="Remove file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="processing-panel">
          <div className="processing-header">
            <div className="processing-spinner" />
            <span>{processingState.message}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${processingState.progress}%` }} />
          </div>
          <span className="progress-label">{processingState.progress}%</span>
        </div>
      )}

      {/* Error state */}
      {processingState.stage === 'error' && (
        <div className="status-banner error-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {processingState.message}
        </div>
      )}

      {/* Analyze Button */}
      {file && processingState.stage === 'idle' && (
        <button className="analyze-btn" onClick={handleAnalyze} id="analyze-grammar-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Analyze Grammar
        </button>
      )}

      {/* Results */}
      {processingState.stage === 'done' && (
        <div className="results-section">
          {/* Summary bar */}
          <div className="results-summary">
            <div className="summary-stat">
              <span className="summary-num">{totalSentences}</span>
              <span className="summary-label">Sentences Scanned</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-num error-num">{errors.length}</span>
              <span className="summary-label">Errors Found</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-num success-num">
                {Math.max(0, totalSentences - errors.length)}
              </span>
              <span className="summary-label">Correct Sentences</span>
            </div>
            <button className="reset-btn" onClick={resetAll} id="grammar-reset-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" />
              </svg>
              New Analysis
            </button>
          </div>

          {errors.length === 0 ? (
            <div className="no-errors-panel">
              <div className="no-errors-icon">✅</div>
              <h3>No Grammar Errors Found</h3>
              <p>Your document is grammatically correct — great work!</p>
            </div>
          ) : (
            <div className="error-list">
              {errors.map((err, idx) => (
                <div key={idx} className="error-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                  <div className="error-card-header">
                    <span className="error-line-badge">Line {err.lineNumber}</span>
                    <span className="error-type-badge">{err.errorType}</span>
                  </div>

                  <div className="error-row">
                    <span className="error-row-label original-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Original
                    </span>
                    <p className="error-original">
                      {err.original.split(err.errorHighlight).map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <mark className="error-highlight">{err.errorHighlight}</mark>
                          )}
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="error-row">
                    <span className="error-row-label suggestion-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Suggestion
                    </span>
                    <p className="error-suggestion">{err.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
