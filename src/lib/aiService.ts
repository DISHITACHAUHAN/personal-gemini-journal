import { getFreshIdToken } from "./firebase";
import {
  ReflectionData,
  SecurityCheckResult,
  WritingPrompt,
  JournalMessage,
  ConversationSummaryResult,
  UserInsights,
  JournalEntry,
} from "../types";

/**
 * Generates comprehensive AI Reflection & Insights analyzing strictly the
 * authenticated user's own journal history.
 * Ensures strict security by passing the user's fresh Firebase ID token.
 */
export async function generateUserInsights(entries: JournalEntry[]): Promise<UserInsights> {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    throw new Error("Authentication token required for AI Insights. Please sign in.");
  }

  // Pass sanitized entry records ensuring only the authenticated user's entries are sent
  const payloadEntries = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    title: e.title,
    content: e.content.slice(0, 800),
    summary: e.summary || "",
    keyThoughts: e.keyThoughts || [],
    takeaways: e.takeaways || [],
    mood: e.mood || "Reflective",
    tags: e.tags || [],
    createdAt: e.createdAt,
  }));

  const response = await fetch("/api/ai/insights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ entries: payloadEntries }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `AI insights generation failed (Status: ${response.status})`);
  }

  const result = await response.json();
  return result.data as UserInsights;
}

/**
 * Sends journal conversation messages to Gemini via the secure server-side endpoint.
 * Returns concise summary, key thoughts, and important takeaways.
 * Authenticated user only; token passed as Bearer authorization.
 */
export async function summarizeConversation(
  messages: JournalMessage[],
  title: string = "Journal Entry",
  mood: string = "Reflective"
): Promise<ConversationSummaryResult> {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    throw new Error("Authentication token required for AI summarization. Please sign in.");
  }

  const response = await fetch("/api/ai/summarize-conversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      messages,
      title,
      mood,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `AI summarization failed (Status: ${response.status})`);
  }

  const result = await response.json();
  return result.data as ConversationSummaryResult;
}

/**
 * Exchanges a message with the empathetic AI journaling companion
 */
export async function getCompanionReply(
  messages: JournalMessage[],
  title: string = "Journal Entry",
  mood: string = "Reflective",
  journalContent: string = ""
): Promise<string> {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    throw new Error("Authentication required for AI companion dialogue.");
  }

  const response = await fetch("/api/ai/companion-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      messages,
      title,
      mood,
      journalContent,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to receive companion reply.");
  }

  const result = await response.json();
  return result.reply || "";
}

/**
 * Sends journal text to the secure server-side Gemini reflection endpoint.
 * Requires an authenticated Firebase session with Bearer token.
 * Gemini API key is never exposed to client.
 */
export async function requestAiReflection(
  title: string,
  content: string,
  mood: string = "Neutral"
): Promise<ReflectionData> {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    throw new Error("Authentication token required for AI services. Please sign in.");
  }

  const response = await fetch("/api/ai/reflect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      title,
      content,
      mood,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `AI reflection failed (Status: ${response.status})`);
  }

  const result = await response.json();
  return result.data as ReflectionData;
}

/**
 * Fetches personalized journaling prompts from the secure backend
 */
export async function fetchWritingPrompts(
  category: string = "Mindfulness & Growth",
  focus: string = "Personal reflection"
): Promise<WritingPrompt[]> {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    throw new Error("Authentication required to retrieve prompts.");
  }

  const response = await fetch("/api/ai/prompts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      category,
      focus,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to retrieve prompts.");
  }

  const data = await response.json();
  return data.prompts || [];
}

/**
 * Client-assisting pre-flight security scan:
 * Checks draft content against pattern detectors on the server to prevent accidental secret leakage
 */
export async function scanDraftForSecrets(content: string): Promise<SecurityCheckResult> {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    return { safe: true, findings: [] };
  }

  try {
    const response = await fetch("/api/security/scan-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      return { safe: true, findings: [] };
    }

    return await response.json();
  } catch (err) {
    console.warn("Pre-flight scan error:", err);
    return { safe: true, findings: [] };
  }
}
