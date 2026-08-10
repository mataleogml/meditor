// Public entry for the "./element" subpath — the Lit Web Component editor.
// Importing this module registers every `meditor-*` custom element (each
// element file self-registers, guarded, on import) and re-exports the element
// classes + the helpers a host needs (i18n defaults, the vanilla preview
// bridge, the idempotent registrar). The React "./editor"/"./wc" entries stay
// intact alongside this during the additive transition.

import "./ui/editor.element";
import "./ui/site-editor.element";
import "./ui/media-library.element";
import "./ui/pages-nav.element";
import "./ui/block-list.element";
import "./ui/field-form.element";
import "./ui/image-picker-field.element";
import "./ui/media-grid.element";
import "./ui/device-preview.element";
import "./ui/page-list.element";
// SDUI admin shell + settings/onboarding/collection (self-registering, guarded).
import "./ui/shell.element";
import "./ui/section-nav.element";
import "./ui/top-bar.element";
import "./ui/settings.element";
import "./ui/collection.element";
import "./ui/collection-list.element";
import "./ui/onboarding.element";

export { MeditorEditor, defineMeditorEditor } from "./ui/editor.element";
export { MeditorSiteEditor } from "./ui/site-editor.element";
export { MeditorMediaLibrary, type MediaLibraryMedia } from "./ui/media-library.element";
export { MeditorPagesNav } from "./ui/pages-nav.element";
export { MeditorBlockList } from "./ui/block-list.element";
export { MeditorFieldForm } from "./ui/field-form.element";
export { MeditorImagePicker, type FieldFormMedia } from "./ui/image-picker-field.element";
export { MeditorMediaGrid, type MediaGridMode } from "./ui/media-grid.element";
export { MeditorDevicePreview } from "./ui/device-preview.element";
export { MeditorPageList } from "./ui/page-list.element";

// SDUI admin shell elements + their client-side prop/type surface. Server-side
// section/settings/collection helpers (createSettingsStore, resolveSections,
// buildCollectionActions, …) live on the server-safe "." entry (index.ts), so
// the client element bundle never pulls in their node:fs dependencies; only
// the erasable types are re-exported here for a host's client wrapper.
export { MeditorShell, type PagesSectionProps, type MediaSectionProps } from "./ui/shell.element";
export { MeditorSectionNav } from "./ui/section-nav.element";
export { MeditorTopBar, type TopBarAction } from "./ui/top-bar.element";
export { MeditorSettings } from "./ui/settings.element";
export { MeditorCollection } from "./ui/collection.element";
export { MeditorCollectionList, resolveListColumns, type CollectionRecordInfo } from "./ui/collection-list.element";
export { MeditorOnboarding, detectStep, type OnboardingStep } from "./ui/onboarding.element";

// The one VALUE a client wrapper needs from sections.ts to build a ctx (the
// server-safe "." entry also exports it, but that entry pulls node:fs and so
// can't be imported from a client component).
export { SECTION_API_VERSION } from "./sections";
export type {
  Section,
  SectionKind,
  SectionCtx,
  ResolvedSection,
  PagesSection,
  MediaSection,
  SettingsSection,
  CollectionSection,
  CustomSection,
} from "./sections";
export type { SiteSettings, SiteSettingsRuntime, SiteSettingsBootstrap, SettingsAdapter, SettingsStore } from "./settings";

export { AutosaveController, PreviewLinkController } from "./ui/controllers";
export { createT } from "./ui/i18n-strings";
export { defaultMessages } from "./ui/messages";
export { initPreviewBridge } from "./ui/preview-bridge.vanilla";
