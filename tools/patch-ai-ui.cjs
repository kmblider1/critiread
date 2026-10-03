const fs=require('fs');let s=fs.readFileSync('public/app.js','utf8');
function rep(a,b){if(!s.includes(a))throw new Error('topilmadi: '+a.slice(0,70));s=s.replace(a,b);}
// talaba esse sahifasi
rep("async function viewEssay(){\n  var r=await api(\"GET\",\"me/essays\");","async function viewEssay(){\n  await ensureAi();\n  var r=await api(\"GET\",\"me/essays\");");
rep("return '<div class=\"queue-item\" style=\"cursor:default\"><div><b>'+e.topic","return '<div class=\"essay-card\"><div class=\"queue-item\" style=\"cursor:default;margin-bottom:0\"><div><b>'+e.topic");
rep("baholanmoqda</span>')+'</div>';}).join(\"\")","baholanmoqda</span>')+'</div>'+aiFeedbackHTML(e)+'</div>';}).join(\"\")");
rep("  return{html:html,title:\"Esse\",after:function(){\n    $(\"#e_body\")","  return{html:html,title:\"Esse\",after:function(){\n    wireFeedback();\n    $(\"#e_body\")");
fs.writeFileSync('public/app.js',s);console.log('esse patched');
