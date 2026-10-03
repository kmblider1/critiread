// index.html ichidagi DATA qismini o'qib, kalitli mazmunni functions/_content.js ga ajratadi.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const dataPart = script.split('/* ============ STATE')[0];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(dataPart.replace(/"use strict";/, '') + ';this.OUT={MODULES,TEST,CRIT,SKILLS,PTS};', ctx);
const { MODULES, TEST } = ctx.OUT;
const quiz = {};
MODULES.forEach(m => { quiz[m.n] = { t: m.quiz.t, o: m.quiz.o, a: m.quiz.a, why: m.quiz.why }; });
const test = TEST.map(q => ({ s: q.s, p: q.p, t: q.t, o: q.o, a: q.a, why: q.why }));
const out = '// AVTOMATIK: tools/extract-content.js. Javob kalitlari FAQAT serverda.\n' +
  'export const QUIZ = ' + JSON.stringify(quiz, null, 1) + ';\n' +
  'export const TEST = ' + JSON.stringify(test, null, 1) + ';\n';
fs.writeFileSync('functions/_content.js', out);
console.log('modules', Object.keys(quiz).length, 'test', test.length);
