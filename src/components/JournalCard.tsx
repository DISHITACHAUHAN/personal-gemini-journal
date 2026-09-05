import React from "react";
import { JournalEntry } from "../types";
import { Sparkles, Calendar, Tag, Trash2, Edit3, ArrowRight } from "lucide-react";

interface JournalCardProps {
  entry: JournalEntry;
  onSelect: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  entry,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const formattedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article
      id={`journal-card-${entry.id}`}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all shadow-sm flex flex-col justify-between"
    >
      <div>
        {/* Card Header: Mood & Date */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {entry.mood || "Reflective"}
            </span>
            {entry.reflection && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
                Reflected
              </span>
            )}
          </div>
          <div className="flex items-center text-[11px] text-slate-400 font-mono">
            <Calendar className="w-3 h-3 mr-1 text-slate-400" />
            {formattedDate}
          </div>
        </div>

        {/* Title */}
        <h3
          onClick={() => onSelect(entry)}
          className="text-base font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors line-clamp-1"
        >
          {entry.title}
        </h3>

        {/* Content or Summary Preview */}
        {entry.summary ? (
          <div className="mt-2 text-xs text-slate-700 bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5">
            <div className="font-semibold text-indigo-950 flex items-center space-x-1 mb-1 text-[11px]">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>AI Conversation Summary:</span>
            </div>
            <p className="line-clamp-2 text-slate-700 font-normal">{entry.summary}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-3">
            {entry.content}
          </p>
        )}

        {/* Key Thoughts & Takeaways Pill Badges */}
        {((entry.keyThoughts && entry.keyThoughts.length > 0) || (entry.takeaways && entry.takeaways.length > 0)) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.keyThoughts && entry.keyThoughts.length > 0 && (
              <span className="inline-flex items-center text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {entry.keyThoughts.length} Key Thought{entry.keyThoughts.length > 1 ? "s" : ""}
              </span>
            )}
            {entry.takeaways && entry.takeaways.length > 0 && (
              <span className="inline-flex items-center text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {entry.takeaways.length} Takeaway{entry.takeaways.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {entry.tags.slice(0, 4).map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
        <button
          id={`btn-read-${entry.id}`}
          onClick={() => onSelect(entry)}
          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Read Entry
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>

        <div className="flex items-center space-x-1">
          <button
            id={`btn-edit-${entry.id}`}
            onClick={() => onEdit(entry)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
            title="Edit Entry"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            id={`btn-delete-${entry.id}`}
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this private journal entry?")) {
                onDelete(entry.id);
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
            title="Delete Entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
