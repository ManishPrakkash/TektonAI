// File: src/components/RecommendationCard.tsx

import { useState } from 'react';
import type { JobRecommendation } from '../services/aiService';

interface RecommendationCardProps {
  job: JobRecommendation;
  index: number;
}

// Parse match score number from string like "85%" → 85
function parseScore(score: string): number {
  return parseInt(score.replace('%', '').trim(), 10) || 0;
}

// Score color based on value
function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

// Score bar trackColor (low-opacity version of score color)
function getScoreTrackColor(score: number): string {
  if (score >= 80) return 'rgba(34,197,94,0.15)';
  if (score >= 60) return 'rgba(245,158,11,0.15)';
  return 'rgba(239,68,68,0.15)';
}

export default function RecommendationCard({ job, index }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const score = parseScore(job.match_score);
  const scoreColor = getScoreColor(score);
  const trackColor = getScoreTrackColor(score);

  return (
    <div
      className="rec-card"
      style={{ animationDelay: `${index * 120}ms` }}
      id={`rec-card-${index}`}
    >
      {/* Card Header */}
      <div className="rec-card-header">
        <div className="rec-card-left">
          <div className="rec-job-index">0{index + 1}</div>
          <div>
            <h3 className="rec-job-title">{job.job_title}</h3>
            <p className="rec-confidence">{job.confidence_reason}</p>
          </div>
        </div>

        {/* Match Score Ring */}
        <div className="rec-score-wrapper" title={`Match Score: ${job.match_score}`}>
          <svg width="60" height="60" viewBox="0 0 60 60">
            {/* Track */}
            <circle
              cx="30"
              cy="30"
              r="24"
              fill="none"
              stroke={trackColor}
              strokeWidth="5"
            />
            {/* Progress */}
            <circle
              cx="30"
              cy="30"
              r="24"
              fill="none"
              stroke={scoreColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 150.796} 150.796`}
              strokeDashoffset="0"
              transform="rotate(-90 30 30)"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <span className="rec-score-label" style={{ color: scoreColor }}>
            {job.match_score}
          </span>
        </div>
      </div>

      {/* Reason */}
      <p className="rec-reason">{job.reason}</p>

      {/* Skills Row */}
      <div className="rec-skills-row">
        <div className="rec-skills-group">
          <span className="rec-skills-label">Required</span>
          <div className="rec-tags">
            {job.required_skills.slice(0, 4).map((s) => (
              <span key={s} className="rec-tag rec-tag-required">
                {s}
              </span>
            ))}
            {job.required_skills.length > 4 && (
              <span className="rec-tag rec-tag-more">+{job.required_skills.length - 4}</span>
            )}
          </div>
        </div>
        <div className="rec-skills-group">
          <span className="rec-skills-label rec-label-gap">Skill Gap</span>
          <div className="rec-tags">
            {job.skill_gap.length === 0 ? (
              <span className="rec-tag rec-tag-none">None 🎉</span>
            ) : (
              job.skill_gap.slice(0, 3).map((s) => (
                <span key={s} className="rec-tag rec-tag-gap">
                  {s}
                </span>
              ))
            )}
            {job.skill_gap.length > 3 && (
              <span className="rec-tag rec-tag-more">+{job.skill_gap.length - 3}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expand Toggle */}
      <button
        className="rec-expand-btn"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse details' : 'Expand details'}
      >
        {expanded ? 'Hide Details' : 'View Recommended Skills'}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded Section */}
      {expanded && (
        <div className="rec-expanded">
          <span className="rec-skills-label" style={{ marginBottom: '10px', display: 'block' }}>
            📈 Recommended Next Skills
          </span>
          <div className="rec-tags">
            {job.recommended_next_skills.map((s) => (
              <span key={s} className="rec-tag rec-tag-next">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
