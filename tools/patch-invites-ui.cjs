const fs=require('fs');let s=fs.readFileSync('public/app.js','utf8');
function rep(a,b){if(!s.includes(a))throw new Error('topilmadi: '+a.slice(0,60));s=s.replace(a,b);}
rep('login:viewLogin,account:viewAccount','login:viewLogin,join:viewJoin,account:viewAccount');
rep('var rs=await Promise.all([api("GET","teacher/students"),api("GET","teacher/panel")]);\n  var stus=rs[0].data.students||[],panel=rs[1].data;',
    'var rs=await Promise.all([api("GET","teacher/students"),api("GET","teacher/panel"),api("GET","teacher/invites")]);\n  var stus=rs[0].data.students||[],panel=rs[1].data,invs=(rs[2].data&&rs[2].data.invites)||[];');
rep("'<div class=\"hero-cta no-print\" style=\"margin:0 0 16px\"><button class=\"btn-ghost\" id=\"csvBtn\">CSV yuklab olish</button></div>'+",
    "invitePanel(invs)+'<div class=\"hero-cta no-print\" style=\"margin:0 0 16px\"><button class=\"btn-ghost\" id=\"csvBtn\">CSV yuklab olish</button></div>'+");
rep('    $("#newStu").addEventListener("submit"',
    '    wireInvites();\n    $("#newStu").addEventListener("submit"');
fs.writeFileSync('public/app.js',s);console.log('patched');
