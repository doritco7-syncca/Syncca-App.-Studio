import { GoogleGenAI } from "@google/genai";
import { AIRTABLE_SCHEMA } from "../airtableSchema";

export class MidwifeService {
  private history: any[] = [];
  private lexicon: any[] = [];
  private userName?: string;
  private savedConcepts: any[] = [];
  private ai: any;
  private chat: any;
  public onNameUpdate?: (name: string) => void;

  constructor() {
  }

  async init(savedConcepts: any[] = [], userName?: string) {
    this.userName = userName;
    this.savedConcepts = savedConcepts;
    
    try {
      // Try to load lexicon for context
      if (this.lexicon.length === 0) {
        const lexiconRes = await fetch('/api/lexicon');
        if (lexiconRes.ok) {
          this.lexicon = await lexiconRes.json();
        }
      }

      // Initialize AI using the standard platform key
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        const systemInstruction = this.buildSystemInstruction();
        this.chat = this.ai.chats.create({
          model: "gemini-1.5-flash-latest",
          config: { systemInstruction }
        });
        console.log("Syncca AI initialized successfully");
      } else {
        console.warn("GEMINI_API_KEY not found in environment");
      }
    } catch (e) {
      console.error("Failed to initialize Syncca service", e);
    }
  }

  private buildSystemInstruction() {
    const nameContext = this.userName ? `\nUSER_NAME: The user's name is ${this.userName}.\n` : "";
    const lexiconContext = this.lexicon.length > 0
      ? `\nKNOWLEDGE BASE:\n${this.lexicon.map(l => `- [[${l.hebrew_term}]] (${l.term}): ${l.definition_he}`).join('\n')}\n`
      : "";
    return nameContext + lexiconContext + AIRTABLE_SCHEMA.systemInstruction;
  }

  async sendMessage(message: string) {
    if (!this.chat) {
      await this.init(this.savedConcepts, this.userName);
    }

    if (this.chat) {
      try {
        const response = await this.chat.sendMessage({ message });
        
        // Update history for context
        this.history.push({ role: 'user', parts: [{ text: message }] });
        this.history.push({ role: 'model', parts: [{ text: response.text }] });

        return response.text;
      } catch (e: any) {
        console.error("AI interaction failed", e);
        return "סליחה, משהו השתבש בחיבור. בואי ננסה שוב.";
      }
    }

    return "סליחה, המערכת לא אותחלה כראוי. בואי ננסה לרענן את הדף.";
  }
}
