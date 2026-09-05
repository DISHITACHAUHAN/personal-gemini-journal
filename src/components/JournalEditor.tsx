import React, { useState, useEffect } from "react";
import { JournalEntry, ReflectionData, JournalMessage } from "../types";
import {
  requestAiReflection,
  scanDraftForSecrets,
  summarizeConversation,
  getCompanionReply,
} from "../lib/aiService";
import {
  Sparkles,
  ShieldAlert,
  Check,
  X,
  Tag,
  Loader2,
  HeartHandshake,
  HelpCircle,
  MessageSquare,
  Send,
  Lightbulb,
  Target,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface JournalEditorProps {
  initialEntry?: JournalEntry | null;
  initialPrompt?: string | null;
  onSave: (data: {
    title: string;
    content: string;
    mood: string;
    tags: string[];
    reflection?: ReflectionData | null;
    messages?: JournalMessage[];
    summary?: string;
    keyThoughts?: string[];
    takeaways?: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

const MOOD_OPTIONS = [
  { id: "Peaceful", label: "Peaceful", emoji: "🌿" },
  { id: "Grateful", label: "Grateful", emoji: "✨" },
  { id: "Reflective", label: "Reflective", emoji: "💭" },
  { id: "Challenged", label: "Challenged", emoji: "⛰️" },
  { id: "Focused", label: "Focused", emoji: "🎯" },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  initialEntry,
  initialPrompt,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialEntry?.title || "");
  const [content, setContent] = useState(initialEntry?.content || initialPrompt || "");
  const [mood, setMood] = useState(initialEntry?.mood || "Reflective");
  const [tags, setTags] = useState<string[]>(initialEntry?.tags || []);
  const [currentTagInput, setCurrentTagInput] = useState("");
  const [reflection, setReflection] = useState<ReflectionData | null>(initialEntry?.reflection || null);

  // Summary, Key Thoughts, Takeaways, and Conversation Messages state
  const [summary, setSummary] = useState<string>(initialEntry?.summary || "");
  const [keyThoughts, setKeyThoughts] = useState<string[]>(initialEntry?.keyThoughts || []);
  const [takeaways, setTakeaways] = useState<string[]>(initialEntry?.takeaways || []);
  const [messages, setMessages] = useState<JournalMessage[]>(initialEntry?.messages || []);

  // Companion Chat inside Editor
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Summarization State
  const [isSummarizingConversation, setIsSummarizingConversation] = useState(false);
  const [conversationSummaryError, setConversationSummaryError] = useState<string | null>(null);
  const [conversationSuccessMsg, setConversationSuccessMsg] = useState<string | null>(null);

  // States
  const [isSaving, setIsSaving] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [secretWarnings, setSecretWarnings] = useState<string[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Periodic debounce scan for accidental secrets in draft
  useEffect(() => {
    if (!content.trim()) {
      setSecretWarnings([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await scanDraftForSecrets(content);
        if (!result.safe && result.findings.length > 0) {
          setSecretWarnings(result.findings.map((f) => f.warning));
        } else {
          setSecretWarnings([]);
        }
      } catch {
        // Silent failure for optional security pre-flight
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [content]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = currentTagInput.trim().replace(/^#/, "").toLowerCase();
      if (clean && !tags.includes(clean) && tags.length < 8) {
        setTags([...tags, clean]);
        setCurrentTagInput("");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Send message to companion in editor
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean || isChatSending || isSummarizingConversation) return;

    setChatError(null);
    setIsChatSending(true);

    const userMsg: JournalMessage = {
      role: "user",
      content: clean,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setChatInput("");

    try {
      const reply = await getCompanionReply(
        newHistory,
        title || "Journal Entry",
        mood,
        content
      );

      const companionMsg: JournalMessage = {
        role: "assistant",
        content: reply || "I hear you. Take a moment to sit with that feeling.",
        timestamp: new Date().toISOString(),
      };

      setMessages([...newHistory, companionMsg]);
    } catch (err: any) {
      console.error("Companion chat error:", err);
      setChatError(err.message || "Failed to receive companion response.");
    } finally {
      setIsChatSending(false);
    }
  };

  // Trigger Conversation Summarization
  const handleFinishConversation = async () => {
    // Collect all relevant conversation messages
    const convoMessages: JournalMessage[] =
      messages.length > 0
        ? messages
        : [
            {
              role: "user",
              content: content.trim() || title.trim() || "Journal reflection entry",
              timestamp: new Date().toISOString(),
            },
            ...(reflection?.reflection
              ? [
                  {
                    role: "assistant" as const,
                    content: reflection.reflection,
                    timestamp: new Date().toISOString(),
                  },
                ]
              : []),
          ];

    if (convoMessages.length === 0 || (!content.trim() && messages.length === 0)) {
      setConversationSummaryError("Please write your journal entry or have a dialogue before generating a summary.");
      return;
    }

    setConversationSummaryError(null);
    setConversationSuccessMsg(null);
    setIsSummarizingConversation(true);

    try {
      const result = await summarizeConversation(convoMessages, title || "Journal Entry", mood);
      setSummary(result.summary);
      setKeyThoughts(result.keyThoughts);
      setTakeaways(result.takeaways);
      if (messages.length === 0) {
        setMessages(convoMessages);
      }
      setConversationSuccessMsg("Conversation finished! Summary, key thoughts, and takeaways generated with Gemini.");
    } catch (err: any) {
      console.error("Conversation summarization error:", err);
      setConversationSummaryError(err.message || "Failed to summarize conversation. Please try again.");
    } finally {
      setIsSummarizingConversation(false);
    }
  };

  const handleTriggerAiReflection = async () => {
    if (!content.trim()) {
      setReflectionError("Please write some journal content before requesting AI reflection.");
      return;
    }

    setReflectionError(null);
    setIsReflecting(true);

    try {
      const data = await requestAiReflection(title || "Untitled Entry", content, mood);
      setReflection(data);
    } catch (err: any) {
      console.error("AI Reflection failed:", err);
      setReflectionError(err.message || "Failed to generate reflection. Server-side Gemini service is busy.");
    } finally {
      setIsReflecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditorError(null);

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle) {
      setEditorError("Please provide a title for your journal entry.");
      return;
    }
    if (cleanTitle.length > 200) {
      setEditorError("Title exceeds 200 characters limit.");
      return;
    }
    if (!cleanContent) {
      setEditorError("Journal content cannot be empty.");
      return;
    }
    if (cleanContent.length > 30000) {
      setEditorError("Content exceeds 30,000 characters limit.");
      return;
    }

    setIsSaving(true);
    try {
      const userMsg: JournalMessage = {
        role: "user",
        content: cleanContent,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages: JournalMessage[] =
        messages.length > 0
          ? messages
          : [
              userMsg,
              ...(reflection?.reflection
                ? [
                    {
                      role: "assistant" as const,
                      content: reflection.reflection,
                      timestamp: new Date().toISOString(),
                    },
                  ]
                : []),
            ];

      const fallbackSummary =
        summary.trim() ||
        reflection?.summary ||
        (reflection?.reflection
          ? reflection.reflection.slice(0, 280)
          : cleanContent.slice(0, 180) + (cleanContent.length > 180 ? "..." : ""));

      await onSave({
        title: cleanTitle,
        content: cleanContent,
        mood,
        tags,
        reflection,
        messages: updatedMessages,
        summary: fallbackSummary,
        keyThoughts: keyThoughts.length > 0 ? keyThoughts : undefined,
        takeaways: takeaways.length > 0 ? takeaways : undefined,
      });
    } catch (err: any) {
      console.error("Save error:", err);
      setEditorError(err.message || "Failed to save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {initialEntry ? "Edit Journal Entry" : "New Secure Journal Entry"}
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Isolated tenant storage: users/[uid]/journals
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="btn-editor-cancel"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-editor-save"
            type="submit"
            disabled={isSaving || isSummarizingConversation}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Encrypting &amp; Saving...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Save &amp; Encrypt Entry
              </>
            )}
          </button>
        </div>
      </div>

      {/* Secret / Key warnings if user accidentally pasted credentials */}
      {secretWarnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Sensitive Pattern Warning Detected</span>
          </div>
          <ul className="text-xs text-amber-700 list-disc pl-5 space-y-1">
            {secretWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-600">
            While your journal is tenant-isolated and encrypted, avoid writing production secrets into reflections.
          </p>
        </div>
      )}

      {/* Editor Main Form Errors */}
      {editorError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
          <X className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{editorError}</span>
        </div>
      )}

      {/* Title & Mood Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="journal-title-input" className="text-xs font-semibold text-slate-700">
            Entry Title
          </label>
          <input
            id="journal-title-input"
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Navigating Team Growth & Focus"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="journal-mood-select" className="text-xs font-semibold text-slate-700">
            Current State
          </label>
          <select
            id="journal-mood-select"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          >
            {MOOD_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tagging */}
      <div className="space-y-2">
        <label htmlFor="journal-tags-input" className="text-xs font-semibold text-slate-700">
          Tags (max 8)
        </label>
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center text-xs font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 text-slate-400 hover:text-rose-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {tags.length < 8 && (
            <input
              id="journal-tags-input"
              type="text"
              value={currentTagInput}
              onChange={(e) => setCurrentTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={tags.length === 0 ? "Type a tag and press Enter..." : "Add more..."}
              className="px-2 py-0.5 text-xs bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-hidden"
            />
          )}
        </div>
      </div>

      {/* Main Journal Content Area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="journal-content-textarea" className="text-xs font-semibold text-slate-700">
            Journal Reflection
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            {content.length} / 30,000 characters
          </span>
        </div>
        <textarea
          id="journal-content-textarea"
          rows={10}
          maxLength={30000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your honest thoughts, reflections, experiences, or dilemmas here..."
          className="w-full px-4 py-3 text-sm leading-relaxed bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-sans"
        />
      </div>

      {/* Reflective AI Companion Dialogue & Automatic Summarization */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                AI Companion Dialogue &amp; Automatic Summarization
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Converse with your AI companion, then finish to extract a concise summary, key thoughts, and takeaways.
            </p>
          </div>

          <button
            id="btn-editor-finish-conversation"
            type="button"
            onClick={handleFinishConversation}
            disabled={isSummarizingConversation || (!content.trim() && messages.length === 0)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 shrink-0"
          >
            {isSummarizingConversation ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Summarizing with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Finish Conversation &amp; Summarize
              </>
            )}
          </button>
        </div>

        {/* Status Alerts */}
        {isSummarizingConversation && (
          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center space-x-2">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            <span>Sending conversation to Gemini server-side to generate concise summary, key thoughts, and takeaways...</span>
          </div>
        )}

        {conversationSummaryError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{conversationSummaryError}</span>
            </div>
            <button
              type="button"
              onClick={handleFinishConversation}
              className="text-xs font-semibold text-rose-900 underline ml-2 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {conversationSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{conversationSuccessMsg}</span>
          </div>
        )}

        {/* Generated Summary, Key Thoughts, and Takeaways Preview */}
        {(summary || keyThoughts.length > 0 || takeaways.length > 0) && (
          <div className="p-4 bg-slate-50 border border-indigo-100 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-950 uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Generated AI Conversation Summary</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSummary("");
                  setKeyThoughts([]);
                  setTakeaways([]);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline"
              >
                Clear
              </button>
            </div>

            {summary && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Concise Summary
                </p>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                  {summary}
                </p>
              </div>
            )}

            {keyThoughts.length > 0 && (
              <div>
                <div className="flex items-center space-x-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  <span>Key Thoughts</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {keyThoughts.map((kt, i) => (
                    <li
                      key={i}
                      className="p-2.5 bg-white border border-amber-200/80 rounded-lg text-xs text-amber-950 flex items-start space-x-2"
                    >
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>{kt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {takeaways.length > 0 && (
              <div>
                <div className="flex items-center space-x-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  <Target className="w-3 h-3 text-emerald-600" />
                  <span>Important Takeaways</span>
                </div>
                <ul className="space-y-1.5">
                  {takeaways.map((t, i) => (
                    <li
                      key={i}
                      className="p-2.5 bg-white border border-emerald-200/80 rounded-lg text-xs text-emerald-950 flex items-start space-x-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Existing Messages */}
        {messages.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  m.role === "assistant"
                    ? "bg-indigo-50/50 border border-indigo-100 text-indigo-950"
                    : "bg-slate-50 border border-slate-200 text-slate-800"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                  {m.role === "assistant" ? "AI Companion" : "You"}
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Interactive Chat Input */}
        <div className="pt-2">
          <div className="flex items-center space-x-2">
            <input
              id="input-editor-chat-message"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask your AI companion questions or share more context..."
              disabled={isChatSending || isSummarizingConversation}
              className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              id="btn-editor-send-chat"
              type="button"
              onClick={handleSendChatMessage}
              disabled={!chatInput.trim() || isChatSending || isSummarizingConversation}
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs disabled:opacity-40 shrink-0"
            >
              {isChatSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3 h-3 mr-1" />
                  Chat
                </>
              )}
            </button>
          </div>
          {chatError && (
            <p className="text-[11px] text-rose-600 mt-1">{chatError}</p>
          )}
        </div>
      </div>

      {/* Server-Side Gemini AI Reflection Assistant Trigger (Reframing & Questions) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Cognitive Reflection &amp; Reframing
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Requests an empathetic, non-judgmental analysis powered securely by Gemini on the server.
            </p>
          </div>

          <button
            id="btn-trigger-ai-reflection"
            type="button"
            onClick={handleTriggerAiReflection}
            disabled={isReflecting || !content.trim()}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-xs disabled:opacity-50 shrink-0"
          >
            {isReflecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-indigo-600" />
                Reflecting via Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {reflection ? "Refresh Reflection" : "Generate Reflection"}
              </>
            )}
          </button>
        </div>

        {reflectionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {reflectionError}
          </div>
        )}

        {/* Display Current Reflection */}
        {reflection && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HeartHandshake className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Reflective Synthesis ({reflection.sentiment})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReflection(null)}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Clear
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {reflection.reflection}
            </p>

            {reflection.themes && reflection.themes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Identified Themes:</span>
                {reflection.themes.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {reflection.guidingQuestions && reflection.guidingQuestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-700">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Guiding Questions to Consider:</span>
                </div>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  {reflection.guidingQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </form>
  );
};
