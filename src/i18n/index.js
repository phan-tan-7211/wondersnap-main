// Presentation-only localization: never rewrite model IDs, geometry or controller state.
import en from './en.js';
import vi from './vi.js';
import contentVi from './content-vi.js';

export const DEFAULT_LOCALE = 'vi';
export const STORAGE_KEY = 'wondersnap.locale';
export const LOCALES = Object.freeze(['vi', 'en']);
export const messages = Object.freeze({ en, vi });
let locale = DEFAULT_LOCALE;
const listeners = new Set();
const numberFormats = new Map();

export function normalizeLocale(value) {
  const language = String(value || '').toLowerCase().split(/[-_]/)[0];
  return LOCALES.includes(language) ? language : null;
}
export function resolveLocale(search = '', storage) {
  const requested = normalizeLocale(new URLSearchParams(search).get('lang'));
  if (requested) return requested;
  try { return normalizeLocale(storage?.getItem(STORAGE_KEY)) || DEFAULT_LOCALE; }
  catch { return DEFAULT_LOCALE; } // Private browsing / blocked storage must not block startup.
}
function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}
export const getLocale = () => locale;
export const speechLocale = () => locale === 'vi' ? 'vi-VN' : 'en-US';
export function setLocale(value, { persist = true } = {}) {
  const next = normalizeLocale(value);
  if (!next) return false;
  if (persist) { try { browserStorage()?.setItem(STORAGE_KEY, next); } catch { /* optional persistence */ } }
  if (next === locale) return true;
  locale = next;
  listeners.forEach((fn) => fn(locale));
  return true;
}
export function onLocaleChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function t(key, params = {}, language = locale) {
  const template = messages[normalizeLocale(language)]?.[key] ?? en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(params, name) ? String(params[name]) : token);
}
/** Source-text keys preserve canonical English model/part identifiers and worker caches. */
export function content(text, language = locale) {
  const source = text ?? '';
  return normalizeLocale(language) === 'vi' ? (contentVi[source] ?? source) : source;
}
export function hasContentTranslation(text) { return Object.hasOwn(contentVi, text); }
export const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Markup belongs to trusted, repository-owned messages; interpolation is always escaped. */
export function html(key, params = {}) {
  return t(key, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, escapeHTML(v)])));
}
export function number(value, digits = 0) {
  const key = `${locale}:${digits}`;
  if (!numberFormats.has(key)) numberFormats.set(key, new Intl.NumberFormat(speechLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return numberFormats.get(key).format(value);
}
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = html(el.dataset.i18nHtml); });
  for (const attr of ['title', 'aria-label', 'content']) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`))));
  }
  root.querySelectorAll('[data-language-select]').forEach((el) => { el.value = locale; });
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  if (doc) doc.documentElement.lang = locale;
}
export function initI18n(root = document) {
  setLocale(resolveLocale(globalThis.location?.search, browserStorage()), { persist: false });
  applyTranslations(root);
  root.querySelectorAll('[data-language-select]').forEach((el) => el.addEventListener('change', () => {
    setLocale(el.value);
    // A URL override applies on entry. Keep it in sync after a deliberate user choice.
    try {
      const url = new URL(globalThis.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', getLocale());
        globalThis.history.replaceState(globalThis.history.state, '', url);
      }
    } catch { /* embedded/locked-down contexts may disallow history updates */ }
  }));
  return onLocaleChange(() => applyTranslations(root));
}
