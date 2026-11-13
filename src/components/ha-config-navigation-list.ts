import type { ContextType } from "@lit/context";
import type { CSSResultGroup, TemplateResult } from "lit";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { consume } from "../common/decorators/consume";
import { configContext } from "../data/context";
import "./ha-icon-next";
import "./ha-svg-icon";
import "./item/ha-list-item-button";
import "./list/ha-list-nav";
import type { PageNavigation } from "../layouts/hass-tabs-subpage";

@customElement("ha-config-navigation-list")
class HaConfigNavigationList extends LitElement {
  @consume({ context: configContext, subscribe: true })
  private _config!: ContextType<typeof configContext>;

  @property({ type: Boolean }) public narrow = false;

  @property({ attribute: false }) public pages!: PageNavigation[];

  @property({ attribute: "has-secondary", type: Boolean })
  public hasSecondary = false;

  @property() public label?: string;

  public render(): TemplateResult {
    return html`
      <ha-list-nav .ariaLabel=${this.label}>
        ${this.pages.map((page) => {
          const externalApp = page.path.endsWith("#external-app-configuration");
          return html`
            <ha-list-item-button
              .href=${externalApp ? undefined : page.path}
              @click=${externalApp ? this._handleExternalApp : undefined}
            >
              <div slot="start" class="icon-background">
                <ha-svg-icon
                  .path=${page.iconPath}
                  .secondaryPath=${page.iconSecondaryPath}
                  .viewBox=${page.iconViewBox}
                ></ha-svg-icon>
              </div>
              <span slot="headline">${page.name}</span>
              ${
                this.hasSecondary
                  ? html`<span slot="supporting-text"
                      >${page.description}</span
                    >`
                  : ""
              }
              ${
                !this.narrow
                  ? html`<ha-icon-next slot="end"></ha-icon-next>`
                  : ""
              }
            </ha-list-item-button>
          `;
        })}
      </ha-list-nav>
    `;
  }

  private _handleExternalApp() {
    this._config.auth.external!.fireMessage({ type: "config_screen/show" });
  }

  static styles: CSSResultGroup = css`
    ha-list-nav::part(base) {
      display: grid;
      grid-template-columns: var(--ha-config-nav-columns, minmax(0, 1fr));
      column-gap: var(--ha-config-nav-column-gap, 40px);
    }
    ha-list-item-button {
      --ha-row-item-min-height: var(--ha-config-nav-row-height, 76px);
      border-radius: 0;
      border-bottom: 1px solid var(--divider-color);
    }
    ha-list-item-button::part(headline) {
      font-size: var(--ha-font-size-l);
      font-weight: var(--ha-font-weight-medium);
    }
    ha-icon-next {
      color: var(--disabled-text-color);
      height: 20px;
      width: 20px;
      display: block;
    }
    .icon-background {
      width: 46px;
      height: 46px;
      border-radius: 15px;
      background-color: rgba(var(--rgb-primary-text-color), 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-background ha-svg-icon {
      color: var(--primary-text-color);
      --mdc-icon-size: 21px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-navigation-list": HaConfigNavigationList;
  }
}
