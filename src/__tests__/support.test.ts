import { supportAction } from "../support";

describe("supportAction", () => {
  it("resolves an in-app link — hopperguard's /feedback", () => {
    expect(supportAction({ kind: "link", href: "/feedback" })).toEqual({
      href: "/feedback",
      label: "Tell us about a problem",
    });
  });

  it("resolves a mailbox — what the marketing sites have instead", () => {
    expect(supportAction({ kind: "email", address: "hello@rozcard.com" })).toEqual({
      href: "mailto:hello@rozcard.com",
      label: "Tell us about a problem",
    });
  });

  it("puts the release into the email subject", () => {
    // The single most useful thing a report about a release can carry, and the
    // one thing a reader is least likely to include unprompted.
    const action = supportAction(
      { kind: "email", address: "hello@rozcard.com", subject: "Issue with {version}" },
      { version: "1.2.0" },
    );
    expect(action?.href).toBe("mailto:hello@rozcard.com?subject=Issue%20with%201.2.0");
  });

  it("does not leave a dangling placeholder when there is no version", () => {
    const action = supportAction(
      { kind: "email", address: "hi@example.com", subject: "Issue with {version}" },
      {},
    );
    expect(action?.href).toBe("mailto:hi@example.com?subject=Issue%20with");
  });

  it("takes the host's own label", () => {
    expect(supportAction({ kind: "link", href: "/feedback", label: "Report an issue" })?.label).toBe(
      "Report an issue",
    );
  });

  it("offers nothing rather than a dead link", () => {
    // An invitation to report a problem that goes nowhere is worse than no
    // invitation: the reader spends the effort and hears nothing back.
    expect(supportAction(undefined)).toBeUndefined();
    expect(supportAction({ kind: "link", href: "" })).toBeUndefined();
    expect(supportAction({ kind: "email", address: "" })).toBeUndefined();
  });
});
