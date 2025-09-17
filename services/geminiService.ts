import { GoogleGenAI, Part, Type } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API key is missing. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

/**
 * Generates content (summary or transcript) from a video.
 * Note: This assumes the execution environment has a proxy that can resolve a public
 * YouTube URL to a file URI accessible by the Gemini API.
 * @param prompt The prompt for the AI.
 * @param videoUrl The public URL of the YouTube video.
 * @returns The generated text.
 */
export async function generateContentFromVideo(prompt: string, videoUrl: string): Promise<string> {
  try {
    const videoFilePart: Part = {
      fileData: {
        mimeType: 'video/mp4',
        fileUri: videoUrl,
      },
    };

    const textPart: Part = { text: prompt };

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [textPart, videoFilePart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A concise and accurate title for the video."
            },
            summary: {
              type: Type.STRING,
              description: "A concise summary of the video, 2-4 paragraphs."
            },
            transcript: {
              type: Type.STRING,
              description: "A detailed and accurate transcript of the video."
            }
          },
          required: ['title', 'summary', 'transcript']
        }
      }
    });
    
    return response.text;

  } catch (error) {
    console.error("Error generating content from video:", error);
    throw new Error(`Failed to process video. Please check the video URL and your API key. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a quiz from a given text transcript.
 * @param promptWithTranscript The prompt including the full transcript.
 * @returns A JSON string representing the quiz.
 */
export async function generateQuizFromTranscript(promptWithTranscript: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: promptWithTranscript,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "The quiz question."
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "An array of 3-4 multiple-choice options."
              },
              answer: {
                type: Type.STRING,
                description: "The correct answer, which must be one of the options."
              },
              explanation: {
                type: Type.STRING,
                description: "A brief explanation for why the answer is correct."
              }
            },
            required: ['question', 'options', 'answer', 'explanation']
          }
        }
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error(`Failed to generate quiz. The model may have had an issue creating the content. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}
