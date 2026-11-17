import { clamp, finiteOr0 } from './math.ts';
import type { Input } from './types.ts';

export const NEUTRAL_INPUT: Readonly<Input> = {
  seq: -1,
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  buttons: 0,
  weaponSlot: -1,
  cycleWeapon: false,
  useItemSlot: -1,
};

/** Clamps every field to its legal range. Inputs from clients are untrusted in step 2. */
export function sanitizeInput(input: Input): Input {
  const slot = input.weaponSlot === 0 || input.weaponSlot === 1 ? input.weaponSlot : -1;
  const item = input.useItemSlot === 0 || input.useItemSlot === 1 || input.useItemSlot === 2 ? input.useItemSlot : -1;
  return {
    seq: Math.trunc(finiteOr0(input.seq)),
    moveX: clamp(finiteOr0(input.moveX), -1, 1),
    moveY: clamp(finiteOr0(input.moveY), -1, 1),
    aimX: finiteOr0(input.aimX),
    aimY: finiteOr0(input.aimY),
    buttons: Math.trunc(finiteOr0(input.buttons)) & 0xff,
    weaponSlot: slot,
    cycleWeapon: input.cycleWeapon === true,
    useItemSlot: item,
    dropSlot: Number.isInteger(input.dropSlot) && input.dropSlot! >= 0 && input.dropSlot! <= 5 ? input.dropSlot : -1,
    ...(Number.isInteger(input.viewTick) ? { viewTick: input.viewTick } : {}),
  };
}
