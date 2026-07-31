import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import pt from './locales/pt.json';
import en from './locales/en.json';

i18n
  // Passa o detector de idioma do navegador (Lê se o Chrome está em pt-BR ou en-US)
  .use(LanguageDetector) 
  // Conecta o motor ao React
  .use(initReactI18next) 
  .init({
    resources: {
      en: { translation: en },
      pt: { translation: pt }
    },
    fallbackLng: 'en', // Se o usuário for da Rússia, cai para Português (ou mude para 'en' se preferir)
    interpolation: {
      escapeValue: false // O React já nos protege contra ataques XSS nativamente
    }
  });

export default i18n;