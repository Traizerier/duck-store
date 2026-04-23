import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createDuck,
  deleteDuck,
  listDucks,
  updateDuck,
  type Duck,
} from "../api/ducks";
import { DuckTable } from "../components/DuckTable";
import { DuckForm, type DuckFormValues } from "../components/DuckForm";
import { useTranslation } from "../i18n/locale";

type FormState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; duck: Duck };

export function Warehouse() {
  const { t } = useTranslation();
  const [ducks, setDucks] = useState<Duck[]>([]);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDucks(await listDucks());
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
      await deleteDuck(duck.id);
      await refresh();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const handleSubmit = async (values: DuckFormValues) => {
    try {
      if (form.mode === "add") {
        await createDuck(values);
      } else if (form.mode === "edit") {
        await updateDuck(form.duck.id, {
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
    <div className="warehouse">
      <header className="warehouse-header">
        <h1>{t("warehouse.title")}</h1>
        <button type="button" onClick={openAdd}>
          {t("warehouse.addButton")}
        </button>
      </header>

      {error && (
        <div role="alert" className="warehouse-error">
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

function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    return `Request failed (${e.status})`;
  }
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
