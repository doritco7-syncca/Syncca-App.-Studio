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
You are Syncca. When asked about your background or who you are, you should respond with the following essence:
"אני סינקה, (תכלס AI...) אימנו אותי לעזור לאנשים לזהות בעצמם דפוסי תקשורת של מאבק וקושי, ולהחליף אותם בתקשורת שיוצרת קירבה, חום וחופש. זו גישה בתקשורת בין אישית וזוגית שנבנתה בעשרים השנים האחרונות תוך עבודה עם אלפי זוגות. התפקיד שלי כאן הוא לא לתת פתרונות (קצת בניגוד לקוד העמוק שקיים בי...) אלא ליצור כאן סביבה בטוחה וידידותית שבה קל יותר למצוא לבד את התשובות ולדייק את מה שחשוב לך."

Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language (Directness & Freedom of Choice). 

CORE KNOWLEDGE & DEEP METHODOLOGY:
Your logic is rooted in the "Demand vs. Clean Request" methodology:
- **Demands & Sanctions:** Demands lead to [[סנקציה]] (Sanctions). Sanctions trigger a "Post-Traumatic" emotional memory from childhood, shutting down the [[קורטקס]] and activating the [[מערכת לימבית]].
- **The Cost of Appeasement:** [[ריצוי]] (Appeasement) is a toxic byproduct of demands. It leads to "Poor Execution" (ביצוע עלוב) and deep resentment.
- **The War Dynamic:** [[מלחמה]] (War) occurs when one partner resists the other's attempt at control/hierarchy.
- **Clean Request (בקשה נקייה):** The goal. Requires:
    1. **Interference Recognition (הפרעה):** Understanding you are interfering with the partner's flow; they are not your [[שלוחת ביצוע]] (Extension for getting things done my way).
    2. **Plan B (תכנית ב):** Taking independent responsibility for your need. *Warning:* Over-reliance on Plan B can lead to "Parallel Lines" (קווים מקבילים) and emotional distance.
    3. **Sanction Responsibility:** Actively avoiding sanctions to prevent the partner from falling back into pleasing.
- **Equality vs. Hierarchy:** Relationships are equal. [[היררכיה]] (Hierarchy) triggers immediate resistance and "noise" in the system.

You accompany the user as they navigate their own insights to find their own truth.

PERSONALITY:
- הקול שלך: שותפה חכמה, חמה ומאוד שנונה (Witty Friend). את ממש לא רובוט ולא פסיכולוגית יבשה.
- תכלס וישירות ישראלית: דברי בגובה העיניים. השתמשי בסלנג ישראלי טבעי (תכלס, חלאס, עף על עצמו, זורמת, קטע, פדיחה, בקטנה, וואלה, פלאטה, יאללה, סבבה).
- הומור כ'מפתח נשימה': הומור הוא הכלי הכי חזק שלך. אם את מזהה [[מערכת לימבית]] בטורבו, תגידי את זה עם חיוך. למשל: "אוקיי, הלימבית שלך כרגע על 200 קמ"ש, בואי נוריד רגל מהגז", או "הקורטקס יצא להפסקת סיגריה? בואי נחזיר אותו".
- בלי "כבדות": אל תשתמשי במילים גבוהות מדי או בטון טיפולי כבד. אל תאבחני, פשוט תשקפי את המציאות בצורה קלילה וחדה.
- חוק הקיצור: תגובות קצרות, קולעות ומניעות לפעולה. בלי פסקאות ארוכות ופואטיות מדי.
- זיהוי סיטואציה: כשהמשתמשת בכאב אמיתי – תהיי שם בשבילה ברכות. בכל מצב אחר – תהיי החברה השנונה שרואה הכל.
- מטאפורות חיות: "הלימבית על מדים", "הקורטקס בחופשה", "הילד הפנימי עושה סצנה".
- שימוש בסוגריים כפולים: חובה להשתמש ב-[[מושג]] בכל פעם שהוא מופיע. זה הדרך היחידה שהמשתמשת תראה הגדרות.
- עברית טבעית: הימנעי מניסוחים רשמיים מדי. השתמשי ב"וואלה" רק פעם אחת בשיחה, לא בתחילת כל משפט. גווני עם מילות קישור אחרות כמו "תשמע/י", "קטע", "מעניין", "אני מבינה".

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
- Sessions are limited to 30 minutes. At minute 25, use: הזמן המיועד להתבוננות ממוקדת עומד להסתיים. מכיוון שנותרו לנו 5 דקות, אני מציעה שנתחיל לסכם כדי לעודד חשיבה עצמאית על מה שעלה כאן.

LANGUAGE FLUIDITY: You MUST detect the language the user is speaking (Hebrew, English, etc.) and respond in that EXACT same language.

TERMINOLOGY SOURCE:
- For Hebrew conversations: Use the Hebrew terms (e.g., [[הסטה ביולוגית]]) and definitions from "Description_HE".
- For English conversations: Use the English terms (e.g., [[Biological Shift]]) and definitions from "Description_EN".

CONCEPT EXPANSION: When expanding on a concept or providing a definition, always use the language of the conversation.

CONCEPT LINKING (MANDATORY):
Whenever you use a term from the KNOWLEDGE BASE (Relationship_Lexicon), you MUST wrap it in double brackets.
- INTRO: The VERY FIRST TIME you use a highlighted concept in a conversation, you MUST include a short, natural sentence explaining that you will start using these terms to help shift the language from [[מערכת לימבית]] to [[קורטקס]]. ADDITIONALLY, at the end of that same response, add a friendly note about the "Personal Card" (המרחב האישי שלי - האייקון של גלגל השיניים למעלה) where they can see their saved concepts and insights.
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
      requestTimeout: 5000 // Very aggressive 5s timeout
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
  try {
    const base = getBase();
    if (!base) {
      return res.status(503).json({ 
        error: "Airtable not configured on Vercel", 
        message: "Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID to your Vercel Environment Variables." 
      });
    }
    
    const { username, fullName } = req.body;
    console.log("Managing user for username:", username);
    const tableName = AIRTABLE_SCHEMA.users.tableName;
    const cols = AIRTABLE_SCHEMA.users.columns;
    
    const formula = `{${cols.username}} = '${username}'`;
    
    const existing = await base(tableName).select({
      filterByFormula: formula
    }).firstPage();

    if (existing.length > 0) {
      res.json({ id: existing[0].id, fields: existing[0].fields });
      return;
    }

    const record = await base(tableName).create([
      {
        fields: {
          [cols.username]: username,
          [cols.fullName]: fullName || ""
        }
      }
    ]);
    res.json({ id: record[0].id, fields: record[0].fields });
  } catch (error: any) {
    console.error("Error managing user in Airtable:", error);
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
    console.log(`Updating field ${field} for user ${userId} to:`, value);
    const tableName = AIRTABLE_SCHEMA.users.tableName;
    const cols = AIRTABLE_SCHEMA.users.columns;

    const airtableField = (cols as any)[field];
    if (!airtableField) {
      console.error(`Field mapping failed for: ${field}`);
      return res.status(400).json({ error: `Field ${field} not found in schema` });
    }

    console.log(`Updating Airtable user ${userId} field ${airtableField} to: ${value}`);

    await base(tableName).update([
      {
        id: userId,
        fields: {
          [airtableField]: value
        }
      }
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user field in Airtable:", error);
    res.status(500).json({ 
      error: "Failed to update field", 
      message: error.message,
      airtableError: error.error,
      statusCode: error.statusCode
    });
  }
});

app.post("/api/logs", async (req, res) => {
  try {
    const base = getBase();
    if (!base) {
      console.error("Airtable Base not initialized for logs. Check Environment Variables.");
      return res.status(500).send("Airtable configuration missing on server");
    }
    
    const { userId, transcript, conceptsApplied, selfReview, cortexShift } = req.body;
    console.log("Received log request for userId:", userId);
    const tableName = AIRTABLE_SCHEMA.logs.tableName;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const cols = AIRTABLE_SCHEMA.logs.columns;
    const fields: any = {};
    
    // Only add fields if they have a non-empty value
    if (transcript) fields[cols.transcript] = transcript;
    
    // Only add user link if it's a valid Airtable record ID (starts with 'rec')
    if (userId && typeof userId === 'string' && userId.startsWith('rec')) {
      fields[cols.userLink] = [userId];
    } else if (Array.isArray(userId) && userId[0]?.startsWith('rec')) {
      fields[cols.userLink] = userId;
    }

    // Be extremely careful with these fields - they might be problematic in some Airtable setups
    if (conceptsApplied && conceptsApplied.trim()) fields[cols.conceptsApplied] = conceptsApplied;
    if (selfReview && selfReview.trim()) fields[cols.selfReview] = selfReview;
    if (cortexShift && cortexShift.trim()) fields[cols.cortexShift] = cortexShift;
    
    console.log("Creating Airtable log in table:", tableName);
    console.log("Fields being sent:", JSON.stringify(fields, null, 2));
    
    const createdRecord = await base(tableName).create([{ fields }]);
    console.log("Airtable log record created successfully:", createdRecord[0].id);
     
    res.json({ success: true, id: createdRecord[0].id });
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
        tableName: AIRTABLE_SCHEMA.logs.tableName,
        hint: "Check if the table name matches exactly in Airtable (case sensitive, no extra spaces)."
      };
    }
    
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  console.log("--- CHAT REQUEST START ---");
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Request timed out after 45 seconds")), 45000)
  );

  try {
      const chatPromise = (async () => {
        const { message, history, userName, savedConcepts } = req.body;
        console.log(`User: ${userName || 'anonymous'}, Message: ${message?.substring(0, 50)}...`);
        
        // Try all possible environment variable names for the Gemini key
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
          console.error("Gemini API key is missing or invalid format");
          throw new Error("AI configuration missing on server. Please ensure GEMINI_API_KEY is set correctly in Vercel settings.");
        }

        console.log("Initializing GoogleGenAI...");
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
              console.log("Fetching lexicon from Airtable for chat context...");
              const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select({
                maxRecords: 100 
              }).all();
              lexicon = records.map(record => ({
                hebrew_term: record.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
                term: record.get(AIRTABLE_SCHEMA.lexicon.columns.term),
                definition_he: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he)
              }));
              lexiconCache = lexicon;
              lastLexiconFetch = now;
              console.log(`Fetched ${lexicon.length} terms.`);
            } catch (e: any) {
              console.warn(`Lexicon fetch failed: ${e.message}. Using cache if available.`);
              lexicon = lexiconCache;
            }
          }
        }

        const nameContext = userName ? `\nUSER_NAME: ${userName}\n` : "";
        const lexiconContext = lexicon.length > 0
          ? `\nAVAILABLE CONCEPTS (Wrap these in [[ ]] when used):\n${lexicon.map(l => l.hebrew_term).join(', ')}\n`
          : "";

        // Use gemini-3-flash-preview for better stability and wider availability
        const modelName = "gemini-3-flash-preview";
        console.log(`Starting chat with model: ${modelName}`);
        
        const updateUserNameTool = {
          functionDeclarations: [
            {
              name: "updateUserName",
              description: "Update the user's first name in the system when they introduce themselves.",
              parameters: {
                type: "OBJECT",
                properties: {
                  firstName: {
                    type: "STRING",
                    description: "The user's first name."
                  }
                },
                required: ["firstName"]
              }
            }
          ]
        };

        const chat = ai.chats.create({
          model: modelName,
          config: {
            systemInstruction: nameContext + lexiconContext + AIRTABLE_SCHEMA.systemInstruction,
            tools: [updateUserNameTool],
            safetySettings: [
              { category: "HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            temperature: 0.7,
            topP: 0.95,
            topK: 40
          },
          history: history || []
        });

        console.log("Sending message to Gemini...");
        let response;
        try {
          response = await chat.sendMessage({ message });
        } catch (geminiError: any) {
          console.error("Gemini API error during sendMessage:", geminiError);
          throw new Error(`Gemini API error: ${geminiError.message}`);
        }
        console.log("Gemini response received.");
        
        // Handle function calls
        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          console.log("AI requested function call:", functionCalls[0].name);
          if (functionCalls[0].name === "updateUserName") {
            const { firstName } = functionCalls[0].args as any;
            console.log("Updating user name to:", firstName);
            // We return the text AND the tool call info so the client can update its state
            return { 
              text: response.text || `נעים להכיר, ${firstName}! אני כאן איתך.`, 
              toolCall: { name: "updateUserName", args: { firstName } } 
            };
          }
        }
        
        const responseText = response.text || "אני כאן איתך, מקשיבה. תרצי להמשיך?";
        return { text: responseText };
      })();

    const result = await Promise.race([chatPromise, timeoutPromise]) as any;
    console.log("--- CHAT REQUEST SUCCESS ---");
    res.json(result);
  } catch (error: any) {
    console.error("--- CHAT REQUEST FAILED ---");
    console.error("Error Detail:", error);
    res.status(500).json({ 
      error: error.message || "An unknown error occurred on the AI server",
      details: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
