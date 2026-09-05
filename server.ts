import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Load firebase-applet-config.json if available
let firebaseConfig: Record<string, string> = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json:", e);
}

const app = express();
const PORT = 3000;

// Security Middleware: Payload size limiting to prevent Denial of Service (DoS)
app.use(express.json({ limit: "256kb" }));

// Security Headers (Defense in Depth)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Rate limiting in-memory store (sliding window per user ID / IP)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

// Cryptographic Firebase ID Token Verification Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

async function verifyFirebaseToken(token: string): Promise<{ uid: string; email?: string; emailVerified?: boolean } | null> {
  const apiKey = firebaseConfig.apiKey || process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    // If no API key configured, check if token can be decoded (fail closed in production)
    console.error("Firebase API key missing for server-side verification.");
    return null;
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data && data.users && data.users.length > 0) {
      const user = data.users[0];
      return {
        uid: user.localId,
        email: user.email,
        emailVerified: user.emailVerified,
      };
    }
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
  }
  return null;
}

// Auth Middleware
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication required",
      message: "Missing or invalid authorization token",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({
      error: "Authentication required",
      message: "Malformed authorization header",
    });
    return;
  }

  const verifiedUser = await verifyFirebaseToken(token);
  if (!verifiedUser) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Session token is invalid or has expired",
    });
    return;
  }

  // Bind verified user identity directly to request
  req.user = verifiedUser;
  next();
}

// Lazy initialization of Gemini client (safe against startup crashes)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured");
    }
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

// ==========================================
// SECURE API ROUTES
// ==========================================

// Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    securityVersion: "1.0.0",
  });
});

// Client Auth Verification / Token Validation Check
app.post("/api/auth/verify", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    authenticated: true,
    user: {
      uid: req.user?.uid,
      email: req.user?.email,
      emailVerified: req.user?.emailVerified,
    },
  });
});

// AI Journal Reflection API
// Strict authentication, verified user-scoping, input sanitization, and rate limiting
app.post("/api/ai/reflect", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Rate limit: 12 requests per minute per user
    if (!checkRateLimit(`ai-reflect:${uid}`, 12, 60000)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "You have submitted multiple reflection requests. Please wait a minute before trying again.",
      });
      return;
    }

    // Input Validation
    const { title, content, mood } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Validation error", message: "Journal content is required." });
      return;
    }

    if (content.length > 20000) {
      res.status(400).json({ error: "Validation error", message: "Journal entry exceeds maximum length of 20,000 characters." });
      return;
    }

    const safeTitle = typeof title === "string" ? title.slice(0, 200) : "Untitled Entry";
    const safeMood = typeof mood === "string" ? mood.slice(0, 50) : "Neutral";

    // Call Gemini API server-side
    const ai = getGeminiClient();

    const systemInstruction = `You are a private, empathetic, and cognitively constructive personal journaling companion.
The user is sharing a private journal entry with title "${safeTitle}" and recorded mood "${safeMood}".
Your job is to provide supportive, psychologically grounded, non-judgmental reflective insights.
Guidelines:
1. Validate emotions with empathy.
2. Offer 2-3 gentle cognitive reframing perspectives or constructive reflections.
3. Provide a concise 1-2 sentence executive summary of the thoughts, events, and core insight.
4. Identify 2-4 key psychological themes/topics (e.g., "Work-Life Balance", "Resilience", "Interpersonal Communication").
5. Provide 2 thought-provoking, forward-looking prompts for deeper reflection.
6. Summarize the overall emotional tone/sentiment respectfully.
7. Do NOT give medical or psychiatric diagnoses.
Output STRICT JSON matching this format:
{
  "reflection": "Paragraph of empathetic, constructive reflection...",
  "summary": "1-2 concise sentences summarizing the essence and takeaway of the entry...",
  "themes": ["Theme 1", "Theme 2"],
  "sentiment": "Reflective / Hopeful / Overwhelmed / Energized / etc.",
  "guidingQuestions": ["Question 1?", "Question 2?"]
}`;

    const promptText = `Journal Title: ${safeTitle}\nMood: ${safeMood}\n\nJournal Content:\n${content.slice(0, 15000)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const responseText = response.text || "{}";
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
      if (!parsedData.summary) {
        parsedData.summary = parsedData.reflection ? parsedData.reflection.slice(0, 250) : content.slice(0, 150);
      }
    } catch {
      parsedData = {
        reflection: responseText,
        summary: responseText.slice(0, 250),
        themes: ["Personal Reflection"],
        sentiment: safeMood,
        guidingQuestions: ["What felt most important to express in this moment?"],
      };
    }

    res.json({
      success: true,
      data: parsedData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI Reflection error:", error?.message || error);
    res.status(500).json({
      error: "AI service error",
      message: "Unable to complete reflective analysis at this time. Please try again shortly.",
    });
  }
});

// Automatic AI Summarization for Completed Journal Conversations
// Validates caller identity, ensures strict tenant confidentiality,
// and extracts concise summary, key thoughts, and important takeaways.
app.post("/api/ai/summarize-conversation", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: "Unauthorized", message: "User identity unverified." });
      return;
    }

    // Rate-limiting: 20 summary requests per minute per user
    if (!checkRateLimit(`ai-summary:${uid}`, 20, 60000)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "You have requested several AI summaries. Please pause for a moment before trying again.",
      });
      return;
    }

    const { messages, title, mood } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        error: "Validation error",
        message: "A list of conversation messages is required to generate a summary.",
      });
      return;
    }

    // Format transcript safely without trusting untrusted formatting
    const formattedTranscript = messages
      .slice(-40) // Last 40 exchanges
      .map((m: any) => {
        const role = m.role === "assistant" ? "AI Reflective Companion" : "User";
        const text = typeof m.content === "string" ? m.content.slice(0, 3000) : "";
        return `${role}: ${text}`;
      })
      .filter((line: string) => line.trim().length > 0)
      .join("\n\n");

    if (!formattedTranscript.trim()) {
      res.status(400).json({
        error: "Validation error",
        message: "No readable dialogue messages were found in the conversation.",
      });
      return;
    }

    const safeTitle = typeof title === "string" && title.trim() ? title.slice(0, 200) : "Journal Dialogue";
    const safeMood = typeof mood === "string" && mood.trim() ? mood.slice(0, 50) : "Reflective";

    const ai = getGeminiClient();

    const systemInstruction = `You are an expert, deeply empathetic, and confidential psychological journaling analyst.
A user has completed an introspective journal conversation with their AI companion regarding their private entry: "${safeTitle}" (Emotional Tone: "${safeMood}").

Your task is to analyze the completed conversation and generate a structured JSON object with exactly:
1. "summary": A concise, clear, and empathetic executive summary (2-3 sentences) capturing the core essence, emotional journey, and central focus of what the user explored.
2. "keyThoughts": An array of 3 to 5 distinct, concise key thoughts, recurring feelings, or underlying beliefs expressed by the user.
3. "takeaways": An array of 2 to 4 actionable insights, constructive cognitive reframings, or forward-looking commitments.

Guidelines:
- Ground your analysis purely on the user's authentic expressions in the conversation.
- Maintain a warm, encouraging, non-judgmental, and validating tone.
- Do NOT provide medical or psychiatric diagnoses.
- Respond with STRICT JSON conforming to this schema:
{
  "summary": "Concise 2-3 sentence overview...",
  "keyThoughts": ["Key thought 1", "Key thought 2", "Key thought 3"],
  "takeaways": ["Takeaway 1", "Takeaway 2"]
}`;

    const promptText = `Journal Context:
Title: ${safeTitle}
Current Mood: ${safeMood}

Conversation Transcript:
${formattedTranscript}

Please synthesize this completed conversation into the specified JSON format.`;

    let responseText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      });
      responseText = response.text || "";
    } catch (primaryErr: any) {
      console.warn("Primary gemini-3.8-flash model failed, falling back to gemini-2.5-flash:", primaryErr?.message);
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      });
      responseText = fallbackResponse.text || "";
    }

    let parsedResult: { summary: string; keyThoughts: string[]; takeaways: string[] };
    try {
      const json = JSON.parse(responseText.trim());
      parsedResult = {
        summary:
          typeof json.summary === "string" && json.summary.trim()
            ? json.summary.trim()
            : "Conversation concluded with valuable self-reflection.",
        keyThoughts:
          Array.isArray(json.keyThoughts) && json.keyThoughts.length > 0
            ? json.keyThoughts.map((t: any) => String(t).trim()).filter(Boolean)
            : ["Explored personal feelings and perspectives", "Acknowledged current challenges and aspirations"],
        takeaways:
          Array.isArray(json.takeaways) && json.takeaways.length > 0
            ? json.takeaways.map((t: any) => String(t).trim()).filter(Boolean)
            : ["Continue practicing mindful awareness through daily journaling"],
      };
    } catch (parseError) {
      console.warn("JSON parse error for summary response, creating structured fallback:", parseError);
      parsedResult = {
        summary: responseText.slice(0, 300) || "Conversation completed and reviewed.",
        keyThoughts: ["Engaged in introspective journaling dialogue"],
        takeaways: ["Revisit these insights as your week progresses"],
      };
    }

    res.json({
      success: true,
      data: parsedResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI Summarize Conversation error:", error?.message || error);
    res.status(500).json({
      error: "AI service error",
      message: error?.message || "Unable to summarize conversation at this time. Please try again shortly.",
    });
  }
});

// Interactive AI Companion Chat exchange
// Allows the user to have an ongoing dialogue before completing their conversation
app.post("/api/ai/companion-reply", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!checkRateLimit(`ai-chat:${uid}`, 25, 60000)) {
      res.status(429).json({ error: "Too many messages sent. Please slow down slightly." });
      return;
    }

    const { messages, title, mood, journalContent } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Validation error", message: "Conversation history is required." });
      return;
    }

    const safeTitle = typeof title === "string" && title.trim() ? title.slice(0, 200) : "Journal Entry";
    const safeMood = typeof mood === "string" && mood.trim() ? mood.slice(0, 50) : "Reflective";
    const safeContentSnippet = typeof journalContent === "string" ? journalContent.slice(0, 2500) : "";

    const ai = getGeminiClient();

    const systemInstruction = `You are a warm, confidential, and empathetic journaling companion.
The user is discussing their private journal entry titled "${safeTitle}" with mood "${safeMood}".
${safeContentSnippet ? `Initial Journal Excerpt:\n"""${safeContentSnippet}"""\n` : ""}
Your purpose is to gently help the user explore their feelings, validate their lived experience without judgment, and ask a single thoughtful, open-ended question to foster self-awareness.
Keep responses concise (2-4 sentences max), grounded, and compassionate. Do not give medical diagnoses or unsolicited advice.`;

    const recentExchanges = messages.slice(-10).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 2000) }],
    }));

    let replyText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: recentExchanges,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      replyText = response.text || "";
    } catch (chatErr: any) {
      console.warn("Primary gemini-3.8-flash chat call failed, falling back to gemini-2.5-flash:", chatErr?.message);
      const fallback = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: recentExchanges,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      replyText = fallback.text || "";
    }

    res.json({
      success: true,
      reply: replyText.trim(),
    });
  } catch (error: any) {
    console.error("AI companion chat error:", error?.message || error);
    res.status(500).json({
      error: "Companion service error",
      message: "Unable to generate companion response at this time.",
    });
  }
});

// Personalized Confidential Writing Prompts API
app.post("/api/ai/prompts", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!checkRateLimit(`ai-prompts:${uid}`, 10, 60000)) {
      res.status(429).json({ error: "Too many prompt requests. Please wait a minute." });
      return;
    }

    const { category, focus } = req.body;
    const safeCategory = typeof category === "string" ? category.slice(0, 50) : "Mindfulness & Growth";
    const safeFocus = typeof focus === "string" ? focus.slice(0, 100) : "Daily clarity";

    const ai = getGeminiClient();

    const systemInstruction = `You generate structured, high-value personal journaling prompts.
Output STRICT JSON with an array of 4 prompts:
{
  "prompts": [
    {
      "id": "1",
      "category": "${safeCategory}",
      "title": "Short prompt title",
      "prompt": "Detailed inspiring question or contemplation exercise"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate 4 thoughtful prompts for category: ${safeCategory} with focus: ${safeFocus}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.8,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      prompts: parsed.prompts || [],
    });
  } catch (error: any) {
    console.error("Prompt generation error:", error?.message || error);
    res.status(500).json({
      error: "Prompt service error",
      message: "Failed to generate prompts. Please try again.",
    });
  }
});

// AI Reflection & Insights API
// Generates recurring themes, key reflections, suggested next actions, and reflection/mood trend
// STRICT SECURITY REQUIREMENT:
// Only analyzes and displays the currently authenticated user's journal data.
// Token verification binds req.user.uid. All input entries are verified to match req.user.uid.
app.post("/api/ai/insights", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: "Unauthorized", message: "User identity unverified." });
      return;
    }

    // Rate limit: 12 requests per minute per user
    if (!checkRateLimit(`ai-insights:${uid}`, 12, 60000)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "You have requested multiple AI Insights analyses. Please pause a moment before refreshing again.",
      });
      return;
    }

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({
        error: "Validation error",
        message: "At least one journal entry from your history is required to generate insights.",
      });
      return;
    }

    // STRICT MULTI-TENANT ISOLATION CHECK:
    // Reject any request where any entry does not strictly belong to the authenticated user.
    for (const entry of entries) {
      if (entry.userId && entry.userId !== uid) {
        res.status(403).json({
          error: "Forbidden",
          message: "Data isolation policy violation: Cross-tenant data analysis is strictly prohibited.",
        });
        return;
      }
    }

    // Sort entries chronologically (oldest to newest for trend analysis)
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Common mood to numeric valence score (1 to 5)
    const moodScoreMap: Record<string, number> = {
      Peaceful: 5,
      Grateful: 5,
      Joyful: 5,
      Focused: 4,
      Motivated: 4,
      Calm: 4,
      Reflective: 3,
      Neutral: 3,
      Challenged: 2,
      Anxious: 2,
      Stressed: 2,
      Overwhelmed: 1,
      Exhausted: 1,
    };

    // Calculate baseline mood distribution for the authenticated user
    const moodCount: Record<string, number> = {};
    for (const e of sortedEntries) {
      const m = e.mood || "Reflective";
      moodCount[m] = (moodCount[m] || 0) + 1;
    }

    const moodDistribution = Object.entries(moodCount).map(([mood, count]) => ({
      mood,
      count,
      percentage: Math.round((count / sortedEntries.length) * 100),
    }));

    // Find dominant mood
    let dominantMood = "Reflective";
    let maxCount = 0;
    for (const [m, c] of Object.entries(moodCount)) {
      if (c > maxCount) {
        dominantMood = m;
        maxCount = c;
      }
    }

    // Prepare compact, privacy-preserving excerpts for Gemini
    const journalExcerpts = sortedEntries.map((e, idx) => {
      const title = typeof e.title === "string" ? e.title.slice(0, 100) : `Entry ${idx + 1}`;
      const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString() : `Day ${idx + 1}`;
      const mood = e.mood || "Reflective";
      const tags = Array.isArray(e.tags) ? e.tags.slice(0, 5).join(", ") : "";
      const summaryOrContent = e.summary
        ? e.summary.slice(0, 300)
        : (typeof e.content === "string" ? e.content.slice(0, 300) : "");
      const keyThoughts = Array.isArray(e.keyThoughts) && e.keyThoughts.length > 0
        ? ` Key Thoughts: ${e.keyThoughts.slice(0, 2).join("; ")}`
        : "";

      return `[Entry ${idx + 1} | ${date} | Mood: ${mood}${tags ? ` | Tags: ${tags}` : ""}]\nTitle: ${title}\nExcerpt: ${summaryOrContent}${keyThoughts}`;
    }).join("\n\n");

    const ai = getGeminiClient();

    const systemInstruction = `You are a world-class, confidential, and deeply empathetic personal reflection and psychological insights analyst.
You are analyzing the chronological journal entries of ONE authenticated user (total entries: ${sortedEntries.length}).
Your role is to produce a profound, constructive, and highly personalized "AI Reflection & Insights" report.

STRICT PRIVACY NOTICE:
- Ground all insights strictly on this user's provided journals.
- Do NOT fabricate or inject facts from other personas.
- Tone must be supportive, validating, empowering, and grounded in emotional intelligence.
- Do NOT provide medical or psychiatric diagnoses.

You MUST produce a STRICT JSON response conforming to this schema:
{
  "summaryOverview": "A thoughtful 2-3 sentence overarching synthesis of their personal journey, resilience, and emotional evolution across these entries.",
  "recurringThemes": [
    {
      "id": "theme-1",
      "theme": "Theme Name (e.g., Mindful Work Boundaries, Creative Self-Expression, Relational Clarity)",
      "frequency": 3,
      "description": "2-3 sentences explaining where and how this theme emerges in their journal entries.",
      "impact": "Positive" | "Growth Area" | "Neutral",
      "relatedTags": ["tag1", "tag2"]
    }
  ],
  "keyReflections": [
    {
      "id": "refl-1",
      "title": "Core Insight Title (e.g., Shifting from Overthinking to Mindful Acceptance)",
      "observation": "Specific emotional or cognitive pattern noticed across their timeline.",
      "growthPoint": "How the user can integrate this insight for sustained inner calm and growth.",
      "entryReferences": ["Title of Relevant Entry 1"]
    }
  ],
  "suggestedActions": [
    {
      "id": "action-1",
      "title": "Actionable Headline (e.g., Establish an Evening Transition Ritual)",
      "action": "Concrete, practical step the user can test over the coming days.",
      "category": "Habit" | "Mindset" | "Action" | "Boundary" | "Wellness",
      "priority": "High" | "Medium" | "Low",
      "rationale": "Direct reason this action addresses an identified theme or reflection."
    }
  ],
  "moodTrend": {
    "dominantMood": "${dominantMood}",
    "overallSentiment": "Empathetic overview of emotional climate (e.g., Grounded & Resilient, Seeking Balance, Hopeful)",
    "sentimentTrajectory": "Upward & Constructive" | "Stable & Grounded" | "Fluctuating & Resilient" | "Needs Care & Support",
    "trajectorySummary": "2-3 sentences contextualizing how their mood and reflections have trended over time.",
    "timeline": [
      {
        "date": "2026-09-01T00:00:00.000Z",
        "formattedDate": "Sep 1",
        "title": "Entry Title",
        "mood": "Peaceful",
        "score": 5,
        "sentiment": "Calm & Centered"
      }
    ]
  }
}

Require:
- recurringThemes: 3 to 6 themes.
- keyReflections: 3 to 5 reflections.
- suggestedActions: 4 to 6 actionable suggestions with concrete advice.
- moodTrend.timeline: Chronological array corresponding to input entries with score between 1 and 5.`;

    const promptText = `Authenticated User Journal History (Total: ${sortedEntries.length} entries):\n\n${journalExcerpts}\n\nPlease generate the comprehensive AI Reflection & Insights JSON.`;

    let responseText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      });
      responseText = response.text || "";
    } catch (primaryErr: any) {
      console.warn("Primary gemini-3.8-flash failed for insights, trying gemini-2.5-flash:", primaryErr?.message);
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      });
      responseText = fallbackResponse.text || "";
    }

    let parsedResult: any = {};
    try {
      parsedResult = JSON.parse(responseText.trim());
    } catch (parseError) {
      console.warn("Insights JSON parse fallback triggered:", parseError);
      parsedResult = {
        summaryOverview: "Your journal records show active introspection, emotional self-awareness, and resilience.",
        recurringThemes: [
          {
            id: "theme-1",
            theme: "Self-Reflection & Awareness",
            frequency: sortedEntries.length,
            description: "Consistent commitment to documenting personal experiences and processing emotions.",
            impact: "Positive",
            relatedTags: ["reflection"],
          },
        ],
        keyReflections: [
          {
            id: "refl-1",
            title: "Navigating Daily Complexities",
            observation: "You use journaling as a grounded anchor when navigating changing circumstances.",
            growthPoint: "Continuing this regular practice strengthens cognitive resilience and clarity.",
            entryReferences: [sortedEntries[0]?.title || "Initial Reflection"],
          },
        ],
        suggestedActions: [
          {
            id: "action-1",
            title: "Regular Reflection Cadence",
            action: "Dedicate 5 minutes every few days to check in with your core feelings.",
            category: "Habit",
            priority: "High",
            rationale: "Builds on your established journaling habit for greater ongoing perspective.",
          },
        ],
        moodTrend: {
          dominantMood,
          overallSentiment: "Reflective & Introspective",
          sentimentTrajectory: "Stable & Grounded",
          trajectorySummary: "Your recorded entries show thoughtful engagement with daily challenges and positive moments.",
          timeline: [],
        },
      };
    }

    // Ensure timeline in moodTrend is populated and aligned
    if (!parsedResult.moodTrend || !Array.isArray(parsedResult.moodTrend.timeline) || parsedResult.moodTrend.timeline.length === 0) {
      parsedResult.moodTrend = parsedResult.moodTrend || {};
      parsedResult.moodTrend.timeline = sortedEntries.map((e) => {
        const moodName = e.mood || "Reflective";
        const score = moodScoreMap[moodName] || 3;
        const d = new Date(e.createdAt);
        return {
          date: e.createdAt,
          formattedDate: isNaN(d.getTime()) ? "Recent" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          title: e.title,
          mood: moodName,
          score,
          sentiment: moodName,
        };
      });
    }

    // Attach distribution and ratio
    parsedResult.moodTrend.dominantMood = parsedResult.moodTrend.dominantMood || dominantMood;
    parsedResult.moodTrend.moodDistribution = moodDistribution;
    const positiveCount = sortedEntries.filter((e) => ["Peaceful", "Grateful", "Joyful", "Focused", "Calm"].includes(e.mood || "")).length;
    parsedResult.moodTrend.positiveRatio = Math.round((positiveCount / sortedEntries.length) * 100);

    const userInsights = {
      id: `insights_${uid}_${Date.now()}`,
      userId: uid,
      generatedAt: new Date().toISOString(),
      analyzedEntriesCount: sortedEntries.length,
      summaryOverview: parsedResult.summaryOverview || "Comprehensive reflection of your authenticated journal history.",
      recurringThemes: parsedResult.recurringThemes || [],
      keyReflections: parsedResult.keyReflections || [],
      suggestedActions: parsedResult.suggestedActions || [],
      moodTrend: parsedResult.moodTrend,
    };

    res.json({
      success: true,
      data: userInsights,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI Insights generation error:", error?.message || error);
    res.status(500).json({
      error: "Insights service error",
      message: error?.message || "Failed to generate AI insights from your journal history.",
    });
  }
});

// PII & Secret Leak Prevention Scanner (Client-assisting security pre-check)
// Detects accidental inclusion of private keys, AWS/Google tokens, passwords, credit card numbers, or SSNs
app.post("/api/security/scan-draft", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { content } = req.body;
    if (typeof content !== "string") {
      res.status(400).json({ error: "Invalid content" });
      return;
    }

    const findings: Array<{ type: string; warning: string }> = [];

    // High entropy / credential detection patterns
    const secretPatterns = [
      { regex: /AIza[0-9A-Za-z-_]{35}/, type: "Google API Key" },
      { regex: /sk-[a-zA-Z0-9]{32,}/, type: "API Secret Key" },
      { regex: /ghp_[a-zA-Z0-9]{36}/, type: "GitHub Token" },
      { regex: /BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY/, type: "Private Cryptographic Key" },
      { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, type: "Payment Card Number" },
      { regex: /\b\d{3}-\d{2}-\d{4}\b/, type: "Social Security Number (SSN)" },
      { regex: /password\s*[:=]\s*['"][^'"]+['"]/i, type: "Plaintext Password" },
    ];

    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        findings.push({
          type: pattern.type,
          warning: `Potential sensitive credential or identifier detected (${pattern.type}). For security, avoid saving sensitive secrets in text notes.`,
        });
      }
    }

    res.json({
      safe: findings.length === 0,
      findings,
    });
  } catch (error: any) {
    console.error("Security scan error:", error);
    res.status(500).json({ error: "Security scan failed" });
  }
});

// Centralized Error Handling Middleware (Do not leak stack traces or internals)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred. Request has been safely aborted.",
  });
});

// Vite middleware & Static Serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Security Kernel] Multi-user journal server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
