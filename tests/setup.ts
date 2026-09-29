import React from "react";
import "@testing-library/jest-dom";

// Ensure a valid test SESSION_SECRET is available for unit tests
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_vitest_mock_session_secret_32b_min_length";

// Make React global for tests if required by transforms
(globalThis as unknown as { React: typeof React }).React = React;

// Mock matchMedia for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
