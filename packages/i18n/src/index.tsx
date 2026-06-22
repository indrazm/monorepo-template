import i18next, { type i18n, type Resource } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import type { ReactNode } from "react";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";

export { useTranslation };
export type { Resource };

export const supportedLanguages = ["en", "id"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const defaultLanguage = "en" satisfies SupportedLanguage;

export const languageLabels = {
  en: "English",
  id: "Bahasa Indonesia",
} satisfies Record<SupportedLanguage, string>;

export type FrontendI18nOptions = {
  appName: string;
  defaultNamespace: string;
  resources: Resource;
  fallbackLanguage?: SupportedLanguage;
  storageKey?: string;
};

export function createFrontendI18n({
  appName,
  defaultNamespace,
  resources,
  fallbackLanguage = defaultLanguage,
  storageKey = `${appName}:language`,
}: FrontendI18nOptions) {
  const instance = i18next.createInstance();

  void instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS: defaultNamespace,
      fallbackLng: fallbackLanguage,
      supportedLngs: [...supportedLanguages],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: storageKey,
      },
      react: {
        useSuspense: false,
      },
    });

  return instance;
}

export function AppI18nProvider({ children, i18n }: { children: ReactNode; i18n: i18n }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const activeLanguage = getSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={activeLanguage}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
      >
        {supportedLanguages.map((language) => (
          <option key={language} value={language}>
            {t(`language.options.${language}`, languageLabels[language])}
          </option>
        ))}
      </select>
    </label>
  );
}

function getSupportedLanguage(language: string | undefined): SupportedLanguage {
  const normalizedLanguage = language?.split("-")[0];

  return (
    supportedLanguages.find((supportedLanguage) => supportedLanguage === normalizedLanguage) ??
    defaultLanguage
  );
}
