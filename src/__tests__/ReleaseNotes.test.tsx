import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ReleaseNotes } from "../components/ReleaseNotes";
import type { PublicRelease } from "../types";

const release = (over: Partial<PublicRelease> = {}): PublicRelease => ({
  version: "1.2.0",
  publishedAt: new Date(2026, 7, 15, 9, 0),
  entries: [{ type: "feat", text: "Add an item from the browser" }],
  ...over,
});

describe("ReleaseNotes", () => {
  it("renders the version, the section a reader recognises, and the entry", () => {
    render(<ReleaseNotes releases={[release()]} />);
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText("New features")).toBeInTheDocument();
    expect(screen.getByText(/Add an item from the browser/)).toBeInTheDocument();
    // Never the maintainer's word.
    expect(screen.queryByText("feat")).not.toBeInTheDocument();
  });

  it("leads with a written summary and still lists the entries", () => {
    render(
      <ReleaseNotes
        releases={[release({ summary: "Collections got faster." })]}
      />,
    );
    expect(screen.getByText("Collections got faster.")).toBeInTheDocument();
    expect(screen.getByText(/Add an item from the browser/)).toBeInTheDocument();
  });

  it("groups releases under one heading per day, newest day first", () => {
    render(
      <ReleaseNotes
        releases={[
          release({ version: "1.3.0", publishedAt: new Date(2026, 7, 16, 9, 0) }),
          release({ version: "1.2.0", publishedAt: new Date(2026, 7, 15, 9, 0) }),
          release({ version: "1.10.0", publishedAt: new Date(2026, 7, 16, 17, 0) }),
        ]}
        formatDate={(d) => d.toISOString().slice(0, 10)}
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["2026-08-16", "2026-08-15"]);

    // And newest version first WITHIN the day — 1.10.0 above 1.3.0, which a
    // string sort gets backwards.
    const versions = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(versions).toEqual(["1.10.0", "1.3.0", "1.2.0"]);
  });

  it("marks a breaking change inline rather than in its own section", () => {
    render(
      <ReleaseNotes
        releases={[release({ entries: [{ type: "feat", text: "Drop the old importer", breaking: true }] })]}
      />,
    );
    expect(screen.getByText(/Breaking:/)).toBeInTheDocument();
    // Beside its own description, not under a heading that makes the whole
    // release read like an incident.
    expect(screen.queryByRole("heading", { name: /breaking/i })).not.toBeInTheDocument();
  });

  it("renders the support call to action with the release's version", () => {
    render(
      <ReleaseNotes
        releases={[release()]}
        support={{ kind: "email", address: "hi@example.com", subject: "Issue with {version}" }}
      />,
    );
    const link = screen.getByRole("link", { name: "Tell us about a problem" });
    expect(link).toHaveAttribute("href", expect.stringContaining("1.2.0"));
  });

  it("renders no call to action when no channel is configured", () => {
    // An invitation that goes nowhere is worse than none.
    render(<ReleaseNotes releases={[release()]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says so when there is nothing to read", () => {
    render(<ReleaseNotes releases={[]} emptyMessage="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });

  it("lets a host substitute its own primitives, partially", () => {
    const Version = ({ children, ...rest }: React.ComponentProps<"h3">) => (
      <h3 {...rest} data-testid="custom-version">
        v{children}
      </h3>
    );
    render(<ReleaseNotes releases={[release()]} components={{ VersionHeading: Version }} />);
    expect(screen.getByTestId("custom-version")).toHaveTextContent("v1.2.0");
    // Everything not overridden still renders.
    expect(screen.getByText("New features")).toBeInTheDocument();
  });

  it("puts a stable class on every element for a host to style against", () => {
    const { container } = render(<ReleaseNotes releases={[release()]} classPrefix="rn" />);
    expect(container.querySelector(".rn")).not.toBeNull();
    expect(container.querySelector(".rn__day-heading")).not.toBeNull();
    expect(container.querySelector(".rn__section--features")).not.toBeNull();
    expect(container.querySelector(".rn__item")).not.toBeNull();
  });

  it("files an undated release under its own heading rather than dropping it", () => {
    render(
      <ReleaseNotes releases={[release({ publishedAt: new Date("nonsense") })]} />,
    );
    expect(screen.getByText("Undated")).toBeInTheDocument();
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
  });
});
