
export const TRANSCRIPT_FROM_VIDEO_PROMPT = `Based on the attached video content, please provide a JSON object with two keys:
1. "title": A concise and accurate title for the video.
2. "transcript": A detailed, accurate, and well-formatted transcript of the video. If multiple speakers are discernible, try to identify and label them (e.g., Speaker 1:, Speaker 2:). Ensure proper punctuation and paragraph breaks.

Ensure the output is a single, valid JSON object only.`;

export const SUMMARY_FROM_VIDEO_PROMPT = `Based on the attached video content, please provide a JSON object with two keys:
1. "title": A concise and accurate title for the video.
2. "summary": A concise summary of the video. The summary should capture the main points and key takeaways, aiming for 2-4 paragraphs.

Ensure the output is a single, valid JSON object only.`;

export const QUIZ_FROM_TRANSCRIPT_PROMPT = `Based on the video transcript provided below, generate a quiz with at least 10 multiple-choice questions.
For each question, provide:
1. The question text.
2. An array of 3-4 options.
3. The correct answer text (must be one of the options).
4. A brief explanation for the correct answer.

Return the quiz as a JSON array of objects. Each object should represent a question and have the following fields: "question", "options", "answer", "explanation".

Example format for a single question object:
  {
    "question": "What is the main color of the sky on a clear day, according to the transcript?",
    "options": ["Green", "Blue", "Red", "Yellow"],
    "answer": "Blue",
    "explanation": "The transcript mentions that the sky appears blue due to Rayleigh scattering."
  }

Ensure the JSON is valid. The questions should be directly answerable from the information present in the transcript. Do not infer information beyond the provided text.
`;