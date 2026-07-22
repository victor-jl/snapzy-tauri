import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";
import ja from "./ja.json";
import ko from "./ko.json";
import fr from "./fr.json";
import de from "./de.json";
import es from "./es.json";
import pt from "./pt.json";
import ru from "./ru.json";
import vi from "./vi.json";

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  pt: { translation: pt },
  ru: { translation: ru },
  vi: { translation: vi },
};

const availableLanguages = Object.keys(resources);

function detectLanguage(): string {
  // Check localStorage first
  try {
    const stored = localStorage.getItem("snapzy-language");
    if (stored && availableLanguages.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }

  // Check browser language
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language?.split("-")[0];
    if (browserLang && availableLanguages.includes(browserLang)) {
      return browserLang;
    }

    // Check all navigator languages
    for (const lang of navigator.languages ?? []) {
      const short = lang.split("-")[0];
      if (short && availableLanguages.includes(short)) {
        return short;
      }
    }
  }

  return "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export { availableLanguages };
export { useTranslation } from "react-i18next";
export default i18n;
