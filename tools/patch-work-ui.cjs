const fs=require('fs');let s=fs.readFileSync('public/app.js','utf8');
function rep(a,b){if(!s.includes(a))throw new Error('topilmadi: '+a.slice(0,70));s=s.replace(a,b);}
rep('{r:"queue",l:"Esse navbati"},','{r:"work",l:"Talaba ishlari"},{r:"queue",l:"Esse navbati"},');
rep('var teacherOnly={students:1,rubric:1,queue:1,research:1,aiq:1}','var teacherOnly={students:1,rubric:1,queue:1,research:1,aiq:1,work:1}');
rep('research:1,account:1,aiq:1}','research:1,account:1,aiq:1,work:1}');
rep('queue:viewQueue,aiq:viewAiq,','queue:viewQueue,aiq:viewAiq,work:viewWork,');
fs.writeFileSync('public/app.js',s);console.log('route patched');
