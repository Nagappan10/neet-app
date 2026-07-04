export interface Subject {
  id: string;
  name: string;
  order: number;
  chapterCount: number;
  pyqTotal: number;
}

export interface ChapterAnalysis {
  years: string[];
  byYear: Record<string, number>;
  difficulty: { easy: number; medium: number; hard: number };
  topicDetail: {
    name: string;
    total: number;
    byYear: Record<string, number>;
    easy: number;
    medium: number;
    hard: number;
  }[];
  summary: string | null;
  insights: string[];
}

export interface Question {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  difficulty: "easy" | "medium" | "hard";
  type: "mcq" | "assertion_reason" | "diagram" | "statement_match";
  isDiagram: boolean;
  source: string;
  subject: { id: string; name: string };
}

export interface TestQuestion {
  id: string;
  stem: string;
  options: string[];
  type: string;
  isDiagram: boolean;
  subject: { name: string };
}

export interface BuiltTest {
  attemptId: string;
  name: string;
  durationSec: number;
  questions: TestQuestion[];
}

export interface Scorecard {
  attemptId: string;
  score: number;
  correct: number;
  wrong: number;
  unattempted: number;
  total: number;
  maxScore: number;
  sectionBreakdown: Record<
    string,
    { correct: number; wrong: number; unattempted: number; score: number }
  >;
}

export interface AttemptSummary {
  id: string;
  name: string;
  mode: string;
  submittedAt: string;
  score: number;
  correct: number;
  wrong: number;
  unattempted: number;
  total: number;
}

export interface ReviewItem {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  source: string;
  subject: { name: string };
  chosenIndex: number | null;
}

export interface Chapter {
  id: string;
  title: string;
  className: number | null;
  order: number;
  weighting: number;
  ntaIncluded: boolean;
  topics: string[];
  analysis: ChapterAnalysis | null;
}
