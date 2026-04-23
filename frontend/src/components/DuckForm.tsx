import { useState, type FormEvent } from "react";
import { useTranslation } from "../i18n/locale";

const COLORS = ["Red", "Green", "Yellow", "Black"] as const;
const SIZES = ["XLarge", "Large", "Medium", "Small", "XSmall"] as const;

export interface DuckFormValues {
  color: string;
  size: string;
  price: number;
  quantity: number;
}

interface DuckFormProps {
  mode: "add" | "edit";
  initialValues?: Partial<DuckFormValues>;
  errors?: Record<string, string>;
  onSubmit: (values: DuckFormValues) => void;
  onCancel: () => void;
}

export function DuckForm({
  mode,
  initialValues,
  errors,
  onSubmit,
  onCancel,
}: DuckFormProps) {
  const { t } = useTranslation();
  const [color, setColor] = useState(initialValues?.color ?? COLORS[0]);
  const [size, setSize] = useState(initialValues?.size ?? SIZES[0]);
  const [price, setPrice] = useState(initialValues?.price ?? 0);
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? 0);

  const identityLocked = mode === "edit";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ color, size, price, quantity });
  };

  return (
    <form onSubmit={handleSubmit} className="duck-form">
      <h2>{mode === "add" ? t("form.addTitle") : t("form.editTitle")}</h2>

      <label>
        {t("form.label.color")}
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={identityLocked}
        >
          {COLORS.map((c) => (
            <option key={c} value={c}>
              {t(`color.${c}`)}
            </option>
          ))}
        </select>
        {errors?.color && <span className="field-error">{errors.color}</span>}
      </label>

      <label>
        {t("form.label.size")}
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          disabled={identityLocked}
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {errors?.size && <span className="field-error">{errors.size}</span>}
      </label>

      <label>
        {t("form.label.price")}
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        {errors?.price && <span className="field-error">{errors.price}</span>}
      </label>

      <label>
        {t("form.label.quantity")}
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        {errors?.quantity && <span className="field-error">{errors.quantity}</span>}
      </label>

      <div className="duck-form-actions">
        <button type="submit">
          {mode === "add" ? t("action.add") : t("action.save")}
        </button>
        <button type="button" onClick={onCancel}>
          {t("action.cancel")}
        </button>
      </div>
    </form>
  );
}
