import { svg, type SVGTemplateResult } from "lit";

/**
 * Inline Lucide icon templates (ISC-licensed path data, copied from
 * lucide-react v0.469.0 — no runtime dependency). Attribute defaults match
 * lucide's own `<svg>` wrapper so these drop in wherever `<Icon />` did.
 */

export const iconChevronDown: SVGTemplateResult = svg`<path d="m6 9 6 6 6-6" />`;

export const iconChevronRight: SVGTemplateResult = svg`<path d="m9 18 6-6-6-6" />`;

export const iconChevronUp: SVGTemplateResult = svg`<path d="m18 15-6-6-6 6" />`;

export const iconCopy: SVGTemplateResult = svg`
  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
`;

export const iconFileText: SVGTemplateResult = svg`
  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  <path d="M10 9H8" />
  <path d="M16 13H8" />
  <path d="M16 17H8" />
`;

export const iconGripVertical: SVGTemplateResult = svg`
  <circle cx="9" cy="12" r="1" />
  <circle cx="9" cy="5" r="1" />
  <circle cx="9" cy="19" r="1" />
  <circle cx="15" cy="12" r="1" />
  <circle cx="15" cy="5" r="1" />
  <circle cx="15" cy="19" r="1" />
`;

export const iconHouse: SVGTemplateResult = svg`
  <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
  <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
`;

export const iconImageOff: SVGTemplateResult = svg`
  <line x1="2" x2="22" y1="2" y2="22" />
  <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
  <line x1="13.5" x2="6" y1="13.5" y2="21" />
  <line x1="18" x2="21" y1="12" y2="15" />
  <path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59" />
  <path d="M21 15V5a2 2 0 0 0-2-2H9" />
`;

export const iconImage: SVGTemplateResult = svg`
  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
  <circle cx="9" cy="9" r="2" />
  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
`;

export const iconLanguages: SVGTemplateResult = svg`
  <path d="m5 8 6 6" />
  <path d="m4 14 6-6 2-3" />
  <path d="M2 5h12" />
  <path d="M7 2h1" />
  <path d="m22 22-5-10-5 10" />
  <path d="M14 18h6" />
`;

export const iconMonitor: SVGTemplateResult = svg`
  <rect width="20" height="14" x="2" y="3" rx="2" />
  <line x1="8" x2="16" y1="21" y2="21" />
  <line x1="12" x2="12" y1="17" y2="21" />
`;

export const iconMoon: SVGTemplateResult = svg`<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />`;

export const iconPencilLine: SVGTemplateResult = svg`
  <path d="M12 20h9" />
  <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  <path d="m15 5 3 3" />
`;

export const iconPlus: SVGTemplateResult = svg`
  <path d="M5 12h14" />
  <path d="M12 5v14" />
`;

export const iconSearch: SVGTemplateResult = svg`
  <circle cx="11" cy="11" r="8" />
  <path d="m21 21-4.3-4.3" />
`;

export const iconSettings: SVGTemplateResult = svg`
  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  <circle cx="12" cy="12" r="3" />
`;

export const iconSmartphone: SVGTemplateResult = svg`
  <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
  <path d="M12 18h.01" />
`;

export const iconSun: SVGTemplateResult = svg`
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2v2" />
  <path d="M12 20v2" />
  <path d="m4.93 4.93 1.41 1.41" />
  <path d="m17.66 17.66 1.41 1.41" />
  <path d="M2 12h2" />
  <path d="M20 12h2" />
  <path d="m6.34 17.66-1.41 1.41" />
  <path d="m19.07 4.93-1.41 1.41" />
`;

export const iconTablet: SVGTemplateResult = svg`
  <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
  <line x1="12" x2="12.01" y1="18" y2="18" />
`;

export const iconTrash2: SVGTemplateResult = svg`
  <path d="M3 6h18" />
  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  <line x1="10" x2="10" y1="11" y2="17" />
  <line x1="14" x2="14" y1="11" y2="17" />
`;

export const iconTriangleAlert: SVGTemplateResult = svg`
  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
  <path d="M12 9v4" />
  <path d="M12 17h.01" />
`;

export const iconUpload: SVGTemplateResult = svg`
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="17 8 12 3 7 8" />
  <line x1="12" x2="12" y1="3" y2="15" />
`;

/**
 * Wraps an icon's inner-path template in the shared lucide `<svg>` attrs.
 * Usage: `${icon(iconTrash2)}` inside a Lit `html` template.
 */
export function icon(inner: SVGTemplateResult): SVGTemplateResult {
  return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
