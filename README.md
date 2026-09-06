# 🔐 Personal Gemini Journal

An AI-powered secure journaling application built with **Google Gemini, Firebase Authentication, Cloud Firestore, and Google Cloud Run**. The application helps users have private, contextual conversations with Gemini, generate journal summaries, and discover recurring themes and personalized reflections.

## ✨ Features

* 🔐 Google Sign-In using Firebase Authentication
* 📝 Private journal entries
* 🤖 Gemini-powered AI conversations
* 💬 Multi-turn conversational context
* 📋 AI-generated journal summaries
* 💡 AI Reflection & Insights
* 📊 Recurring themes and personal reflection trends
* 🔒 User-isolated Firestore data
* 🛡️ Firestore Security Rules
* ☁️ Cloud Run deployment support
* 🔑 Secret Manager support for production deployment

---

## 🏗️ Architecture

```text
                    Personal Gemini Journal
                              │
                              ▼
                       React Frontend
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             Firebase Auth          Backend API
                    │                   │
                    │             ┌─────┴─────┐
                    │             │           │
                    │             ▼           ▼
                    │          Gemini API   Firestore
                    │
                    ▼
             Authenticated User
```

### Data Flow

```text
User
 │
 ▼
Firebase Google Authentication
 │
 ▼
Authenticated UID
 │
 ├── Create Journal
 │
 ▼
Firestore
users/{uid}/journals/{journalId}
 │
 ▼
Secure Backend
 │
 ▼
Gemini
 │
 ├── Conversation
 ├── Summary
 └── AI Insights
```

---

# 🛠️ Technology Stack

| Technology              | Purpose                       |
| ----------------------- | ----------------------------- |
| React                   | Frontend                      |
| TypeScript              | Application development       |
| Firebase Authentication | Google Sign-In                |
| Cloud Firestore         | Journal data storage          |
| Gemini API              | AI conversations and insights |
| Google Cloud Run        | Application deployment        |
| Secret Manager          | Secure production secrets     |
| GitHub                  | Source code management        |

---

# 🚀 Development Setup

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/personal-gemini-journal.git

cd personal-gemini-journal
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Firebase

Create a Firebase project from the Firebase Console.

Enable:

```text
Firebase Authentication
Cloud Firestore
```

### Enable Google Authentication

Go to:

```text
Firebase Console
→ Authentication
→ Sign-in method
→ Google
→ Enable
```

---

## 4. Configure Firebase in the Application

Create your Firebase configuration using environment variables.

Example:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> Firebase web configuration values are not substitutes for server-side secrets. Never place Gemini API keys or service-account credentials in frontend environment variables.

---

# 🔥 Firestore Data Model

Journal data is isolated by the authenticated Firebase UID.

```text
users/
  {uid}/
    journals/
      {journalId}
        title
        messages
        summary
        insights
        createdAt
        updatedAt
```

Example:

```text
users
│
├── userA
│    └── journals
│         ├── journal001
│         └── journal002
│
└── userB
     └── journals
          ├── journal003
          └── journal004
```

User A can access only:

```text
users/userA/journals/*
```

User A must NOT be able to access:

```text
users/userB/journals/*
```

---

# 🛡️ Firebase Firestore Security Rules

Use strict user-based authorization.

Create:

```text
firestore.rules
```

Recommended rules:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Users can access only their own user document.
    match /users/{userId} {
      allow read, create, update, delete:
        if request.auth != null
        && request.auth.uid == userId;

      // User's private journals
      match /journals/{journalId} {

        allow read, create, update, delete:
          if request.auth != null
          && request.auth.uid == userId;

        // Deny any unexpected subcollections by default.
        match /{document=**} {
          allow read, write: if false;
        }
      }
    }

    // Deny everything else by default.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 🔒 Security Model

The important authorization check is:

```text
request.auth.uid == userId
```

This means the currently authenticated Firebase user must match the owner ID in the Firestore path.

### Unauthenticated user

```text
request.auth == null
        ↓
       DENY
```

### Authenticated owner

```text
request.auth.uid == userId
        ↓
       ALLOW
```

### Authenticated different user

```text
request.auth.uid != userId
        ↓
       DENY
```

---

# ⚠️ Important Security Rules Note

Do not use client-provided values as the source of authorization.

For example, this is unsafe:

```javascript
const uid = request.body.uid;
```

The server must use the authenticated identity instead.

The trusted identity should come from Firebase Authentication:

```text
Firebase Authentication
        ↓
request.auth.uid
        ↓
Firestore authorization
```

---

# 🤖 Gemini Integration

Gemini powers the AI functionality of the application.

The application uses Gemini for:

### 1. Multi-turn Conversation

Users can have contextual conversations with Gemini.

```text
User:
I'm preparing for an AI hackathon.

Gemini:
That's exciting. What are you building?

User:
A secure journaling application.

Gemini:
Your focus is therefore on...
```

The conversation context is maintained within the journal session.

### 2. Automatic Summary

Gemini generates:

* Concise summary
* Key thoughts
* Important takeaways

### 3. AI Reflection & Insights

Gemini analyzes the authenticated user's own journal history to identify:

* Recurring themes
* Reflection patterns
* Personal growth
* Suggested next actions
* Reflection prompts

---

# 🔐 Gemini API Security

Never expose the Gemini API key in frontend code.

### ❌ Do NOT do this

```javascript
const GEMINI_API_KEY = "YOUR_SECRET_KEY";
```

or:

```env
VITE_GEMINI_API_KEY=your_secret_key
```

because `VITE_*` variables are intended for client-side builds and can become accessible to users.

### ✅ Recommended production architecture

```text
React Frontend
      │
      ▼
Backend API
      │
      ▼
Google Cloud Secret Manager
      │
      ▼
Gemini API
```

The browser communicates with your backend rather than directly exposing the Gemini secret.

---

# ☁️ Cloud Run Deployment

Cloud Run is used to deploy the production application in a scalable containerized environment.

Architecture:

```text
Source Code
     │
     ▼
Docker
     │
     ▼
Cloud Build
     │
     ▼
Artifact Registry
     │
     ▼
Cloud Run
     │
     ▼
Public HTTPS URL
```

Example:

```text
https://your-service-xxxxx.run.app
```

---

# 🔑 Secret Manager

For production deployment, store sensitive credentials in **Google Cloud Secret Manager**.

Example:

```text
Secret:
GEMINI_API_KEY
```

Cloud Run receives access to the secret through its runtime identity.

```text
Cloud Run
   │
   ▼
Secret Manager
   │
   ▼
GEMINI_API_KEY
   │
   ▼
Backend
   │
   ▼
Gemini API
```

Never commit secrets to GitHub.

---

# 🧪 Local Development

Start the development server:

```bash
npm run dev
```

Then open the local URL shown by Vite, commonly:

```text
http://localhost:5173
```

Test:

* Google Sign-In
* Logout
* Create journal
* Gemini conversation
* Multi-turn context
* Journal saving
* Summary generation
* AI Insights

---

# 🔍 Security Testing

## Test 1 — Unauthenticated Access

Open the application without logging in.

Expected:

```text
Private journal → DENIED
```

---

## Test 2 — User A

Login with Account A.

Create:

```text
Private Journal A
```

Expected:

```text
Account A → Can read/write Journal A
```

---

## Test 3 — User B

Logout from Account A.

Login with Account B.

Expected:

```text
Account B → Cannot see Journal A
```

---

## Test 4 — Cross-user Access

Attempt to access:

```text
users/userA/journals/journalA
```

while authenticated as:

```text
userB
```

Expected:

```text
PERMISSION DENIED
```

---

# 📁 Project Structure

```text
personal-gemini-journal/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── firebase/
│   └── App.tsx
│
├── public/
│
├── firestore.rules
├── firebase.json
├── package.json
├── Dockerfile
├── .env.example
├── .gitignore
└── README.md
```

---

# 🚫 Files That Must Never Be Committed

```text
.env
.env.local
service-account.json
*.pem
*.key
API keys
private credentials
```

Add sensitive files to `.gitignore`.

Example:

```gitignore
node_modules/
.env
.env.local
.env.*.local
service-account.json
dist/
```

---

# 🔄 Development Workflow

```text
1. Build feature
       ↓
2. Test locally
       ↓
3. Test Firebase Authentication
       ↓
4. Test Firestore isolation
       ↓
5. Test Gemini
       ↓
6. Run security checks
       ↓
7. Commit to GitHub
       ↓
8. Build Docker image
       ↓
9. Deploy to Cloud Run
       ↓
10. Test production application
```

---

# 🎯 Key Differentiator

## AI Reflection & Insights

Unlike a basic AI chatbot, Personal Gemini Journal uses Gemini to understand patterns across the user's **own private journal history**.

The system can answer questions such as:

```text
"What have I been worried about recently?"

"What goals do I mention repeatedly?"

"How have my thoughts changed over time?"

"What patterns do you notice in my journal?"
```

All insights are restricted to the currently authenticated user's data.

---

# 🔒 Security Principles

The application follows these principles:

* Authentication before private access
* User-level authorization
* User-isolated Firestore documents
* Default-deny Firestore rules
* No client-trusted ownership
* No Gemini API keys in frontend code
* No secrets committed to GitHub
* Server-side Gemini requests for production
* Secret Manager for production credentials
* HTTPS through Cloud Run

---

# 📌 Future Improvements

* Advanced personal analytics
* More detailed reflection timelines
* Voice journaling
* Emotion-aware journaling
* Export journal as PDF
* Scheduled reflection reminders
* Improved AI personalization

---

# 🏆 Project Goal

Personal Gemini Journal demonstrates how **generative AI can be combined with strong cloud security and user data isolation** to create a useful, privacy-focused application.

The project combines:

```text
Firebase
   +
Firestore
   +
Gemini
   +
Google Cloud Run
   +
Secret Manager
   =
Secure AI Journaling Platform
```

---

## 👩‍💻 Author

**Dishita Chauhan**

B.Tech Computer Science & Engineering

Built as part of an AI and Google Cloud development challenge.
