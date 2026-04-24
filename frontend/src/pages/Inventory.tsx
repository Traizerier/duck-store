import { useCallback, useEffect, useState } from "react";
import { services, ApiError } from "../services";
import { Duck } from "../models/Duck";
import { DuckTable } from "../components/DuckTable";
import { DuckForm, type DuckFormValues } from "../components/DuckForm";
import { useTranslation } from "../i18n/locale";

// The page title comes from the stack's VITE_TITLE env var (set by
// docker-compose's per-stack --env-file). That's how a "warehouse"
// instance shows "Duck Warehouse" at the top while a "store" instance
// shows "Duck Store" — same React code, different startup config.
const PAGE_TITLE = import.meta.env.VITE_TITLE ?? "Duck Inventory";

type FormState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; duck: Duck };

export function Inventory() {
  const { t } = useTranslation();
  const [ducks, setDucks] = useState<Duck[]>([]);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Route thrown errors to a user-facing string. For ApiError we prefer the
  // canonical envelope's `body.message` (set by the backend for 404/500/etc.)
  // so the user sees the server's actual diagnostic instead of a bare status.
  // Fall back to the translated "Request failed (N)" when the server omitted
  // a message. Non-ApiError Errors keep their raw `.message` — that copy
  // comes from the browser runtime, not us.
  const describeError = (e: unknown): string => {
    if (e instanceof ApiError) {
      const msg = extractApiMessage(e.body);
      if (msg) return msg;
      return t("error.requestFailed", { status: e.status });
    }
    if (e instanceof Error) return e.message;
    return t("error.unknown");
  };

  const refresh = useCallback(async () => {
    try {
      setDucks(await services.get("duck").list());
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openAdd = () => {
    setFieldErrors({});
    setError(null);
    setForm({ mode: "add" });
  };
  const openEdit = (duck: Duck) => {
    setFieldErrors({});
    setError(null);
    setForm({ mode: "edit", duck });
  };
  const closeForm = () => {
    setFieldErrors({});
    setForm({ mode: "closed" });
  };

  const handleDelete = async (duck: Duck) => {
    if (!window.confirm(t("delete.confirm", { color: duck.color, size: duck.size }))) return;
    try {
      await duck.delete();
      await refresh();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const handleSubmit = async (values: DuckFormValues) => {
    try {
      if (form.mode === "add") {
        await services.get("duck").create(values);
      } else if (form.mode === "edit") {
        await form.duck.update({
          price: values.price,
          quantity: values.quantity,
        });
      }
      closeForm();
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const extracted = extractFieldErrors(e.body);
        if (extracted) {
          setFieldErrors(extracted);
          return;
        }
      }
      setError(describeError(e));
    }
  };

  return (
    <div className="inventory">
      <header className="inventory-header">
        <h1>{PAGE_TITLE}</h1>
        <button type="button" onClick={openAdd}>
          {t("inventory.addButton")}
        </button>
      </header>

      {error && (
        <div role="alert" className="inventory-error">
          {error}
        </div>
      )}

      <DuckTable ducks={ducks} onEdit={openEdit} onDelete={handleDelete} />

      {form.mode !== "closed" && (
        <DuckForm
          mode={form.mode}
          initialValues={form.mode === "edit" ? form.duck : undefined}
          errors={fieldErrors}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}

// Pull out the canonical envelope's `message` field when present. Reads
// defensively so a server returning {} or a non-object body falls through
// to the translated generic string.
function extractApiMessage(body: unknown): string | null {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string" &&
    (body as { message: string }).message.length > 0
  ) {
    return (body as { message: string }).message;
  }
  return null;
}

function extractFieldErrors(body: unknown): Record<string, string> | null {
  if (
    body &&
    typeof body === "object" &&
    "errors" in body &&
    body.errors &&
    typeof body.errors === "object"
  ) {
    const entries = Object.entries(body.errors as Record<string, unknown>).filter(
      ([, v]) => typeof v === "string",
    ) as [string, string][];
    if (entries.length === 0) return null;
    return Object.fromEntries(entries);
  }
  return null;
}
