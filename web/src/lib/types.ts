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
