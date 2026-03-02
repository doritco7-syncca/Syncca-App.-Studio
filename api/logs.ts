import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  logs: {
    tableName: "Conversation_Logs",
    columns: {
      userLink: "User_Link",
      transcript: "Full_Transcript",
      conceptsApplied: "Concepts_Applied",
      createdAt: "Created_At"
    }
  }
};

const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey, requestTimeout: 5000 }).base(baseId);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { userId, transcript, conceptsApplied, timestamp } = req.body;
    
    // Validate userId
    if (!userId) {
      console.warn("Logging attempted without userId");
      return res.status(400).json({ error: "userId is required" });
    }

    // Try to find the correct table name (handle case sensitivity or plural/singular)
    const tableNames = [AIRTABLE_SCHEMA.logs.tableName, "Logs", "logs", "Conversation Logs"];
    let targetTable = tableNames[0];
    
    // Create record
    const fields: any = {
      [AIRTABLE_SCHEMA.logs.columns.transcript]: transcript || "No transcript provided",
      [AIRTABLE_SCHEMA.logs.columns.conceptsApplied]: conceptsApplied || ""
    };

    // Link to user - Airtable accepts both record IDs (rec...) and primary field values (emails)
    // We wrap this in a try-catch or check if it's a valid ID to avoid failing the whole log
    if (userId && typeof userId === 'string') {
      if (userId.startsWith('rec')) {
        fields[AIRTABLE_SCHEMA.logs.columns.userLink] = [userId];
      } else {
        // If it's an email, Airtable might still accept it if it's the primary field
        fields[AIRTABLE_SCHEMA.logs.columns.userLink] = [userId];
      }
    }

    console.log("Attempting to create log record in Airtable...");
    try {
      await base(targetTable).create([{ fields }]);
      console.log("Log record created successfully");
      res.json({ success: true });
    } catch (createError: any) {
      console.error("Airtable Create Error:", createError);
      
      // If linking failed, try creating without the link
      if (createError.message?.includes('User_Link') || createError.message?.includes('link')) {
        console.log("Retrying log creation without user link...");
        const { [AIRTABLE_SCHEMA.logs.columns.userLink]: _, ...fieldsWithoutLink } = fields;
        await base(targetTable).create([{ fields: fieldsWithoutLink }]);
        return res.json({ success: true, warning: "Logged without user link due to error" });
      }
      
      throw createError;
    }
  } catch (error: any) {
    console.error("Airtable Logging Error Details:", {
      message: error.message,
      stack: error.stack,
      tableName: AIRTABLE_SCHEMA.logs.tableName
    });
    res.status(500).json({ error: error.message, details: "Check server logs for more info" });
  }
}
