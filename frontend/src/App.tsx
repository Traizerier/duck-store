import { LocaleProvider, useTranslation } from "./i18n/locale";
import { Inventory } from "./pages/Inventory";

// Instance label sourced from the stack's VITE_INSTANCE env (set by
// docker-compose --env-file). Used only as a tiny chip near the locale
// toggle — the main page title comes from VITE_TITLE in Inventory.tsx.
const INSTANCE = import.meta.env.VITE_INSTANCE ?? "";

function AppChrome() {
  const { t, locale, setLocale } = useTranslation();
  return (
    <main className="app">
      <nav className="tab-bar">
        {INSTANCE && <span className="instance-chip">{INSTANCE}</span>}
        <button
          type="button"
          className="locale-toggle"
          onClick={() => setLocale(locale === "en" ? "es" : "en")}
        >
          {t("locale.toggle")}
        </button>
      </nav>
      <Inventory />
    </main>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <AppChrome />
    </LocaleProvider>
  );
}
