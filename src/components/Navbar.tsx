import React from "react";
import {
  ShieldCheck,
  Sparkles,
  Plus,
  LogOut,
  Lock,
  KeyRound,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { User } from "../lib/firebase";

interface NavbarProps {
  user: User | null;
  currentView?: "list" | "editor" | "detail" | "insights";
  onNavigate?: (view: "list" | "insights") => void;
  onNewEntry: () => void;
  onOpenSecurityModal: () => void;
  onOpenPromptsModal: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView = "list",
  onNavigate,
  onNewEntry,
  onOpenSecurityModal,
  onOpenPromptsModal,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Navigation */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => onNavigate && onNavigate("list")}
              title="Return to Journal"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 tracking-tight uppercase text-sm">
                    Sentinel Journal
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase tracking-wide border border-emerald-100 hidden sm:flex items-center">
                    <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                    Isolated Scope
                  </span>
                </div>
                {user && (
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-[150px] sm:max-w-xs">
                    users/{user.uid.slice(0, 8)}.../journals
                  </p>
                )}
              </div>
            </div>

            {/* View Navigation Switcher */}
            {user && onNavigate && (
              <nav className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                <button
                  id="nav-tab-journals"
                  onClick={() => onNavigate("list")}
                  className={`px-3 py-1.5 font-semibold rounded-md transition-all flex items-center ${
                    currentView === "list" || currentView === "detail" || currentView === "editor"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  <span>Journals</span>
                </button>
                <button
                  id="nav-tab-insights"
                  onClick={() => onNavigate("insights")}
                  className={`px-3 py-1.5 font-semibold rounded-md transition-all flex items-center ${
                    currentView === "insights"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 mr-1.5 ${
                      currentView === "insights" ? "text-indigo-200" : "text-indigo-600"
                    }`}
                  />
                  <span>AI Insights</span>
                </button>
              </nav>
            )}
          </div>

          {/* Action Buttons */}
          {user ? (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                id="btn-open-prompts"
                onClick={onOpenPromptsModal}
                className="inline-flex items-center px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
                title="AI Writing Prompts"
              >
                <Sparkles className="w-3.5 h-3.5 sm:mr-1.5 text-indigo-600" />
                <span className="hidden md:inline">Inspiration Prompts</span>
                <span className="hidden sm:inline md:hidden">Prompts</span>
              </button>

              <button
                id="btn-open-security"
                onClick={onOpenSecurityModal}
                className="inline-flex items-center px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                title="Security & Isolation Inspector"
              >
                <KeyRound className="w-3.5 h-3.5 sm:mr-1.5 text-slate-700" />
                <span className="hidden md:inline">Security Architecture</span>
                <span className="hidden sm:inline md:hidden">Security</span>
              </button>

              <button
                id="btn-navbar-new-entry"
                onClick={onNewEntry}
                className="inline-flex items-center px-3 sm:px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">New Entry</span>
              </button>

              <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300 text-[10px] font-bold text-slate-700 uppercase">
                  {user.email ? user.email.slice(0, 2) : "SE"}
                </div>
                <span className="text-xs text-slate-600 font-medium hidden lg:inline max-w-[130px] truncate">
                  {user.email || "Authenticated User"}
                </span>
                <button
                  id="btn-sign-out"
                  onClick={onSignOut}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center text-xs text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
              Tenant Isolation Enforced
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
