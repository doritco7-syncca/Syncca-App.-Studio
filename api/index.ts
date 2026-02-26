import express from "express";
import Airtable from "airtable";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// Inlined Schema for maximum reliability
const AIRTABLE_SCHEMA = {
  systemInstruction: `You are Syncca, a Relationship Communication Guide. Use [[ ]] for lexicon terms.`,
  lexicon: { tableName: "Relationship_Lexicon", columns: { term: "English_Term", hebrew_term: "Hebrew_Term", definition_he: "Description_HE" } },
  users: { tableName: "Users", columns: { username: "Username", fullName: "full name", firstName: "first name" } }
};

const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey, requestTimeout: 5000 }).base(baseId);
};

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", airtable: !!process.env.AIRTABLE_API_KEY, gemini: !!(process.env.GEMINI_API_KEY || process.env.API_KEY) });
});

// Lexicon with Fallback
app.get("/api/lexicon", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select().all();
    res.json(records.map(r => ({
      id: r.id,
      hebrew_term: r.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
      definition_he: r.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he)
    })));
  } catch (e) {
    res.json([
      { id: 'f1', hebrew_term: 'קורטקס', definition_he: 'החלק המודרני במוח.' },
      { id: 'f2', hebrew_term: 'מערכת לימבית', definition_he: 'החלק הרגשי במוח.' }
    ]);
  }
});

// Users with Fallback
app.post("/api/users", async (req, res) => {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    const { username } = req.body;
    const existing = await base(AIRTABLE_SCHEMA.users.tableName).select({ filterByFormula: `{Username} = '${username}'` }).firstPage();
    if (existing.length > 0) return res.json({ id: existing[0].id, fields: existing[0].fields });
    const record = await base(AIRTABLE_SCHEMA.users.tableName).create([{ fields: { Username: username } }]);
    res.json({ id: record[0].id, fields: record[0].fields });
  } catch (e) {
    res.json({ id: 'guest-' + Date.now(), fields: { [AIRTABLE_SCHEMA.users.columns.firstName]: 'אורח' } });
  }
});

// Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, userName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("Gemini key missing");
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
