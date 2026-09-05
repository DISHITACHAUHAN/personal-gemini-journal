export interface JournalMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface ReflectionData {
  reflection: string;
  summary?: string;
  themes: string[];
  sentiment: string;
  guidingQuestions: string[];
}

export interface ConversationSummaryResult {
  summary: string;
  keyThoughts: string[];
  takeaways: string[];
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  messages: JournalMessage[];
  summary: string;
  keyThoughts?: string[];
  takeaways?: string[];
  mood?: string;
  tags?: string[];
  reflection?: ReflectionData | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action:
    | "AUTH_LOGIN"
    | "AUTH_LOGOUT"
    | "AUTH_REGISTER"
    | "ENTRY_CREATE"
    | "ENTRY_UPDATE"
    | "ENTRY_DELETE"
    | "AI_REFLECTION"
    | "INSIGHTS_GENERATION"
    | "DATA_EXPORT";
  timestamp: string;
  details: string;
  status: "SUCCESS" | "DENIED" | "FLAGGED";
}

export interface SecurityFinding {
  type: string;
  warning: string;
}

export interface SecurityCheckResult {
  safe: boolean;
  findings: SecurityFinding[];
}

export interface WritingPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

export interface RecurringTheme {
  id: string;
  theme: string;
  frequency: number;
  description: string;
  impact: "Positive" | "Growth Area" | "Neutral";
  relatedTags: string[];
}

export interface KeyReflection {
  id: string;
  title: string;
  observation: string;
  growthPoint: string;
  entryReferences?: string[];
}

export interface SuggestedAction {
  id: string;
  title: string;
  action: string;
  category: "Habit" | "Mindset" | "Action" | "Boundary" | "Wellness";
  priority: "High" | "Medium" | "Low";
  rationale: string;
  completed?: boolean;
}

export interface MoodTrendPoint {
  date: string;
  formattedDate: string;
  title: string;
  mood: string;
  score: number; // 1 to 5 numeric scale
  sentiment: string;
}

export interface MoodTrendAnalysis {
  timeline: MoodTrendPoint[];
  dominantMood: string;
  overallSentiment: string;
  sentimentTrajectory: "Upward & Constructive" | "Stable & Grounded" | "Fluctuating & Resilient" | "Needs Care & Support";
  trajectorySummary: string;
  moodDistribution: { mood: string; count: number; percentage: number }[];
  positiveRatio: number;
}

export interface UserInsights {
  id: string;
  userId: string;
  generatedAt: string;
  analyzedEntriesCount: number;
  summaryOverview: string;
  recurringThemes: RecurringTheme[];
  keyReflections: KeyReflection[];
  suggestedActions: SuggestedAction[];
  moodTrend: MoodTrendAnalysis;
}
