// Vietnamese commands return canonical actions, independent of the active UI locale.
import vi from './content-vi.js';

export const normalizeSpeech = (text) => String(text || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/\s+/g, ' ');
const aliases = {
  tim: 'Human Heart', 'trai tim': 'Human Heart', nao: 'Human Brain', than: 'Kidney', phoi: 'Lungs',
  mat: 'Human Eye', tai: 'Human Ear', rang: 'Tooth (Molar)', 'hop so': 'Skull', 'bo xuong': 'Skeleton',
  'co the': 'Human Body', adn: 'DNA Double Helix', 'te bao': 'Animal Cell', 'o to': 'Sports Car',
  'xe hoi': 'Sports Car', 'xe may': 'Motorcycle', 'may bay': 'Airliner', 'ten lua': 'Saturn V Rocket',
  'dong ho': 'Mechanical Watch', 'pin xe dien': 'EV Battery Pack', 'dong co': 'Inline-4 Engine',
};
const commands = [
  ['describe', ['mo ta', 'giai thich', 'day la gi', 'bo phan nay la gi', 'doc mo ta']],
  ['explode', ['tach roi', 'thao roi', 'mo ra', 'xem ben trong']],
  ['assemble', ['lap lai', 'lap rap', 'dong lai']],
  ['next', ['tiep theo']], ['prev', ['truoc do', 'quay lai']],
  ['snap', ['bung tay', 'goi hat sang']], ['dissolve', ['tan bien', 'xoa mo hinh']],
  ['cut', ['mat cat', 'cat lop']], ['zoomIn', ['phong to']], ['zoomOut', ['thu nho']],
  ['rotate', ['xoay']], ['record', ['quay video', 'ghi hinh']],
];

/** Return null for an English/unrecognized command so the existing English parser can handle it. */
export function parseVietnameseCommand(text, catalog, labels = []) {
  let input = ` ${normalizeSpeech(text)} `;
  const has = (phrase) => input.includes(` ${phrase} `);
  if (['dung cau do', 'ket thuc cau do', 'thoat cau do'].some(has)) return [{ type: 'stopQuiz' }];
  if (['cau do', 'kiem tra kien thuc'].some(has)) return [{ type: 'quiz' }];
  const actions = [];
  // Remove action phrases before matching names: "mặt cắt" must not select "mắt".
  for (const [type, phrases] of commands) {
    if (!phrases.some(has)) continue;
    actions.push({ type });
    for (const phrase of phrases) input = input.split(` ${phrase} `).join(' ');
  }
  const candidates = catalog.flatMap((d) => {
    const display = vi[d.name];
    return display ? [{ name: d.name, phrase: normalizeSpeech(display) }] : [];
  });
  for (const [phrase, name] of Object.entries(aliases)) {
    if (catalog.some((d) => d.name === name)) candidates.push({ name, phrase });
  }
  const model = candidates.filter((item) => has(item.phrase)).sort((a, b) => b.phrase.length - a.phrase.length)[0];
  const part = labels.map((item, index) => ({ index, phrase: vi[item.label] ? normalizeSpeech(vi[item.label]) : '' }))
    .filter((item) => item.phrase && has(item.phrase)).sort((a, b) => b.phrase.length - a.phrase.length)[0];
  const explicitModel = has('mo hinh');
  const selection = part && !explicitModel && (!model || part.phrase.length >= model.phrase.length)
    ? { type: 'part', index: part.index } : model ? { type: 'model', name: model.name } : null;
  if (selection) actions.unshift(selection);
  return actions.length ? actions : null;
}
