import { LitElement, html, css, type PropertyValues } from "lit";
import { primitiveStyles } from "./styles";
import { icon, iconMonitor, iconTablet, iconSmartphone, iconMoon, iconSun } from "./icons";

type Device = "desktop" | "tablet" | "mobile";

const WIDTHS: Record<Device, number | null> = { desktop: null, tablet: 820, mobile: 390 };
const DEVICES: { id: Device; icon: ReturnType<typeof icon>; label: string }[] = [
  { id: "desktop", icon: icon(iconMonitor), label: "Desktop" },
  { id: "tablet", icon: icon(iconTablet), label: "Tablet" },
  { id: "mobile", icon: icon(iconSmartphone), label: "Mobile" },
];
const MIN_W = 320;

/**
 * Center preview: device-size switcher + free drag-resize + independent
 * light/dark toggle, over a live iframe in a shadow-DOM scroll container.
 * Ported from `device-preview.tsx` (`DevicePreview`) — see spec §1.
 */
export class MeditorDevicePreview extends LitElement {
  static properties = {
    src: { type: String },
    reloadKey: { type: Number, attribute: "reload-key" },
    _device: { state: true },
    _custom: { state: true },
    _theme: { state: true },
  };

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: flex;
        flex: 1 1 0%;
        min-height: 0;
        flex-direction: column;
        background: var(--scms-muted);
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        border-bottom: 1px solid var(--scms-border);
        background: var(--scms-bg);
        padding: 0.375rem 0.5rem;
      }
      .devices {
        display: flex;
        flex: 1 1 0%;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
      }
      .device-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        border: none;
        border-radius: 0.375rem;
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        color: var(--scms-muted-fg);
        background: transparent;
        transition: background-color 0.15s, color 0.15s;
      }
      .device-btn:hover {
        background: var(--scms-muted);
        color: var(--scms-fg);
      }
      .device-btn[aria-pressed="true"] {
        background: var(--scms-muted);
        color: var(--scms-fg);
      }
      .device-btn svg {
        width: 1rem;
        height: 1rem;
      }
      .width-label {
        margin-left: 0.5rem;
        width: 3.5rem;
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .theme-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        border: none;
        border-radius: 0.375rem;
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        color: var(--scms-muted-fg);
        background: transparent;
        transition: background-color 0.15s, color 0.15s;
      }
      .theme-btn:hover {
        background: var(--scms-muted);
        color: var(--scms-fg);
      }
      .theme-btn svg {
        width: 1rem;
        height: 1rem;
      }
      .area {
        display: flex;
        flex: 1 1 0%;
        min-height: 0;
        justify-content: center;
        padding: 0;
      }
      @media (min-width: 768px) {
        .area {
          padding: 1rem;
        }
      }
      .frame {
        position: relative;
        height: 100%;
        background: #fff;
        width: 100%;
      }
      .frame.framed {
        flex-shrink: 0;
        overflow: hidden;
        border-radius: 0.75rem;
        border: 1px solid var(--scms-border);
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        width: var(--frame-w);
      }
      iframe {
        height: 100%;
        width: 100%;
        border: 0;
        background: #fff;
      }
      .resize-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        right: -0.375rem;
        width: 0.75rem;
        cursor: col-resize;
        touch-action: none;
      }
      .resize-handle > div {
        margin: 0 auto;
        height: 100%;
        width: 0.125rem;
        background: var(--scms-border);
        opacity: 0;
        transition: opacity 0.15s;
      }
      .resize-handle:hover > div {
        opacity: 1;
      }
    `,
  ];

  declare src: string;
  declare reloadKey: number;
  declare _device: Device;
  declare _custom: number | null;
  declare _theme: "light" | "dark";

  private dragStartX = 0;
  private dragStartW = 0;

  constructor() {
    super();
    this.src = "";
    this.reloadKey = 0;
    this._device = "desktop";
    this._custom = null;
    this._theme = "light";
  }

  private get iframeEl(): HTMLIFrameElement | null {
    return this.renderRoot.querySelector("iframe");
  }

  private get areaEl(): HTMLElement | null {
    return this.renderRoot.querySelector(".area");
  }

  /** OUT-direction access for the editor shell's PreviewLinkController: the
   *  live preview iframe to post `{type:'select'}` into. The iframe lives in
   *  this element's shadow, so the shell can't reach it directly. */
  get iframe(): HTMLIFrameElement | null {
    return this.iframeEl;
  }

  private pushTheme = (): void => {
    this.iframeEl?.contentWindow?.postMessage(
      { __scms: true, type: "theme", theme: this._theme },
      window.location.origin
    );
  };

  updated(changed: PropertyValues): void {
    if (changed.has("_theme") || changed.has("reloadKey")) this.pushTheme();
  }

  private pick(d: Device): void {
    this._device = d;
    this._custom = null;
  }

  private toggleTheme(): void {
    this._theme = this._theme === "dark" ? "light" : "dark";
  }

  private onPointerDown = (e: PointerEvent): void => {
    const width = this._custom ?? WIDTHS[this._device];
    this.dragStartW = width ?? this.areaEl?.clientWidth ?? 1024;
    this.dragStartX = e.clientX;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) return;
    const max = this.areaEl?.clientWidth ?? 2000;
    const next = this.dragStartW + (e.clientX - this.dragStartX) * 2;
    this._custom = Math.max(MIN_W, Math.min(next, max));
  };

  private onPointerUp = (e: PointerEvent): void => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  };

  render() {
    const width = this._custom ?? WIDTHS[this._device];
    const framed = width != null;
    return html`
      <div class="toolbar">
        <div class="devices">
          ${DEVICES.map(
            ({ id, icon: ic, label }) => html`
              <button
                type="button"
                class="device-btn"
                aria-label=${label}
                aria-pressed=${this._custom == null && this._device === id}
                @click=${() => this.pick(id)}
              >
                ${ic} ${label}
              </button>
            `
          )}
          <span class="width-label">${width ? `${Math.round(width)}px` : "full"}</span>
        </div>
        <button type="button" class="theme-btn" aria-label="Toggle preview theme" @click=${() => this.toggleTheme()}>
          ${this._theme === "dark" ? icon(iconMoon) : icon(iconSun)} ${this._theme === "dark" ? "Dark" : "Light"}
        </button>
      </div>
      <div class="area scroll-area">
        <div class="frame ${framed ? "framed" : ""}" style=${framed ? `--frame-w:${width}px` : ""}>
          <iframe title="Live preview" src=${this.src} @load=${this.pushTheme}></iframe>
          ${framed
            ? html`
                <div
                  class="resize-handle"
                  role="separator"
                  aria-label="Drag to resize preview"
                  @pointerdown=${this.onPointerDown}
                  @pointermove=${this.onPointerMove}
                  @pointerup=${this.onPointerUp}
                >
                  <div></div>
                </div>
              `
            : null}
        </div>
      </div>
    `;
  }
}

customElements.define("meditor-device-preview", MeditorDevicePreview);

declare global {
  interface HTMLElementTagNameMap {
    "meditor-device-preview": MeditorDevicePreview;
  }
}
