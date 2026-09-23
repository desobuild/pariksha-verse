import React from "react";
import "@testing-library/jest-dom";

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
