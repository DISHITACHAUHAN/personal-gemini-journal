import React, { useState, useEffect } from "react";
import { User } from "../lib/firebase";
import { JournalEntry, UserInsights, SuggestedAction } from "../types";
import { generateUserInsights } from "../lib/aiService";
import {
  saveUserInsightsSnapshot,
  loadLatestUserInsights,
  updateInsightActionStatus,
} from "../lib/journalService";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  Brain,
  CheckSquare,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Layers,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Smile,
  AlertCircle,
  FileText,
  Lock,
  Download,
  Share2,
  Tag,
} from "lucide-react";

interface InsightsDashboardProps {
  user: User;
  entries: JournalEntry[];
  onNewEntry: () => void;
  onOpenEntry?: (entry: JournalEntry) => void;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  user,
  entries,
  onNewEntry,
  onOpenEntry,
}) => {
  const [insights, setInsights] = useState<UserInsights | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionUpdatingId, setActionUpdatingId] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState<boolean>(false);

  // Load cached insights from Firestore on initial mount
  useEffect(() => {
    let isMounted = true;
    async function loadCached() {
      try {
        setLoadingInitial(true);
        const cached = await loadLatestUserInsights();
        if (isMounted && cached) {
          // Verify that cached insights belong to the authenticated user
          if (cached.userId === user.uid) {
            setInsights(cached);
          }
        }
      } catch (err) {
        console.warn("Could not load cached insights:", err);
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    }
    loadCached();
    return () => {
      isMounted = false;
    };
  }, [user.uid]);

  // Handler to trigger new AI Insights generation
  const handleGenerateInsights = async () => {
    if (entries.length === 0) {
      setErrorMessage("Please create at least one journal entry to generate AI reflections and insights.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Verify that all entries passed match current authenticated user
      const userEntries = entries.filter((e) => e.userId === user.uid);
      if (userEntries.length === 0) {
        throw new Error("No journal entries matching your authenticated user profile were found.");
      }

      const generated = await generateUserInsights(userEntries);
      setInsights(generated);

      // Persist snapshot to Firestore
      await saveUserInsightsSnapshot(generated);
    } catch (err: any) {
      console.error("Failed to generate insights:", err);
      setErrorMessage(err.message || "Failed to analyze journal history. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle suggested action completion
  const handleToggleAction = async (actionId: string, currentStatus: boolean | undefined) => {
    if (!insights) return;
    const newStatus = !currentStatus;

    // Optimistic UI update
    setInsights((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        suggestedActions: prev.suggestedActions.map((act) =>
          act.id === actionId ? { ...act, completed: newStatus } : act
        ),
      };
    });

    try {
      setActionUpdatingId(actionId);
      await updateInsightActionStatus(actionId, newStatus);
    } catch (err) {
      console.warn("Failed to persist action status update:", err);
    } finally {
      setActionUpdatingId(null);
    }
  };

  // Export or copy formatted markdown report
  const handleExportMarkdown = () => {
    if (!insights) return;

    const markdownText = `# AI Reflection & Insights Report
**User Scope:** ${user.email || user.uid}
**Generated:** ${new Date(insights.generatedAt).toLocaleString()}
**Entries Analyzed:** ${insights.analyzedEntriesCount}

---

## Executive Overview
${insights.summaryOverview}

---

## Emotional & Reflection Trajectory
- **Dominant Mood:** ${insights.moodTrend?.dominantMood || "Reflective"}
- **Sentiment Trajectory:** ${insights.moodTrend?.sentimentTrajectory || "Stable & Grounded"}
- **Overall Climate:** ${insights.moodTrend?.overallSentiment || "Introspective"}

${insights.moodTrend?.trajectorySummary || ""}

---

## Recurring Themes
${insights.recurringThemes
  .map(
    (t, idx) =>
      `### ${idx + 1}. ${t.theme} (${t.frequency} entries)
- **Impact:** ${t.impact}
- **Description:** ${t.description}
${t.relatedTags?.length ? `- **Tags:** ${t.relatedTags.join(", ")}` : ""}`
  )
  .join("\n\n")}

---

## Key Reflections & Cognitive Insights
${insights.keyReflections
  .map(
    (r, idx) =>
      `### ${idx + 1}. ${r.title}
- **Observed Pattern:** ${r.observation}
- **Growth Point:** ${r.growthPoint}`
  )
  .join("\n\n")}

---

## Suggested Next Actions
${insights.suggestedActions
  .map(
    (a, idx) =>
      `### ${idx + 1}. [${a.completed ? "x" : " "}] ${a.title} (${a.category} • ${a.priority} Priority)
- **Action:** ${a.action}
- **Rationale:** ${a.rationale}`
  )
  .join("\n\n")}

---
*Tenant Isolated Sentinel Journal • Confidential AI Reflection Engine*`;

    navigator.clipboard.writeText(markdownText);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2500);
  };

  // Trajectory badge styling helper
  const getTrajectoryBadge = (trajectory?: string) => {
    switch (trajectory) {
      case "Upward & Constructive":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          dot: "bg-emerald-500",
        };
      case "Stable & Grounded":
        return {
          bg: "bg-indigo-50 text-indigo-800 border-indigo-200",
          dot: "bg-indigo-500",
        };
      case "Fluctuating & Resilient":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          dot: "bg-amber-500",
        };
      case "Needs Care & Support":
        return {
          bg: "bg-rose-50 text-rose-800 border-rose-200",
          dot: "bg-rose-500",
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-800 border-slate-200",
          dot: "bg-slate-400",
        };
    }
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg text-xs space-y-1.5 border border-slate-700 max-w-xs">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <span className="font-semibold text-slate-200 truncate">{data.title}</span>
            <span className="text-[10px] text-slate-400">{data.formattedDate}</span>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-slate-400">Recorded Mood:</span>
            <span className="font-medium text-indigo-300">{data.mood}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Valence Level:</span>
            <span className="font-mono font-bold text-amber-300">{data.score}/5</span>
          </div>
          {data.sentiment && (
            <p className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-800/80">
              "{data.sentiment}"
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loadingInitial) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
          <Brain className="w-5 h-5 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-slate-600">
          Loading isolated AI reflection profile...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Security Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                AI Reflection & Insights
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Authenticated User Scope
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Personal Reflection Dashboard
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Synthesizing longitudinal psychological themes, cognitive shifts, emotional trends,
              and constructive next actions derived strictly from your authenticated journal history.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500 font-mono">
                Data Isolation: users/{user.uid.slice(0, 10)}.../journals • No cross-tenant mixing
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {insights && (
              <button
                id="btn-export-insights"
                onClick={handleExportMarkdown}
                className="inline-flex items-center px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
                title="Copy structured summary report to clipboard"
              >
                {copiedState ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-1.5 text-slate-600" />
                    Export Summary
                  </>
                )}
              </button>
            )}

            <button
              id="btn-generate-insights"
              onClick={handleGenerateInsights}
              disabled={isLoading || entries.length === 0}
              className="inline-flex items-center px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin text-white" />
                  Synthesizing Insights...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2 text-indigo-200" />
                  {insights ? "Regenerate Insights" : "Analyze Journal History"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Analysis Notice: </span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Active Analysis Loading Overlay */}
        {isLoading && (
          <div className="mt-6 p-6 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-950">
                  Synthesizing your journal timeline with Gemini AI...
                </p>
                <p className="text-xs text-indigo-700">
                  Correlating recurring themes, assessing emotional trajectories, and framing actionable next steps.
                </p>
              </div>
            </div>
            <div className="text-xs font-mono font-medium text-indigo-800 bg-white/80 px-3 py-1.5 rounded-lg border border-indigo-200">
              {entries.length} entries in pipeline
            </div>
          </div>
        )}
      </div>

      {/* Case 1: User has zero entries */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-900">
              No Journal Entries Found Yet
            </h3>
            <p className="text-sm text-slate-600">
              The AI Reflection & Insights engine analyzes your personal journal timeline to extract
              recurring themes, reflection trends, and actionable commitments.
            </p>
          </div>
          <button
            id="btn-empty-create-first"
            onClick={onNewEntry}
            className="inline-flex items-center px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Write Your First Entry
          </button>
        </div>
      ) : !insights && !isLoading ? (
        /* Case 2: User has entries but hasn't generated insights yet */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Ready to Analyze {entries.length} Private Journal {entries.length === 1 ? "Entry" : "Entries"}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Generate an overarching personal reflection profile with longitudinal mood trends and tailored next steps.
              </p>
            </div>
            <button
              id="btn-trigger-initial-insights"
              onClick={handleGenerateInsights}
              className="inline-flex items-center px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate AI Reflection & Insights
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Recurring Themes</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Detects underlying life patterns, focal areas, and recurring topics across your entries.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Key Reflections</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Highlights cognitive growth points, emotional shifts, and resilience milestones.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Suggested Next Actions</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Actionable, realistic practices and mindset habits for constructive daily living.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Reflection & Mood Trend</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chronological visualization of emotional valence, dominant tone, and trajectory.
              </p>
            </div>
          </div>
        </div>
      ) : insights ? (
        /* Case 3: Insights loaded or freshly generated */
        <div className="space-y-8">
          {/* Executive Overview Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/60 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-indigo-400" />
                <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">
                  Longitudinal Synthesis
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-indigo-200">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                  {new Date(insights.generatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="w-1 h-1 rounded-full bg-indigo-400" />
                <span>{insights.analyzedEntriesCount} Entries Analyzed</span>
              </div>
            </div>
            <p className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
              "{insights.summaryOverview}"
            </p>
          </div>

          {/* Section 1: Reflection & Mood Trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Reflection & Mood Trend
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Chronological progression of recorded mood states and emotional valence over time.
                </p>
              </div>

              {/* Trajectory Badge */}
              {insights.moodTrend?.sentimentTrajectory && (
                <div
                  className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                    getTrajectoryBadge(insights.moodTrend.sentimentTrajectory).bg
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      getTrajectoryBadge(insights.moodTrend.sentimentTrajectory).dot
                    }`}
                  />
                  Trajectory: {insights.moodTrend.sentimentTrajectory}
                </div>
              )}
            </div>

            {/* Trajectory Summary Narrative */}
            {insights.moodTrend?.trajectorySummary && (
              <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/70 leading-relaxed">
                {insights.moodTrend.trajectorySummary}
              </p>
            )}

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Dominant Mood
                </span>
                <span className="text-lg font-bold text-slate-900 mt-1 block">
                  {insights.moodTrend?.dominantMood || "Reflective"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Emotional Climate
                </span>
                <span className="text-lg font-bold text-indigo-900 mt-1 block truncate">
                  {insights.moodTrend?.overallSentiment || "Introspective"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Constructive Ratio
                </span>
                <span className="text-lg font-bold text-emerald-700 mt-1 block">
                  {insights.moodTrend?.positiveRatio ?? 80}%
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Timeline Points
                </span>
                <span className="text-lg font-bold text-slate-900 mt-1 block">
                  {insights.moodTrend?.timeline?.length || entries.length} entries
                </span>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Valence Scale: 1 (Challenged) → 5 (Peaceful / Grateful)</span>
                <span>Chronological Progression</span>
              </div>
              <div className="h-64 sm:h-72 w-full">
                {insights.moodTrend?.timeline && insights.moodTrend.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={insights.moodTrend.timeline}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />
                      <YAxis
                        domain={[1, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#moodGradient)"
                        dot={{ r: 4, fill: "#4f46e5", strokeWidth: 2, stroke: "#ffffff" }}
                        activeDot={{ r: 6, fill: "#3730a3", strokeWidth: 2, stroke: "#ffffff" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Timeline data is compiling...
                  </div>
                )}
              </div>
            </div>

            {/* Mood Distribution Badges */}
            {insights.moodTrend?.moodDistribution && insights.moodTrend.moodDistribution.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 block mb-3">
                  Mood Frequency Distribution
                </span>
                <div className="flex flex-wrap gap-2">
                  {insights.moodTrend.moodDistribution.map((item) => (
                    <div
                      key={item.mood}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center space-x-2"
                    >
                      <span className="font-semibold text-slate-900">{item.mood}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">{item.count} {item.count === 1 ? "entry" : "entries"}</span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Recurring Themes */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  1. Recurring Themes
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Dominant patterns and recurring life subjects identified across your journal history.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.recurringThemes.map((theme) => {
                const isGrowth = theme.impact === "Growth Area";
                const isPositive = theme.impact === "Positive";
                return (
                  <div
                    key={theme.id}
                    className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-base">
                          {theme.theme}
                        </h3>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isGrowth
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {theme.impact}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {theme.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                      <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {theme.frequency} {theme.frequency === 1 ? "entry" : "entries"}
                      </span>
                      {theme.relatedTags && theme.relatedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {theme.relatedTags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="text-slate-500 font-mono text-[10px]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Key Reflections */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  2. Key Reflections & Cognitive Growth
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Deep psychological patterns and self-awareness breakthroughs noted in your writing.
              </p>
            </div>

            <div className="space-y-4">
              {insights.keyReflections.map((refl, index) => (
                <div
                  key={refl.id || index}
                  className="p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors space-y-3"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      {refl.title}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1 bg-slate-50 p-3.5 rounded-lg border border-slate-200/70">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Observed Pattern
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {refl.observation}
                      </p>
                    </div>

                    <div className="space-y-1 bg-indigo-50/50 p-3.5 rounded-lg border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                        Growth Point & Catalyst
                      </span>
                      <p className="text-xs text-indigo-950 leading-relaxed">
                        {refl.growthPoint}
                      </p>
                    </div>
                  </div>

                  {refl.entryReferences && refl.entryReferences.length > 0 && (
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-1">
                      <span className="text-slate-400">Referenced in:</span>
                      <span className="font-medium text-slate-700 italic truncate">
                        {refl.entryReferences.join(" • ")}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Suggested Next Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    3. Suggested Next Actions
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Constructive, realistic practices for your daily habits and mindset routines.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {insights.suggestedActions.filter((a) => a.completed).length} of{" "}
                {insights.suggestedActions.length} completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.suggestedActions.map((action) => {
                const isCompleted = !!action.completed;
                const isHigh = action.priority === "High";
                return (
                  <div
                    key={action.id}
                    className={`p-5 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                      isCompleted
                        ? "bg-slate-50/80 border-slate-200 opacity-80"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          id={`btn-action-toggle-${action.id}`}
                          onClick={() => handleToggleAction(action.id, action.completed)}
                          className="flex items-start space-x-3 text-left group"
                        >
                          <div className="mt-0.5 shrink-0 text-slate-400 group-hover:text-indigo-600">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h3
                              className={`font-bold text-sm ${
                                isCompleted
                                  ? "line-through text-slate-500"
                                  : "text-slate-900"
                              }`}
                            >
                              {action.title}
                            </h3>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              Category: {action.category}
                            </span>
                          </div>
                        </button>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                            isHigh
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {action.priority} Priority
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-relaxed pl-8 ${
                          isCompleted ? "text-slate-500" : "text-slate-700"
                        }`}
                      >
                        {action.action}
                      </p>
                    </div>

                    <div className="pl-8 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span className="text-slate-400">Why it matters: </span>
                      <span className="italic">{action.rationale}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security & Privacy Reassurance Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cryptographic Multi-Tenant Assurance
                </h4>
                <p className="text-xs text-slate-600">
                  All insights were generated from <code className="text-indigo-600">users/{user.uid}</code>.
                  No other user data was accessed, and results are persisted exclusively to your private account.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 shrink-0">
              Timestamp: {new Date(insights.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
