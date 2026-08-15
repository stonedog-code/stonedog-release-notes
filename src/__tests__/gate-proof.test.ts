/**
 * TEMPORARY — deliberately failing, to prove branch protection actually blocks
 * a merge (NEH-745). Delete this branch without merging.
 *
 * A green check and a REQUIRED green check look identical on a PR. The only
 * honest confirmation is a red one that cannot be merged past.
 */
it("fails on purpose, so we can watch the merge be refused", () => {
  expect(1).toBe(2);
});
