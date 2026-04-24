import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./test/setup";
import App from "./App";

describe("App — locale toggle", () => {
  it("should toggle between English and Spanish", async () => {
    server.use(http.get("/api/ducks", () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<App />);

    // The page title ("Duck Inventory" in tests since VITE_TITLE isn't
    // set in jsdom) comes from env, not i18n. The locale toggle only
    // flips the button label + the page's translated strings.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Español/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Español/i }));
    expect(screen.getByRole("button", { name: /English/i })).toBeInTheDocument();
  });
});
