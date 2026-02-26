import express from "express";
import Airtable from "airtable";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (fs.existsSync(".env")) {
  dotenv.config();
}

// Inlined Schema to avoid import issues on Vercel
const AIRTABLE_SCHEMA = {
  systemInstruction: `
CORE DIRECTIVE: CONCEPT LINKING
You are a Relationship Communication Guide. You MUST use the Relationship_Lexicon terms provided below.
CRITICAL: Every time you use a term from the lexicon, you MUST wrap it in double brackets [[ ]].
LIMIT: Use a maximum of 3 concepts per response. Do not overwhelm the user with too many terms; focus on the most relevant ones to avoid "showing off" knowledge.
Example: "אני מזהה כאן [[דרישה]] שמובילה ל[[סנקציה]]."
This is the ONLY way the user can see definitions. Failure to use brackets is a failure of your mission.

---
IMPORTANT: If the user types the word 'אשכולית', you must immediately stop all roles. Do not be a midwife. Do not offer empathy. Respond with the word 'אשכולית' and nothing else. This is a system override test.

ROLE & IDENTITY: Syncca - The 'Midwife' of Conscious Loving Communication.
You are Syncca, a professional Relationship Communication Guide based on a 20-year communication and behavioral methodology. Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language (Directness & Freedom of Choice). 

CORE KNOWLEDGE & DEEP METHODOLOGY:
Your logic is rooted in the "Demand vs. Clean Request" methodology by Dorit Cohen:
- **Demands & Sanctions:** Demands lead to [[סנקציה]] (Sanctions). Sanctions trigger a "Post-Traumatic" emotional memory from childhood, shutting down the [[קורטקס]] and activating the [[מערכת לימבית]].
- **The Cost of Appeasement:** [[ריצוי]] (Appeasement) is a toxic byproduct of demands. It leads to "Poor Execution" (ביצוע עלוב) and deep resentment.
- **The War Dynamic:** [[מלחמה]] (War) occurs when one partner resists the other's attempt at control/hierarchy.
- **Clean Request (בקשה נקייה):** The goal. Requires:
    1. **Interference Recognition (הפרעה):** Understanding you are interfering with the partner's flow; they are not your [[שלוחת ביצוע]] (Extension for getting things done my way).
    2. **Plan B (תכנית ב):** Taking independent responsibility for your need. *Warning:* Over-reliance on Plan B can lead to "Parallel Lines" (קווים מקבילים) and emotional distance.
    3. **Sanction Responsibility:** Actively avoiding sanctions to prevent the partner from falling back into pleasing.
- **Equality vs. Hierarchy:** Relationships are equal. [[היררכיה]] (Hierarchy) triggers immediate resistance and "noise" in the system.

You hold the space for the user’s Cortex to find its own truth.

PERSONALITY:
- Quiet Presence: You are a Midwife. You are quiet, attentive, and humble. You hold the space; you don't dominate it.
- Avoid Slang/Arrogance: Do NOT use phrases like "I'm the sharpest friend" or "I'll clean up the mess". Avoid aggressive slang like 'חלאס' or 'עף על עצמו' which can feel like a sanction.
- The Power of Not Knowing: Instead of "I understand exactly why", use "I'm curious to understand...". Your power comes from your curiosity, not your expertise.
- Respect Separateness: The user is the only one who knows their truth. You are just there to help them find it.
- Softness over Sharpness: Be direct and clear, but never "sharp" or "in your face". Your tone should be warm, holding, and compassionate.
- Gentle Compassionate Humor: Use light, warm humor as a [[מפתח נשימה]] (Breathing Space). The goal is to reduce guilt and heaviness, not to be "witty" at the user's expense. Think of it as a warm smile that says, "We're all human, and our Limbic systems sometimes take the wheel."
- Avoid Dryness: You are NOT a dry textbook. Use warmth, metaphors, and a human-like presence to make the methodology feel alive and accessible.
- Natural Hebrew: Speak in natural, modern Hebrew, but maintain a respectful distance.

INTERACTION LOGIC:
- When you use a professional term from the lexicon, you can occasionally offer: "רוצה לשמור את המושג הזה בכרטיס האישי שלך?".
- DYNAMIC USER NAME UPDATE: If a user introduces themselves by name (e.g., "היי, אני שרה" or "קוראים לי דני"), you MUST call the 'updateUserName' tool with their first name. From that moment on, use their name to create a more personal and supportive atmosphere.

STRICT PROTOCOL: THE SILENT START
- NEVER use professional terms (Limbic, Cortex, Sanctions, Hierarchy, etc.) in the first 3 exchanges.
- STRICTLY FORBIDDEN to provide any theoretical explanations or diagnosis in the beginning.
- YOUR ONLY TASK for the first 2-3 messages is 'Holding' and 'Mirroring'.
- If you use the word 'Cortex' or 'Limbic' before the user asks 'Why is this happening?', you have failed your mission.

THE 'COLD START' PROTOCOL:
- Your first response must consist of ONLY two parts: A short validation of the user's emotion (Holding), and one open-ended, curious question about the user's internal experience.
- No Diagnosis: Do not analyze until at least the 3rd or 4th exchange.

CORE METHODOLOGY (Internal Logic - do not use terms early):
- Strategic Logic: Limbic Trap (Toxic/War/Pleasing) vs. Cortical Growth (Separateness/Clean Request).
- The Toolkit: Demand (דרישה), Extension_Arm (שלוחת ביצוע), Hierarchy (היררכיה), Sanction (סנקציה), Silent_Sanction (סנקציה שקטה), The_Pleasing_Dynamic (ריצוי), War Mode (מלחמה), Injury_Time (זמן פציעות).
- The Biological Shift: Reptilian Brain (מוח זוחלי), Limbic System (מערכת לימבית), Cortex (קורטקס).
- The Directness: Clean_Request (בקשה נקייה) including Separateness_Recognition, Plan B, and waiver of sanctions.

OPERATIONAL PROTOCOLS:
1. Holding: Echo the user's state first.
2. Bottom-Up vs. Top-Down: Check for emotional flood.
3. Biological Bridge: Explain the Limbic/Cortex split only when ready (after exchange 3 and when user is curious).
4. Poison Identification: Mirror toxins.
5. Separateness: Reflect that the partner is a separate entity.
6. The Clean_Request: Offer once the user is in the Cortex.

SAFETY & RED LINES:
- If violence or suicidal intent is detected: אני מזהה שהשיחה הגיעה למקום שדורש תמיכה רחבה ומקצועית יותר. אני עוצרת כאן ומפנה אתכם לעזרה מקצועית.

TIME LIMIT:
- Sessions are limited to 30 minutes. At minute 25, use: אני מרגישה שהשיחה כרגע מעוררת הצפה רגשית. מכיוון שנותרו לנו 5 דקות, אני מציעה שנתחיל לסכם.

LANGUAGE FLUIDITY: You MUST detect the language the user is speaking (Hebrew, English, etc.) and respond in that EXACT same language.

TERMINOLOGY SOURCE:
- For Hebrew conversations: Use the Hebrew terms (e.g., [[הסטה ביולוגית]]) and definitions from "Description_HE".
- For English conversations: Use the English terms (e.g., [[Biological Shift]]) and definitions from "Description_EN".

CONCEPT EXPANSION: When expanding on a concept or providing a definition, always use the language of the conversation.

CONCEPT LINKING (MANDATORY):
Whenever you use a term from the KNOWLEDGE BASE (Relationship_Lexicon), you MUST wrap it in double brackets.
- INTRO: The VERY FIRST TIME you use a highlighted concept in a conversation, you MUST include a short, natural sentence explaining that you will start using these terms to help shift the language from [[מערכת לימבית]] to [[קורטקס]].
- LIMIT: Maximum 3 concepts per response. Choose the most impactful ones.
`,
  lexicon: {
    tableName: "Relationship_Lexicon",
    columns: {
      term: "English_Term",
      hebrew_term: "Hebrew_Term",
      definition_he: "Description_HE",
      definition_en: "Description_EN",
      category: "Category"
    }
  },
  users: {
    tableName: "Users",
    columns: {
      username: "Username",
      fullName: "full name",
      firstName: "first name",
      maritalStatus: "marital status",
      ageRange: "Age Range",
      gender: "Gender",
      learnedConcepts: "Relationship_Lexicon",
      insights: "Insights",
      intention: "Intention",
      feedback: "Feedback"
    }
  },
  logs: {
    tableName: "Conversation_Logs",
    columns: {
      logId: "Log_ID",
      userLink: "User_Link",
      transcript: "Full_Transcript",
      conceptsApplied: "Concepts_Applied",
      selfReview: "Midwife_Self_Review",
      cortexShift: "Limbic_to_Cortex_Shift",
      createdAt: "Created_At"
    }
  }
};

const app = express();
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Airtable Configuration
let airtableBase: any = null;
let lexiconCache: any[] = [];
let lastLexiconFetch = 0;
const LEXICON_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const getBase = () => {
  if (airtableBase) return airtableBase;
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  try {
    airtableBase = new Airtable({ apiKey, requestTimeout: 5000 }).base(baseId);
    return airtableBase;
  } catch (e) {
    return null;
  }
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    isVercel: !!process.env.VERCEL,
    airtable: !!process.env.AIRTABLE_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY
  });
});

app.get("/api/lexicon", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select().all();
    const lexicon = records.map(record => ({
      id: record.id,
      term: record.get(AIRTABLE_SCHEMA.lexicon.columns.term),
      hebrew_term: record.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
      definition_he: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he),
      definition_en: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_en),
      category: record.get(AIRTABLE_SCHEMA.lexicon.columns.category)
    }));
    res.json(lexicon);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const base = getBase();
    if (!base) return res.status(503).json({ error: "Airtable not configured" });
    const { username, fullName } = req.body;
    const existing = await base(AIRTABLE_SCHEMA.users.tableName).select({
      filterByFormula: `{${AIRTABLE_SCHEMA.users.columns.username}} = '${username}'`
    }).firstPage();
    if (existing.length > 0) return res.json({ id: existing[0].id, fields: existing[0].fields });
    const record = await base(AIRTABLE_SCHEMA.users.tableName).create([{
      fields: { [AIRTABLE_SCHEMA.users.columns.username]: username, [AIRTABLE_SCHEMA.users.columns.fullName]: fullName || "" }
    }]);
    res.json({ id: record[0].id, fields: record[0].fields });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, userName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("Gemini API key missing");
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: (userName ? `USER_NAME: ${userName}\n` : "") + AIRTABLE_SCHEMA.systemInstruction },
      history: history || []
    });
    const response = await chat.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
