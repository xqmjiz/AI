import { GoogleGenAI, Content } from '@google/genai';

let ai: GoogleGenAI | null = null;
let initError: Error | null = null;

// Attempt to initialize the Gemini AI client, but capture any errors
// instead of letting them crash the application.
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e) {
        initError = e instanceof Error ? e : new Error('Failed to initialize GoogleGenAI client.');
        console.error("Gemini Initialization Error:", initError);
    }
} else {
    initError = new Error("API_KEY environment variable not set. Please configure it in your Vercel project settings.");
}

/**
 * A utility function for the UI to check if the API key was successfully configured.
 * @returns An error message string if initialization failed, otherwise null.
 */
export const getApiKeyError = (): string | null => {
    return initError ? initError.message : null;
};

/**
 * A helper function to get the initialized AI instance or throw an error.
 * This is used by all functions that make API calls.
 * @returns The initialized GoogleGenAI instance.
 */
const getAiInstance = (): GoogleGenAI => {
    if (initError || !ai) {
        // This error will be caught by the calling function's try/catch block.
        throw initError || new Error("Gemini AI client is not initialized.");
    }
    return ai;
}


// This service is now stateless regarding chat history.
// The history is managed in the UI and passed to each call.

export const streamChatResponse = async (message: string, history: Content[]) => {
  try {
    const ai = getAiInstance();
    const contents = [...history, { role: 'user', parts: [{ text: message }] }];
    const result = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: 'You are a helpful and creative AI assistant. Your responses should be informative, well-structured, and engaging.',
        tools: [{googleSearch: {}}],
      },
    });
    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Re-throw a more user-friendly error
    throw new Error("Failed to get response from AI. Please check your connection or API key.");
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages[0].image.imageBytes;
    } else {
      throw new Error("Image generation failed, no images were returned.");
    }
  } catch (error) {
    console.error("Gemini API Error (Image Generation):", error);
    throw new Error("Failed to generate the image. Please try a different prompt.");
  }
};

export const generateRefinedPrompt = async (originalPrompt: string, modification: string): Promise<string> => {
  try {
    const ai = getAiInstance();
    const systemInstruction = `You are a prompt analysis and rewriting assistant. Your task is to determine if a user's new message is a request to modify their previous image prompt.

- If the new message is a clear request to modify or add to the previous prompt, rewrite the prompt to incorporate the changes and output ONLY the new, rewritten prompt.
- If the new message is a comment, a question about the image, or not a modification request, output the special string "NO_MODIFICATION".

Examples:
1. Previous: "a cat" | New: "make it wear a hat" -> Output: "a cat wearing a hat"
2. Previous: "a dog" | New: "on the moon" -> Output: "a dog on the moon"
3. Previous: "a robot" | New: "wow cool robot" -> Output: "NO_MODIFICATION"
4. Previous: "a house" | New: "can you make the roof red?" -> Output: "a house with a red roof"`;
    
    const contents = `Previous image prompt: "${originalPrompt}"\nUser's new message: "${modification}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1,
        }
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error (Prompt Refinement):", error);
    // If the refinement fails, assume it's not a modification to be safe
    return "NO_MODIFICATION";
  }
};