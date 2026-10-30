import {
  BriefcaseBusiness,
  Laptop,
  Sparkles,
  Coffee,
  Utensils,
  Heart,
  User,
  Moon,
  Leaf,
} from "lucide-react";
import type { Activity } from "../lib/model";
export const icons: Record<string, typeof Leaf> = {
  briefcase: BriefcaseBusiness,
  laptop: Laptop,
  sparkles: Sparkles,
  coffee: Coffee,
  utensils: Utensils,
  heart: Heart,
  user: User,
  moon: Moon,
  leaf: Leaf,
};
export function ActivityIcon({
  activity,
  size = 20,
}: {
  activity: Activity;
  size?: number;
}) {
  const Icon = icons[activity.icon] ?? Leaf;
  return <Icon size={size} strokeWidth={1.7} />;
}
