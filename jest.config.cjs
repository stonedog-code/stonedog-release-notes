/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  // `.tsx` as well as `.ts`. Omitting it loads the component modules as
  // CommonJS, where the first ESM-only import fails with "Must use import to
  // load ES Module" — pointing at the dependency rather than at this list.
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  // jsdom only for the component tests; everything else stays on `node`, which
  // is faster and cannot accidentally depend on a DOM that production lacks.
  testEnvironment: "node",
  projects: [
    {
      displayName: "node",
      preset: "ts-jest/presets/default-esm",
      extensionsToTreatAsEsm: [".ts", ".tsx"],
      testEnvironment: "node",
      transform: { "^.+\\.tsx?$": ["ts-jest", { useESM: true }] },
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
    },
    {
      displayName: "dom",
      preset: "ts-jest/presets/default-esm",
      extensionsToTreatAsEsm: [".ts", ".tsx"],
      testEnvironment: "jsdom",
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: { jsx: "react-jsx" } }],
      },
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.tsx"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**", "!src/index.ts"],
};
