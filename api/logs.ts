import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  logs: {
    tableName: "Conversation_Logs",
    columns: {
      userLink: "User_Link",
      transcript: "Full_Transcript",
      conceptsApplied: "Concepts_Applied",
      createdAt: "Created_At",
      sessionId: "Session_ID"
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
    
    const { userId, transcript, conceptsApplied, timestamp, sessionId } = req.body;
    
    // Validate userId
    if (!userId) {
      console.warn("Logging attempted without userId");
      return res.status(400).json({ error: "userId is required" });
    }

    // Try to find the correct table name
    const targetTable = AIRTABLE_SCHEMA.logs.tableName;
    
    // Prepare fields
    const fields: any = {
      [AIRTABLE_SCHEMA.logs.columns.transcript]: transcript || "No transcript provided",
      [AIRTABLE_SCHEMA.logs.columns.conceptsApplied]: conceptsApplied || ""
    };

    if (sessionId) {
      fields[AIRTABLE_SCHEMA.logs.columns.sessionId] = sessionId;
    }

    // Link to user
    if (userId && typeof userId === 'string') {
      fields[AIRTABLE_SCHEMA.logs.columns.userLink] = [userId];
    }

    console.log(`Attempting to log for session: ${sessionId || 'none'}`);

    // Check if record with this sessionId already exists
    let existingRecordId = null;
    if (sessionId) {
      const existing = await base(targetTable).select({
        filterByFormula: `{${AIRTABLE_SCHEMA.logs.columns.sessionId}} = '${sessionId}'`,
        maxRecords: 1
      }).firstPage();
      
      if (existing && existing.length > 0) {
        existingRecordId = existing[0].id;
      }
    }

    try {
      if (existingRecordId) {
        console.log(`Updating existing log record: ${existingRecordId}`);
        await base(targetTable).update(existingRecordId, fields);
      } else {
        console.log("Creating new log record...");
        await base(targetTable).create([{ fields }]);
      }
      res.json({ success: true, updated: !!existingRecordId });
    } catch (createError: any) {
      console.error("Airtable Operation Error:", createError);
      
      // If linking failed, try without the link
      if (createError.message?.includes('User_Link') || createError.message?.includes('link')) {
        console.log("Retrying without user link...");
        const { [AIRTABLE_SCHEMA.logs.columns.userLink]: _, ...fieldsWithoutLink } = fields;
        if (existingRecordId) {
          await base(targetTable).update(existingRecordId, fieldsWithoutLink);
        } else {
          await base(targetTable).create([{ fields: fieldsWithoutLink }]);
        }
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
