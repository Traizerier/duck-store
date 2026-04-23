import { createContext, useContext, useState, type ReactNode } from "react";

export type Locale = "en" | "es";

// Translation dictionaries. Keep keys flat and namespaced ("col.size", "action.edit")
// for clarity. Keys that don't need translation (e.g. "ID", "USD") stay inline.
// Exported so locale.test.ts can assert the two dictionaries share the same
// key set (the compile-time TranslationKey alias only catches typos against
// `en`, not missing keys in `es`).
export const translations = {
  en: {
    "tab.warehouse": "Warehouse",
    "tab.store": "Store",
    "locale.toggle": "Español",

    "warehouse.title": "Duck Warehouse",
    "warehouse.addButton": "Add Duck",

    "col.id": "ID",
    "col.color": "Color",
    "col.size": "Size",
    "col.price": "Price",
    "col.quantity": "Quantity",
    "col.actions": "Actions",

    "price.format": "{value} USD",

    "action.edit": "Edit",
    "action.delete": "Delete",
    "action.add": "Add",
    "action.save": "Save",
    "action.cancel": "Cancel",

    "form.addTitle": "Add Duck",
    "form.editTitle": "Edit Duck",
    "form.label.color": "Color",
    "form.label.size": "Size",
    "form.label.price": "Price",
    "form.label.quantity": "Quantity",

    "table.empty": "No ducks in the warehouse yet.",
    "table.search": "Search ducks...",
    "table.next": "Next",
    "table.prev": "Previous",
    "table.pageOf": "Page {current} of {total}",

    "color.Red": "Red",
    "color.Green": "Green",
    "color.Yellow": "Yellow",
    "color.Black": "Black",

    "delete.confirm": "Delete {color} {size} duck?",
  },
  es: {
    "tab.warehouse": "Almacén",
    "tab.store": "Tienda",
    "locale.toggle": "English",

    "warehouse.title": "Almacén de Patitos",
    "warehouse.addButton": "Agregar Patito",

    "col.id": "ID",
    "col.color": "Color",
    "col.size": "Tamaño",
    "col.price": "Precio",
    "col.quantity": "Cantidad",
    "col.actions": "Acciones",

    "price.format": "{value} USD",

    "action.edit": "Editar",
    "action.delete": "Borrar",
    "action.add": "Agregar",
    "action.save": "Guardar",
    "action.cancel": "Cancelar",

    "form.addTitle": "Agregar Patito",
    "form.editTitle": "Editar Patito",
    "form.label.color": "Color",
    "form.label.size": "Tamaño",
    "form.label.price": "Precio",
    "form.label.quantity": "Cantidad",

    "table.empty": "No hay patitos en el almacén todavía.",
    "table.search": "Buscar patitos...",
    "table.next": "Siguiente",
    "table.prev": "Anterior",
    "table.pageOf": "Página {current} de {total}",

    "color.Red": "Rojo",
    "color.Green": "Verde",
    "color.Yellow": "Amarillo",
    "color.Black": "Negro",

    "delete.confirm": "¿Borrar patito {color} {size}?",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

// Exported for unit tests. Application code should use the `useTranslation`
// hook, which wires locale state through context.
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = translations[locale] as Record<string, string>;
  let str = dict[key];
  if (str === undefined) {
    // Warn in dev so missing keys surface during development instead of
    // silently rendering the raw key. In production builds
    // import.meta.env.DEV is statically false and this branch is dead-stripped.
    if (import.meta.env?.DEV) {
      console.warn(`[i18n] Missing translation for "${key}" in locale "${locale}"`);
    }
    str = key;
  }
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

// Default context — returns English. Lets components rendered outside a
// provider (e.g. in isolated unit tests) still get reasonable output.
const defaultValue: LocaleContextValue = {
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => translate("en", key, vars),
};

const LocaleContext = createContext<LocaleContextValue>(defaultValue);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const value: LocaleContextValue = {
    locale,
    setLocale,
    t: (key, vars) => translate(locale, key, vars),
  };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  return useContext(LocaleContext);
}

// Exported for tests that want to assert against the dictionaries directly.
export type { TranslationKey };
