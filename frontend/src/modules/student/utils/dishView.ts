import type { DishDto } from '../types';
import { DISH_OFF_SALE_TEXT, DISH_SHORTAGE_TEXT } from './submitTexts';

export type DishAvailabilityKind = 'ON_SALE' | 'SHORTAGE' | 'OFF_SALE';

export interface DishView {
  kind: DishAvailabilityKind;
  metaText: string;
  shortageClickable: boolean;
  stepperVisible: boolean;
}

function normalizeAvailable(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

export function toDishView(dish: DishDto): DishView {
  if (dish.onSale !== true) {
    return {
      kind: 'OFF_SALE',
      metaText: DISH_OFF_SALE_TEXT,
      shortageClickable: false,
      stepperVisible: false,
    };
  }
  const available = normalizeAvailable(dish.availableQuantity);
  if (available <= 0) {
    return {
      kind: 'SHORTAGE',
      metaText: DISH_SHORTAGE_TEXT,
      shortageClickable: true,
      stepperVisible: true,
    };
  }
  return {
    kind: 'ON_SALE',
    metaText: `可售 ${available} 份`,
    shortageClickable: false,
    stepperVisible: true,
  };
}