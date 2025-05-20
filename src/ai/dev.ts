
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-assets-from-prompt.ts';
import '@/ai/flows/generate-harmonious-palettes.ts';
import '@/ai/flows/suggest-scene-from-audio.ts';
import '@/ai/flows/generate-scene-ambiance.ts';
import '@/ai/flows/generate-visual-overlay.ts'; // Added new flow
