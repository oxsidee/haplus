import { css } from "lit";
import { extractVars } from "../../common/style/derived-css-vars";

/**
 * Semantic styles use core styles to define higher level variables like box shadows.
 * Here we define all styles except colors
 */
export const semanticStyles = css`
  html {
    --ha-box-shadow-s: 0 1px 2px rgba(20, 21, 23, 0.04), 0 6px 20px rgba(20, 21, 23, 0.05);
    --ha-box-shadow-m: 0 2px 4px rgba(20, 21, 23, 0.05), 0 12px 32px rgba(20, 21, 23, 0.08);
    --ha-box-shadow-l: 0 4px 8px rgba(20, 21, 23, 0.06), 0 24px 56px rgba(20, 21, 23, 0.12);
    --ha-card-box-shadow: var(--ha-box-shadow-s);
  }
`;

export const darkSemanticStyles = css`
  html {
    --ha-box-shadow-s: 0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 1px 3px 0 rgba(0, 0, 0, 0.5);
    --ha-box-shadow-m: 0 3px 6px -1px rgba(0, 0, 0, 0.35), 0 8px 16px -2px rgba(0, 0, 0, 0.45);
    --ha-box-shadow-l: 0 6px 12px -3px rgba(0, 0, 0, 0.4), 0 16px 32px -6px rgba(0, 0, 0, 0.55);
    --ha-card-box-shadow: none;
  }
`;

export const darkSemanticVariables = extractVars(darkSemanticStyles);
