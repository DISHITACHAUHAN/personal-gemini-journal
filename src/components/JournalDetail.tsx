import React, { useState } from "react";
import { JournalEntry, JournalMessage } from "../types";
import { summarizeConversation, getCompanionReply } from "../lib/aiService";
import { saveConversationSummary, updateJournalEntry } from "../lib/journalService";
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Edit3,
  Trash2,
  Download,
  ShieldCheck,
  HeartHandshake,
  HelpCircle,
  Tag,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Target,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface JournalDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
  onUpdate?: (updated: JournalEntry) => void;
}

export const JournalDetail: React.FC<JournalDetailProps> = ({
  entry,
  onBack,
  onEdit,
  onDelete,
  onUpdate,
}) => {
  // Conversation state
  const initialMessages: JournalMessage[] =
    entry.messages && entry.messages.length > 0
      ? entry.messages
      : [
          {
            role: "user",
            content: entry.content,
            timestamp: entry.createdAt,
          },
        ];

  const [messages, setMessages] = useState<JournalMessage[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Summarization state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarySuccessMsg, setSummarySuccessMsg] = useState<string | null>(null);

  const formattedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entry, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `journal_${entry.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMarkdown = () => {
    const md = `# ${entry.title}
Date: ${formattedDate}
Mood: ${entry.mood || "Reflective"}
Tags: ${(entry.tags || []).join(", ")}

---

## Content
${entry.content}

${
  entry.summary
    ? `
---
## AI Summary
${entry.summary}
`
    : ""
}

${
  entry.keyThoughts && entry.keyThoughts.length > 0
    ? `
### Key Thoughts
${entry.keyThoughts.map((kt) => `- ${kt}`).join("\n")}
`
    : ""
}

${
  entry.takeaways && entry.takeaways.length > 0
    ? `
### Important Takeaways
${entry.takeaways.map((t) => `- ${t}`).join("\n")}
`
    : ""
}

${
  entry.reflection
    ? `
---
## Cognitive Reflection & Reframing
*Sentiment: ${entry.reflection.sentiment}*

${entry.reflection.reflection}

### Themes
${(entry.reflection.themes || []).map((t) => `- ${t}`).join("\n")}

### Guiding Questions
${(entry.reflection.guidingQuestions || []).map((q) => `- ${q}`).join("\n")}
`
    : ""
}
`;
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `journal_${entry.id}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Send message to AI companion
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean || isSending || isSummarizing) return;

    setSendError(null);
    setIsSending(true);

    const userMsg: JournalMessage = {
      role: "user",
      content: clean,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText("");

    try {
      // Call secure server-side companion
      const reply = await getCompanionReply(
        newHistory,
        entry.title,
        entry.mood,
        entry.content
      );

      const companionMsg: JournalMessage = {
        role: "assistant",
        content: reply || "I hear you. Take a breath and reflect on what feels most central right now.",
        timestamp: new Date().toISOString(),
      };

      const updatedAll = [...newHistory, companionMsg];
      setMessages(updatedAll);

      // Persist conversation messages to authenticated user's Firestore document
      await updateJournalEntry(entry.id, { messages: updatedAll });
      if (onUpdate) {
        onUpdate({ ...entry, messages: updatedAll });
      }
    } catch (err: any) {
      console.error("Message send failed:", err);
      setSendError(err.message || "Failed to receive companion response. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Complete and summarize the conversation with Gemini
  const handleFinishConversation = async () => {
    if (isSummarizing) return;

    setSummaryError(null);
    setSummarySuccessMsg(null);
    setIsSummarizing(true);

    try {
      // 1. Send relevant conversation messages to Gemini via secure server endpoint
      const result = await summarizeConversation(messages, entry.title, entry.mood);

      // 2. Save summary, key thoughts, and takeaways inside user's Firestore journal document
      await saveConversationSummary(entry.id, {
        summary: result.summary,
        keyThoughts: result.keyThoughts,
        takeaways: result.takeaways,
        messages,
      });

      const updatedEntry: JournalEntry = {
        ...entry,
        summary: result.summary,
        keyThoughts: result.keyThoughts,
        takeaways: result.takeaways,
        messages,
        updatedAt: new Date().toISOString(),
      };

      if (onUpdate) {
        onUpdate(updatedEntry);
      }

      setSummarySuccessMsg("Conversation finished and summarized successfully! Saved to your private Firestore vault.");
    } catch (err: any) {
      console.error("Conversation summarization failed:", err);
      setSummaryError(err.message || "Unable to summarize conversation at this time. Please try again.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Navigation & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <button
          id="btn-detail-back"
          onClick={onBack}
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Journal Index
        </button>

        <div className="flex items-center space-x-2">
          <button
            id="btn-detail-export-md"
            onClick={handleExportMarkdown}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Download confidential Markdown"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Markdown
          </button>
          <button
            id="btn-detail-export-json"
            onClick={handleExportJson}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Download raw encrypted-schema JSON"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-400" />
            JSON
          </button>
          <button
            id="btn-detail-edit"
            onClick={() => onEdit(entry)}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1" />
            Edit Entry
          </button>
          <button
            id="btn-detail-delete"
            onClick={() => {
              if (window.confirm("Permanently delete this entry from isolated Firestore storage?")) {
                onDelete(entry.id);
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
            title="Delete Entry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Entry Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            {entry.mood || "Reflective"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100">
            <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
            Tenant Scoped: users/[uid]/journals/{entry.id.slice(0, 8)}...
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {entry.title}
        </h1>

        <div className="flex items-center text-xs text-slate-400 space-x-2 font-mono">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Summarization Status Alerts */}
      {isSummarizing && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center space-x-3 shadow-xs">
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
          <div>
            <p className="font-semibold text-indigo-950">Generating AI Conversation Synthesis with Gemini...</p>
            <p className="text-indigo-700 text-[11px] mt-0.5">
              Securely processing dialogue server-side to extract concise summary, key thoughts, and important takeaways.
            </p>
          </div>
        </div>
      )}

      {summaryError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start justify-between shadow-xs">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Summarization Error</p>
              <p className="text-rose-700 text-[11px] mt-0.5">{summaryError}</p>
            </div>
          </div>
          <button
            onClick={handleFinishConversation}
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-rose-800 bg-white border border-rose-200 rounded hover:bg-rose-100 transition-colors shrink-0 ml-3"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </button>
        </div>
      )}

      {summarySuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{summarySuccessMsg}</span>
        </div>
      )}

      {/* AI Structured Summary, Key Thoughts & Important Takeaways Card */}
      {(entry.summary || (entry.keyThoughts && entry.keyThoughts.length > 0) || (entry.takeaways && entry.takeaways.length > 0)) && (
        <section className="bg-white border border-indigo-100 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-indigo-950 uppercase tracking-widest">
                AI Conversation Summary & Insights
              </h2>
            </div>
            <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-semibold">
              Gemini Powered • Owner-Only
            </span>
          </div>

          {/* Concise Summary */}
          {entry.summary && (
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Concise Summary
              </h3>
              <p className="text-sm text-slate-800 leading-relaxed bg-slate-50/70 p-4 rounded-lg border border-slate-200 font-normal">
                {entry.summary}
              </p>
            </div>
          )}

          {/* Key Thoughts */}
          {entry.keyThoughts && entry.keyThoughts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span>Key Thoughts</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {entry.keyThoughts.map((thought, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-lg text-xs text-amber-950 flex items-start space-x-2 leading-relaxed"
                  >
                    <span className="text-amber-600 font-bold shrink-0 mt-0.5">•</span>
                    <span>{thought}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Important Takeaways */}
          {entry.takeaways && entry.takeaways.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span>Important Takeaways</span>
              </div>
              <ul className="space-y-2">
                {entry.takeaways.map((takeaway, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-lg text-xs text-emerald-950 flex items-start space-x-2.5 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Main Journal Content */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="prose prose-slate max-w-none text-slate-800 text-base leading-relaxed whitespace-pre-wrap font-sans">
          {entry.content}
        </div>

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            {entry.tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reflective Journal Conversation Area */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                Journal Dialogue & Conversation ({messages.length} exchanges)
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Converse with your AI companion, then finish to generate a structured synthesis.
            </p>
          </div>

          {/* Primary Action: Finish Conversation & Summarize */}
          <button
            id="btn-finish-conversation"
            type="button"
            onClick={handleFinishConversation}
            disabled={isSummarizing || messages.length === 0}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 shrink-0"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Summarizing with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Finish Conversation & Summarize
              </>
            )}
          </button>
        </div>

        {/* Message Exchanges Stream */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl text-xs leading-relaxed border ${
                msg.role === "assistant"
                  ? "bg-indigo-50/60 border-indigo-100 text-indigo-950"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
                <span className={msg.role === "assistant" ? "text-indigo-700 font-bold" : "text-slate-600 font-bold"}>
                  {msg.role === "assistant" ? "AI Reflective Companion" : "Author (You)"}
                </span>
                {msg.timestamp && (
                  <span className="text-slate-400 font-mono font-normal">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}

          {isSending && (
            <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100 text-indigo-800 text-xs flex items-center space-x-2 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>AI Companion is reflecting...</span>
            </div>
          )}
        </div>

        {sendError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{sendError}</span>
          </div>
        )}

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <input
              id="input-companion-message"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Continue the conversation or ask your companion for reflection..."
              disabled={isSending || isSummarizing}
              className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              id="btn-send-companion-message"
              type="submit"
              disabled={!inputText.trim() || isSending || isSummarizing}
              className="inline-flex items-center px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs disabled:opacity-40 shrink-0"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Send
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            When you've finished exploring this entry, click &ldquo;Finish Conversation &amp; Summarize&rdquo; above to automatically generate and save your summary, key thoughts, and takeaways.
          </p>
        </form>
      </section>

      {/* AI Reflective Synthesis Panel (Original Cognitive Reframing) */}
      {entry.reflection && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                Cognitive Reflection & Reframing
              </h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {entry.reflection.sentiment}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <HeartHandshake className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
              <div className="flex-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Empathetic Perspective
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {entry.reflection.reflection}
                </p>
              </div>
            </div>

            {entry.reflection.themes && entry.reflection.themes.length > 0 && (
              <div className="pl-7">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Core Themes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {entry.reflection.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {entry.reflection.guidingQuestions && entry.reflection.guidingQuestions.length > 0 && (
              <div className="pl-7 pt-2">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Forward-Looking Questions</span>
                </div>
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-slate-600">
                  {entry.reflection.guidingQuestions.map((q, i) => (
                    <li key={i} className="leading-relaxed">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
