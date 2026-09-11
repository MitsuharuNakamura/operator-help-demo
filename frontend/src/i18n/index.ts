import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ja from "./ja.json";
import en from "./en.json";
import zh from "./zh.json";

const stored = (typeof window !== "undefined"
  ? localStorage.getItem("lang")
  : null) as "ja" | "en" | "zh" | null;

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: stored || "ja",
  fallbackLng: "ja",
  interpolation: { escapeValue: false },
});

export default i18n;
