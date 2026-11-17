// Placeholder part catalog for step 1. Renderers map these ids to placeholder geometry now
// and to real models in the Patchwork step. Parts are cosmetic only.
import type { PartLoadout, PartSlot } from './types.ts';

export const PART_CATALOG: Record<PartSlot, readonly string[]> = {
  head: ['bear', 'frog', 'shark'],
  body: ['pink', 'blue', 'mint', 'cream'],
  legs: ['chicken', 'stubby'],
  tail: ['fox', 'bunny'],
  accessory: ['bandage', 'button', 'crown'],
};

export const PART_SLOTS: readonly PartSlot[] = ['head', 'body', 'legs', 'tail', 'accessory'];

export const DEFAULT_PARTS: PartLoadout = {
  head: 'bear',
  body: 'pink',
  legs: 'chicken',
  tail: 'fox',
  accessory: 'bandage',
};
