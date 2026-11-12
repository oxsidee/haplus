import type { HassEntity } from "home-assistant-js-websocket";
import memoizeOne from "memoize-one";
import { DOMAINS_TOGGLE } from "../../../../common/const";
import { computeDomain } from "../../../../common/entity/compute_domain";
import { getEntityAreaId } from "../../../../common/entity/context/get_entity_context";
import { UNAVAILABLE, UNKNOWN } from "../../../../data/entity/entity";
import type { HomeAssistant } from "../../../../types";

export interface SceneIndex {
  byDomain: Record<string, string[]>;
  byArea: Record<string, string[]>;
  areaOf: Record<string, string | undefined>;
}

export const buildSceneIndex = memoizeOne(
  (
    entities: HomeAssistant["entities"],
    devices: HomeAssistant["devices"],
    stateIds: string
  ): SceneIndex => {
    const byDomain: Record<string, string[]> = {};
    const byArea: Record<string, string[]> = {};
    const areaOf: Record<string, string | undefined> = {};
    for (const entityId of stateIds.split(",")) {
      if (!entityId) {
        continue;
      }
      const entry = entities[entityId];
      if (entry && (entry.hidden || entry.entity_category)) {
        continue;
      }
      const domain = computeDomain(entityId);
      (byDomain[domain] ||= []).push(entityId);
      const areaId = entry
        ? (getEntityAreaId(entityId, entities, devices) ?? undefined)
        : undefined;
      areaOf[entityId] = areaId;
      if (areaId) {
        (byArea[areaId] ||= []).push(entityId);
      }
    }
    return { byDomain, byArea, areaOf };
  }
);

const stateKeys = memoizeOne((states: HomeAssistant["states"]) =>
  Object.keys(states).sort().join(",")
);

export const getSceneIndex = (hass: HomeAssistant): SceneIndex =>
  buildSceneIndex(hass.entities, hass.devices, stateKeys(hass.states));

export const statesOf = (hass: HomeAssistant, ids: string[] | undefined) =>
  (ids || [])
    .map((id) => hass.states[id])
    .filter((s): s is HassEntity => s !== undefined);

export const deviceClassOf = (stateObj: HassEntity): string | undefined =>
  stateObj.attributes.device_class;

export const isOpening = (stateObj: HassEntity) =>
  computeDomain(stateObj.entity_id) === "binary_sensor" &&
  ["window", "door", "garage_door", "opening"].includes(
    deviceClassOf(stateObj) || ""
  ) &&
  stateObj.state === "on";

export const isAvailable = (stateObj: HassEntity) =>
  stateObj.state !== UNAVAILABLE && stateObj.state !== UNKNOWN;

export const isLightOn = (stateObj: HassEntity) => stateObj.state === "on";

export const brightnessPct = (stateObj: HassEntity): number | undefined => {
  const b = stateObj.attributes.brightness;
  return typeof b === "number" ? Math.round((b / 255) * 100) : undefined;
};

export const averageBrightness = (lights: HassEntity[]) => {
  const values = lights
    .filter(isLightOn)
    .map(brightnessPct)
    .filter((v): v is number => v !== undefined);
  if (!values.length) {
    return undefined;
  }
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
};

export const numericState = (stateObj?: HassEntity): number | undefined => {
  if (
    !stateObj ||
    stateObj.state === UNAVAILABLE ||
    stateObj.state === UNKNOWN
  ) {
    return undefined;
  }
  const v = Number(stateObj.state);
  return Number.isFinite(v) ? v : undefined;
};

export const isToggleable = (entityId: string) =>
  DOMAINS_TOGGLE.has(computeDomain(entityId));

export const callToggle = (hass: HomeAssistant, entityId: string) => {
  const domain = computeDomain(entityId);
  if (domain === "scene" || domain === "script") {
    return hass.callService(domain, "turn_on", { entity_id: entityId });
  }
  if (domain === "button" || domain === "input_button") {
    return hass.callService(domain, "press", { entity_id: entityId });
  }
  return hass.callService("homeassistant", "toggle", { entity_id: entityId });
};

export const dashboardBasePath = () =>
  window.location.pathname.split("/").slice(0, 2).join("/");

export const greetingKey = (date: Date) => {
  const h = date.getHours();
  if (h >= 5 && h < 12) {
    return "morning";
  }
  if (h >= 12 && h < 17) {
    return "afternoon";
  }
  if (h >= 17 && h < 23) {
    return "evening";
  }
  return "night";
};
