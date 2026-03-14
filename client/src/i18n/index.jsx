import { createContext, useContext, useState, useCallback } from 'react';
import tr from './tr.js';
import en from './en.js';

const locales = { tr, en };
const STORAGE_KEY = 'app-lang';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'tr'
  );

  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key, params) => {
    let str = locales[lang]?.[key] || locales.tr[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
