import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import yo from './locales/yo.json';
import ha from './locales/ha.json';
import pcm from './locales/pcm.json';
import ig from './locales/ig.json';

const resources = {
  en: { translation: en },
  yo: { translation: yo },
  ha: { translation: ha },
  pcm: { translation: pcm },
  ig: { translation: ig },
};

// Get saved language or default to English
const savedLanguage = localStorage.getItem('ntc-language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Èdè Yorùbá' },
  { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa' },
  { code: 'pcm', name: 'Pidgin', nativeName: 'Naija' },
  { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo' },
];

export const changeLanguage = (langCode: string) => {
  localStorage.setItem('ntc-language', langCode);
  i18n.changeLanguage(langCode);
};

export default i18n;
