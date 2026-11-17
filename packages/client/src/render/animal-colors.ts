import type { Animal } from '@stuffed/sim';

/** Each animal's fabric: main color and belly or accent color (models and HUD icons). */
export const ANIMAL_COLORS: Record<Animal, { main: string; belly: string }> = {
  bear: { main: '#b5835a', belly: '#ecd2ac' },
  frog: { main: '#72c25e', belly: '#e1f2a6' },
  shark: { main: '#7f9fbf', belly: '#f2f4f7' },
  chicken: { main: '#fbf6ef', belly: '#ffffff' },
};
