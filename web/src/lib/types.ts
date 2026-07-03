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
