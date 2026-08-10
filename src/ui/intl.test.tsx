import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CmsIntlProvider, useT } from "./intl";

afterEach(cleanup);

function Probe({ k, vars }: Readonly<{ k: string; vars?: Record<string, string> }>) {
  const t = useT();
  return <span>{t(k, vars)}</span>;
}

describe("useT / CmsIntlProvider", () => {
  it("resolves a packaged default string without a provider", () => {
    render(<Probe k="shell.publish" />);
    expect(screen.getByText("Publish")).toBeInTheDocument();
  });

  it("interpolates {vars}", () => {
    render(<Probe k="nav.confirmDelete" vars={{ slug: "about" }} />);
    expect(screen.getByText(/Delete page “about”/)).toBeInTheDocument();
  });

  it("falls back to the key itself for an unknown key", () => {
    render(<Probe k="does.not.exist" />);
    expect(screen.getByText("does.not.exist")).toBeInTheDocument();
  });

  it("applies host overrides deep-merged onto the English defaults", () => {
    render(
      <CmsIntlProvider messages={{ "shell.publish": "Publicar" }}>
        <Probe k="shell.publish" />
        <Probe k="shell.discardDraft" />
      </CmsIntlProvider>
    );
    expect(screen.getByText("Publicar")).toBeInTheDocument();
    expect(screen.getByText("Discard draft")).toBeInTheDocument(); // untouched default
  });
});
