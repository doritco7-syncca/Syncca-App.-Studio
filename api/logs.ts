import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  logs: {
    tableName: "Conversation_Logs",
    columns: {
      userLink: "User_Link",
      transcript: "Full_Transcript",
      conceptsApplied: "Concepts_Applied",
      selfReview: "Midwife_Self_Review",
      cortexShift: "Limbic_to_Cortex_Shift",
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
    
    const { userId, transcript, conceptsApplied, selfReview, cortexShift, timestamp } = req.body;
    
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
      [AIRTABLE_SCHEMA.logs.columns.transcript]: transcript,
      [AIRTABLE_SCHEMA.logs.columns.conceptsApplied]: conceptsApplied || "",
      [AIRTABLE_SCHEMA.logs.columns.selfReview]: selfReview || "",
      [AIRTABLE_SCHEMA.logs.columns.cortexShift]: cortexShift || "",
      [AIRTABLE_SCHEMA.logs.columns.createdAt]: timestamp || new Date().toISOString()
    };

    // Only add userLink if userId looks like an Airtable record ID (starts with 'rec')
    if (userId.startsWith('rec')) {
      fields[AIRTABLE_SCHEMA.logs.columns.userLink] = [userId];
    } else {
      console.log("userId is not a record ID, skipping link:", userId);
    }

    await base(targetTable).create([{ fields }]);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Airtable Logging Error Details:", {
      message: error.message,
      stack: error.stack,
      tableName: AIRTABLE_SCHEMA.logs.tableName
    });
    res.status(500).json({ error: error.message, details: "Check server logs for more info" });
  }
}
