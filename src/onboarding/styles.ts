import { css } from "lit";

export const onBoardingStyles = css`
  .card-content {
    padding: 32px;
  }
  h1 {
    font-size: clamp(30px, 5vw, 40px);
    font-weight: var(--ha-font-weight-display, 300);
    letter-spacing: var(--ha-letter-spacing-display, -0.03em);
    line-height: 1.05;
    margin-bottom: 12px;
  }
  ha-icon-button-arrow-prev {
    margin-left: -12px;
    display: block;
  }
  p {
    font-size: 1rem;
    color: var(--secondary-text-color);
    line-height: var(--ha-line-height-normal);
    margin-top: 0;
    margin-bottom: 32px;
  }
  .footer {
    margin-top: 16px;
    text-align: right;
  }
`;
