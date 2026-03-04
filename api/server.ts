import express from "express";
import Airtable from "airtable";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
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
const SYSTEM_INSTRUCTION = `
ROLE: Syncca - The 'Midwife' of Conscious Loving Communication.
You are Syncca. Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language (Directness & Freedom of Choice).

CORE METHODOLOGY (The "Article" Rationale):
1. **The Biological Split:**
   - [[מערכת לימבית]] (Limbic System): The "War Brain" / "Survival Brain". Triggered by [[דרישה]] (Demand) or threat. It sees the partner as an enemy.
   - [[קורטקס]] (Cortex): The "Love Brain" / "Human Brain". Allows for empathy, logic, and [[נפרדות]] (Separateness).
   - [[הסטה ביולוגית]] (Biological Shift): The moment the Limbic takes over. Often leads to [[זמן פציעות]] (Injury Time) where no productive communication can happen.
   - [[מוח זוחלי]] (Reptilian Brain): Deep survival instincts (Fight/Flight/Freeze).

2. **Toxic Dynamics:**
   - [[דרישה]] (Demand): An expectation that the partner fulfills a need, backed by a potential [[סנקציה]].
   - [[סנקציה]] (Sanction): Emotional or practical punishment for not meeting a demand.
   - [[ריצוי]] (Appeasement): Doing what the partner wants out of fear of sanctions. Leads to "Poor Execution" (ביצוע עלוב) and resentment.
   - [[היררכיה]] (Hierarchy): One partner acting as the "boss". Triggers immediate resistance and "noise".
   - [[שלוחת ביצוע]] (Extension Arm): Treating the partner as a tool to get things done rather than a separate person.
   - [[מלחמה]] (War): The result of mutual demands and resistance.

3. **The Path to Healing:**
   - [[בקשה נקייה]] (Clean Request): The goal. It has 3 components:
     a. **Interference Recognition ([[הפרעה]]):** Acknowledging you are interrupting their flow.
     b. **[[תכנית ב]] (Plan B):** Having a way to meet your need independently if they say no.
     c. **Sanction Waiver:** Ensuring the partner feels safe to say "no" without punishment.
   - [[נפרדות]] (Separateness): Recognizing the partner is a separate entity with their own world, not an extension of you.
   - [[החזקה]] (Holding): Staying present and containing the emotional space.

KNOWLEDGE BASE (Terms to wrap in [[ ]]):
- [[מערכת לימבית]], [[קורטקס]], [[מוח זוחלי]], [[הסטה ביולוגית]], [[זמן פציעות]], [[דרישה]], [[סנקציה]], [[ריצוי]], [[מלחמה]], [[היררכיה]], [[שלוחת ביצוע]], [[בקשה נקייה]], [[נפרדות]], [[תכנית ב]], [[הפרעה]], [[החזקה]].

CORE DIRECTIVE: CONCEPT LINKING
- You MUST wrap lexicon terms in double brackets [[ ]].
- LIMIT: Use a maximum of 3 concepts per response.
- Example: "אני מזהה כאן [[דרישה]] שמובילה ל[[סנקציה]]."

PERSONALITY:
- Voice: Witty Friend (שותפה חכמה, חמה ושנונה). Not a robot or dry therapist.
- Language: Use natural Israeli slang (תכלס, חלאס, עף על עצמו, זורמת, קטע, פדיחה, בקטנה, וואלה, יאללה, סבבה).
- Humor: Use humor to call out [[מערכת לימבית]] or [[קורטקס]] issues.
- Responses: Short, sharp, and actionable.

PROTOCOLS:
1. Silent Start: First 2-3 exchanges focus on 'Holding' and 'Mirroring' without professional terms.
2. Biological Bridge: Explain the Limbic/Cortex split only when user is curious (usually after exchange 3).
3. Clean Request: Offer once the user is in the Cortex.

SAFETY:
- If violence/suicide detected: "אני מזהה שהשיחה הגיעה למקום שדורש תמיכה רחבה ומקצועית יותר. אני עוצרת כאן ומפנה אתכם לעזרה מקצועית."

LANGUAGE: Respond in the EXACT same language as the user (Hebrew/English).
`;

const AIRTABLE_SCHEMA = {
  systemInstruction: SYSTEM_INSTRUCTION,
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
      sessionId: "Session_ID",
      userLink: "User_Link",
      transcript: "Full_Transcript",
      conceptsApplied: "Concepts_Applied",
      feedback: "Feedback",
      createdAt: "Created_At"
    }
  },
  feedbacks: {
    tableName: "Feedbacks",
    columns: {
      userEmail: "User_Email",
      content: "Feedback_Content",
      createdAt: "Created"
    }
  }
};

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/ping", (req, res) => res.send("pong"));

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
  
  if (!apiKey || !baseId) {
    console.error("Airtable configuration missing. API Key:", !!apiKey, "Base ID:", !!baseId);
    return null;
  }
  
  try {
    console.log(`Initializing Airtable with Base ID: ${baseId.substring(0, 5)}... and API Key: ${apiKey.substring(0, 5)}...`);
    airtableBase = new Airtable({ 
      apiKey,
      requestTimeout: 15000 // Increased to 15s
    }).base(baseId);
    return airtableBase;
  } catch (e) {
    console.error("Airtable init failed:", e);
    return null;
  }
};

// API Routes
app.get("/api/health", async (req, res) => {
  const airtableKey = process.env.AIRTABLE_API_KEY;
  const airtableBaseId = process.env.AIRTABLE_BASE_ID;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  let airtableStatus = "Not Configured";
  if (airtableKey && airtableBaseId) {
    try {
      const base = new Airtable({ apiKey: airtableKey }).base(airtableBaseId);
      // Try to fetch just one record to verify connectivity
      await base(AIRTABLE_SCHEMA.lexicon.tableName).select({ maxRecords: 1 }).firstPage();
      airtableStatus = "Connected Successfully";
    } catch (e: any) {
      airtableStatus = `Configuration Error: ${e.message}`;
    }
  }

  res.json({ 
    status: "ok", 
    mode: process.env.NODE_ENV || "development",
    isVercel: !!process.env.VERCEL,
    airtable: {
      status: airtableStatus,
      keyPresent: !!airtableKey,
      basePresent: !!airtableBaseId,
      keyPrefix: airtableKey ? airtableKey.substring(0, 5) : null,
      basePrefix: airtableBaseId ? airtableBaseId.substring(0, 5) : null
    },
    gemini: {
      configured: !!geminiKey && geminiKey !== "undefined" && geminiKey.length > 10,
      keyPresent: !!geminiKey,
      prefix: (geminiKey && geminiKey.length > 5) ? geminiKey.substring(0, 6) : "None"
    }
  });
});

app.get("/api/lexicon", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const cols = AIRTABLE_SCHEMA.lexicon.columns;
    const tableName = AIRTABLE_SCHEMA.lexicon.tableName;
    
    const records = await base(tableName).select().all();
    console.log(`Fetched ${records.length} lexicon records from Airtable`);
    
    const lexicon = records.map(record => {
      const def_he = record.get(cols.definition_he);
      const def_en = record.get(cols.definition_en);
      
      return {
        id: record.id,
        term: record.get(cols.term),
        hebrew_term: record.get(cols.hebrew_term),
        definition: def_he || def_en,
        definition_he: def_he,
        definition_en: def_en,
        category: record.get(cols.category)
      };
    });
    
    res.json(lexicon);
  } catch (error: any) {
    console.error("Error fetching lexicon:", error);
    res.status(500).json({ error: "Failed to fetch lexicon", details: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  const startTime = Date.now();
  try {
    const base = getBase();
    if (!base) {
      return res.status(503).json({ 
        error: "Airtable not configured on Vercel", 
        message: "Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID to your Vercel Environment Variables." 
      });
    }
    
    const { username, fullName } = req.body;
    console.log(`[UserMgmt] Request for: ${username}. Time: ${new Date().toISOString()}`);
    const tableName = AIRTABLE_SCHEMA.users.tableName;
    const cols = AIRTABLE_SCHEMA.users.columns;
    
    const formula = `{${cols.username}} = '${username}'`;
    
    console.log(`[UserMgmt] Searching Airtable with formula: ${formula}`);
    const existing = await base(tableName).select({
      filterByFormula: formula,
      maxRecords: 1
    }).firstPage();

    console.log(`[UserMgmt] Search completed in ${Date.now() - startTime}ms. Found: ${existing.length > 0}`);

    if (existing.length > 0) {
      res.json({ id: existing[0].id, fields: existing[0].fields });
      return;
    }

    console.log(`[UserMgmt] Creating new user record...`);
    const record = await base(tableName).create([
      {
        fields: {
          [cols.username]: username,
          [cols.fullName]: fullName || ""
        }
      }
    ]);
    console.log(`[UserMgmt] User created in ${Date.now() - startTime}ms. ID: ${record[0].id}`);
    res.json({ id: record[0].id, fields: record[0].fields });
  } catch (error: any) {
    console.error(`[UserMgmt] FAILED after ${Date.now() - startTime}ms:`, error);
    res.status(500).json({ 
      error: "Failed to manage user", 
      message: error.message,
      airtableError: error.error,
      statusCode: error.statusCode,
      tableName: AIRTABLE_SCHEMA.users.tableName
    });
  }
});


app.post("/api/users/:userId/concepts", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { userId } = req.params;
    const { conceptIds } = req.body;
    console.log(`Updating concepts for user ${userId}:`, conceptIds);
    const tableName = AIRTABLE_SCHEMA.users.tableName;
    const cols = AIRTABLE_SCHEMA.users.columns;

    await base(tableName).update([
      {
        id: userId,
        fields: {
          [cols.learnedConcepts]: conceptIds
        }
      }
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user concepts in Airtable:", error);
    res.status(500).json({ 
      error: "Failed to update concepts", 
      message: error.message,
      airtableError: error.error,
      statusCode: error.statusCode
    });
  }
});

app.post("/api/users/:userId/fields", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { userId } = req.params;
    const { field, value } = req.body;
    const tableName = AIRTABLE_SCHEMA.users.tableName;
    const cols = AIRTABLE_SCHEMA.users.columns;

    // 1. Get the record first to find the actual field names in Airtable
    const record = await base(tableName).find(userId);
    if (!record) {
      return res.status(404).json({ error: "User record not found" });
    }

    // 2. Find the actual field name (case-insensitive match)
    const airtableFieldKey = (cols as any)[field] || field;
    const actualFieldName = Object.keys(record.fields).find(
      key => key.toLowerCase() === airtableFieldKey.toLowerCase()
    ) || airtableFieldKey;

    console.log(`[Airtable] Updating user ${userId}: mapping "${field}" -> "${actualFieldName}"`);

    await base(tableName).update([
      {
        id: userId,
        fields: {
          [actualFieldName]: value
        }
      }
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user field in Airtable:", error);
    res.status(500).json({ 
      error: "Failed to update field", 
      message: error.message
    });
  }
});

app.post("/api/logs", async (req, res) => {
  const tableName = AIRTABLE_SCHEMA.logs.tableName;
  const cols = AIRTABLE_SCHEMA.logs.columns;
  const fields: any = {};

  try {
    const base = getBase();
    if (!base) {
      console.error("Airtable Base not initialized for logs. Check Environment Variables.");
      return res.status(500).send("Airtable configuration missing on server");
    }
    
    const { userId, transcript, conceptsApplied, sessionId, feedback } = req.body;
    console.log("Received log request for userId:", userId);
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Only add fields if they have a non-empty value
    if (transcript) fields[cols.transcript] = transcript;
    if (sessionId) fields[cols.sessionId] = sessionId;
    if (feedback !== undefined && feedback !== null) fields[cols.feedback] = feedback;
    
    // Link to user - only if it's a real Airtable ID (usually starts with 'rec')
    if (userId && typeof userId === 'string' && userId.startsWith('rec')) {
      fields[cols.userLink] = [userId];
    } else {
      console.log(`Skipping user link for non-Airtable ID: ${userId}`);
    }

    // Be extremely careful with these fields - they might be problematic in some Airtable setups
    if (conceptsApplied && typeof conceptsApplied === 'string' && conceptsApplied.trim()) {
      fields[cols.conceptsApplied] = conceptsApplied;
    }
    
    // Try "Conversation_Logs" first, then "Logs" as fallback
    const tableNames = [tableName, "Logs", "Conversation_Logs"];
    const uniqueTableNames = [...new Set(tableNames)];
    
    let lastError = null;
    for (const currentTable of uniqueTableNames) {
      try {
        console.log(`Attempting to log to table: ${currentTable}`);
        
        // Check if record with this sessionId already exists
        let existingRecordId = null;
        if (sessionId) {
          const existing = await base(currentTable).select({
            filterByFormula: `{${cols.sessionId}} = '${sessionId}'`,
            maxRecords: 1
          }).firstPage();
          
          if (existing && existing.length > 0) {
            existingRecordId = existing[0].id;
          }
        }

        if (existingRecordId) {
          console.log(`Updating existing log record: ${existingRecordId} in ${currentTable}`);
          await base(currentTable).update(existingRecordId, fields);
          return res.json({ success: true, id: existingRecordId, updated: true, table: currentTable });
        } else {
          console.log(`Creating new log record in ${currentTable}...`);
          const createdRecord = await base(currentTable).create([{ fields }]);
          console.log("Airtable log record created successfully:", createdRecord[0].id);
          return res.json({ success: true, id: createdRecord[0].id, table: currentTable });
        }
      } catch (e: any) {
        console.warn(`Logging failed on table ${currentTable}: ${e.message}`);
        lastError = e;
      }
    }
    
    throw lastError || new Error("Failed to log to any table");
  } catch (error: any) {
    console.error("Error logging conversation to Airtable:", error);
    // Return more detailed error info to help debug
    res.status(500).json({ 
      error: "Failed to log conversation", 
      message: error.message,
      airtableError: error.error, // Airtable SDK often puts details here
      statusCode: error.statusCode,
      tableName: tableName,
      fieldsSent: fields
    });
  }
});
app.post("/api/feedbacks", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { email, content } = req.body;
    const tableName = AIRTABLE_SCHEMA.feedbacks.tableName;
    const cols = AIRTABLE_SCHEMA.feedbacks.columns;
    
    console.log(`[Feedback] Saving for ${email} to table: ${tableName}`);
    
    // Attempt to find the table first to check column names
    let actualContentCol = cols.content;
    let actualEmailCol = cols.userEmail;
    
    try {
      const sample = await base(tableName).select({ maxRecords: 1 }).firstPage();
      if (sample.length > 0) {
        const existingCols = Object.keys(sample[0].fields);
        actualContentCol = existingCols.find(c => c.toLowerCase().includes('content') || c.toLowerCase().includes('feedback')) || cols.content;
        actualEmailCol = existingCols.find(c => c.toLowerCase().includes('email') || c.toLowerCase().includes('user')) || cols.userEmail;
      }
    } catch (e) {
      console.warn("[Feedback] Could not probe table columns, using defaults");
    }

    const fields: any = {
      [actualContentCol]: content,
      [actualEmailCol]: email || ""
    };
    
    const record = await base(tableName).create([{ fields }]);
    res.json({ id: record[0].id, success: true });
  } catch (error: any) {
    console.error("[Feedback] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/test-airtable", async (req, res) => {
  try {
    const base = getBase();
    if (!base) return res.status(500).json({ error: "Airtable not configured" });
    
    const results: any = {};
    
    // Test Lexicon
    try {
      const lexicon = await base(AIRTABLE_SCHEMA.lexicon.tableName).select({ maxRecords: 1 }).firstPage();
      results.lexicon = { status: "ok", count: lexicon.length };
    } catch (e: any) {
      results.lexicon = { status: "error", message: e.message };
    }
    
    // Test Users
    try {
      const users = await base(AIRTABLE_SCHEMA.users.tableName).select({ maxRecords: 1 }).firstPage();
      results.users = { status: "ok", count: users.length };
    } catch (e: any) {
      results.users = { status: "error", message: e.message };
    }
    
    // Test Logs
    try {
      console.log(`Testing Logs table: ${AIRTABLE_SCHEMA.logs.tableName}`);
      const logs = await base(AIRTABLE_SCHEMA.logs.tableName).select({ maxRecords: 1 }).firstPage();
      results.logs = { status: "ok", count: logs.length, tableName: AIRTABLE_SCHEMA.logs.tableName };
    } catch (e: any) {
      console.error("Logs table test failed:", e.message);
      results.logs = { 
        status: "error", 
        message: e.message, 
        tableName: AIRTABLE_SCHEMA.logs.tableName
      };
    }

    // Test Feedbacks
    try {
      const feedbacks = await base(AIRTABLE_SCHEMA.feedbacks.tableName).select({ maxRecords: 1 }).firstPage();
      results.feedbacks = { status: "ok", count: feedbacks.length, tableName: AIRTABLE_SCHEMA.feedbacks.tableName };
    } catch (e: any) {
      results.feedbacks = { status: "error", message: e.message, tableName: AIRTABLE_SCHEMA.feedbacks.tableName };
    }
    
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  console.log("--- CHAT REQUEST START ---");
  
  try {
    const { message, history, userName, userGender, savedConcepts } = req.body;
    console.log(`User: ${userName || 'anonymous'}, Gender: ${userGender || 'unknown'}, Message: ${message?.substring(0, 50)}...`);

    // Hardcoded welcome message to speed up startup and satisfy user request
    if (message === "START_SESSION_NEW_OR_RETURNING") {
      const welcomeMsg = "היי, אני סינקה. אני כאן כדי לעזור לך להחליף את ה'מלחמות' היומיומיות בשפה של קירבה וחופש. במקום לתת לך פתרונות מוכנים, אני אעזור לך לעצור, לחשוב יחד ולמצוא בעצמך את התשובות המדויקות לך. מה יושב לך על הלב ברגע זה?";
      console.log("Returning hardcoded welcome message immediately");
      return res.status(200).json({ text: welcomeMsg });
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
      throw new Error("AI configuration missing on server.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Fetch lexicon for context (with cache)
    const base = getBase();
    let lexicon = [];
    if (base) {
      const now = Date.now();
      if (lexiconCache.length > 0 && (now - lastLexiconFetch < LEXICON_CACHE_TTL)) {
        lexicon = lexiconCache;
      } else {
        try {
          const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select({ maxRecords: 100 }).all();
          lexicon = records.map(record => ({
            hebrew_term: record.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
            term: record.get(AIRTABLE_SCHEMA.lexicon.columns.term),
            definition_he: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he)
          }));
          lexiconCache = lexicon;
          lastLexiconFetch = now;
        } catch (e: any) {
          lexicon = lexiconCache;
        }
      }
    }

    const nameContext = userName ? `\nUSER_NAME: ${userName}\n` : "";
    const genderContext = userGender ? `\nUSER_GENDER: ${userGender}. Please address the user accordingly.\n` : "";
    const lexiconContext = lexicon.length > 0
      ? `\nAVAILABLE CONCEPTS (Wrap these in [[ ]] when used):\n${lexicon.map(l => l.hebrew_term).join(', ')}\n`
      : "";

    const modelName = "gemini-3-flash-preview";
    console.log(`Starting chat with model: ${modelName}`);
    
    // Add safety settings to avoid false positives in relationship advice
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ];
    
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        const currentModel = attempts === maxAttempts ? "gemini-3-flash-preview" : modelName;
        console.log(`Attempt ${attempts} using model: ${currentModel}`);
        
        const chat = ai.chats.create({
          model: currentModel,
          config: {
            systemInstruction: nameContext + genderContext + lexiconContext + AIRTABLE_SCHEMA.systemInstruction,
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
            safetySettings
          },
          history: (history || []).slice(-15)
        });

        response = await chat.sendMessage({ message });
        break;
      } catch (geminiError: any) {
        console.warn(`Gemini Attempt ${attempts} failed:`, geminiError.message);
        if (attempts >= maxAttempts) throw geminiError;
        if (geminiError.message?.includes('503') || geminiError.message?.includes('overloaded')) {
          await new Promise(resolve => setTimeout(resolve, attempts * 1000));
        } else {
          throw geminiError;
        }
      }
    }

    let responseText = response.text;
    
    if (!responseText) {
      const finishReason = response?.candidates?.[0]?.finishReason;
      console.warn(`[Chat] Empty response text. Finish reason: ${finishReason}`);
      
      if (finishReason === 'SAFETY') {
        responseText = "אני כאן איתך, אבל נראה שהשיחה הגיעה לאזור רגיש מדי עבורי כרגע. בואו ננסה לדבר על הרגשות שעולים בך סביב זה בצורה אחרת.";
      } else {
        responseText = "אני כאן איתך, מקשיבה. תרצי להמשיך ולשתף עוד על מה שקורה?";
      }
    }

    res.json({ text: responseText });
    console.log("--- CHAT REQUEST SUCCESS ---");
  } catch (error: any) {
    console.error("--- CHAT REQUEST FAILED ---", error);
    res.status(500).json({ error: error.message });
  }
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled Server Error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message 
  });
});

// Vite middleware for development
async function startServer() {
  if (process.env.VERCEL) {
    console.log("Running in Vercel environment - skipping server listen and Vite.");
    return;
  }

  console.log("--- SERVER STARTUP ---");
  console.log("Mode:", process.env.NODE_ENV || "development");
  
  if (process.env.NODE_ENV !== "production") {
    try {
      // Use dynamic import to avoid bundling Vite in production
      const viteModule = await import("vite");
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);

      // SPA Fallback for development
      app.get("*", async (req, res, next) => {
        if (req.url.startsWith('/api') || req.url === '/ping') return next();
        try {
          let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
          template = await vite.transformIndexHtml(req.url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (e) {
      console.error("Vite failed to load:", e);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
