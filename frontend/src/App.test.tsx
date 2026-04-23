import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./test/setup";
import App from "./App";

describe("App — locale toggle", () => {
  it("should render English by default and Spanish after clicking the toggle", async () => {
    server.use(http.get("/api/ducks", () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<App />);

    // Default English
    await waitFor(() => expect(screen.getByText("Duck Warehouse")).toBeInTheDocument());
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Español/i })).toBeInTheDocument();

    // Click toggle
    await user.click(screen.getByRole("button", { name: /Español/i }));

    // Now Spanish
    expect(screen.getByText("Almacén de Patitos")).toBeInTheDocument();
    expect(screen.getByText("Almacén")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /English/i })).toBeInTheDocument();
  });
});
