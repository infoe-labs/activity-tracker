import { type Activity, palette } from "../src/lib/model";
export const defaults: Activity[] = Array.from({ length: 8 }, (_, i) => ({
  id: "test-activity-" + i,
  name: "Test activity " + i,
  color: palette[i],
  icon: "leaf",
  order: i,
  archived: false,
  favorite: false,
}));
