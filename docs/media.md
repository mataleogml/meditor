# Media

Optional. Omit `CmsConfig.mediaAdapter` and `image`-typed fields still
render — just as a plain text input with no "Browse library" button, and
`MediaLibrary`/`listMedia`/`deleteMedia` have nothing to talk to.

## `MediaAdapter`

The only thing that knows where/how media files are stored:

```ts
export type MediaAsset = {
  id: string;      // adapter-defined stable key (fs adapter: the filename)
  url: string;      // public URL, e.g. "/img/foo-a1b2c3d4.webp"
  name: string;      // display name (original upload filename)
  size: number;      // bytes
  width?: number;
  height?: number;
  mime: string;      // "image/webp" | "image/avif" | "image/svg+xml" | ...
  createdAt: string; // ISO 8601
};

export type PreparedFile = {
  name: string;  // slugified base name, already carrying the final extension
  mime: string;  // final mime AFTER conversion
  buffer: Buffer;
  width?: number;
  height?: number;
};

export interface MediaAdapter {
  list(): Promise<MediaAsset[]>;
  upload(file: PreparedFile): Promise<MediaAsset>; // file is already validated + converted
  delete(id: string): Promise<void>;
}
```

Adapters never see a raw client upload — only an already-validated,
already-web-optimized `PreparedFile` (see the upload pipeline below).

## `createFsMediaAdapter` — the reference implementation

Flat-directory filesystem adapter (mirrors `createMarkdownAdapter`'s
conventions: a `create*Adapter(opts)` factory, a `SAFE_*` traversal guard,
idempotent delete):

```ts
import { createFsMediaAdapter } from "meditor";

mediaAdapter: createFsMediaAdapter({
  dir: path.join(process.cwd(), "public/img"),
  publicPath: "/img",
})
```

`upload()` always appends a random 8-hex-char suffix to the filename —
unconditionally, not check-then-write — so concurrent uploads with the same
name can never race each other for the same path. `list()` probes each
file's dimensions via `sharp` (best-effort; a corrupt/dimensionless file just
gets `width`/`height` left `undefined` rather than failing the whole list) and
sorts newest-first. `delete()` is idempotent (no-ops if the file is already
gone).

An S3/Vercel Blob/R2 adapter drops in behind the same interface without
touching `processUpload`, `FieldForm`, or the media library UI — same seam
as `ContentAdapter`.

## The upload pipeline (`processUpload`)

Every upload — from `ImagePickerField`'s inline uploader or the standalone
`MediaLibrary` — goes through `handleMediaUpload` → `processUpload` before
any `MediaAdapter` sees it:

```ts
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB, pre-conversion
```

- **Never trusts the client.** Sniffs the actual bytes via `sharp.metadata()`
  — not the `Content-Type` header or filename extension (both are
  attacker-controlled).
- **Raster formats** (PNG/JPEG/GIF/TIFF) are auto-oriented from EXIF, resized
  to fit inside 2000×2000 (never upscaled), and re-encoded to WebP at quality
  82 — the same house rule this repo's own committed assets follow.
- **WebP/AVIF** pass through mime-tagged as-is (dimension cap and EXIF strip
  don't currently apply to already-optimized formats — fine for an
  `authorize()`-gated admin tool, would need revisiting for open/anonymous
  upload).
- **SVG** is rejected if it contains `<script`, an `on*=` handler, or
  `javascript:` (a blocklist heuristic, not real sanitization — swap in
  `dompurify`+`jsdom` if upload access ever extends beyond authenticated
  authors).
- Anything else (BMP, HEIC, …) is rejected with a clear "Upload PNG, JPEG,
  GIF, WebP, AVIF, or SVG" error.

Wire the Route Handler (a Route Handler, not a Server Action — Next's
default 1MB action-body cap is the wrong shape for raw image bytes; a route
also bypasses a parent layout's auth gate, so it re-checks itself):

```ts
// app/editor/media/upload/route.ts
import { handleMediaUpload } from "meditor";
import { cmsConfig } from "@/cms.config";

export const runtime = "nodejs"; // sharp needs native bindings, not the edge runtime
export async function POST(request: Request) {
  return handleMediaUpload(cmsConfig, request);
}
```

Point `FieldFormMedia.uploadPath` / `MediaLibrary`'s `uploadPath` prop at
that route's path.

## Image fields

`FieldDef.type: "image"` on a slice prop wires it to
`ImagePickerField` — see [slices.md](./slices.md#the-image-field-type) for
the bare-string vs. `{src, alt}` shapes it handles, and
[editor.md](./editor.md#mediagrid--imagepickerfield) for the component
itself.
