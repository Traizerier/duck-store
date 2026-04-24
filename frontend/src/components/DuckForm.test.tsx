import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DuckForm } from "./DuckForm";

const noop = () => {};

describe("DuckForm — add mode", () => {
  it("should render all four input fields", () => {
    render(<DuckForm mode="add" onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
  });

  it("should offer exactly the four spec colors", () => {
    render(<DuckForm mode="add" onSubmit={noop} onCancel={noop} />);
    const select = screen.getByLabelText(/color/i) as HTMLSelectElement;
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Red", "Green", "Yellow", "Black"]);
  });

  it("should offer exactly the five spec sizes", () => {
    render(<DuckForm mode="add" onSubmit={noop} onCancel={noop} />);
    const select = screen.getByLabelText(/size/i) as HTMLSelectElement;
    // Option `value` is the spec token; the visible text is the English
    // translation. Check values — they're what the form submits — so the
    // assertion survives future locale-label tweaks.
    const values = within(select).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["XLarge", "Large", "Medium", "Small", "XSmall"]);
  });

  it("should call onSubmit with the selected values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DuckForm mode="add" onSubmit={onSubmit} onCancel={noop} />);

    await user.selectOptions(screen.getByLabelText(/color/i), "Green");
    await user.selectOptions(screen.getByLabelText(/size/i), "Medium");
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), "9.99");
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "7");

    await user.click(screen.getByRole("button", { name: /add|save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      color: "Green",
      size: "Medium",
      price: 9.99,
      quantity: 7,
    });
  });

  it("should call onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DuckForm mode="add" onSubmit={noop} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("DuckForm — edit mode", () => {
  const initial = { color: "Yellow", size: "Large", price: 15, quantity: 30 };

  it("should pre-fill every field from initialValues", () => {
    render(
      <DuckForm mode="edit" initialValues={initial} onSubmit={noop} onCancel={noop} />,
    );
    expect(screen.getByLabelText(/color/i)).toHaveValue("Yellow");
    expect(screen.getByLabelText(/size/i)).toHaveValue("Large");
    expect(screen.getByLabelText(/price/i)).toHaveValue(15);
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(30);
  });

  it("should disable color and size so they can't be edited", () => {
    render(
      <DuckForm mode="edit" initialValues={initial} onSubmit={noop} onCancel={noop} />,
    );
    expect(screen.getByLabelText(/color/i)).toBeDisabled();
    expect(screen.getByLabelText(/size/i)).toBeDisabled();
    expect(screen.getByLabelText(/price/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/quantity/i)).not.toBeDisabled();
  });
});

describe("DuckForm — field errors", () => {
  it("should render the per-field error strings when errors are passed", () => {
    render(
      <DuckForm
        mode="add"
        errors={{ color: "must be one of: Red, Green, Yellow, Black", price: "must be positive" }}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText(/must be one of: Red, Green, Yellow, Black/)).toBeInTheDocument();
    expect(screen.getByText(/must be positive/)).toBeInTheDocument();
  });
});
