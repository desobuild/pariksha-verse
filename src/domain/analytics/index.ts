/**
 * Analytics domain barrel (Phase 12).
 *
 * Pure aggregation over existing Phase 1–11 data. UI consumes the snapshot
 * built here; components never calculate analytics themselves.
 */

export * from "./types";
export * from "./trends";
export * from "./coverage";
export * from "./performance";
export * from "./study";
export * from "./revision";
export * from "./mocks";
export * from "./insights";
export * from "./snapshot";
