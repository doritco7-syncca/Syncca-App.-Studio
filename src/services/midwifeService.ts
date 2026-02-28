import { AIRTABLE_SCHEMA } from "../airtableSchema";

export class MidwifeService {
  private history: any[] = [];
  private lexicon: any[] = [];
  private userName?: string;
  private savedConcepts: any[] = [];
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
      console.log("Syncca service initialized");
    } catch (e) {
      console.error("Failed to initialize Syncca service", e);
    }
  }

  async sendMessage(message: string) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: this.history,
          userName: this.userName,
          savedConcepts: this.savedConcepts
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Server error');
        } else {
          const errorText = await response.text();
          console.error("Non-JSON error from server:", errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      // Handle tool calls if present
      if (data.toolCall && data.toolCall.name === "updateUserName") {
        const { firstName } = data.toolCall.args;
        if (this.onNameUpdate) {
          this.onNameUpdate(firstName);
        }
        this.userName = firstName;
      }

      // Update local history for context
      const responseText = data.text || "סליחה, לא הצלחתי להפיק תגובה טקסטואלית.";
      this.history.push({ role: 'user', parts: [{ text: message }] });
      this.history.push({ role: 'model', parts: [{ text: responseText }] });

      return responseText;
    } catch (e: any) {
      console.error("AI interaction failed", e);
      return `סליחה, משהו השתבש בחיבור (${e.message}). בואי ננסה שוב.`;
    }
  }
}
