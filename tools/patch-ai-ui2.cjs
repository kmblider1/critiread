const fs=require('fs');let s=fs.readFileSync('public/app.js','utf8');
function rep(a,b){if(!s.includes(a))throw new Error('topilmadi: '+a.slice(0,70));s=s.replace(a,b);}
// o'qituvchi: esse baholash sahifasida AI tavsiya paneli
rep("async function viewQueue(arg){\n  if(arg){","async function viewQueue(arg){\n  await ensureAi();\n  if(arg){");
rep("'<div class=\"split\"><div><div class=\"essay-text\">'+esc(e.body)+'</div><div id=\"rubricArea\"","'<div class=\"split\"><div><div class=\"essay-text\">'+esc(e.body)+'</div><div id=\"aiBar\"></div><div id=\"rubricArea\"");
rep("      var area=$(\"#rubricArea\");previewScore(area,\"#pvCard\");\n      area.addEventListener(\"change\",function(){previewScore(area,\"#pvCard\");});",
"      var area=$(\"#rubricArea\");previewScore(area,\"#pvCard\");\n      area.addEventListener(\"change\",function(){previewScore(area,\"#pvCard\");});\n      wireSuggest(e.id,area);");
// modul sahifasi: murabbiy bloki
rep("<div id=\"quizBox\"></div></div></div>'+","<div id=\"quizBox\"></div></div><div class=\"block wide\" id=\"coachBlock\"></div></div>'+");
rep("title:\"Modul \"+m.n,after:function(){\n    var box=$(\"#quizBox\")","title:\"Modul \"+m.n,after:function(){\n    initCoach(n);\n    var box=$(\"#quizBox\")");
// o'qituvchi tabi va marshrut
rep("{r:\"queue\",l:\"Esse navbati\"},","{r:\"queue\",l:\"Esse navbati\"},{r:\"aiq\",l:\"AI savollar\"},");
rep("var teacherOnly={students:1,rubric:1,queue:1,research:1}","var teacherOnly={students:1,rubric:1,queue:1,research:1,aiq:1}");
rep("var needAuth={test:1,essay:1,profile:1,students:1,rubric:1,queue:1,research:1,account:1}","var needAuth={test:1,essay:1,profile:1,students:1,rubric:1,queue:1,research:1,account:1,aiq:1}");
rep("queue:viewQueue,research:viewResearch}","queue:viewQueue,aiq:viewAiq,research:viewResearch}");
fs.writeFileSync('public/app.js',s);console.log('patched 2');
