# 🧠 Cloudflare VMail - Project Ideas & Roadmap

This document stores advanced concepts, automation workflows, and feature requests for future implementation.

## 🚀 n8n Automation Workflows (The "Smart" Layer)

### 1. The "Auto-Verifier" (Account Activation Bot)
*   **Goal:** Automate the "Click Verify Link" step for new accounts.
*   **Trigger:** New Email Webhook.
*   **Workflow:** 
    1.  Parse HTML/Text using Regex to find `href` inside buttons like "Verify", "Confirm", "Activate".
    2.  Use **HTTP Request/Browser Node** to visit the link automatically.
    3.  Take a screenshot (optional) and send "Verified ✅" notification to Telegram.
*   **Value:** Save huge time when registering multiple accounts.

### 2. The "AI Accountant" (Receipt Processing)
*   **Goal:** Automate expense tracking from emails.
*   **Trigger:** Email from 'Uber', 'Grab', 'Stripe', 'Apple'.
*   **Workflow:**
    1.  Send Email Content (or Screenshot of HTML) to **OpenAI GPT-4o (Vision)**.
    2.  Prompt: "Extract Vendor, Date, Currency, Total Amount, Category".
    3.  Output JSON -> Append to **Google Sheets** or **Airtable**.
*   **Value:** Automated bookkeeping.

### 3. The "News-to-Audio" (Personal Podcast)
*   **Goal:** Listen to newsletters instead of reading.
*   **Trigger:** Email from Substack/Newsletters.
*   **Workflow:**
    1.  **AI Summary** to condense content.
    2.  **Text-to-Speech (TTS)** (OpenAI Audio / ElevenLabs) to generate MP3.
    3.  Upload to R2 -> Send Audio File to Telegram.
*   **Value:** Consume content on the go (Driving/Gym).

### 4. The "Second Brain" Archiver
*   **Goal:** Save knowledge to personal wiki.
*   **Trigger:** Email flagged as "Keep".
*   **Workflow:** Convert HTML to Markdown -> Push to **Notion** / **Obsidian** (via Git or API).

---

## 🛡️ Core Feature Enhancements (Worker)

### 1. Intelligent OTP Detection (✅ Done Phase 6)
*   Extract 6-digit codes and display prominently in Telegram.

### 2. "Trust Score" (Phishing Detector)
*   Analyze `SPF`, `DKIM`, `DMARC` results in `email.headers`.
*   Display 🛡️ (Green) or ⚠️ (Red) in subject line or Telegram alert.

### 3. Alias Pausing
*   Feature to "Freeze" an alias temporarily.
*   Worker rejects/bounces emails sent to frozen aliases without deleting the alias.

### 4. Direct SMTP Sending (Connecting to Gmail)
*   Use `nodemailer` + `nodejs_compat` + `connect()` to send via user's own Gmail.
*   Free, High Reputation, no 3rd party signup.

---

## 🤖 Advanced: "The Full Loop" (Auto-Registration)

### Concept: "Identity Factory"
Instead of just *receiving* mail, the system *creates* the account.

*   **Components:**
    *   **n8n / Headless Browser (Puppeteer):** To fill forms on websites.
    *   **Captcha Solver (2Captcha/CapSolver):** To pass "I am not a robot".
    *   **VMail:** To provide the email address + Receive the OTP/Link.
    *   **Workflow:**
        1.  Triger: user says `/create_instagram` on Telegram.
        2.  n8n spins up Browser -> Visits Instagram.com.
        3.  Fills Form (Gen Random Name, Use VMail Alias).

---

## 🌍 Ecosystem Expansion (The "Big" Picture)

### 1. Browser Extension (Chrome/Firefox)
*   **Goal:** Instant alias generation without opening the dashboard.
*   **Feature:** Right-click on any input field -> "Generate VMail".
*   **Tech:** Connects to `POST /api/v1/admin/aliases` via API Key.

### 2. "Serverless Mailtrap" (Dev Tool)
*   **Goal:** Use VMail as an infrastructure for testing software.
*   **Feature:** Expose `GET /api/v1/latest` for CI/CD pipelines (Cypress/Playwright).
*   **Use Case:** Developers automated testing of "Forgot Password" flows.

### 3. "AI Bodyguard" (Active Defense)
*   **Goal:** Active screening of incoming mail.
*   **Feature:** AI replies to sender: "Please state your business and budget."
*   **Logic:** Only forwards to User if the sender answers correctly.

