import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { Warehouse } from "./Warehouse";

const duckA = {
  id: 1,
  color: "Red",
  size: "Large",
  price: 10,
  quantity: 5,
  deleted: false,
};

describe("Warehouse page", () => {
  it("should load ducks on mount and display them", async () => {
    server.use(http.get("/api/ducks", () => HttpResponse.json([duckA])));
    render(<Warehouse />);
    await waitFor(() => expect(screen.getByText("Red")).toBeInTheDocument());
  });

  it("should open the add form when the Add Duck button is clicked", async () => {
    server.use(http.get("/api/ducks", () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<Warehouse />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add duck/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /add duck/i }));
    expect(screen.getByRole("heading", { name: /add duck/i })).toBeInTheDocument();
  });

  it("should POST a new duck and reload on submit", async () => {
    const stored: typeof duckA[] = [];
    server.use(
      http.get("/api/ducks", () => HttpResponse.json(stored)),
      http.post("/api/ducks", async ({ request }) => {
        const body = (await request.json()) as Omit<typeof duckA, "id" | "deleted">;
        const created = { id: stored.length + 1, ...body, deleted: false };
        stored.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    render(<Warehouse />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add duck/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /add duck/i }));
    await user.selectOptions(screen.getByLabelText(/color/i), "Red");
    await user.selectOptions(screen.getByLabelText(/size/i), "Large");
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), "10");
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "5");
    await user.click(screen.getByRole("button", { name: /^Add$/ }));

    await waitFor(() => expect(screen.getByText("Red")).toBeInTheDocument());
  });

  it("should open the edit form pre-filled when a row's Edit button is clicked", async () => {
    server.use(http.get("/api/ducks", () => HttpResponse.json([duckA])));
    const user = userEvent.setup();
    render(<Warehouse />);
    await waitFor(() => expect(screen.getByText("Red")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByRole("heading", { name: /edit duck/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toHaveValue(10);
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(5);
  });

  it("should DELETE the duck after confirm and reload", async () => {
    const stored = [duckA];
    server.use(
      http.get("/api/ducks", () => HttpResponse.json(stored)),
      http.delete("/api/ducks/:id", () => {
        stored.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<Warehouse />);
    await waitFor(() => expect(screen.getByText("Red")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(screen.queryByText("Red")).not.toBeInTheDocument());
  });

  it("should surface field-level 400 errors into the form", async () => {
    server.use(
      http.get("/api/ducks", () => HttpResponse.json([])),
      http.post("/api/ducks", () =>
        HttpResponse.json(
          { error: "ValidationError", errors: { color: "must be one of: Red, Green, Yellow, Black" } },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<Warehouse />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add duck/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /add duck/i }));
    // Submit the default values — backend will reject
    await user.click(screen.getByRole("button", { name: /^Add$/ }));

    // The error text should appear inside the color label, not in a top-level alert.
    await waitFor(() => {
      const colorLabel = screen.getByLabelText(/color/i).closest("label");
      expect(colorLabel).not.toBeNull();
      expect(
        within(colorLabel as HTMLElement).getByText(/must be one of: Red, Green, Yellow, Black/),
      ).toBeInTheDocument();
    });
  });

  it("should NOT DELETE when confirm is dismissed", async () => {
    const stored = [duckA];
    const deleteSpy = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.get("/api/ducks", () => HttpResponse.json(stored)),
      http.delete("/api/ducks/:id", deleteSpy),
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<Warehouse />);
    await waitFor(() => expect(screen.getByText("Red")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Red")).toBeInTheDocument();
  });
});
