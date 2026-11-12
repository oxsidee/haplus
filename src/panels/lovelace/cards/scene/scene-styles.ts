import { css } from "lit";

export const sceneStyles = css`
  :host {
    display: block;
    --scene-bg: var(--primary-background-color);
    --scene-rail: var(--sidebar-background-color);
    --scene-card: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
    --scene-well: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    --scene-sel: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
    --scene-bd: var(--divider-color);
    --scene-bd2: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
    --scene-text: var(--primary-text-color);
    --scene-text2: var(--secondary-text-color);
    --scene-text3: var(--disabled-text-color);
    --scene-inv: var(--primary-background-color);
    --scene-inv-bg: var(--primary-text-color);
    --scene-dock-bg: color-mix(
      in srgb,
      var(--primary-text-color) 4%,
      transparent
    );
    --scene-dock-fg: color-mix(
      in srgb,
      var(--primary-text-color) 82%,
      transparent
    );
    --scene-track: color-mix(
      in srgb,
      var(--primary-text-color) 16%,
      transparent
    );
    --scene-light: var(--state-light-active-color, var(--amber-color));
    --scene-heat: var(--state-climate-heat-color, var(--deep-orange-color));
    --scene-cool: var(--state-climate-cool-color, var(--blue-color));
    --scene-ok: var(--success-color);
    --scene-warn: var(--warning-color);
    --scene-alert: var(--error-color);
    --scene-cover: var(--state-cover-active-color, var(--purple-color));
    --scene-media: var(
      --state-media_player-active-color,
      var(--light-blue-color)
    );
    --scene-energy: var(--yellow-color);
    --scene-shadow: var(--ha-card-box-shadow, none);
    --scene-min-height: calc(
      100vh - var(--header-height, 56px) - var(--safe-area-inset-top, 0px)
    );
    font-family: var(--ha-font-family-body);
    color: var(--scene-text);
  }

  .layout {
    display: flex;
    flex-wrap: wrap;
    min-height: var(--scene-min-height);
    background: var(--scene-bg);
  }

  .stage {
    flex: 999 1 640px;
    min-width: 0;
    box-sizing: border-box;
    padding: var(--ha-space-3) clamp(20px, 3vw, 44px) var(--ha-space-7);
    display: flex;
    flex-direction: column;
    gap: var(--ha-space-5);
    background: radial-gradient(
      1000px 640px at 40% 58%,
      var(--scene-stage-center, var(--card-background-color)) 0%,
      var(--scene-bg) 72%
    );
    transition: background 600ms ease;
  }

  .rail {
    flex: 1 1 420px;
    min-width: 0;
    max-height: var(--scene-min-height);
    overflow-y: auto;
    box-sizing: border-box;
    padding: var(--ha-space-7) var(--ha-space-7) var(--ha-space-8);
    background: var(--scene-rail);
    border-inline-start: 1px solid var(--scene-bd);
    display: flex;
    flex-direction: column;
    gap: var(--ha-space-7);
  }

  @media (max-width: 1100px) {
    .rail {
      max-height: none;
      border-inline-start: none;
      border-top: 1px solid var(--scene-bd);
    }
  }

  .intro {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: var(--ha-space-3);
  }

  .overline {
    font-size: 12px;
    letter-spacing: var(--ha-letter-spacing-overline, 0.24em);
    color: var(--scene-text2);
    font-weight: 500;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--dot);
    box-shadow: 0 0 12px var(--dot);
  }

  h1 {
    margin: 0;
    font-size: clamp(36px, 4.4vw, 56px);
    line-height: 1.02;
    font-weight: var(--ha-font-weight-display, 300);
    letter-spacing: var(--ha-letter-spacing-display, -0.03em);
  }

  .summary {
    margin: 0;
    font-size: 16px;
    color: var(--scene-text2);
    line-height: 1.5;
    max-width: 640px;
  }

  button {
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--ha-color-focus);
    outline-offset: 2px;
    border-radius: var(--ha-border-radius-lg);
  }

  .toggle:focus-visible {
    outline-offset: -4px;
    border-radius: var(--ha-border-radius-pill);
  }

  .metrics {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-2) var(--ha-space-9);
  }

  .metric {
    border: 0;
    background: transparent;
    padding: 4px 0;
    color: var(--scene-text);
    text-align: start;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 44px;
  }

  .metric .value {
    font-size: 28px;
    font-weight: 300;
    letter-spacing: -0.02em;
  }

  .metric .label {
    font-size: 13px;
    color: var(--scene-text2);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 3px;
    background: var(--dot);
    flex: none;
  }

  .visual {
    flex: 1;
    min-height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .visual {
    position: relative;
  }

  .visual-edit {
    position: absolute;
    top: 0;
    inset-inline-end: 0;
    width: 40px;
    height: 40px;
    border-radius: 20px;
    border: 1px solid var(--scene-bd);
    background: var(--scene-dock-bg);
    color: var(--scene-text2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    opacity: 0.6;
    transition: opacity 200ms ease;
    --mdc-icon-size: 20px;
  }

  .visual:hover .visual-edit,
  .visual-edit:focus-visible {
    opacity: 1;
  }

  .home-photo {
    width: 100%;
    max-width: 820px;
    aspect-ratio: 16 / 9;
    border-radius: var(--ha-border-radius-5xl);
    background-size: cover;
    background-position: center;
    position: relative;
    overflow: hidden;
    filter: brightness(0.62) saturate(0.85);
    box-shadow: var(--ha-box-shadow-l);
    transition: filter 600ms ease;
  }

  .home-photo.lit {
    filter: brightness(1) saturate(1);
  }

  .home-photo::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      70% 60% at 50% 70%,
      rgba(242, 180, 90, 0.22) 0%,
      transparent 70%
    );
    opacity: 0;
    transition: opacity 600ms ease;
  }

  .home-photo.lit::after {
    opacity: 1;
  }

  .visual svg.house,
  .visual svg.room {
    display: block;
    width: 100%;
    max-width: 760px;
    height: auto;
    overflow: visible;
  }

  svg .glow {
    transition: opacity 600ms ease;
  }

  svg .blind {
    transition: height 600ms ease;
  }

  svg .tree1 {
    fill: #7e8478;
  }
  svg .tree2 {
    fill: #949a8d;
  }
  svg .ground {
    stroke: rgba(20, 21, 23, 0.14);
  }
  svg .wall-top {
    stop-color: #e9e5de;
  }
  svg .wall-bottom {
    stop-color: #dcd6cc;
  }
  svg .floor-top {
    stop-color: #cfc6b8;
  }
  svg .floor-bottom {
    stop-color: #e6e1d8;
  }
  svg .frame {
    stroke: #f7f5f1;
  }
  svg .rug {
    fill: rgba(20, 21, 23, 0.05);
  }
  svg .cord {
    stroke: #5b5650;
  }
  svg .cord-fill {
    fill: #5b5650;
  }
  svg .shade {
    fill: #f3eee5;
  }
  svg .sofa {
    fill: #a69c8e;
  }
  svg .sofa-back {
    fill: #958b7d;
  }
  svg .cushion {
    fill: #bdb3a5;
  }
  svg .table {
    fill: #7a5434;
  }

  :host([dark]) svg .tree1 {
    fill: #15181b;
  }
  :host([dark]) svg .tree2 {
    fill: #1b1f23;
  }
  :host([dark]) svg .ground {
    stroke: rgba(255, 255, 255, 0.1);
  }
  :host([dark]) svg .wall-top {
    stop-color: #1b1d21;
  }
  :host([dark]) svg .wall-bottom {
    stop-color: #141518;
  }
  :host([dark]) svg .floor-top {
    stop-color: #17181b;
  }
  :host([dark]) svg .floor-bottom {
    stop-color: #0b0c0e;
  }
  :host([dark]) svg .frame {
    stroke: #2a2d32;
  }
  :host([dark]) svg .rug {
    fill: rgba(255, 255, 255, 0.035);
  }
  :host([dark]) svg .cord {
    stroke: #3a3c40;
  }
  :host([dark]) svg .cord-fill {
    fill: #3a3c40;
  }
  :host([dark]) svg .shade {
    fill: #d8d2c6;
  }
  :host([dark]) svg .sofa {
    fill: #2c2a27;
  }
  :host([dark]) svg .sofa-back {
    fill: #24221f;
  }
  :host([dark]) svg .cushion {
    fill: #38342f;
  }
  :host([dark]) svg .table {
    fill: #3b2c1f;
  }

  .dock {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .dock-item {
    width: 112px;
    height: 96px;
    border-radius: var(--ha-border-radius-3xl);
    border: 1px solid var(--scene-bd);
    background: var(--scene-dock-bg);
    color: var(--scene-dock-fg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    padding: 0 6px;
    transition:
      background 240ms ease,
      color 240ms ease,
      border-color 240ms ease;
    --mdc-icon-size: 24px;
  }

  .dock-item[aria-pressed="true"] {
    background: var(--scene-inv-bg);
    border-color: var(--scene-inv-bg);
    color: var(--scene-inv);
  }

  .dock-item .name {
    font-size: 14px;
    font-weight: 500;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dock-item .state {
    font-size: 11px;
    opacity: 0.7;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dock-edit {
    width: 56px;
    height: 96px;
    border-radius: var(--ha-border-radius-3xl);
    border: 1px dashed var(--scene-bd2);
    background: transparent;
    color: var(--scene-text2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    --mdc-icon-size: 22px;
  }

  .dock-edit:hover {
    color: var(--scene-text);
    border-color: var(--scene-text2);
  }

  .rail-actions {
    display: flex;
    align-items: baseline;
    gap: var(--ha-space-4);
  }

  .rail-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--ha-space-3);
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: -0.015em;
  }

  .link {
    font-size: 13px;
    color: var(--scene-text2);
    text-decoration: none;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
    font-size: 12px;
  }

  .group-head .title {
    letter-spacing: 0.2em;
    color: var(--scene-text2);
    font-weight: 500;
    text-transform: uppercase;
  }

  .group-head .meta {
    color: var(--scene-text3);
  }

  .toggle {
    flex: none;
    width: 52px;
    height: 44px;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle .track {
    width: 42px;
    height: 26px;
    border-radius: 13px;
    background: var(--scene-track);
    position: relative;
    display: block;
    transition: background 240ms ease;
  }

  .toggle .knob {
    position: absolute;
    top: 3px;
    inset-inline-start: 3px;
    width: 20px;
    height: 20px;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: inset-inline-start 240ms ease;
  }

  .toggle[aria-pressed="true"] .track {
    background: var(--toggle-color, var(--scene-light));
  }

  .toggle[aria-pressed="true"] .knob {
    inset-inline-start: 19px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-2);
  }

  .chip {
    height: 44px;
    padding: 0 16px;
    border-radius: 22px;
    border: 1px solid var(--scene-bd);
    background: transparent;
    color: var(--scene-text);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 240ms ease,
      color 240ms ease;
    --mdc-icon-size: 18px;
  }

  .chip[aria-pressed="true"] {
    background: var(--scene-inv-bg);
    border-color: var(--scene-inv-bg);
    color: var(--scene-inv);
  }

  .list-row {
    min-height: 60px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    border: 0;
    border-bottom: 1px solid var(--scene-bd);
    background: transparent;
    color: var(--scene-text);
    padding: 8px 2px;
    text-align: start;
    cursor: pointer;
  }

  .round-icon {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--icon-color) 16%, transparent);
    color: var(--icon-color);
    display: flex;
    align-items: center;
    justify-content: center;
    --mdc-icon-size: 18px;
  }

  .row-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row-text .primary {
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-text .secondary {
    font-size: 13px;
    color: var(--scene-text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chevron {
    color: var(--scene-text3);
    --mdc-icon-size: 16px;
  }

  .circle-btn {
    width: 44px;
    height: 44px;
    border-radius: 22px;
    border: 1px solid var(--scene-bd);
    background: transparent;
    color: var(--scene-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    --mdc-icon-size: 20px;
  }

  @media (max-width: 600px) {
    .stage {
      padding-inline: var(--ha-space-4);
      gap: var(--ha-space-4);
    }
    .rail {
      padding: var(--ha-space-5) var(--ha-space-4) var(--ha-space-7);
      gap: var(--ha-space-6);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ha-space-2) var(--ha-space-4);
    }
    .metric .value {
      font-size: 24px;
    }
    .visual {
      min-height: 180px;
    }
    .dock {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--ha-space-2);
    }
    .dock-item,
    .dock-edit {
      width: auto;
      height: 88px;
      border-radius: 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
    }
  }
`;
