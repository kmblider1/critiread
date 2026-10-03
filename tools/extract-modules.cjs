// public/data.js dan server uchun mavzu tavsifi va rubrikani (kalitsiz) ajratadi: functions/_modules.js
const fs=require('fs'),vm=require('vm');
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/data.js','utf8')+';this.M=MODULES;this.R=CRIT;',ctx);
const out={};ctx.M.forEach(m=>{out[m.n]={en:m.en,uz:m.uz,type:m.type,ct:m.ct,goal:m.goal,idea:m.idea,example:m.example};});
fs.writeFileSync('functions/_modules.js',
  '// AVTOMATIK: tools/extract-modules.cjs. AI uchun mavzu va rubrika konteksti.\n'+
  'export const MODULE_INFO = '+JSON.stringify(out,null,1)+';\n'+
  'export const RUBRIC = '+JSON.stringify(ctx.R,null,1)+';\n');
console.log('modules',Object.keys(out).length,'rubric',ctx.R.length);
