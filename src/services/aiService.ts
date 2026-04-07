// File: src/services/aiService.ts
//
// SETUP INSTRUCTIONS:
// ─────────────────────────────────────────────────────────────
// 1. Create a `.env` file in the project ROOT (d:\Academics\TektonAI\)
// 2. Add this line:
//      VITE_GEMINI_API_KEY=your-gemini-api-key-here
// 3. Save the file, then restart the dev server: npm run dev
//
// Get your free Gemini API key at:
//   https://aistudio.google.com/app/apikey
// ─────────────────────────────────────────────────────────────

export interface JobRecommendation {
  job_title: string;
  match_score: string;
  reason: string;
  confidence_reason: string;
  required_skills: string[];
  skill_gap: string[];
  recommended_next_skills: string[];
}

export interface RecommendationResult {
  level: string;
  recommendations: JobRecommendation[];
}

// ── Gemini API config ─────────────────────────────────────────────────────
// Using gemini-2.5-flash (stable as of April 2026)
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

// ── Custom error: missing API key ─────────────────────────────────────────
export class ApiKeyMissingError extends Error {
  constructor() {
    super('Gemini API key not configured');
    this.name = 'ApiKeyMissingError';
  }
}

// ── Utility: check key at page load ──────────────────────────────────────
export function isApiKeyConfigured(): boolean {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

// ── System instruction (separate from user content) ───────────────────────
const SYSTEM_INSTRUCTION = `You are a JSON-only API. You output ONLY raw valid JSON with no extra text, 
no explanations, no markdown, no code fences. Every response starts with { and ends with }.`;

// ── Prompt builder ────────────────────────────────────────────────────────
const buildPrompt = (resumeText: string): string =>
  `Analyze this resume and return ONLY a JSON object with exactly this structure:

{
  "level": "<Beginner|Intermediate|Advanced>",
  "recommendations": [
    {
      "job_title": "<role name>",
      "match_score": "<0-100>%",
      "reason": "<2-3 sentences citing resume content>",
      "confidence_reason": "<1 sentence justifying the score>",
      "required_skills": ["<skill1>", "<skill2>"],
      "skill_gap": ["<missing skill1>", "<missing skill2>"],
      "recommended_next_skills": ["<skill1>", "<skill2>"]
    }
  ]
}

Rules:
- Recommend EXACTLY 4 job roles
- All roles must be relevant to this specific resume
- Resume text was extracted via OCR, ignore minor noise
- Keep each "reason" under 2 sentences
- Keep each "confidence_reason" under 1 sentence
- Keep skill arrays concise (max 6 items each)
- Output ONLY the JSON object, nothing else

Resume:
${resumeText}`;

// ── Gemini response type ──────────────────────────────────────────────────
interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

// ── Helper: extract JSON from any string ──────────────────────────────────
function extractJSON(text: string): string | null {
  // Try direct parse first (clean JSON)
  try {
    JSON.parse(text.trim());
    return text.trim();
  } catch { /* continue */ }

  // Find outermost {...} block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch { /* continue */ }
  }

  // Strip markdown fences and retry
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  const s2 = stripped.indexOf('{');
  const e2 = stripped.lastIndexOf('}');
  if (s2 !== -1 && e2 > s2) {
    return stripped.slice(s2, e2 + 1);
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────
export async function getJobRecommendations(
  resumeText: string
): Promise<RecommendationResult> {

  // Step 1: Validate API key
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new ApiKeyMissingError();
  }

  // Step 2: Validate resume text
  if (!resumeText.trim()) {
    throw new Error('Resume text is empty. Please upload a valid resume image.');
  }

  // Step 3: Call Gemini REST API
  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // System instruction tells Gemini to ONLY output JSON
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(resumeText) }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,  // increased to prevent truncation of 4 recommendations
          topP: 0.95,
        },
      }),
    });
  } catch {
    throw new Error(
      'Network error — could not reach Gemini. Check your internet connection.'
    );
  }

  // Step 4: HTTP error handling
  if (!response.ok) {
    const err: GeminiResponse = await response.json().catch(() => ({}));
    const msg = err?.error?.message ?? response.statusText;

    if (response.status === 400) {
      throw new Error(`Gemini request error (400): ${msg}`);
    }
    if (response.status === 403) {
      throw new Error(
        'Gemini API key unauthorized (403). Enable the Generative Language API in Google Cloud Console.'
      );
    }
    if (response.status === 429) {
      throw new Error('Gemini rate limit hit. Please wait a moment and try again.');
    }

    throw new Error(`Gemini API error ${response.status}: ${msg}`);
  }

  // Step 5: Parse the API response envelope
  const data: GeminiResponse = await response.json();

  // Log full response for debugging (visible in browser DevTools → Console)
  console.debug('[TektonAI] Full Gemini response:', JSON.stringify(data, null, 2));

  // Check for prompt block
  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked this request (${data.promptFeedback.blockReason}). Try uploading a clearer resume image.`
    );
  }

  const candidate = data.candidates?.[0];

  if (!candidate) {
    throw new Error('Gemini returned no candidates. Please try again.');
  }

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Gemini safety filter triggered. Try a different resume image.');
  }

  // Truncated response — JSON will be incomplete
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini response was cut off (token limit reached). Please try again — the resume may be very long.'
    );
  }

  const raw = candidate.content?.parts?.[0]?.text ?? '';

  if (!raw.trim()) {
    console.error('[TektonAI] Empty text in candidate. Full data:', data);
    throw new Error(
      `Gemini returned empty text (finishReason: ${candidate.finishReason ?? 'unknown'}). Please try again.`
    );
  }

  console.debug('[TektonAI] Raw text from Gemini:', raw);

  // Step 6: Extract and parse JSON robustly
  const jsonStr = extractJSON(raw);

  if (!jsonStr) {
    console.error('[TektonAI] Cannot find JSON in response. Raw text was:\n', raw);
    throw new Error(
      'Gemini did not return JSON. Check DevTools console for the raw response.'
    );
  }

  try {
    const parsed: RecommendationResult = JSON.parse(jsonStr);

    if (!parsed.level || !Array.isArray(parsed.recommendations)) {
      console.error('[TektonAI] Bad shape:', parsed);
      throw new Error('Gemini response is missing required fields. Please try again.');
    }

    if (parsed.recommendations.length === 0) {
      throw new Error('Gemini returned 0 job recommendations. Please try again.');
    }

    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('[TektonAI] JSON.parse failed on:\n', jsonStr);
      throw new Error('Gemini returned malformed JSON. Please try again.');
    }
    throw e;
  }
}
