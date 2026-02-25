import express from "express";
import { createServer as createViteServer } from "vite";
import Airtable from "airtable";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { AIRTABLE_SCHEMA } from "./src/airtableSchema.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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

const getBase = () => {
  if (!airtableBase) {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    if (!apiKey || !baseId) {
      console.warn("Airtable credentials missing. API calls will fail.");
      return null;
    }
    
    airtableBase = new Airtable({ apiKey }).base(baseId);
  }
  return airtableBase;
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mode: process.env.NODE_ENV || "development",
    airtableConfigured: !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID),
    geminiConfigured: !!(process.env.GEMINI_API_KEY || process.env.API_KEY)
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
    if (!base) throw new Error("Airtable not configured");
    
    const { username, fullName } = req.body;
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
    console.error("Error managing user:", error);
    res.status(500).json({ error: "Failed to manage user", details: error.message });
  }
});


app.post("/api/users/:userId/concepts", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { userId } = req.params;
    const { conceptIds } = req.body;
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
    console.error("Error updating user concepts:", error);
    res.status(500).json({ error: "Failed to update concepts", details: error.message });
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

    const airtableField = (cols as any)[field];
    if (!airtableField) {
      return res.status(400).json({ error: `Field ${field} not found in schema` });
    }

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
    console.error("Error updating user field:", error);
    res.status(500).json({ error: "Failed to update field", details: error.message });
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
    const tableName = AIRTABLE_SCHEMA.logs.tableName;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const cols = AIRTABLE_SCHEMA.logs.columns;
    
    const fields: any = {
      [cols.userLink]: Array.isArray(userId) ? userId : [userId],
      [cols.transcript]: transcript || "",
      [cols.createdAt]: new Date().toISOString()
    };

    if (conceptsApplied) fields[cols.conceptsApplied] = conceptsApplied;
    if (selfReview) fields[cols.selfReview] = selfReview;
    if (cortexShift) fields[cols.cortexShift] = cortexShift;
    
    await base(tableName).create([{ fields }]);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error logging conversation:", error);
    res.status(500).json({ 
      error: "Failed to log conversation", 
      details: error.message
    });
  }
});
app.post("/api/chat", async (req, res) => {
  console.log("Received chat request");
  try {
    const { message, history, userName, savedConcepts } = req.body;
    
    // Try all possible environment variable names for the Gemini key
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
      console.error("Gemini API key is missing or invalid format");
      return res.status(500).json({ 
        error: "AI configuration missing on server. Please ensure GEMINI_API_KEY is set correctly in Vercel settings." 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Fetch lexicon for context
    const base = getBase();
    let lexicon = [];
    if (base) {
      try {
        const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select().all();
        lexicon = records.map(record => ({
          hebrew_term: record.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
          term: record.get(AIRTABLE_SCHEMA.lexicon.columns.term),
          definition_he: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he)
        }));
      } catch (e) {
        console.warn("Lexicon fetch failed for chat context");
      }
    }

    const nameContext = userName ? `\nUSER_NAME: ${userName}\n` : "";
    const lexiconContext = lexicon.length > 0
      ? `\nKNOWLEDGE BASE:\n${lexicon.map(l => `- [[${l.hebrew_term}]]: ${l.definition_he}`).join('\n')}\n`
      : "";

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: nameContext + lexiconContext + AIRTABLE_SCHEMA.systemInstruction,
      },
      history: history || []
    });

    const response = await chat.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error);
    // If it's a JSON error from Google, try to parse it for a cleaner message
    let errorMessage = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.error.message) errorMessage = parsed.error.message;
    } catch (e) {}
    
    res.status(500).json({ error: errorMessage });
  }
});

// Vite middleware for development
async function startServer() {
  console.log("Starting server in mode:", process.env.NODE_ENV || "development");
  
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
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
  } else {
    console.log("Serving static files from dist");
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.url.startsWith('/api')) return res.status(404).json({ error: "API route not found" });
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  // Only listen if not running as a Vercel function
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
