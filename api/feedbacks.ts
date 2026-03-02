import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  feedbacks: {
    tableName: "Feedbacks",
    columns: {
      userEmail: "User_Email",
      content: "Feedback_Content"
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
  
  console.log("Feedback submission received:", req.body);
  
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { email, content } = req.body;
    
    // Try "Feedbacks" first, then "Feedback" as fallback
    const tableNames = [AIRTABLE_SCHEMA.feedbacks.tableName, "Feedback", "Feedbacks"];
    const uniqueTableNames = [...new Set(tableNames)];
    
    let lastError = null;
    for (const tableName of uniqueTableNames) {
      try {
        console.log(`Attempting to save feedback to table: ${tableName}`);
        const record = await base(tableName).create([{
          fields: { 
            [AIRTABLE_SCHEMA.feedbacks.columns.userEmail]: email || "unknown", 
            [AIRTABLE_SCHEMA.feedbacks.columns.content]: content || ""
          }
        }]);
        console.log(`Feedback saved successfully to ${tableName}. Record ID: ${record[0].id}`);
        return res.json({ id: record[0].id, success: true, table: tableName });
      } catch (e: any) {
        console.warn(`Failed to save to table ${tableName}: ${e.message}`);
        lastError = e;
      }
    }
    
    throw lastError || new Error("Failed to save to any feedback table");
  } catch (error: any) {
    console.error("Airtable Feedback Submission Failed:", error);
    res.status(500).json({ error: error.message });
  }
}
