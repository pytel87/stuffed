import type { Animal } from '@stuffed/sim';

/** Each animal's fabric: main color and belly or accent color (models and HUD icons). */
export const ANIMAL_COLORS: Record<Animal, { main: string; belly: string }> = {
  bear: { main: '#b5835a', belly: '#ecd2ac' },
  frog: { main: '#72c25e', belly: '#e1f2a6' },
  shark: { main: '#7f9fbf', belly: '#f2f4f7' },
  chicken: { main: '#fbf6ef', belly: '#ffffff' },
  dino: { main: '#45b39d', belly: '#f2e2a0' },
  owl: { main: '#9a6b45', belly: '#f3dfb6' },
  axolotl: { main: '#f6a7c1', belly: '#ffe0ea' },
  penguin: { main: '#34405a', belly: '#fbfbfb' },
  bunny: { main: '#c7b6ea', belly: '#f6f0ff' },
  unicorn: { main: '#fdf3fb', belly: '#ffe3f1' },
  cat: { main: '#f2b85e', belly: '#fff3dc' },
  fox: { main: '#e8743b', belly: '#fff7ee' },
  panda: { main: '#f7f5ef', belly: '#ffffff' },
  pig: { main: '#f7a8b8', belly: '#ffd3dc' },
  lion: { main: '#e9b24f', belly: '#fbe6b8' },
  elephant: { main: '#a3b3c9', belly: '#d8e1ee' },
};
