import {
  db,
  auth,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
} from "./firebase";
import { JournalEntry, AuditLog, JournalMessage, UserInsights } from "../types";

/**
 * Ensures strict multi-tenant isolation by deriving UID solely from the authenticated Firebase token.
 * Throws immediately if no authenticated user session exists.
 */
function getAuthenticatedUid(): string {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.uid) {
    throw new Error("Security Violation: Action requires an active authenticated session.");
  }
  return currentUser.uid;
}

/**
 * Logs a security or user action in the tamper-proof user audit log subcollection
 */
export async function recordAuditLog(
  action: AuditLog["action"],
  details: string,
  status: AuditLog["status"] = "SUCCESS"
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.uid) {
      return;
    }
    const uid = currentUser.uid;
    const logId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const logRef = doc(db, "users", uid, "auditLogs", logId);

    const logEntry: AuditLog = {
      id: logId,
      userId: uid,
      action,
      timestamp: new Date().toISOString(),
      details: details.slice(0, 500),
      status,
    };

    await setDoc(logRef, logEntry);
  } catch (error) {
    console.warn("Audit logging encountered non-fatal error:", error);
  }
}

/**
 * Subscribes in real-time to the current authenticated user's journal entries.
 * Strictly scoped to `users/{uid}/journals`.
 */
export function subscribeToJournals(
  onData: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  const uid = getAuthenticatedUid();
  const journalsRef = collection(db, "users", uid, "journals");
  const q = query(journalsRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      onData(entries);
    },
    (err) => {
      console.warn("Firestore subscription notice:", err);
      onError(err);
    }
  );
}

/**
 * Subscribes to the tamper-proof audit logs for the current user
 */
export function subscribeToAuditLogs(
  onData: (logs: AuditLog[]) => void,
  onError: (error: Error) => void
): () => void {
  const uid = getAuthenticatedUid();
  const logsRef = collection(db, "users", uid, "auditLogs");
  const q = query(logsRef, orderBy("timestamp", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push(docSnap.data() as AuditLog);
      });
      onData(logs);
    },
    (err) => {
      console.warn("Audit log subscription notice:", err);
      onError(err);
    }
  );
}

/**
 * Creates a new journal entry inside `users/{uid}/journals/{journalId}`
 */
export async function createJournalEntry(data: {
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  reflection?: JournalEntry["reflection"];
  messages?: JournalMessage[];
  summary?: string;
  keyThoughts?: string[];
  takeaways?: string[];
}): Promise<JournalEntry> {
  const uid = getAuthenticatedUid();

  // Strict client-side validation before writing to database
  const cleanTitle = data.title.trim();
  const cleanContent = data.content.trim();

  if (!cleanTitle) {
    throw new Error("Validation Error: Title cannot be empty.");
  }
  if (cleanTitle.length > 200) {
    throw new Error("Validation Error: Title cannot exceed 200 characters.");
  }
  if (!cleanContent) {
    throw new Error("Validation Error: Content cannot be empty.");
  }
  if (cleanContent.length > 30000) {
    throw new Error("Validation Error: Content cannot exceed 30,000 characters.");
  }

  const entryId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const entryRef = doc(db, "users", uid, "journals", entryId);

  // Initialize conversation messages
  const initialMessages: JournalMessage[] =
    data.messages && data.messages.length > 0
      ? data.messages
      : [
          { role: "user", content: cleanContent, timestamp: new Date().toISOString() },
          ...(data.reflection?.reflection
            ? [{ role: "assistant" as const, content: data.reflection.reflection, timestamp: new Date().toISOString() }]
            : []),
        ];

  // Derive concise generated summary
  const summaryText =
    data.summary?.trim() ||
    data.reflection?.summary?.trim() ||
    (data.reflection?.reflection
      ? data.reflection.reflection.slice(0, 280)
      : cleanContent.slice(0, 180) + (cleanContent.length > 180 ? "..." : ""));

  const entry: JournalEntry = {
    id: entryId,
    userId: uid, // Strictly bound to authenticated user
    title: cleanTitle,
    content: cleanContent,
    messages: initialMessages,
    summary: summaryText,
    keyThoughts: data.keyThoughts || [],
    takeaways: data.takeaways || [],
    mood: data.mood || "Neutral",
    tags: (data.tags || []).slice(0, 8),
    reflection: data.reflection || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(entryRef, entry);
  await recordAuditLog("ENTRY_CREATE", `Created journal entry "${cleanTitle.slice(0, 30)}..."`);
  return entry;
}

/**
 * Updates an existing journal entry inside `users/{uid}/journals/{journalId}`
 */
export async function updateJournalEntry(
  id: string,
  updates: {
    title?: string;
    content?: string;
    mood?: string;
    tags?: string[];
    reflection?: JournalEntry["reflection"];
    messages?: JournalMessage[];
    summary?: string;
    keyThoughts?: string[];
    takeaways?: string[];
  }
): Promise<void> {
  const uid = getAuthenticatedUid();
  const entryRef = doc(db, "users", uid, "journals", id);

  const payload: Record<string, any> = {
    userId: uid, // Ensure ownership invariant
    updatedAt: new Date().toISOString(),
  };

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) throw new Error("Title cannot be empty.");
    if (cleanTitle.length > 200) throw new Error("Title cannot exceed 200 characters.");
    payload.title = cleanTitle;
  }

  if (updates.content !== undefined) {
    const cleanContent = updates.content.trim();
    if (!cleanContent) throw new Error("Content cannot be empty.");
    if (cleanContent.length > 30000) throw new Error("Content cannot exceed 30,000 characters.");
    payload.content = cleanContent;
  }

  if (updates.mood !== undefined) {
    payload.mood = updates.mood;
  }

  if (updates.tags !== undefined) {
    payload.tags = updates.tags.slice(0, 8);
  }

  if (updates.reflection !== undefined) {
    payload.reflection = updates.reflection;
  }

  if (updates.messages !== undefined) {
    payload.messages = updates.messages;
  }

  if (updates.summary !== undefined) {
    payload.summary = updates.summary.trim();
  }

  if (updates.keyThoughts !== undefined) {
    payload.keyThoughts = updates.keyThoughts;
  }

  if (updates.takeaways !== undefined) {
    payload.takeaways = updates.takeaways;
  }

  await updateDoc(entryRef, payload);
  await recordAuditLog("ENTRY_UPDATE", `Updated journal entry ID: ${id}`);
}

/**
 * Saves completed AI conversation summary, key thoughts, and takeaways
 * directly to the authenticated user's Firestore journal document: users/{uid}/journals/{journalId}
 */
export async function saveConversationSummary(
  journalId: string,
  summaryData: {
    summary: string;
    keyThoughts: string[];
    takeaways: string[];
    messages?: JournalMessage[];
  }
): Promise<void> {
  const uid = getAuthenticatedUid();
  const entryRef = doc(db, "users", uid, "journals", journalId);

  const payload: Record<string, any> = {
    userId: uid,
    summary: summaryData.summary.trim(),
    keyThoughts: summaryData.keyThoughts,
    takeaways: summaryData.takeaways,
    updatedAt: new Date().toISOString(),
  };

  if (summaryData.messages) {
    payload.messages = summaryData.messages;
  }

  await updateDoc(entryRef, payload);
  await recordAuditLog("AI_REFLECTION", `Generated automatic AI conversation summary for journal ID: ${journalId}`);
}

/**
 * Deletes a journal entry from `users/{uid}/journals/{journalId}`
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  const uid = getAuthenticatedUid();
  const entryRef = doc(db, "users", uid, "journals", id);

  await deleteDoc(entryRef);
  await recordAuditLog("ENTRY_DELETE", `Deleted journal entry ID: ${id}`);
}

/**
 * Persists an AI Reflection & Insights snapshot into the authenticated user's
 * Firestore subcollection: users/{uid}/insights/{insightId} and users/{uid}/insights/latest
 */
export async function saveUserInsightsSnapshot(insights: UserInsights): Promise<void> {
  const uid = getAuthenticatedUid();
  const latestRef = doc(db, "users", uid, "insights", "latest");
  const histRef = doc(db, "users", uid, "insights", insights.id);

  await setDoc(latestRef, insights);
  await setDoc(histRef, insights);
  await recordAuditLog(
    "INSIGHTS_GENERATION",
    `Generated AI Reflection & Insights analyzing ${insights.analyzedEntriesCount} user journal entries.`
  );
}

/**
 * Retrieves the latest cached AI Reflection & Insights snapshot for the authenticated user
 */
export async function loadLatestUserInsights(): Promise<UserInsights | null> {
  const uid = getAuthenticatedUid();
  const latestRef = doc(db, "users", uid, "insights", "latest");
  const snapshot = await getDoc(latestRef);

  if (snapshot.exists()) {
    return snapshot.data() as UserInsights;
  }
  return null;
}

/**
 * Updates completion status of a suggested action in the latest insights snapshot
 */
export async function updateInsightActionStatus(
  actionId: string,
  completed: boolean
): Promise<void> {
  const uid = getAuthenticatedUid();
  const latestRef = doc(db, "users", uid, "insights", "latest");
  const snapshot = await getDoc(latestRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as UserInsights;
    const updatedActions = data.suggestedActions.map((act) =>
      act.id === actionId ? { ...act, completed } : act
    );
    await updateDoc(latestRef, { suggestedActions: updatedActions });
  }
}
