
export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export type LoadingStates = {
  summary: 'idle' | 'loading' | 'ready' | 'error';
  transcript: 'idle' | 'loading' | 'ready' | 'error';
  quiz: 'idle' | 'loading' | 'ready' | 'error';
};

export type ActiveTab = 'summary' | 'transcript' | 'quiz';
