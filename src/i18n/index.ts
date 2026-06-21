import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import es from './es.json'
import { useSettings } from '@/store/settings'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: useSettings.getState().lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

// Keep i18next in sync with the settings store.
useSettings.subscribe((s) => {
  if (s.lang !== i18n.language) i18n.changeLanguage(s.lang)
})

export default i18n
