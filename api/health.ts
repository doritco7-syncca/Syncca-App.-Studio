import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    status: "ok", 
    time: new Date().toISOString(),
    env: {
      airtable: !!process.env.AIRTABLE_API_KEY,
      gemini: !!(process.env.GEMINI_API_KEY || process.env.API_KEY)
    }
  });
}
