const fs=require('fs');
function patch(p,pairs){let s=fs.readFileSync(p,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error(p+': topilmadi: '+a.slice(0,70));s=s.replace(a,b);}fs.writeFileSync(p,s);}
patch('functions/_ai.js',[
 ["level: { type: 'string', enum: ['A', 'B', 'C', 'D'] },","level: { type: 'string', enum: ['A', 'B', 'C', 'D', 'N'] },"],
 ["!['A', 'B', 'C', 'D'].includes(c.level)","!['A', 'B', 'C', 'D', 'N'].includes(c.level)"],
 ["'For each criterion give exactly one level (A, B, C or D), a short verbatim quote from the essay as evidence (empty string if none), and a one-sentence reason. ' +\n    'If the essay is too short or off-topic to judge a criterion, choose the lower level and say so. ' +",
  "'For each criterion give exactly one level: A, B, C or D, or N (not assessable). Use N ONLY when this single essay cannot provide evidence for the criterion at all (typically criterion 5, self-regulation, which needs visible revision, self-correction or peer-feedback work that one finished essay does not show). Do not use N to avoid a hard judgement: if the essay is weak, short or off-topic on a criterion it CAN show, give the lower level. ' +\n    'Give a short verbatim quote from the essay as evidence (empty string if none) and a one-sentence reason (for N, say what evidence is missing). ' +"],
]);
patch('public/app.js',[
 ["      var inp=$('input[name=\"e'+c.index+'\"][value=\"'+c.level+'\"]',area);if(inp)inp.checked=true;",
  "      var NA=c.level===\"N\";\n      $$('input[name=\"e'+c.index+'\"]',area).forEach(function(x){x.checked=false;});\n      var inp=NA?null:$('input[name=\"e'+c.index+'\"][value=\"'+c.level+'\"]',area);if(inp)inp.checked=true;"],
 ["n.innerHTML='<b>AI taklifi: '+esc(c.level)+'.</b> '+esc(c.reason)+(c.evidence?' <q>'+esc(c.evidence)+'</q>':'');",
  "n.innerHTML=NA?'<b>AI: bu esseda baholab bo‘lmaydi.</b> '+esc(c.reason)+' <i>Daraja belgilanmadi: o‘zingiz hal qiling yoki mezonni o‘tkazib yuboring.</i>':'<b>AI taklifi: '+esc(c.level)+'.</b> '+esc(c.reason)+(c.evidence?' <q>'+esc(c.evidence)+'</q>':'');"],
 ["toast(\"Darajalar belgilandi. Tekshirib, kerak bo‘lsa o‘zgartiring\");",
  "var nNA=r.data.criteria.filter(function(c){return c.level===\"N\";}).length;\n    toast(\"Darajalar belgilandi\"+(nNA?\" (\"+nNA+\" ta mezon baholanmaydi)\":\"\")+\". Tekshirib, kerak bo‘lsa o‘zgartiring\");"],
]);
patch('tools/mock-anthropic.mjs',[
 ["level: 'BCBAC'[i - 1]","level: (all.includes('TRIGGER_NA') ? 'BCBAN' : 'BCBAC')[i - 1]"],
]);
console.log('patched');
