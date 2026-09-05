import React, { useState, useEffect } from "react";
import { auth, onAuthStateChanged, fbSignOut, User } from "./lib/firebase";
import {
  subscribeToJournals,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  recordAuditLog,
} from "./lib/journalService";
import { JournalEntry, ReflectionData, JournalMessage } from "./types";
import { Navbar } from "./components/Navbar";
import { AuthView } from "./components/AuthView";
import { JournalEditor } from "./components/JournalEditor";
import { JournalCard } from "./components/JournalCard";
import { JournalDetail } from "./components/JournalDetail";
import { SecurityAuditModal } from "./components/SecurityAuditModal";
import { WritingPromptsModal } from "./components/WritingPromptsModal";
import { InsightsDashboard } from "./components/InsightsDashboard";
import {
  Search,
  BookOpen,
  Plus,
  ShieldCheck,
  Sparkles,
  Lock,
  Layers,
  Filter,
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Journal data states
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  // Views & navigation
  const [viewMode, setViewMode] = useState<"list" | "editor" | "detail" | "insights">("list");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  // Modals
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>("ALL");

  // Track Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        setEntries([]);
        setViewMode("list");
        setSelectedEntry(null);
        setActivePrompt(null);
        setShowSecurityModal(false);
        setShowPromptsModal(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore subscription to users/{uid}/journals
  useEffect(() => {
    if (!user) return;

    setEntriesLoading(true);
    setEntriesError(null);

    const unsubscribe = subscribeToJournals(
      (loadedEntries) => {
        setEntries(loadedEntries);
        setEntriesLoading(false);

        // Update selected entry if currently viewing detail
        setSelectedEntry((prev) => {
          if (!prev) return null;
          const updated = loadedEntries.find((e) => e.id === prev.id);
          return updated || prev;
        });
      },
      (err) => {
        console.warn("Failed to load user journals:", err);
        setEntriesError("Could not retrieve journal entries. Please verify permissions.");
        setEntriesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSaveEntry = async (data: {
    title: string;
    content: string;
    mood: string;
    tags: string[];
    reflection?: ReflectionData | null;
    messages?: JournalMessage[];
    summary?: string;
    keyThoughts?: string[];
    takeaways?: string[];
  }) => {
    if (selectedEntry) {
      await updateJournalEntry(selectedEntry.id, data);
    } else {
      const newEntry = await createJournalEntry(data);
      setSelectedEntry(newEntry);
    }
    setViewMode("list");
    setSelectedEntry(null);
    setActivePrompt(null);
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteJournalEntry(id);
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
      setViewMode("list");
    }
  };

  const handleSignOut = async () => {
    try {
      if (user) {
        await recordAuditLog(
          "AUTH_LOGOUT",
          `Signed out session: ${user.email || user.uid}`
        );
      }
      await fbSignOut(auth);
    } catch (err: any) {
      console.warn("Sign-out warning:", err);
    } finally {
      setUser(null);
      setEntries([]);
      setViewMode("list");
      setSelectedEntry(null);
      setActivePrompt(null);
      setShowSecurityModal(false);
      setShowPromptsModal(false);
    }
  };

  const handleSelectPrompt = (promptText: string) => {
    setActivePrompt(promptText);
    setSelectedEntry(null);
    setShowPromptsModal(false);
    setViewMode("editor");
  };

  // Filtered entries
  const filteredEntries = entries.filter((entry) => {
    const matchesQuery =
      searchQuery.trim() === "" ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.tags && entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesMood =
      selectedMoodFilter === "ALL" || entry.mood === selectedMoodFilter;

    return matchesQuery && matchesMood;
  });

  // Calculate statistics
  const reflectedCount = entries.filter((e) => !!e.reflection).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-slate-600">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Lock className="w-4 h-4 text-white animate-pulse" />
          </div>
          <span className="text-xs font-mono font-medium text-slate-500">
            Validating security session...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar */}
      <Navbar
        user={user}
        currentView={viewMode}
        onNavigate={(nav) => {
          setViewMode(nav);
          setSelectedEntry(null);
        }}
        onNewEntry={() => {
          setSelectedEntry(null);
          setActivePrompt(null);
          setViewMode("editor");
        }}
        onOpenSecurityModal={() => setShowSecurityModal(true)}
        onOpenPromptsModal={() => setShowPromptsModal(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {!user ? (
          <AuthView onAuthSuccess={() => setViewMode("list")} />
        ) : viewMode === "editor" ? (
          <JournalEditor
            initialEntry={selectedEntry}
            initialPrompt={activePrompt}
            onSave={handleSaveEntry}
            onCancel={() => {
              setViewMode("list");
              setSelectedEntry(null);
              setActivePrompt(null);
            }}
          />
        ) : viewMode === "detail" && selectedEntry ? (
          <JournalDetail
            entry={selectedEntry}
            onBack={() => {
              setViewMode("list");
              setSelectedEntry(null);
            }}
            onEdit={(entry) => {
              setSelectedEntry(entry);
              setViewMode("editor");
            }}
            onDelete={handleDeleteEntry}
            onUpdate={(updated) => {
              setSelectedEntry(updated);
            }}
          />
        ) : viewMode === "insights" ? (
          <InsightsDashboard
            user={user}
            entries={entries}
            onNewEntry={() => {
              setSelectedEntry(null);
              setActivePrompt(null);
              setViewMode("editor");
            }}
            onOpenEntry={(entry) => {
              setSelectedEntry(entry);
              setViewMode("detail");
            }}
          />
        ) : (
          /* List View / Dashboard */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* AI Reflection & Insights Feature Callout */}
            <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/60 rounded-xl border border-indigo-100 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      AI Reflection & Insights Dashboard
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                      Longitudinal Synthesis
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Analyze recurring themes, cognitive reflections, actionable habits, and mood trends across your private journal history.
                  </p>
                </div>
              </div>
              <button
                id="btn-goto-insights"
                onClick={() => setViewMode("insights")}
                className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Open Insights Dashboard
              </button>
            </div>

            {/* Top Stat Banner (Professional Polish Metric Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Private Journal Entries
                </p>
                <div className="flex items-end justify-between">
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-800">{entries.length}</span>
                    <span className="text-xs text-emerald-600 pb-0.5 font-medium">Active</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <div className="w-full h-1 bg-slate-100 mt-3 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-indigo-600"></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  AI Cognitive Reflections
                </p>
                <div className="flex items-end justify-between">
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-800">{reflectedCount}</span>
                    <span className="text-xs text-indigo-600 pb-0.5 font-medium">Gemini 2.5</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="w-full h-1 bg-slate-100 mt-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: entries.length > 0 ? `${Math.min(100, (reflectedCount / entries.length) * 100)}%` : "0%",
                    }}
                  ></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Isolation Enforcement
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Zero-Trust Scoped</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      users/{user.uid.slice(0, 6)}...
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="w-full h-1 bg-slate-100 mt-3 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-emerald-500"></div>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="search-journals-input"
                  type="text"
                  placeholder="Search entries by title, notes, or #tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Mood Filter */}
              <div className="flex items-center space-x-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center shrink-0">
                  <Filter className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Filter:
                </span>
                {["ALL", "Peaceful", "Grateful", "Reflective", "Challenged", "Focused"].map((m) => (
                  <button
                    key={m}
                    id={`filter-mood-${m.toLowerCase()}`}
                    onClick={() => setSelectedMoodFilter(m)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
                      selectedMoodFilter === m
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Entries Grid */}
            {entriesError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {entriesError}
              </div>
            )}

            {entriesLoading ? (
              <div className="py-16 text-center text-xs text-slate-500 font-mono">
                Decrypting and synchronizing authenticated partition...
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {searchQuery ? "No matching entries found" : "Your private journal is empty"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchQuery
                      ? "Try altering your keyword or clearing the active mood filter."
                      : "Entries are securely stored exclusively under your user ID: users/" +
                        user.uid.slice(0, 8) +
                        ".../journals"}
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-3 pt-2">
                  <button
                    id="btn-empty-prompts"
                    onClick={() => setShowPromptsModal(true)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 inline text-indigo-600" />
                    Get Prompts
                  </button>
                  <button
                    id="btn-empty-new-entry"
                    onClick={() => {
                      setSelectedEntry(null);
                      setActivePrompt(null);
                      setViewMode("editor");
                    }}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Write First Entry
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEntries.map((entry) => (
                  <JournalCard
                    key={entry.id}
                    entry={entry}
                    onSelect={(e) => {
                      setSelectedEntry(e);
                      setViewMode("detail");
                    }}
                    onEdit={(e) => {
                      setSelectedEntry(e);
                      setViewMode("editor");
                    }}
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Security Architecture & Audit Inspector Modal */}
      {showSecurityModal && user && (
        <SecurityAuditModal
          user={user}
          onClose={() => setShowSecurityModal(false)}
        />
      )}

      {/* AI Writing Prompts Modal */}
      {showPromptsModal && user && (
        <WritingPromptsModal
          onSelectPrompt={handleSelectPrompt}
          onClose={() => setShowPromptsModal(false)}
        />
      )}
    </div>
  );
}
