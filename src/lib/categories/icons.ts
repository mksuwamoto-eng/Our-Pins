import {
  UtensilsCrossed,
  Coffee,
  Croissant,
  Wine,
  ShoppingBag,
  ShoppingCart,
  TrainFront,
  Sparkles,
  Droplet,
  Mountain,
  Users,
  Stethoscope,
  Smile,
  Scale,
  KeyRound,
  Calculator,
  HeartHandshake,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

// Map the Lucide icon NAME stored on each category (supabase/seed.sql) to its
// component. Keyed by name (not slug) so a future category can reuse an icon
// without a code change; unknown names fall back to a generic pin.
const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Coffee,
  Croissant,
  Wine,
  ShoppingBag,
  ShoppingCart,
  TrainFront,
  Sparkles,
  Droplet,
  Mountain,
  Users,
  Stethoscope,
  Smile,
  Scale,
  KeyRound,
  Calculator,
  HeartHandshake,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name ? ICONS[name] : undefined) ?? MapPin;
}
