"use client";

import { useEffect } from "react";
import { initPreviewBridge } from "./preview-bridge.vanilla";

/**
 * Rendered inside the preview route. Bridges the preview iframe and the editor:
 *  - click a block (an element wrapped with `data-scms-index`) to select it;
 *    click the page background to select the page itself
 *  - double-click a text element to edit it inline; on blur the new text is
 *    posted back to the editor, which maps it to the matching slice field
 *  - applies an independent light/dark theme + scroll-to on request
 *
 * The logic lives in `preview-bridge.vanilla` and this is a thin React mount for
 * it — the two used to be byte-for-byte copies, which is how the deselect fix
 * would have landed in only one of them. Same shape the `init` scaffolder writes
 * into a host app.
 */
export function PreviewBridge() {
  useEffect(() => initPreviewBridge(), []);
  return null;
}
