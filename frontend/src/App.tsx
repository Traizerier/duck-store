import { LocaleProvider, useTranslation } from "./i18n/locale";
import { Warehouse } from "./pages/Warehouse";

function AppChrome() {
  const { t, locale, setLocale } = useTranslation();
  return (
    <main className="app">
      <nav className="tab-bar">
        <span className="tab tab-active">{t("tab.warehouse")}</span>
        <span className="tab tab-disabled">{t("tab.store")}</span>
        <button
          type="button"
          className="locale-toggle"
          onClick={() => setLocale(locale === "en" ? "es" : "en")}
        >
          {t("locale.toggle")}
        </button>
      </nav>
      <Warehouse />
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
