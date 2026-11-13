import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators";

@customElement("ha-page-heading")
export class HaPageHeading extends LitElement {
  @property() public overline?: string;

  @property() public heading?: string;

  @property() public subtitle?: string;

  protected render() {
    return html`
      <div class="text">
        ${
          this.overline
            ? html`<span class="overline">${this.overline}</span>`
            : nothing
        }
        <h1><slot name="heading">${this.heading}</slot></h1>
        <slot name="subtitle">
          ${
            this.subtitle
              ? html`<p class="subtitle">${this.subtitle}</p>`
              : nothing
          }
        </slot>
      </div>
      <div class="actions"><slot></slot></div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--ha-space-5);
    }

    .text {
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-2);
      min-width: 0;
    }

    .overline {
      font-size: 12px;
      letter-spacing: var(--ha-letter-spacing-overline, 0.24em);
      color: var(--secondary-text-color);
      font-weight: var(--ha-font-weight-medium);
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: var(--ha-page-heading-size, clamp(36px, 4.6vw, 60px));
      line-height: 1;
      font-weight: var(--ha-font-weight-thin, 200);
      letter-spacing: -0.035em;
      color: var(--primary-text-color);
    }

    .subtitle,
    ::slotted([slot="subtitle"]) {
      margin: 0;
      font-size: 15px;
      color: var(--secondary-text-color);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ha-space-2);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-page-heading": HaPageHeading;
  }
}
