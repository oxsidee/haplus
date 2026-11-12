import {
  mdiGarage,
  mdiLightbulbGroup,
  mdiLock,
  mdiPlayCircleOutline,
  mdiShieldCheck,
  mdiThermostat,
  mdiWindowShutter,
} from "@mdi/js";

export const DOCK_GROUP_PREFIX = "group:";

export const DOCK_GROUPS = [
  "lights",
  "climate",
  "locks",
  "covers",
  "gates",
  "security",
  "media",
] as const;

export type DockGroup = (typeof DOCK_GROUPS)[number];

export const DOCK_GROUP_ICONS: Record<DockGroup, string> = {
  lights: mdiLightbulbGroup,
  climate: mdiThermostat,
  locks: mdiLock,
  covers: mdiWindowShutter,
  gates: mdiGarage,
  security: mdiShieldCheck,
  media: mdiPlayCircleOutline,
};

export const DEFAULT_DOCK_ITEMS = DOCK_GROUPS.filter((g) => g !== "media").map(
  (g) => `${DOCK_GROUP_PREFIX}${g}`
);

export const dockGroupOf = (item: string): DockGroup | undefined => {
  if (!item.startsWith(DOCK_GROUP_PREFIX)) {
    return undefined;
  }
  const group = item.slice(DOCK_GROUP_PREFIX.length) as DockGroup;
  return DOCK_GROUPS.includes(group) ? group : undefined;
};
