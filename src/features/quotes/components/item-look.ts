import {
  Armchair,
  CookingPot,
  Heading,
  Package,
  PenLine,
  Truck,
  Users,
  Wine,
  type LucideIcon,
} from 'lucide-react-native';

import type { Tint } from '@/theme/tokens';

import type { EditorItem, ItemType } from '../types';

/** Symbol und Farbton je Positionsart – in der Liste, im Hinzufügen-Blatt und im Bearbeiten-Blatt gleich. */
export const ITEM_LOOK: Record<ItemType | 'heading', { icon: LucideIcon; tint: Tint }> = {
  package: { icon: Package, tint: 'teal' },
  dish: { icon: CookingPot, tint: 'amber' },
  service: { icon: Users, tint: 'indigo' },
  beverage: { icon: Wine, tint: 'rose' },
  equipment: { icon: Armchair, tint: 'violet' },
  travel: { icon: Truck, tint: 'sky' },
  custom: { icon: PenLine, tint: 'slate' },
  heading: { icon: Heading, tint: 'slate' },
};

export const lookOf = (item: EditorItem) => ITEM_LOOK[item.is_heading ? 'heading' : item.type];
