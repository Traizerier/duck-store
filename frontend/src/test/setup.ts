import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

// Auto-cleanup from @testing-library/react only registers when `globals: true`
// in vitest config. Since we're explicit (globals: false), call cleanup here.
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => server.close());
