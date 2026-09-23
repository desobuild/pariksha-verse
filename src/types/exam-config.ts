/**
 * Typed exam configuration model.
 * 
 * Generic representation of scoring rules, exam structure, duration,
 * and syllabus metadata so that no specific exam (NEET, JEE, UPSC, etc.)
 * is hardcoded into application behavior.
 */

export interface ScoringRule {
  correctMarks: number;
  incorrectMarks: number;
  unattemptedMarks: number;
}

export interface ExamSectionConfig {
  name: string;
  subjectSlug: string;
  totalQuestions: number;
  mandatoryQuestions?: number;
  scoringRule: ScoringRule;
}

export interface ExamScoringConfig {
  totalMarks: number;
  defaultRule: ScoringRule;
  durationMinutes: number;
  totalQuestions: number;
  sections?: ExamSectionConfig[];
  negativeMarking: boolean;
  syllabusVersion?: string;
  passingCriteriaDescription?: string;
}

export interface ExamMetadata {
  officialConductingBody?: string;
  officialWebsite?: string;
  eligibilityNotes?: string;
  cycleYear?: number;
  [key: string]: unknown;
}
