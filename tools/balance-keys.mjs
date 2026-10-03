// To'g'ri javob pozitsiyalarini A-D bo'ylab tekis taqsimlaydi (variantlarni ustma-ust almashtirib).
// Natija functions/_content.js ga yoziladi. Ishlatish: node tools/balance-keys.mjs
import fs from 'node:fs';
import { QUIZ, TEST } from '../functions/_content.js';

function targets(count, seed) {
  // 0..3 ni teng taqsimlangan, ammo ketma-ket takrorlanmaydigan tartibda
  const base = Array.from({ length: count }, (_, i) => i % 4);
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 1; i < base.length; i++) if (base[i] === base[i - 1]) { const j = base.findIndex((v, k) => k > i && v !== base[i] && v !== base[i - 1]); if (j > 0) [base[i], base[j]] = [base[j], base[i]]; }
  return base;
}
function place(q, target) {
  if (q.a === target) return;
  const o = q.o.slice();
  [o[q.a], o[target]] = [o[target], o[q.a]];
  q.o = o; q.a = target;
}
const keys = Object.keys(QUIZ);
const tq = targets(keys.length, 11);
keys.forEach((k, i) => place(QUIZ[k], tq[i]));
const tt = targets(TEST.length, 29);
TEST.forEach((q, i) => place(q, tt[i]));
const count = (arr) => [0, 1, 2, 3].map((x) => arr.filter((v) => v === x).length);
console.log('QUIZ', count(keys.map((k) => QUIZ[k].a)), 'TEST', count(TEST.map((q) => q.a)));
fs.writeFileSync('functions/_content.js',
  '// AVTOMATIK: tools/extract-content.js + tools/balance-keys.mjs. Javob kalitlari FAQAT serverda.\n' +
  'export const QUIZ = ' + JSON.stringify(QUIZ, null, 1) + ';\n' +
  'export const TEST = ' + JSON.stringify(TEST, null, 1) + ';\n');
