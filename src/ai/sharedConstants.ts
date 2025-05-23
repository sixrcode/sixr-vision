
export const defaultSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  // Consider adding 'HARM_CATEGORY_CIVIC_INTEGRITY' if relevant for your use case.
];

export const MODEL_NAME_TEXT_GENERATION = 'googleai/gemini-2.0-flash';
export const MODEL_NAME_IMAGE_GENERATION = 'googleai/gemini-2.0-flash-exp';
