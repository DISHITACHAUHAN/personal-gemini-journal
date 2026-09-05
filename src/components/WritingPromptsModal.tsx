import React, { useState, useEffect } from "react";
import { WritingPrompt } from "../types";
import { fetchWritingPrompts } from "../lib/aiService";
import { Sparkles, Loader2, X, ArrowRight, RefreshCw } from "lucide-react";

interface WritingPromptsModalProps {
  onSelectPrompt: (promptText: string) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { id: "Mindfulness & Gratitude", label: "Mindfulness & Gratitude" },
  { id: "Resilience & Growth", label: "Resilience & Growth" },
  { id: "Work & Clarity", label: "Work-Life Clarity" },
  { id: "Creativity & Dreams", label: "Creativity & Dreams" },
];

export const WritingPromptsModal: React.FC<WritingPromptsModalProps> = ({
  onSelectPrompt,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrompts = async (category: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWritingPrompts(category, "Daily journaling clarity");
      setPrompts(result);
    } catch (err: any) {
      console.error("Failed to load prompts:", err);
      setError(err.message || "Could not generate prompts at this moment. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts(selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Confidential Journaling Prompts
              </h2>
              <p className="text-xs text-slate-500">
                Generated dynamically by server-side Gemini AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-xs font-semibold"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadPrompts(selectedCategory)}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-200/60 transition-colors disabled:opacity-50"
            title="Regenerate Prompts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Generating thoughtful prompts via Gemini...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {prompts.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-200 hover:bg-white transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-900">
                      {p.title}
                    </h3>
                    <button
                      id={`btn-use-prompt-${idx}`}
                      onClick={() => onSelectPrompt(p.prompt)}
                      className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Use Prompt
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    "{p.prompt}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
