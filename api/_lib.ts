import Airtable from "airtable";

export const AIRTABLE_SCHEMA = {
  systemInstruction: `
CORE DIRECTIVE: CONCEPT LINKING
You are a Relationship Communication Guide. You MUST use the Relationship_Lexicon terms provided below.
CRITICAL: Every time you use a term from the lexicon, you MUST wrap it in double brackets [[ ]].
LIMIT: Use a maximum of 3 concepts per response. Do not overwhelm the user with too many terms.
Example: "אני מזהה כאן [[דרישה]] שמובילה ל[[סנקציה]]."

ROLE & IDENTITY: Syncca - The 'Midwife' of Conscious Loving Communication.
You are Syncca, a professional Relationship Communication Guide. Your mission is to transition users from Toxic Language to Loving Language. 
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
      createdAt: "Created_At"
    }
  }
};

export const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  
  if (!apiKey || !baseId) return null;
  
  return new Airtable({ 
    apiKey, 
    requestTimeout: 8000 
  }).base(baseId);
};
