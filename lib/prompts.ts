
export const COMBINED_DATA_FROM_VIDEO_PROMPT = `Analyze the video and provide the following:
1. A concise and accurate title for the video.
2. A summary of the video, capturing the main points and key takeaways in 2-4 paragraphs.
3. A detailed, accurate, and well-formatted transcript. If possible, label different speakers (e.g., Speaker 1:, Speaker 2:).`;

export const QUIZ_FROM_TRANSCRIPT_PROMPT = `Based on the video transcript provided below, generate a quiz with at least 10 multiple-choice questions.
The questions should be directly answerable from the information present in the transcript. Do not infer information beyond the provided text.
For each question, provide the question, 3-4 options, the correct answer, and a brief explanation.
`;
