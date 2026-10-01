// i18n.js - Internationalization module for WonderSnap
const LOCALES = {
  en: 'en.json',
  vi: 'vi.json'
};

let currentLocale = 'vi';
let translations = {};
let listeners = [];

async function loadLocale(locale) {
  if (!LOCALES[locale]) {
    console.warn(`Locale ${locale} not supported, falling back to en`);
    locale = 'en';
  }
  try {
    const response = await fetch(`src/locales/${LOCALES[locale]}`);
    if (!response.ok) throw new Error(`Failed to load ${locale}`);
    translations = await response.json();
    currentLocale = locale;
    document.documentElement.lang = locale;
    return true;
  } catch (error) {
    console.error(`Failed to load locale ${locale}:`, error);
    if (locale !== 'en') {
      return loadLocale('en');
    }
    return false;
  }
}

function t(key, params = {}) {
  const keys = key.split('.');
  let value = translations;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  if (typeof value !== 'string') return key;
  return value.replace(/\{\{(\w+)\}\}/g, (match, param) => params[param] || match);
}

function tHtml(key, params = {}) {
  return t(key, params);
}

function getCurrentLocale() {
  return currentLocale;
}

function getAvailableLocales() {
  return Object.keys(LOCALES);
}

function onLocaleChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

function notifyListeners() {
  listeners.forEach(cb => cb(currentLocale, translations));
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const translation = t(key);
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
      el.value = translation;
    } else if (el.dataset.i18nHtml === 'true') {
      el.innerHTML = translation;
    } else {
      el.textContent = translation;
    }
  });

  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const attrs = el.dataset.i18nAttr.split(',');
    attrs.forEach(attr => {
      const [key, attrName] = attr.split(':');
      const translation = t(key.trim());
      el.setAttribute(attrName.trim(), translation);
    });
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    el.title = t(key);
  });
}

async function initI18n() {
  const savedLocale = localStorage.getItem('wondersnap-locale') || 'vi';
  await loadLocale(savedLocale);
  applyTranslations();

  const selector = document.getElementById('localeSelector');
  if (selector) {
    selector.value = currentLocale;
    selector.addEventListener('change', async (e) => {
      await setLocale(e.target.value);
    });
  }
}

async function setLocale(locale) {
  const success = await loadLocale(locale);
  if (success) {
    localStorage.setItem('wondersnap-locale', locale);
    applyTranslations();
    notifyListeners();
  }
  return success;
}

export {
  initI18n,
  t,
  tHtml,
  getCurrentLocale,
  getAvailableLocales,
  setLocale,
  onLocaleChange,
  applyTranslations
};
