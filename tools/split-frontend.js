// Bir martalik: eski bitta-fayl sahifani public/style.css + public/data.js ga ajratadi (mashq kalitlarisiz).
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('public/index.html', 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync('public/style.css', css.trim() + '\n');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const dataPart = script.split('/* ============ STATE')[0].replace(/"use strict";/, '');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(dataPart + ';this.OUT={SKILLS,SHORT,CRIT,PTS,TASKS,MTYPE,TYPE2TASK,CORE,MODULES};', ctx);
const o = ctx.OUT;
o.MODULES = o.MODULES.map(m => { const c = Object.assign({}, m); delete c.quiz; return c; });
const out = '// Ochiq mazmun (kalitsiz). Mashq va test savollari/kalitlari serverda: functions/_content.js\n' +
  Object.keys(o).map(k => 'var ' + k + '=' + JSON.stringify(o[k]) + ';').join('\n') + '\n';
fs.writeFileSync('public/data.js', out);
console.log('css', css.length, 'data', out.length);
