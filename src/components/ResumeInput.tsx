// File: src/components/ResumeInput.tsx

import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

interface ResumeInputProps {
  onAnalyze: (resumeText: string) => void;
  isLoading: boolean;
  /** When true, locks all action buttons (e.g. API key missing) */
  disabled?: boolean;
}

type OcrStatus = 'idle' | 'processing' | 'done' | 'error';

export default function ResumeInput({ onAnalyze, isLoading, disabled = false }: ResumeInputProps) {
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [ocrStatus, setOcrStatus]       = useState<OcrStatus>('idle');
  const [ocrProgress, setOcrProgress]   = useState(0);
  const [ocrError, setOcrError]         = useState('');
  const [isDragOver, setIsDragOver]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReady = ocrStatus === 'done' && extractedText.length >= 50 && !isLoading && !disabled;

  // ── Handle file selection ──────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setOcrError('Only JPG and PNG images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setOcrError('Image must be under 10 MB.');
      return;
    }

    setOcrError('');
    setExtractedText('');
    setOcrStatus('idle');
    setOcrProgress(0);
    setImageFile(file);

    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // ── OCR via Tesseract.js ───────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!imageFile) return;

    setOcrStatus('processing');
    setOcrProgress(0);
    setExtractedText('');
    setOcrError('');

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();

      const cleaned = text.trim();
      if (cleaned.length < 50) {
        setOcrError('Could not extract enough text. Try a clearer image.');
        setOcrStatus('error');
        return;
      }

      setExtractedText(cleaned);
      setOcrStatus('done');
      setOcrProgress(100);
    } catch {
      setOcrError('OCR failed. Please try a different image.');
      setOcrStatus('error');
    }
  };

  // ── Submit to AI ───────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!isReady) return;
    onAnalyze(extractedText);
  };

  // ── Reset state ────────────────────────────────────────────────────────────
  const handleClear = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedText('');
    setOcrStatus('idle');
    setOcrProgress(0);
    setOcrError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="resume-input-wrapper">

      {/* ── Header ── */}
      <div className="resume-input-header">
        <div className="resume-input-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <div>
          <h2 className="resume-input-title">Upload Your Resume Image</h2>
          <p className="resume-input-subtitle">
            Upload a JPG or PNG of your resume. AI will extract text and generate job matches.
          </p>
        </div>
      </div>

      {/* ── Drop Zone / Preview ── */}
      {!imagePreview ? (
        <div
          className={`resume-drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Upload resume image"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <div className="drop-zone-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </div>
          <p className="drop-zone-title">Drop your resume image here</p>
          <p className="drop-zone-subtitle">or click to browse — JPG, PNG supported</p>
          <span className="drop-zone-badge">Max 10 MB</span>
        </div>
      ) : (
        <div className="resume-preview-wrapper">
          {/* Image Preview */}
          <div className="resume-image-preview">
            <img src={imagePreview} alt="Resume preview" className="preview-img" />
            <button className="preview-clear-btn" onClick={handleClear} aria-label="Remove image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* File Info */}
          <div className="resume-file-info">
            <div className="file-info-name">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>{imageFile?.name}</span>
            </div>
            <span className="file-info-size">
              {imageFile ? (imageFile.size / 1024).toFixed(0) + ' KB' : ''}
            </span>
          </div>

          {/* OCR Progress Bar */}
          {ocrStatus === 'processing' && (
            <div className="ocr-progress-wrapper">
              <div className="ocr-progress-header">
                <span className="ocr-progress-label">
                  <span className="ocr-dot" /> Extracting text from image...
                </span>
                <span className="ocr-progress-pct">{ocrProgress}%</span>
              </div>
              <div className="ocr-progress-track">
                <div
                  className="ocr-progress-fill"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* OCR Error */}
          {ocrStatus === 'error' && (
            <div className="ocr-error-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {ocrError}
            </div>
          )}

          {/* Extracted Text Preview */}
          {ocrStatus === 'done' && extractedText && (
            <div className="ocr-result-preview">
              <div className="ocr-result-header">
                <span className="ocr-result-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Text extracted — {extractedText.length.toLocaleString()} characters
                </span>
              </div>
              <p className="ocr-result-snippet">
                {extractedText.slice(0, 220)}{extractedText.length > 220 ? '...' : ''}
              </p>
            </div>
          )}

          {/* Extract button — shown if not yet run */}
          {ocrStatus === 'idle' && (
            <button
              className="extract-btn"
              onClick={handleExtract}
              aria-label="Extract text from image"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Extract Text from Image
            </button>
          )}

          {/* Retry button after error */}
          {ocrStatus === 'error' && (
            <button className="extract-btn extract-btn-retry" onClick={handleExtract}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.58" />
              </svg>
              Retry Extraction
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id="resume-file-input"
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-label="Resume image file input"
      />

      {/* ── Main Action Button ── */}
      <button
        id="analyze-resume-btn"
        className={`analyze-btn ${isLoading ? 'analyzing' : ''}`}
        onClick={handleSubmit}
        disabled={!isReady}
        aria-label="Upload and get recommendations"
      >
        {isLoading ? (
          <>
            <span className="analyze-spinner" />
            Generating Recommendations...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Upload &amp; Get Recommendations
          </>
        )}
      </button>

      {/* Helper text */}
      {ocrStatus !== 'done' && !isLoading && (
        <p className="upload-helper-text">
          {!imageFile
            ? 'Step 1: Upload a clear image of your resume'
            : ocrStatus === 'processing'
            ? 'Step 2: Extracting text — please wait...'
            : ocrStatus === 'error'
            ? 'Step 2: OCR failed — retry or upload a clearer image'
            : 'Step 2: Click "Extract Text from Image" to process'}
        </p>
      )}
      {ocrStatus === 'done' && !isLoading && (
        <p className="upload-helper-text success-text">
          ✓ Step 3: Text ready — click "Upload &amp; Get Recommendations"
        </p>
      )}
    </div>
  );
}
