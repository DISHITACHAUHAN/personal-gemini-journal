import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  auth,
} from "../lib/firebase";
import { recordAuditLog } from "../lib/journalService";
import { Shield, Lock, CheckCircle2, AlertCircle, Sparkles, KeyRound } from "lucide-react";

interface AuthViewProps {
  onAuthSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);

  // Password hygiene checks
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const isPasswordStrong = hasMinLength && hasNumber && hasLetter;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsOperationNotAllowed(false);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    if (isRegistering) {
      if (!isPasswordStrong) {
        setErrorMessage("Password must be at least 8 characters and contain both letters and numbers.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (userCredential.user) {
          await recordAuditLog("AUTH_REGISTER", `Registered account: ${cleanEmail}`);
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (userCredential.user) {
          await recordAuditLog("AUTH_LOGIN", `Signed in with email: ${cleanEmail}`);
        }
      }
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.warn("Auth flow notice:", err?.code, err?.message);
      let userFriendlyMsg = "Authentication failed. Please verify credentials.";
      if (err.code === "auth/email-already-in-use") {
        userFriendlyMsg = "This email is already registered. Please sign in instead.";
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        userFriendlyMsg = "Invalid email or password. Please check your credentials and try again.";
      } else if (err.code === "auth/invalid-email") {
        userFriendlyMsg = "The email address format is invalid. Please check your email.";
      } else if (err.code === "auth/weak-password") {
        userFriendlyMsg = "The password is too weak. Please use at least 8 characters with letters and numbers.";
      } else if (err.code === "auth/too-many-requests") {
        userFriendlyMsg = "Access temporarily disabled due to multiple failed attempts. Please try again later.";
      } else if (err.code === "auth/user-disabled") {
        userFriendlyMsg = "This account has been disabled. Please contact support.";
      } else if (err.code === "auth/operation-not-allowed") {
        setIsOperationNotAllowed(true);
        userFriendlyMsg =
          "Email & password sign-in is disabled in this Firebase project. Please sign in using Google Identity below.";
      } else if (err.code === "auth/network-request-failed") {
        userFriendlyMsg = "Network error. Please verify your internet connection and retry.";
      } else if (err.message) {
        userFriendlyMsg = err.message.replace(/^Firebase:\s*/, "");
      }
      setErrorMessage(userFriendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setIsOperationNotAllowed(false);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      if (userCredential.user) {
        await recordAuditLog(
          "AUTH_LOGIN",
          `Signed in with Google OAuth: ${userCredential.user.email || userCredential.user.uid}`
        );
      }
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.warn("Google sign-in notice:", err?.code, err?.message);
      if (err.code === "auth/popup-closed-by-user") {
        setErrorMessage("Sign-in cancelled. The Google popup was closed before completing.");
      } else if (err.code === "auth/popup-blocked") {
        setErrorMessage("Sign-in popup was blocked by your browser. Please allow popups for this site and retry.");
      } else if (err.code === "auth/cancelled-popup-request") {
        // Another popup opened; ignore silently
      } else if (err.code === "auth/unauthorized-domain") {
        setErrorMessage(
          "This domain is not authorized for Google Sign-In in Firebase. You can use Email/Password sign-in below."
        );
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setErrorMessage(
          "An account already exists with the same email using a different sign-in method. Please sign in with your original method."
        );
      } else if (err.code === "auth/network-request-failed") {
        setErrorMessage("Network connection error during Google sign-in. Please check your connection and retry.");
      } else {
        setErrorMessage(
          err.message?.replace(/^Firebase:\s*/, "") ||
            "Google authentication could not be completed. Please try again or use email sign-in."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8">
        {/* Security Architecture Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
            Secure Multi-User Journal
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Defense-in-depth architecture with cryptographically enforced data isolation and server-side AI reflections.
          </p>
        </div>

        {/* Security Assurance Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2 shadow-sm">
          <div className="flex items-center text-slate-900 font-semibold space-x-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Zero-Trust Database Isolation Policy</span>
          </div>
          <ul className="space-y-1 pl-5 list-disc text-slate-600">
            <li>Firestore collection isolation: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">users/&#123;uid&#125;/journals</code></li>
            <li>Firestore Security Rules strictly deny cross-user read/write queries</li>
            <li>Gemini AI credentials remain server-side; calls authenticated via Firebase ID tokens</li>
          </ul>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              id="tab-sign-in"
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setErrorMessage(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium text-center border-b-2 transition-colors ${
                !isRegistering
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-register"
              type="button"
              onClick={() => {
                setIsRegistering(true);
                setErrorMessage(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium text-center border-b-2 transition-colors ${
                isRegistering
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              {isOperationNotAllowed && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full mt-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                >
                  <span>Sign in with Google Identity</span>
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="auth-email">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="auth-confirm-password">
                    Confirm password
                  </label>
                  <input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Password strength checklist */}
                <div className="pt-1 text-xs space-y-1">
                  <div className={`flex items-center space-x-1.5 ${hasMinLength ? "text-emerald-700" : "text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "text-emerald-600" : "text-slate-300"}`} />
                    <span>Minimum 8 characters</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasNumber && hasLetter ? "text-emerald-700" : "text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber && hasLetter ? "text-emerald-600" : "text-slate-300"}`} />
                    <span>Includes letters and numbers</span>
                  </div>
                </div>
              </>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {loading
                ? "Securing Session..."
                : isRegistering
                ? "Create User Account"
                : "Sign In Securely"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-mono">or continue with</span>
            </div>
          </div>

          <button
            id="btn-auth-google"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full flex items-center justify-center py-2.5 px-4 bg-white hover:bg-slate-50 border text-slate-700 text-sm font-medium rounded-lg transition-all shadow-xs ${
              isOperationNotAllowed
                ? "border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-700 font-semibold"
                : "border-slate-200"
            }`}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google Identity
          </button>
        </div>
      </div>
    </div>
  );
};
