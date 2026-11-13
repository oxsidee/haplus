import type { HassEntity } from "home-assistant-js-websocket";
import { computeDomain } from "../../../../common/entity/compute_domain";
import { supportsFeature } from "../../../../common/entity/supports-feature";
import { CoverEntityFeature } from "../../../../data/cover";
import type {
  AreaPanelConfig,
  AreaPanelGroupConfig,
} from "../../../../data/frontend";
import type { LightEntity } from "../../../../data/light";
import { isLightOn, isToggleable } from "./scene-index";

export const PRESET_GROUPS = [
  "lights",
  "climate",
  "covers",
  "media",
  "security",
  "others",
  "sensors",
] as const;

export const SENSOR_DOMAINS = ["sensor", "binary_sensor"];

export type GroupKind =
  "light" | "climate" | "cover" | "media_player" | "toggle" | "sensor";

export const GROUP_KINDS: GroupKind[] = [
  "light",
  "climate",
  "cover",
  "media_player",
  "toggle",
  "sensor",
];

export const resolveAreaPanel = (
  defaults: AreaPanelGroupConfig[],
  saved: AreaPanelConfig | undefined,
  exists: (entityId: string) => boolean
): AreaPanelGroupConfig[] => {
  if (!saved) {
    return defaults
      .map((g) => ({ ...g, entities: g.entities.filter(exists) }))
      .filter((g) => g.entities.length);
  }
  const groups = saved.groups.map((g) => ({
    ...g,
    entities: g.entities.filter(exists),
  }));
  const placed = new Set<string>([
    ...saved.groups.flatMap((g) => g.entities),
    ...(saved.hidden ?? []),
  ]);
  for (const d of defaults) {
    const extra = d.entities.filter((e) => exists(e) && !placed.has(e));
    if (!extra.length) {
      continue;
    }
    let target = groups.find((g) => g.id === d.id);
    if (!target) {
      target = { id: d.id, entities: [] };
      groups.push(target);
    }
    target.entities.push(...extra);
    extra.forEach((e) => placed.add(e));
  }
  return groups;
};

export const kindOf = (stateObj: HassEntity): GroupKind => {
  const domain = computeDomain(stateObj.entity_id);
  if (domain === "light") {
    return "light";
  }
  if (domain === "climate") {
    return "climate";
  }
  if (domain === "cover") {
    return "cover";
  }
  if (domain === "media_player") {
    return "media_player";
  }
  if (isToggleable(stateObj.entity_id) && !SENSOR_DOMAINS.includes(domain)) {
    return "toggle";
  }
  return "sensor";
};

export const splitByKind = (states: HassEntity[]) => {
  const byKind = new Map<GroupKind, HassEntity[]>();
  for (const s of states) {
    const kind = kindOf(s);
    if (!byKind.has(kind)) {
      byKind.set(kind, []);
    }
    byKind.get(kind)!.push(s);
  }
  return GROUP_KINDS.filter((k) => byKind.has(k)).map((kind) => ({
    kind,
    states: byKind.get(kind)!,
  }));
};

const unionModes = (lights: LightEntity[]) =>
  Array.from(
    new Set(lights.flatMap((l) => l.attributes.supported_color_modes ?? []))
  );

export const combineLights = (
  lights: LightEntity[],
  name: string
): LightEntity => {
  if (lights.length === 1) {
    return lights[0];
  }
  const on = lights.filter(isLightOn);
  const lead = on[0] ?? lights[0];
  const withBri = on.filter((l) => typeof l.attributes.brightness === "number");
  const brightness = withBri.length
    ? Math.round(
        withBri.reduce((sum, l) => sum + l.attributes.brightness!, 0) /
          withBri.length
      )
    : undefined;
  const mins = lights
    .map((l) => l.attributes.min_color_temp_kelvin)
    .filter((v): v is number => typeof v === "number");
  const maxs = lights
    .map((l) => l.attributes.max_color_temp_kelvin)
    .filter((v): v is number => typeof v === "number");
  return {
    ...lead,
    state: on.length
      ? "on"
      : lights.every((l) => l.state === "unavailable")
        ? "unavailable"
        : "off",
    attributes: {
      ...lead.attributes,
      friendly_name: name,
      brightness,
      supported_color_modes: unionModes(lights),
      min_color_temp_kelvin: mins.length ? Math.min(...mins) : undefined,
      max_color_temp_kelvin: maxs.length ? Math.max(...maxs) : undefined,
      effect_list: undefined,
      supported_features: 0,
    },
  } as LightEntity;
};

export const combineStates = (
  states: HassEntity[],
  name: string
): HassEntity => {
  if (states.length === 1) {
    return states[0];
  }
  const active =
    states.find((s) => s.state === "playing") ??
    states.find((s) => s.state !== "off" && s.state !== "unavailable") ??
    states[0];
  const attributes: HassEntity["attributes"] = {
    ...active.attributes,
    friendly_name: name,
  };
  if (computeDomain(active.entity_id) === "cover") {
    const positions = states
      .map((s) =>
        typeof s.attributes.current_position === "number"
          ? s.attributes.current_position
          : s.state === "closed"
            ? 0
            : 100
      )
      .filter((v): v is number => typeof v === "number");
    attributes.current_position = Math.round(
      positions.reduce((a, b) => a + b, 0) / positions.length
    );
    attributes.supported_features = states.every((s) =>
      supportsFeature(s, CoverEntityFeature.SET_POSITION)
    )
      ? CoverEntityFeature.SET_POSITION +
        CoverEntityFeature.OPEN +
        CoverEntityFeature.CLOSE
      : CoverEntityFeature.OPEN + CoverEntityFeature.CLOSE;
  }
  return {
    ...active,
    attributes,
  };
};

export const newGroupId = () => `g_${Date.now().toString(36)}`;
