import { GoogleGenAI, Type } from "@google/genai";
import { GameState, StrategyAnalysis, GameEntity, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED" || JSON.stringify(error).includes("429");
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`Rate limit hit. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export interface AnalysisResult {
  entities: GameEntity[];
  strategy?: StrategyAnalysis;
}

export async function analyzeGameFrame(base64Image: string, history: GameState[]): Promise<AnalysisResult> {
  const prompt = `
    You are a universal game AI observer and professional esports strategy engine. 
    
    TASK 1: Analyze this screenshot of a video game. 
    Identify the player, enemies, and any projectiles. 
    For each entity, provide its approximate [x, y] coordinates (0-100 scale where 0,0 is top-left and 100,100 is bottom-right), health percentage (if visible), and current action/state.
    
    TASK 2: Analyze the provided game history and predict the enemy's next move, overall strategy, and a multi-step plan.
    For each step in the multi-step plan, provide a description and an approximate target [x, y] coordinate.
    
    Game History (last 5 states, essential data only):
    ${JSON.stringify(history.slice(-5).map(s => ({
      t: s.timestamp,
      e: s.entities.map(e => ({ t: e.type, p: e.position, s: e.state }))
    })), null, 2)}
  `;

  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { 
                      type: Type.STRING,
                      enum: ["player", "enemy", "projectile", "unknown"]
                    },
                    position: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER }
                      },
                      required: ["x", "y"]
                    },
                    health: { type: Type.NUMBER },
                    state: { type: Type.STRING }
                  },
                  required: ["id", "type", "position", "state"]
                }
              },
              strategy: {
                type: Type.OBJECT,
                properties: {
                  currentStrategy: { type: Type.STRING },
                  predictedNextMove: { type: Type.STRING },
                  threatLevel: { 
                    type: Type.STRING,
                    enum: ["low", "medium", "high"]
                  },
                  confidence: { type: Type.NUMBER },
                  predictions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        action: { type: Type.STRING },
                        probability: { type: Type.NUMBER }
                      },
                      required: ["action", "probability"]
                    }
                  },
                  multiStepPlan: {
                    type: Type.ARRAY,
                    items: { 
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING },
                        targetPosition: {
                          type: Type.OBJECT,
                          properties: {
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                          },
                          required: ["x", "y"]
                        }
                      },
                      required: ["description", "targetPosition"]
                    }
                  }
                },
                required: ["currentStrategy", "predictedNextMove", "threatLevel", "confidence", "predictions", "multiStepPlan"]
              }
            },
            required: ["entities"]
          }
        },
      });

      const data = JSON.parse(response.text || "{}");
      return {
        entities: (data.entities || []) as GameEntity[],
        strategy: data.strategy as StrategyAnalysis | undefined
      };
    });
  } catch (error) {
    console.error("Game Frame Analysis Error:", error);
    return { entities: [] };
  }
}

// Keep individual functions as fallbacks or for specific use cases if needed, 
// but we'll primarily use analyzeGameFrame now.
export async function analyzeScreen(base64Image: string): Promise<GameEntity[]> {
  const res = await analyzeGameFrame(base64Image, []);
  return res.entities;
}

export async function analyzeStrategy(history: GameState[]): Promise<StrategyAnalysis> {
  const res = await analyzeGameFrame("", history);
  return res.strategy || {
    currentStrategy: "Unknown",
    predictedNextMove: "Unknown",
    threatLevel: "low",
    confidence: 0,
    predictions: [],
    multiStepPlan: []
  };
}

export async function processTacticalQuery(
  query: string, 
  history: GameState[], 
  currentVision: GameEntity[],
  chatHistory: ChatMessage[]
): Promise<string> {
  const prompt = `
    You are a professional esports tactical consultant. 
    A user is asking a question about the current game state. 
    Use the provided game history, current vision data, and previous conversation to provide a concise, expert tactical answer.
    
    Current Vision (what the AI sees now):
    ${JSON.stringify(currentVision, null, 2)}
    
    Game History (last 5 states):
    ${JSON.stringify(history.slice(-5).map(s => ({
      t: s.timestamp,
      e: s.entities.map(e => ({ t: e.type, p: e.position, s: e.state }))
    })), null, 2)}
    
    Previous Conversation:
    ${chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
    
    USER QUERY: "${query}"
    
    Provide a tactical, professional answer. If the query is about something not visible or in history, state that clearly.
  `;

  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        }
      });
      return response.text || "I'm sorry, I couldn't analyze the tactical situation right now.";
    });
  } catch (error) {
    console.error("Tactical Query Error:", error);
    return "Tactical analysis failed. Please try again.";
  }
}
