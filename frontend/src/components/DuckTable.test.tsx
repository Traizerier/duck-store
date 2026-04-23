import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DuckTable } from "./DuckTable";
import type { Duck } from "../api/ducks";

const sampleDucks: Duck[] = [
  { id: 1, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
  { id: 2, color: "Green", size: "Small", price: 8, quantity: 20, deleted: false },
];

const noop = () => {};

describe("DuckTable", () => {
  it("should render one row per duck plus a header row", () => {
    render(<DuckTable ducks={sampleDucks} onEdit={noop} onDelete={noop} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); // 1 header + 2 data
  });

  it("should render localized column headers (default locale: English)", () => {
    render(<DuckTable ducks={sampleDucks} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("should render localized color labels (default locale: English)", () => {
    render(<DuckTable ducks={sampleDucks} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
  });

  it("should format price with USD suffix", () => {
    render(<DuckTable ducks={sampleDucks} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText("10 USD")).toBeInTheDocument();
    expect(screen.getByText("8 USD")).toBeInTheDocument();
  });

  it("should show an empty-state message when no ducks are passed", () => {
    render(<DuckTable ducks={[]} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/no ducks/i)).toBeInTheDocument();
  });

  it("should call onEdit with the clicked duck when its Edit button is pressed", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<DuckTable ducks={sampleDucks} onEdit={onEdit} onDelete={noop} />);
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    expect(editButtons).toHaveLength(2);
    await user.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(sampleDucks[0]);
  });

  it("should call onDelete with the clicked duck when its Delete button is pressed", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<DuckTable ducks={sampleDucks} onEdit={noop} onDelete={onDelete} />);
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons).toHaveLength(2);
    await user.click(deleteButtons[1]);
    expect(onDelete).toHaveBeenCalledWith(sampleDucks[1]);
  });

  it("should filter rows by the global search input", async () => {
    const ducks: Duck[] = [
      { id: 1, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
      { id: 2, color: "Green", size: "Small", price: 8, quantity: 10, deleted: false },
      { id: 3, color: "Yellow", size: "Medium", price: 7, quantity: 15, deleted: false },
    ];
    const user = userEvent.setup();
    render(<DuckTable ducks={ducks} onEdit={noop} onDelete={noop} />);

    await user.type(screen.getByPlaceholderText(/search/i), "Green");

    expect(screen.queryByText("Red")).not.toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
    expect(screen.queryByText("Yellow")).not.toBeInTheDocument();
  });

  it("should paginate and allow moving to the next page", async () => {
    const ducks: Duck[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      color: "Red",
      size: "Large",
      price: 10,
      quantity: i + 1,
      deleted: false,
    }));
    const user = userEvent.setup();
    render(<DuckTable ducks={ducks} onEdit={noop} onDelete={noop} />);

    // Default page size is 10 → first page shows 10 data rows.
    let dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: /next/i }));

    dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(5);
  });

  it("should re-sort rows when a sortable column header is clicked", async () => {
    // Three ducks with distinct prices so we can prove the sort order switches.
    const ducks: Duck[] = [
      { id: 1, color: "Red", size: "Large", price: 20, quantity: 5, deleted: false },
      { id: 2, color: "Green", size: "Small", price: 10, quantity: 15, deleted: false },
      { id: 3, color: "Yellow", size: "Medium", price: 5, quantity: 10, deleted: false },
    ];
    const user = userEvent.setup();
    render(<DuckTable ducks={ducks} onEdit={noop} onDelete={noop} />);

    // Click the sort button inside the Price column header.
    const priceHeader = screen.getByRole("columnheader", { name: /price/i });
    await user.click(within(priceHeader).getByRole("button"));

    // Ascending by price (5, 10, 20 → Yellow, Green, Red).
    const dataRows = screen.getAllByRole("row").slice(1); // drop header row
    expect(within(dataRows[0]).getByText("Yellow")).toBeInTheDocument();
    expect(within(dataRows[1]).getByText("Green")).toBeInTheDocument();
    expect(within(dataRows[2]).getByText("Red")).toBeInTheDocument();
  });
});
