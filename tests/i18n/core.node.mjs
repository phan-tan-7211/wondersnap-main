import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../../src/i18n/en.js';
import vi from '../../src/i18n/vi.js';
import { resolveLocale, setLocale, getLocale, onLocaleChange, t, html, content, number, speechLocale, STORAGE_KEY } from '../../src/i18n/index.js';
import { parseCommand, Voice, speak } from '../../src/features.js';

const storage = (value) => ({ getItem: (key) => key === STORAGE_KEY ? value : null });
const catalog = ['Human Heart', 'Human Brain', 'Human Eye', 'Human Ear', 'Sports Car', 'Turtle Tower', 'Animal Cell'].map((name) => ({ name }));
const labels = [{ label: 'Frontal lobe' }, { label: 'Hippocampus' }, { label: 'Left atrium' }];
afterEach(() => { setLocale('vi', { persist: false }); delete globalThis.window; delete globalThis.SpeechSynthesisUtterance; delete globalThis.localStorage; });

test('English and Vietnamese UI keys and placeholders match exactly', () => {
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.ok(vi[key].trim(), key);
    assert.deepEqual([...vi[key].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(), [...en[key].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(), key);
  }
});
test('default locale is Vietnamese', () => assert.equal(resolveLocale(), 'vi'));
test('valid URL overrides stored locale', () => assert.equal(resolveLocale('?lang=vi', storage('en')), 'vi'));
test('valid storage overrides default', () => assert.equal(resolveLocale('', storage('en')), 'en'));
test('invalid URL falls back to stored locale', () => assert.equal(resolveLocale('?lang=zz', storage('en')), 'en'));
test('invalid storage falls back to Vietnamese', () => assert.equal(resolveLocale('', storage('fr')), 'vi'));
test('regional tags normalize', () => assert.equal(resolveLocale('?lang=EN-us'), 'en'));
test('blocked storage is safe on startup', () => assert.equal(resolveLocale('', { getItem() { throw Error('denied'); } }), 'vi'));
test('blocked storage is safe when switching', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied'); } });
  assert.equal(setLocale('en'), true); assert.equal(getLocale(), 'en');
});
test('switching persists and notifies once; unsubscribe works', () => {
  const writes = []; globalThis.localStorage = { setItem: (...a) => writes.push(a) };
  let calls = 0; const off = onLocaleChange(() => calls++);
  setLocale('en'); setLocale('en'); off(); setLocale('vi');
  assert.equal(calls, 1); assert.deepEqual(writes[0], [STORAGE_KEY, 'en']);
});
test('invalid locale cannot corrupt current state', () => { assert.equal(setLocale('zz'), false); assert.equal(getLocale(), 'vi'); });
test('messages interpolate zero and unknown keys remain diagnosable', () => {
  assert.equal(t('quiz.score', { score: 0, total: 5 }), '🏆 Điểm 0 / 5');
  assert.equal(t('missing.key'), 'missing.key');
  assert.equal(t('quiz.ask'), 'Hãy tìm {name}');
});
test('translated content has English fallback and never mutates input', () => {
  const item = Object.freeze({ name: 'Turtle Tower' });
  assert.equal(content(item.name), 'Tháp Rùa'); assert.equal(item.name, 'Turtle Tower');
  assert.equal(content('A future model'), 'A future model'); assert.equal(content(null), '');
  setLocale('en'); assert.equal(content('Turtle Tower'), 'Turtle Tower');
});
test('HTML interpolation escapes data but preserves trusted markup', () => {
  const value = html('stats.camera', { fps: '<img src=x onerror=alert(1)>', delegate: '<script>', ms: 0 });
  assert.match(value, /<b>&lt;img/); assert.doesNotMatch(value, /<img|<script>/);
});
test('numbers and speech tags follow selected language', () => {
  assert.equal(number(1.25, 2), '1,25'); assert.equal(speechLocale(), 'vi-VN');
  setLocale('en'); assert.equal(number(1.25, 2), '1.25'); assert.equal(speechLocale(), 'en-US');
});
const commands = [
  ['cho tôi xem tim', [{ type: 'model', name: 'Human Heart' }]],
  ['cho toi xem tim', [{ type: 'model', name: 'Human Heart' }]],
  ['mở mô hình tháp rùa', [{ type: 'model', name: 'Turtle Tower' }]],
  ['tách rời', [{ type: 'explode' }]], ['lắp lại', [{ type: 'assemble' }]],
  ['tiếp theo', [{ type: 'next' }]], ['trước đó', [{ type: 'prev' }]],
  ['mặt cắt', [{ type: 'cut' }]], // must not select Human Eye (mắt)
  ['câu đố', [{ type: 'quiz' }]], ['dừng câu đố', [{ type: 'stopQuiz' }]],
  ['phóng to', [{ type: 'zoomIn' }]], ['thu nhỏ', [{ type: 'zoomOut' }]],
  ['quay video', [{ type: 'record' }]],
  ['chỉ thùy trán', [{ type: 'part', index: 0 }]],
  ['mô tả hồi hải mã', [{ type: 'part', index: 1 }, { type: 'describe' }]],
  ['show me the heart', [{ type: 'model', name: 'Human Heart' }]],
  ['show me the hippocampus', [{ type: 'part', index: 1 }]],
  ['stop quiz', [{ type: 'stopQuiz' }]], ['nonsense xyz', []],
];
for (const [text, expected] of commands) test(`voice parser: ${text}`, () => assert.deepEqual(parseCommand(text, catalog, labels), expected));

test('recognition switches vi-VN → en-US and stale sessions cannot restart or emit', () => {
  const instances = [], heard = [];
  class SR { constructor() { this.starts = 0; instances.push(this); } start() { this.starts++; } stop() { this.stopped = true; } }
  globalThis.window = { SpeechRecognition: SR };
  const voice = new Voice((text) => heard.push(text), 'vi-VN');
  assert.equal(voice.start(), true); const old = instances[0], oldEnd = old.onend, oldResult = old.onresult;
  voice.setLanguage('en-US'); assert.equal(instances[1].lang, 'en-US'); assert.equal(old.stopped, true);
  oldEnd(); oldResult({ results: [[{ transcript: 'stale' }]] });
  assert.equal(old.starts, 1); assert.deepEqual(heard, []);
  voice.stop(); assert.equal(voice.on, false); assert.equal(instances[1].onend, null);
});
test('speech synthesis sets the locale and chooses a matching voice', () => {
  let spoken;
  const vn = { lang: 'vi-VN', name: 'Vietnamese' };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.window = { speechSynthesis: { cancel() {}, getVoices: () => [vn], speak: (u) => { spoken = u; } } };
  assert.equal(speak('Tháp Rùa', 'vi-VN'), true); assert.equal(spoken.lang, 'vi-VN'); assert.equal(spoken.voice, vn);
});
test('unsupported voice APIs fail gracefully', () => {
  globalThis.window = {}; const voice = new Voice(() => {});
  assert.equal(voice.start(), false); assert.equal(speak('test', 'vi-VN'), false);
});
test('every static HTML translation binding references a real UI key', () => {
  const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  for (const [, key] of source.matchAll(/data-i18n(?:-html|-title|-aria-label|-content)?="([^"]+)"/g)) assert.ok(key in en && key in vi, key);
});
