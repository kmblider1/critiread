"use strict";
/* CritiRead — frontend. Ma'lumot va javob kalitlari serverda (/api). data.js: ochiq mazmun. */
var $=function(s,r){return(r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function mean(a){return a.reduce(function(x,y){return x+y;},0)/a.length;}
function grade(p){return p>=90?5:p>=70?4:p>=60?3:2;}
function gradeCls(g){return g===5?"gr5":g===4?"gr4":g===3?"gr3":"gr2";}
function isCore(m){return !!CORE[m.type];}
function toast(m){var t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove("show");},2600);}
var S={user:null,setup:false,theme:null,quizzes:null,viewStu:null,test:null,sort:{k:"name",d:1},seq:0};

/* ---------- tema ---------- */
try{S.theme=localStorage.getItem("critiread.theme");}catch(e){}
function applyTheme(){
  var t=S.theme||(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
  document.documentElement.setAttribute("data-theme",t);
}

/* ---------- API ---------- */
function api(method,path,body){
  var opt={method:method,credentials:"same-origin",headers:{"content-type":"application/json"}};
  if(method!=="GET")opt.headers["x-cr"]="1";
  if(body!==undefined)opt.body=JSON.stringify(body);
  return fetch("/api/"+path,opt).then(function(r){
    return r.json().catch(function(){return {};}).then(function(d){
      if(r.status===401&&path!=="login"&&path!=="me"&&path!=="status"){S.user=null;S.quizzes=null;chrome();location.hash="#/login";}
      return {status:r.status,data:d};
    });
  }).catch(function(){return {status:0,data:{error:"Tarmoq xatosi. Qayta urinib ko‘ring."}};});
}

/* ---------- SVG radar ---------- */
function radarSVG(series,size){
  size=size||360;var c=size/2,R=size/2-58,n=6,rings=[20,40,60,80,100];
  function pt(i,v){var a=-Math.PI/2+i*2*Math.PI/n;return[c+R*v/100*Math.cos(a),c+R*v/100*Math.sin(a)];}
  var g='';
  rings.forEach(function(r){g+='<polygon points="'+SKILLS.map(function(_,i){return pt(i,r).join(",");}).join(" ")+'" fill="none" stroke="var(--line-2)" stroke-width="1"/>';});
  SKILLS.forEach(function(_,i){var p=pt(i,100);g+='<line x1="'+c+'" y1="'+c+'" x2="'+p[0]+'" y2="'+p[1]+'" stroke="var(--line)"/>';});
  rings.forEach(function(r){var p=pt(0,r);g+='<text x="'+(p[0]+4)+'" y="'+(p[1]+3)+'" font-size="9" fill="var(--smoke)">'+r+'</text>';});
  series.forEach(function(s){
    var vals=s.vals.map(function(v){return v==null?0:v;});
    g+='<polygon points="'+vals.map(function(v,i){return pt(i,v).join(",");}).join(" ")+'" fill="'+(s.fill||"none")+'" stroke="'+s.color+'" stroke-width="'+(s.w||2)+'"'+(s.dash?' stroke-dasharray="5 4"':'')+' stroke-linejoin="round"/>';
    if(!s.dash)vals.forEach(function(v,i){var p=pt(i,v);g+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3.4" fill="'+s.color+'"><title>'+SKILLS[i].k+': '+(s.vals[i]==null?"baholanmagan":v+"%")+'</title></circle>';});
  });
  SHORT.forEach(function(l,i){var a=-Math.PI/2+i*2*Math.PI/n,x=c+(R+22)*Math.cos(a),y=c+(R+22)*Math.sin(a);
    var anc=Math.abs(Math.cos(a))<.25?"middle":(Math.cos(a)>0?"start":"end");
    g+='<text x="'+x+'" y="'+(y+4)+'" font-size="12" text-anchor="'+anc+'" fill="var(--slate)">'+l+'</text>';});
  return '<svg viewBox="0 0 '+size+' '+size+'" role="img" aria-label="CT-profil radar diagrammasi">'+g+'</svg>';
}
var FILL="rgba(59,91,253,.16)";

/* ---------- qobiq: tepa panel + tablar ---------- */
function tabsFor(){
  var u=S.user,t=[{r:"",l:"Bosh sahifa"},{r:"modules",l:"Mavzular (30)"}];
  if(!u)return t;
  if(u.role==="student")t.push({r:"test",l:"Diagnostika"},{r:"essay",l:"Esse"},{r:"profile",l:"CT-profil"});
  else t.push({r:"students",l:"Talabalar"},{r:"rubric",l:"Baholash"},{r:"queue",l:"Esse navbati"},{r:"aiq",l:"AI savollar"},{r:"profile",l:"Profillar"},{r:"research",l:"Tadqiqot (Cohen’s d)"});
  return t;
}
function chrome(cur){
  var u=S.user;
  $("#userArea").innerHTML=u?
    '<div class="user-chip"><div class="who"><b>'+esc(u.name)+'</b><span>'+(u.role==="teacher"?"O‘qituvchi":"Talaba")+(u.grp?" · "+esc(u.grp):"")+'</span></div>'+
    '<a class="btn-ghost btn-sm" href="#/account">Parol</a><button class="btn-ghost btn-sm" id="logoutBtn">Chiqish</button></div>':
    '<a class="btn-primary btn-sm" href="#/login">Kirish</a>';
  var lo=$("#logoutBtn");if(lo)lo.addEventListener("click",function(){api("POST","logout").then(function(){S.user=null;S.quizzes=null;S.test=null;chrome();location.hash="#/";toast("Tizimdan chiqdingiz");});});
  $("#tabs").innerHTML=tabsFor().map(function(t){
    var on=(cur===t.r)||(t.r==="modules"&&cur==="module");
    return '<a class="tab" href="#/'+t.r+'"'+(on?' aria-current="page"':'')+'>'+t.l+'</a>';}).join("");
}

/* ---------- marshrutlash ---------- */
function note(title,text,btn){return '<div class="locked"><h2 style="font-size:30px;margin-bottom:10px">'+title+'</h2><p>'+text+'</p>'+(btn||"")+'</div>';}
async function route(){
  var seq=++S.seq;
  var h=location.hash.replace(/^#\/?/,"").split("/"),r=h[0]||"",arg=h[1];
  var needAuth={test:1,essay:1,profile:1,students:1,rubric:1,queue:1,research:1,account:1,aiq:1};
  var teacherOnly={students:1,rubric:1,queue:1,research:1,aiq:1},studentOnly={test:1,essay:1};
  chrome(r);
  var app=$("#app");
  if(needAuth[r]&&!S.user){location.hash="#/login";return;}
  if(teacherOnly[r]&&S.user.role!=="teacher"){app.innerHTML='<section class="view">'+note("Bu bo‘lim o‘qituvchi uchun","Sizning hisobingiz talaba hisobi.")+'</section>';return;}
  if(studentOnly[r]&&S.user.role!=="student"){app.innerHTML='<section class="view">'+note("Bu bo‘lim talaba uchun","O‘qituvchi hisobida test va esse topshirilmaydi. Talabalar natijasini «Talabalar» bo‘limida ko‘ring.")+'</section>';return;}
  app.innerHTML='<div class="loading">Yuklanmoqda…</div>';
  var views={"":viewHome,modules:viewModules,module:viewModule,login:viewLogin,join:viewJoin,account:viewAccount,test:viewTest,essay:viewEssay,profile:viewProfile,students:viewStudents,rubric:viewRubric,queue:viewQueue,aiq:viewAiq,research:viewResearch};
  var v=await (views[r]||viewHome)(arg);
  if(seq!==S.seq)return;
  app.innerHTML='<section class="view">'+v.html+'</section>';
  document.title=(v.title?v.title+" · ":"")+"CritiRead";
  if(v.after)await v.after();
  window.scrollTo(0,0);
}

/* ---------- bosh sahifa ---------- */
var SAMPLE_PRE=[54,50,46,52,49,44],SAMPLE_CUR=[76,72,66,74,70,63];
async function viewHome(){
  var u=S.user,cta;
  if(!u)cta='<a class="btn-primary" href="#/login">Kirish</a><a class="btn-ghost" href="#/modules">Mavzularni ko‘rish</a>';
  else if(u.role==="student")cta='<a class="btn-primary" href="#/test">Diagnostikaga o‘tish</a><a class="btn-ghost" href="#/modules">Mavzular</a>';
  else cta='<a class="btn-primary" href="#/students">Talabalar</a><a class="btn-ghost" href="#/queue">Esse navbati</a>';
  var html='<div class="hero"><div><div class="eyebrow">DSc dissertatsiyasi · amaliy-eksperimental komponent</div>'+
   '<h1>Tanqidiy fikrlashni <em>o‘lchaydigan</em> raqamli o‘quv muhiti</h1>'+
   '<p class="lede">Bo‘lajak ingliz tili o‘qituvchilari uchun “Reading and Writing” fani misolida. Har topshiriq tanqidiy fikrlash mezonlari bo‘yicha baholanadi va talabaning CT-profilini shakllantiradi.</p>'+
   '<div class="hero-cta">'+cta+'</div>'+
   '<div class="methodline"><span><b>Model:</b> CTDF</span><span><b>Darajalar:</b> CEFR</span><span><b>Standart:</b> Paul–Elder</span><span><b>Ko‘nikma:</b> Facione ×6</span></div></div>'+
   '<div class="artifact"><div class="cap"><span>CT-profil <span class="demo-tag">namuna</span></span><b>'+Math.round(mean(SAMPLE_CUR))+'%</b></div><div class="radar-wrap">'+
   radarSVG([{vals:SAMPLE_PRE,color:"var(--pre-line)",dash:1,w:1.5},{vals:SAMPLE_CUR,color:"var(--brown)",fill:FILL}],330)+'</div></div></div>'+
   '<div class="divider"></div><div class="section-head"><div class="eyebrow">Qanday ishlaydi</div><h2>To‘rt qadamda CT-profil</h2></div>'+
   '<div class="steps">'+
   '<div class="step"><b>1</b><h4>PRE-diagnostika</h4><p>12 savol boshlang‘ich darajani aniqlaydi (bahoga kirmaydi).</p></div>'+
   '<div class="step"><b>2</b><h4>Mavzular va topshiriqlar</h4><p>30 modul, mashqlar va esse.</p></div>'+
   '<div class="step"><b>3</b><h4>Rubrika bilan baholash</h4><p>O‘qituvchi 6×4 mezon bo‘yicha baholaydi, profil yangilanadi.</p></div>'+
   '<div class="step"><b>4</b><h4>POST va Cohen’s d</h4><p>O‘sish (Δ) va ta’sir kuchi hisoblanadi.</p></div></div>'+
   '<div class="divider"></div><div class="section-head"><div class="eyebrow">Ikki mustaqil oqim</div><h2>Baho va diagnostika alohida</h2></div>'+
   '<div class="parts">'+
   '<div class="part"><div class="no">01</div><div><h3>Joriy topshiriqlar → CT% → baho</h3><p>Topshiriq va esselar rubrika bo‘yicha baholanadi: A=5, B=4, C=3, D=2. CT% = ball ÷ maksimal ball. 90–100 → 5, 70–89 → 4, 60–69 → 3, 0–59 → 2.</p></div></div>'+
   '<div class="part key"><div class="no">02</div><div><span class="tagx">Eksperiment o‘lchovi</span><h3>PRE/POST diagnostika → Δ va Cohen’s d</h3><p>Boshlang‘ich va yakuniy diagnostika bahoga qo‘shilmaydi; faqat o‘sish va ta’sir kuchini ko‘rsatadi. To‘g‘ri javoblar talabaga ko‘rsatilmaydi va serverda saqlanadi.</p></div></div></div>';
  return{html:html,title:""};
}

/* ---------- kirish / sozlash ---------- */
async function viewLogin(){
  if(S.user){location.hash="#/";return{html:"",title:""};}
  var st=await api("GET","status");S.setup=!!(st.data&&st.data.setup);
  var html;
  if(S.setup){
    html='<div class="auth-wrap"><form class="auth-card" id="authForm"><div class="eyebrow">Birinchi sozlash</div><h2>O‘qituvchi hisobini yarating</h2>'+
     '<p class="note" style="margin-top:6px">Bu hisob butun platformani boshqaradi. Parolni faqat o‘zingiz biling.</p>'+
     '<div class="fld-row"><label class="fld" for="f_name">Ism-familiya</label><input class="num" id="f_name" autocomplete="name" required></div>'+
     '<div class="fld-row"><label class="fld" for="f_email">Email</label><input class="num" id="f_email" type="email" autocomplete="username" required></div>'+
     '<div class="fld-row"><label class="fld" for="f_pass">Parol (kamida 8 belgi)</label><input class="num" id="f_pass" type="password" autocomplete="new-password" minlength="8" required></div>'+
     '<div class="fld-row"><label class="fld" for="f_pass2">Parolni takrorlang</label><input class="num" id="f_pass2" type="password" autocomplete="new-password" required></div>'+
     '<div id="authMsg"></div><button class="btn-primary" type="submit">Hisobni yaratish</button></form></div>';
  }else{
    html='<div class="auth-wrap"><form class="auth-card" id="authForm"><div class="eyebrow">CritiRead</div><h2>Tizimga kirish</h2>'+
     '<p class="note" style="margin-top:6px">Talaba hisobini o‘qituvchi yaratadi. Hisobingiz bo‘lmasa, o‘qituvchingizga murojaat qiling.</p>'+
     '<div class="fld-row"><label class="fld" for="f_email">Email</label><input class="num" id="f_email" type="email" autocomplete="username" required></div>'+
     '<div class="fld-row"><label class="fld" for="f_pass">Parol</label><input class="num" id="f_pass" type="password" autocomplete="current-password" required></div>'+
     '<div id="authMsg"></div><button class="btn-primary" type="submit">Kirish</button></form></div>';
  }
  return{html:html,title:S.setup?"Sozlash":"Kirish",after:function(){
    $("#authForm").addEventListener("submit",async function(e){
      e.preventDefault();var msg=$("#authMsg"),btn=$("button[type=submit]",this);msg.innerHTML="";
      var body;
      if(S.setup){
        if($("#f_pass").value!==$("#f_pass2").value){msg.innerHTML='<div class="form-err">Parollar mos kelmadi</div>';return;}
        body={name:$("#f_name").value,email:$("#f_email").value,password:$("#f_pass").value};
      }else body={email:$("#f_email").value,password:$("#f_pass").value};
      btn.disabled=true;
      var r=await api("POST",S.setup?"setup":"login",body);
      btn.disabled=false;
      if(r.status!==200){msg.innerHTML='<div class="form-err">'+esc(r.data.error||"Xatolik")+'</div>';return;}
      var me=await api("GET","me");S.user=me.data.user;S.setup=false;S.quizzes=null;
      toast("Xush kelibsiz, "+S.user.name);
      chrome();location.hash=S.user.role==="teacher"?"#/students":"#/";
    });
  }};
}
async function viewAccount(){
  var html='<div class="auth-wrap"><form class="auth-card" id="pwForm"><div class="eyebrow">'+esc(S.user.email)+'</div><h2>Parolni almashtirish</h2>'+
   '<div class="fld-row"><label class="fld" for="p_cur">Joriy parol</label><input class="num" id="p_cur" type="password" autocomplete="current-password" required></div>'+
   '<div class="fld-row"><label class="fld" for="p_new">Yangi parol (kamida 8 belgi)</label><input class="num" id="p_new" type="password" autocomplete="new-password" minlength="8" required></div>'+
   '<div id="pwMsg"></div><button class="btn-primary" type="submit">Saqlash</button></form></div>';
  return{html:html,title:"Parol",after:function(){
    $("#pwForm").addEventListener("submit",async function(e){e.preventDefault();
      var r=await api("POST","me/password",{current:$("#p_cur").value,next:$("#p_new").value});
      $("#pwMsg").innerHTML=r.status===200?'<div class="form-ok">Parol almashtirildi</div>':'<div class="form-err">'+esc(r.data.error||"Xatolik")+'</div>';
      if(r.status===200)this.reset();});
  }};
}

/* ---------- mavzular ---------- */
var modFilter="all",modQuery="";
async function loadQuizzes(){
  if(!S.user||S.user.role!=="student")return null;
  if(!S.quizzes){var r=await api("GET","quizzes");if(r.status===200)S.quizzes=r.data;}
  return S.quizzes;
}
async function viewModules(){
  var qz=await loadQuizzes(),done=qz?qz.done:{};
  var doneN=MODULES.filter(function(m){return done[m.n]!==undefined;}).length;
  var html='<div class="section-head"><div class="eyebrow">Reading &amp; Writing · o‘quv dasturi</div><h2>30 modul — topshiriq turlari va CT-ko‘nikma bog‘lanishi</h2>'+
   '<p class="lede">Tanqidiy fikrlash eng kuchli ishlaydigan mavzular CT-yadro deb belgilangan. 15 va 30-modullar — eksperimental o‘lchov (pre/post), bahoga kirmaydi.</p></div>'+
   (S.user&&S.user.role==="student"?'<div class="progress-line"><span class="tnum" style="font-size:14px;color:var(--slate)">Mashq bajarilgan: <b>'+doneN+' / 30</b></span><div class="bar"><i style="width:'+(doneN/30*100)+'%"></i></div></div>':'')+
   '<div class="filterbar" id="modFilter" role="group" aria-label="Filtr">'+
   [["all","Barchasi"],["core","CT-yadro"],["read","O‘qish & tahlil"],["write","Yozma ish"],["source","Manba baholash"],["diag","Diagnostika"]].map(function(f){
     return '<button class="fbtn" data-f="'+f[0]+'" aria-pressed="'+(modFilter===f[0])+'">'+f[1]+'</button>';}).join("")+'</div>'+
   '<input class="num search" id="modSearch" type="search" placeholder="Mavzu qidirish…" aria-label="Mavzu qidirish" value="'+esc(modQuery)+'">'+
   '<div class="mod-grid" id="modGrid"></div>';
  return{html:html,title:"Mavzular",after:function(){
    function draw(){
      var sets={read:["reading","position","evidence"],write:["essay"],source:["source"],diag:["diagnostic","peer"]};
      var q=modQuery.trim().toLowerCase();
      var list=MODULES.filter(function(m){
        var okF=modFilter==="all"||(modFilter==="core"&&isCore(m))||(sets[modFilter]&&sets[modFilter].indexOf(m.type)>=0);
        var okQ=!q||(m.en+" "+m.uz+" "+MTYPE[m.type]).toLowerCase().indexOf(q)>=0;
        return okF&&okQ;});
      $("#modGrid").innerHTML=list.length?list.map(function(m){
        return '<a class="mod" href="#/module/'+m.n+'"><div class="mod-top"><span class="mod-n">Modul '+m.n+'</span>'+(isCore(m)?'<span class="mod-flag">CT-yadro</span>':'')+'</div>'+
         '<h4>'+m.en+'</h4><div class="uz">'+m.uz+'</div><div class="type">'+MTYPE[m.type]+'</div>'+
         '<div class="badges">'+(m.ct.length?m.ct.map(function(c){return '<span>'+c+'</span>';}).join(" · "):'<span>Til ko‘nikmasi</span>')+'</div>'+
         (done[m.n]!==undefined?'<span class="done-mark" title="Bajarilgan" aria-label="Bajarilgan">✓</span>':'')+'</a>';}).join(""):'<p class="note">Hech narsa topilmadi.</p>';
    }
    draw();
    $$("#modFilter .fbtn").forEach(function(b){b.addEventListener("click",function(){modFilter=b.dataset.f;
      $$("#modFilter .fbtn").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false");});draw();});});
    $("#modSearch").addEventListener("input",function(){modQuery=this.value;draw();});
  }};
}
async function viewModule(arg){
  var n=parseInt(arg,10),m=MODULES[n-1];
  if(!m)return viewModules();
  var qz=await loadQuizzes();
  var prev=MODULES[n-2],next=MODULES[n];
  var html='<div class="crumbs"><a href="#/modules">Mavzular</a> / Modul '+m.n+'</div>'+
   '<div class="mod-hero"><div class="eyebrow">Modul '+m.n+' / 30 · '+MTYPE[m.type]+'</div><h2>'+m.en+'</h2><p class="lede">'+m.uz+'</p>'+
   '<div class="chips">'+(isCore(m)?'<span class="chip core">CT-yadro</span>':'')+m.ct.map(function(c){return '<span class="chip">'+c+'</span>';}).join("")+'</div></div>'+
   '<div class="blocks">'+
   '<div class="block"><h3>O‘quv maqsadlari</h3><ul>'+m.goal.map(function(g){return '<li>'+g+'</li>';}).join("")+'</ul></div>'+
   '<div class="block"><h3>Asosiy g‘oya</h3><p>'+m.idea+'</p></div>'+
   '<div class="block wide"><h3>Namuna</h3><div class="example">'+m.example+'</div></div>'+
   '<div class="block wide"><h3>Mashq</h3><div id="quizBox"></div></div><div class="block wide" id="coachBlock"></div></div>'+
   '<div class="pager">'+(prev?'<a class="btn-ghost" href="#/module/'+prev.n+'">← '+prev.n+'. '+esc(prev.uz)+'</a>':'<span></span>')+
   (next?'<a class="btn-ghost" href="#/module/'+next.n+'">'+next.n+'. '+esc(next.uz)+' →</a>':'<a class="btn-primary" href="#/profile">CT-profilga o‘tish →</a>')+'</div>';
  return{html:html,title:"Modul "+m.n,after:function(){
    initCoach(n);
    var box=$("#quizBox"),L=["A","B","C","D"];
    if(!S.user){box.innerHTML='<div class="empty">Mashq savollari uchun <a href="#/login">tizimga kiring</a>.</div>';return;}
    if(S.user.role!=="student"){box.innerHTML='<div class="empty">Mashqni faqat talaba hisobi bajaradi.</div>';return;}
    if(!qz){box.innerHTML='<div class="empty">Mashq yuklanmadi.</div>';return;}
    var q=qz.questions[n],d=qz.done[n];
    box.innerHTML='<p class="q-text">'+esc(q.t)+'</p>'+q.o.map(function(o,i){return '<button class="q-opt" data-i="'+i+'"><span class="k">'+L[i]+'</span><span>'+esc(o)+'</span></button>';}).join("")+'<div id="qWhy"></div>';
    function lock(res){
      $$(".q-opt",box).forEach(function(b){var i=+b.dataset.i;b.disabled=true;if(i===res.a)b.classList.add("right");else if(i===res.choice)b.classList.add("wrong");});
      $("#qWhy").innerHTML='<div class="q-why"><b>'+(res.correct?"To‘g‘ri. ":"Noto‘g‘ri. ")+'</b>'+esc(res.why)+'</div>';
    }
    if(d)lock(d);
    $$(".q-opt",box).forEach(function(b){b.addEventListener("click",async function(){
      var r=await api("POST","quizzes/"+n+"/answer",{choice:+b.dataset.i});
      if(r.status!==200){toast(r.data.error||"Xatolik");return;}
      qz.done[n]=r.data;lock(r.data);toast(r.data.correct?"To‘g‘ri javob ✓":"Izohni o‘qing");});});
  }};
}

/* ---------- diagnostika (talaba) ---------- */
var TIPS=["Matn mazmuni va yashirin ma’noni sekin o‘qib, o‘z so‘zingiz bilan ayting (3, 17-modullar).","Da’vo, dalil va faktni ajratishga mashq qiling (5, 10-modullar).","Manbani mezon bilan baholang (23, 26, 27-modullar).","Dalildan nimaga xulosa chiqarilishini, muqobil tushuntirishlarni o‘ylang (10, 21-modullar).","Tezis + dalil + izoh (CEE) tuzilmasida yozing (6–8-modullar).","Fikr-mulohazadan so‘ng matnni qayta ishlang (9, 29-modullar)."];
function deltaTable(diag){
  if(!diag||!diag.pre)return '<div class="empty">Diagnostika hali topshirilmagan.</div>';
  var rows=SKILLS.map(function(s,i){var po=diag.post?diag.post.scores[i]:null,d=po==null?null:po-diag.pre.scores[i];
    return '<tr><td>'+s.k+'</td><td class="num">'+diag.pre.scores[i]+'%</td><td class="num">'+(po==null?"—":po+"%")+'</td><td class="num">'+(d==null?"—":(d>=0?"+":"")+d)+'</td></tr>';}).join("");
  return '<div class="tbl-wrap"><table style="min-width:0"><thead><tr><th>Ko‘nikma</th><th class="num">PRE</th><th class="num">POST</th><th class="num">Δ</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
async function viewTest(){
  var r=await api("GET","test/questions");
  var head='<div class="section-head"><div class="eyebrow">Facione 6 ko‘nikma · PRE va POST o‘lchov</div><h2>Diagnostik test</h2>'+
   '<p class="lede">12 savol, har ko‘nikmadan 2 tadan. Natija bahoga kirmaydi, faqat o‘sishni (Δ) o‘lchaydi. To‘g‘ri javoblar ko‘rsatilmaydi.</p></div><div id="testRoot"></div>';
  return{html:head,title:"Diagnostika",after:async function(){
    var root=$("#testRoot");
    if(r.status!==200){root.innerHTML='<div class="form-err">'+esc(r.data.error||"Yuklanmadi")+'</div>';return;}
    if(S.test&&S.test.result){return showTestResult(root);}
    if(!r.data.phase){
      var p=await api("GET","me/profile");
      root.innerHTML='<div class="panel pad"><h3 style="font-size:20px;margin-bottom:12px">PRE va POST topshirilgan</h3>'+deltaTable(p.data.diag)+'</div>';return;
    }
    if(!S.test||S.test.phase!==r.data.phase)S.test={phase:r.data.phase,questions:r.data.questions,i:0,ans:[],result:null};
    drawTest(root);
  }};
}
function drawTest(root){
  var T=S.test,q=T.questions[T.i],L=["A","B","C","D"],pc=Math.round(T.i/T.questions.length*100);
  root.innerHTML='<div class="split"><div class="panel pad">'+
   '<div class="progress-line"><span class="tnum note">'+(T.phase==="pre"?"PRE":"POST")+' · Savol '+(T.i+1)+' / '+T.questions.length+'</span><div class="bar"><i style="width:'+pc+'%"></i></div></div>'+
   (q.p?'<p class="q-passage">'+esc(q.p)+'</p>':'')+'<p class="q-text">'+esc(q.t)+'</p>'+
   q.o.map(function(o,i){return '<button class="q-opt'+(T.ans[T.i]===i?" sel":"")+'" data-i="'+i+'"><span class="k">'+L[i]+'</span><span>'+esc(o)+'</span></button>';}).join("")+
   '<div class="pager"><button class="btn-ghost" id="tPrev"'+(T.i?"":" disabled")+'>← Oldingi</button>'+
   '<button class="btn-primary" id="tNext"'+(T.ans[T.i]===undefined?" disabled":"")+'>'+(T.i===T.questions.length-1?"Yakunlash":"Keyingi →")+'</button></div></div>'+
   '<div class="panel pad"><h3 style="font-size:20px;margin-bottom:10px">Ko‘rsatma</h3><ul class="note" style="padding-left:18px;line-height:1.7"><li>Har savolda bitta to‘g‘ri javob bor.</li><li>Javobni topshirishdan oldin o‘zgartirish mumkin.</li><li>Yakunlagach natijani qayta topshirib bo‘lmaydi.</li></ul></div></div>';
  $$(".q-opt",root).forEach(function(b){b.addEventListener("click",function(){T.ans[T.i]=+b.dataset.i;drawTest(root);});});
  $("#tPrev").addEventListener("click",function(){T.i--;drawTest(root);});
  $("#tNext").addEventListener("click",async function(){
    if(T.i<T.questions.length-1){T.i++;drawTest(root);window.scrollTo(0,0);return;}
    this.disabled=true;
    var r=await api("POST","test/submit",{answers:T.ans});
    if(r.status!==200){toast(r.data.error||"Xatolik");this.disabled=false;return;}
    T.result=r.data;S.test=T;showTestResult(root);
  });
}
function showTestResult(root){
  var T=S.test,res=T.result,p=res.scores,ov=Math.round(mean(p)),weak=p.indexOf(Math.min.apply(null,p));
  root.innerHTML='<div class="split"><div class="panel plain pad"><div class="radar-wrap">'+radarSVG([{vals:p,color:"var(--brown)",fill:FILL}],400)+'</div></div>'+
   '<div><div class="tiles" style="margin-bottom:14px"><div class="tile hl"><div class="lab">'+(res.phase==="pre"?"PRE":"POST")+' natijasi</div><div class="big">'+ov+'%</div><div class="sub">'+res.right+' / '+res.total+' to‘g‘ri · bahoga kirmaydi</div></div>'+
   '<div class="tile"><div class="lab">Eng zaif ko‘nikma</div><div class="big" style="font-size:20px">'+SKILLS[weak].k+'</div><div class="sub">'+p[weak]+'%</div></div></div>'+
   '<div class="panel pad"><h3 style="font-size:19px;margin-bottom:6px">Ko‘nikmalar kesimi</h3><div class="skill-list" style="margin-top:14px">'+
   SKILLS.map(function(s,i){return '<div class="skill-row"><div class="nm">'+s.k+' <em>'+s.en+'</em></div><div class="val tnum">'+p[i]+'%</div><div class="dualbar"><span class="now" style="width:'+p[i]+'%"></span></div></div>';}).join("")+
   '</div><div class="advice"><b>Tavsiya:</b> '+TIPS[weak]+'</div></div>'+
   '<div class="hero-cta"><a class="btn-primary" href="#/profile">CT-profilga o‘tish</a><a class="btn-ghost" href="#/modules">Mavzular</a></div></div></div>';
  S.test=null;
}

/* ---------- esse (talaba) ---------- */
async function viewEssay(){
  await ensureAi();
  var r=await api("GET","me/essays");
  var essayMods=MODULES.filter(function(m){return m.type==="essay";});
  var list=(r.data.essays||[]);
  var html='<div class="section-head"><div class="eyebrow">Yozma topshiriq</div><h2>Esse topshirish</h2>'+
   '<p class="lede">Mavzuni tanlab, inglizcha esse yozing (kamida 30 so‘z). O‘qituvchi uni rubrika bo‘yicha baholaydi va natija CT-profilingizga qo‘shiladi.</p></div>'+
   '<div class="split"><div class="panel pad"><form id="essayForm"><label class="fld" for="e_topic">Mavzu</label><select id="e_topic">'+essayMods.map(function(m){return '<option value="'+m.n+'">'+m.n+'. '+esc(m.en)+'</option>';}).join("")+'</select>'+
   '<label class="fld" for="e_body" style="margin-top:14px">Esse matni</label><textarea id="e_body" placeholder="Thesis, evidence, counter-argument, conclusion…" required></textarea>'+
   '<div class="wc"><span id="e_wc">0 so‘z</span><span>maks. 20 000 belgi</span></div><div id="e_msg"></div>'+
   '<div class="hero-cta"><button class="btn-primary" type="submit">Topshirish</button></div></form></div>'+
   '<div class="panel pad"><h3 style="font-size:20px;margin-bottom:14px">Mening esselarim</h3>'+(list.length?list.map(function(e){
     var m=MODULES[e.topic-1];
     return '<div class="essay-card"><div class="queue-item" style="cursor:default;margin-bottom:0"><div><b>'+e.topic+'. '+esc(m?m.en:"")+'</b><div class="note">'+esc(String(e.created_at).slice(0,16))+'</div></div>'+
      (e.status==="graded"?'<span class="status-pill gr">'+e.pct+'% · baho '+e.grade+'</span>':'<span class="status-pill sub">baholanmoqda</span>')+'</div>'+aiFeedbackHTML(e)+'</div>';}).join(""):'<div class="empty">Hali esse topshirmagansiz.</div>')+'</div></div>';
  return{html:html,title:"Esse",after:function(){
    wireFeedback();
    $("#e_body").addEventListener("input",function(){$("#e_wc").textContent=(this.value.trim().match(/\S+/g)||[]).length+" so‘z";});
    $("#essayForm").addEventListener("submit",async function(e){e.preventDefault();
      var res=await api("POST","essays",{topic:+$("#e_topic").value,body:$("#e_body").value});
      if(res.status!==200){$("#e_msg").innerHTML='<div class="form-err">'+esc(res.data.error||"Xatolik")+'</div>';return;}
      toast("Esse topshirildi");route();});
  }};
}

/* ---------- profil ---------- */
var KIND={reading:"O‘qish / matn tahlili",writing:"Yozma topshiriq",peer:"Peer & self-review",diagnostic:"Rubrika (kompleks)",essay:"Esse"};
function profileHTML(p,name){
  var hasAny=p.overall!==null;
  var weak=-1;if(hasAny){var mn=101;p.cur.forEach(function(v,i){if(v!==null&&v<mn){mn=v;weak=i;}});}
  var radar=[];
  if(p.diag&&p.diag.pre)radar.push({vals:p.diag.pre.scores,color:"var(--pre-line)",dash:1,w:1.5});
  radar.push({vals:p.cur,color:"var(--brown)",fill:FILL});
  return '<div class="tiles" style="margin-bottom:18px">'+
   '<div class="tile hl"><div class="lab">Umumiy CT darajasi</div><div class="big">'+(hasAny?p.overall+"%":"—")+'</div><div class="sub">'+(hasAny?"baho "+p.grade:"hali baholanmagan")+'</div></div>'+
   '<div class="tile"><div class="lab">Baholangan urinishlar</div><div class="big">'+p.attempts.length+'</div><div class="sub">rubrika va esse</div></div>'+
   '<div class="tile"><div class="lab">Eng zaif ko‘nikma</div><div class="big" style="font-size:20px">'+(weak>=0?SKILLS[weak].k:"—")+'</div><div class="sub">'+(weak>=0?p.cur[weak]+"%":"")+'</div></div></div>'+
   '<div class="split"><div class="panel plain pad"><div class="radar-wrap">'+radarSVG(radar,410)+'</div>'+
   '<div class="legend"><span><i style="background:var(--brown)"></i>Joriy (topshiriqlar bo‘yicha)</span>'+(p.diag&&p.diag.pre?'<span><i style="background:var(--pre-line)"></i>PRE-diagnostika</span>':'')+'</div></div>'+
   '<div class="panel pad"><h3 style="font-size:20px;margin-bottom:18px">Ko‘nikmalar kesimi</h3><div class="skill-list">'+
   SKILLS.map(function(s,i){var v=p.cur[i];
     return '<div class="skill-row"><div class="nm">'+s.k+' <em>'+s.en+'</em></div><div class="val tnum">'+(v===null?'<span style="color:var(--ash)">baholanmagan</span>':v+'%')+'</div><div class="dualbar"><span class="now" style="width:'+(v||0)+'%"></span></div></div>';}).join("")+
   '</div>'+(weak>=0?'<div class="advice"><b>Tavsiya:</b> eng zaif ko‘nikma — <b>'+SKILLS[weak].k+'</b>. '+TIPS[weak]+'</div>':'<div class="advice">Profil o‘qituvchi topshiriqni yoki esseni baholagach paydo bo‘ladi.</div>')+'</div></div>'+
   '<h3 style="font-size:22px;margin:34px 0 6px">Diagnostika: PRE → POST</h3><p class="note" style="margin-bottom:12px">Bu natijalar bahoga qo‘shilmaydi, faqat o‘sishni (Δ) ko‘rsatadi.</p>'+deltaTable(p.diag)+
   '<h3 style="font-size:22px;margin:34px 0 12px">Baholangan topshiriqlar</h3>'+(p.attempts.length?
    '<div class="tbl-wrap"><table style="min-width:0"><thead><tr><th>Tur</th><th>Mavzu</th><th class="num">CT%</th><th>Baho</th><th>Sana</th></tr></thead><tbody>'+
    p.attempts.slice().reverse().map(function(a){var m=a.topic?MODULES[a.topic-1]:null;
      return '<tr><td>'+(KIND[a.kind]||a.kind)+'</td><td>'+(m?a.topic+". "+esc(m.en):"—")+'</td><td class="num">'+a.pct+'%</td><td><span class="gpill '+gradeCls(a.grade)+'">'+a.grade+'</span></td><td>'+esc(String(a.at).slice(0,16))+'</td></tr>';}).join("")+'</tbody></table></div>':'<div class="empty">Hali baholangan topshiriq yo‘q.</div>');
}
async function viewProfile(arg){
  var u=S.user;
  if(u.role==="student"){
    var r=await api("GET","me/profile");
    var html='<div class="section-head"><div class="eyebrow">CT-profil · 6 ko‘nikma bo‘yicha radar</div><h2>Mening CT-profilim</h2><p class="lede">Profil o‘qituvchi baholagan topshiriq va esselardan hisoblanadi. Diagnostika alohida — faqat o‘sishni o‘lchaydi.</p></div>'+profileHTML(r.data,u.name);
    return{html:html,title:"CT-profil"};
  }
  var ls=await api("GET","teacher/students"),stus=ls.data.students||[];
  if(!stus.length)return{html:'<div class="section-head"><h2>Profillar</h2></div><div class="empty">Hali talaba yo‘q. «Talabalar» bo‘limida hisob yarating.</div>',title:"Profillar"};
  var id=parseInt(arg,10)||S.viewStu||stus[0].id;
  if(!stus.some(function(s){return s.id===id;}))id=stus[0].id;
  S.viewStu=id;
  var pr=await api("GET","teacher/students/"+id+"/profile");
  var html2='<div class="section-head"><div class="eyebrow">O‘qituvchi ko‘rinishi</div><h2>Talaba profili</h2></div>'+
   '<div class="panel pad no-print" style="margin-bottom:18px;display:flex;gap:16px;align-items:end;flex-wrap:wrap"><div style="min-width:240px;flex:1"><label class="fld" for="profSel">Talaba</label><select id="profSel">'+
   stus.map(function(s){return '<option value="'+s.id+'"'+(s.id===id?" selected":"")+'>'+esc(s.name)+(s.grp?" — "+esc(s.grp):"")+'</option>';}).join("")+'</select></div>'+
   '<button class="btn-ghost" id="printBtn">Chop etish / PDF</button></div>'+profileHTML(pr.data,pr.data.student.name);
  return{html:html2,title:"Profillar",after:function(){
    $("#profSel").addEventListener("change",function(){location.hash="#/profile/"+this.value;});
    $("#printBtn").addEventListener("click",function(){window.print();});
  }};
}

/* ---------- o'qituvchi: talabalar ---------- */
function genPass(){var c="abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",a=new Uint32Array(12),o="";crypto.getRandomValues(a);for(var i=0;i<12;i++)o+=c[a[i]%c.length];return o;}
async function viewStudents(){
  var rs=await Promise.all([api("GET","teacher/students"),api("GET","teacher/panel"),api("GET","teacher/invites")]);
  var stus=rs[0].data.students||[],panel=rs[1].data,invs=(rs[2].data&&rs[2].data.invites)||[];
  var weak=-1;if(panel.skillAvg){var mn=101;panel.skillAvg.forEach(function(v,i){if(v!==null&&v<mn){mn=v;weak=i;}});}
  var html='<div class="section-head"><div class="eyebrow">O‘qituvchi paneli</div><h2>Talabalar va guruh statistikasi</h2>'+
   '<p class="lede">Talaba hisoblarini siz yaratasiz. Har talaba faqat o‘z natijasini ko‘radi.</p></div>'+
   '<div class="tiles" style="margin-bottom:22px">'+
   '<div class="tile hl"><div class="lab">Guruh CT darajasi</div><div class="big">'+(panel.overall===null?"—":panel.overall+"%")+'</div><div class="sub">'+(panel.overall===null?"hali baholanmagan":"o‘rtacha baho "+grade(panel.overall))+'</div></div>'+
   '<div class="tile"><div class="lab">Talabalar</div><div class="big">'+panel.students+'</div><div class="sub">hisob yaratilgan</div></div>'+
   '<div class="tile"><div class="lab">Eng zaif ko‘nikma</div><div class="big" style="font-size:20px">'+(weak>=0?SKILLS[weak].k:"—")+'</div><div class="sub">'+(weak>=0?panel.skillAvg[weak]+"%":"")+'</div></div>'+
   '<div class="tile"><div class="lab">Esse navbati</div><div class="big">'+panel.queue+'</div><div class="sub"><a href="#/queue">baholash →</a></div></div></div>'+
   '<div class="panel pad" style="margin-bottom:22px"><h3 style="font-size:20px;margin-bottom:14px">Yangi talaba hisobi</h3><form id="newStu"><div class="form-row">'+
   '<div><label class="fld" for="n_name">Ism-familiya</label><input class="num" id="n_name" required></div>'+
   '<div><label class="fld" for="n_email">Email (login)</label><input class="num" id="n_email" type="email" required></div>'+
   '<div><label class="fld" for="n_grp">Guruh (masalan E yoki N)</label><input class="num" id="n_grp" maxlength="40"></div>'+
   '<div><label class="fld" for="n_pass">Boshlang‘ich parol</label><input class="num" id="n_pass" value="'+genPass()+'" minlength="8" required></div>'+
   '<div><button class="btn-primary" type="submit">Yaratish</button></div></div><div id="newMsg"></div>'+
   '<p class="note" style="margin-top:10px">Parolni talabaga o‘zingiz yetkazing; u «Parol» orqali o‘zgartira oladi. Parol bazada xeshlangan holda saqlanadi, keyin ko‘rib bo‘lmaydi.</p></form></div>'+
   invitePanel(invs)+'<div class="hero-cta no-print" style="margin:0 0 16px"><button class="btn-ghost" id="csvBtn">CSV yuklab olish</button></div>'+
   '<div class="tbl-wrap"><table id="statTable"><thead><tr id="statHead"></tr></thead><tbody id="statBody"></tbody></table></div>';
  return{html:html,title:"Talabalar",after:function(){
    var cols=[{k:"name",l:"Talaba"},{k:"grp",l:"Guruh"}].concat(SHORT.map(function(s,i){return{k:"c"+i,l:s,n:1};})).concat([{k:"ov",l:"Umumiy",n:1},{k:"g",l:"Baho"},{k:"d",l:"PRE/POST"},{k:"x",l:""}]);
    function val(s,k){if(k==="name")return s.name;if(k==="grp")return s.grp;if(k==="ov")return s.overall===null?-1:s.overall;if(k==="g")return s.grade||0;if(k==="d")return (s.diag.pre?1:0)+(s.diag.post?1:0);if(k==="x")return 0;var v=s.cur[+k.slice(1)];return v===null?-1:v;}
    function draw(){
      $("#statHead").innerHTML=cols.map(function(c){var a=S.sort.k===c.k?(S.sort.d>0?" ▲":" ▼"):"";
        return '<th'+(c.n?' class="num"':'')+'>'+(c.k==="x"?"":'<button data-k="'+c.k+'">'+c.l+a+'</button>')+'</th>';}).join("");
      var rows=stus.slice().sort(function(a,b){var x=val(a,S.sort.k),y=val(b,S.sort.k);return (x>y?1:x<y?-1:0)*S.sort.d;});
      $("#statBody").innerHTML=rows.length?rows.map(function(s){
        return '<tr><td>'+esc(s.name)+'<div class="note">'+esc(s.email)+'</div></td><td>'+esc(s.grp||"—")+'</td>'+
         s.cur.map(function(v){return '<td class="num">'+(v===null?"—":v)+'</td>';}).join("")+
         '<td class="num"><b>'+(s.overall===null?"—":s.overall+"%")+'</b></td><td>'+(s.grade?'<span class="gpill '+gradeCls(s.grade)+'">'+s.grade+'</span>':"—")+'</td>'+
         '<td>'+(s.diag.pre?"PRE":"—")+' / '+(s.diag.post?"POST":"—")+'</td>'+
         '<td><div class="row-actions"><a href="#/profile/'+s.id+'">Profil</a><button data-act="pw" data-id="'+s.id+'">Parol</button><button data-act="rd" data-id="'+s.id+'">Diagn. qayta</button></div></td></tr>';}).join(""):
        '<tr><td colspan="'+cols.length+'"><div class="empty">Hali talaba hisobi yo‘q.</div></td></tr>';
      $$("#statHead button").forEach(function(b){b.addEventListener("click",function(){S.sort={k:b.dataset.k,d:S.sort.k===b.dataset.k?-S.sort.d:1};draw();});});
      $$("#statBody [data-act]").forEach(function(b){b.addEventListener("click",async function(){
        var id=b.dataset.id;
        if(b.dataset.act==="pw"){
          var np=prompt("Yangi parol (kamida 8 belgi):",genPass());if(!np)return;
          var r=await api("POST","teacher/students/"+id+"/reset-password",{password:np});toast(r.status===200?"Parol yangilandi: "+np:(r.data.error||"Xatolik"));
        }else{
          var ph=prompt("Qaysi diagnostikani qayta ochish? pre yoki post","post");if(ph!=="pre"&&ph!=="post")return;
          if(!confirm(ph.toUpperCase()+" natijasi o‘chiriladi. Davom etasizmi?"))return;
          var r2=await api("POST","teacher/students/"+id+"/reset-diagnostic",{phase:ph});toast(r2.status===200?ph.toUpperCase()+" qayta ochildi":(r2.data.error||"Xatolik"));
          if(r2.status===200)route();
        }});});
    }
    draw();
    wireInvites();
    $("#newStu").addEventListener("submit",async function(e){e.preventDefault();
      var pass=$("#n_pass").value;
      var r=await api("POST","teacher/students",{name:$("#n_name").value,email:$("#n_email").value,grp:$("#n_grp").value,password:pass});
      if(r.status!==200){$("#newMsg").innerHTML='<div class="form-err">'+esc(r.data.error||"Xatolik")+'</div>';return;}
      toast("Hisob yaratildi. Login: "+$("#n_email").value+" · parol: "+pass);route();});
    $("#csvBtn").addEventListener("click",function(){
      var head=["Talaba","Email","Guruh"].concat(SKILLS.map(function(s){return s.k;})).concat(["Umumiy","Baho","PRE","POST"]);
      var lines=[head].concat(stus.map(function(s){return[s.name,s.email,s.grp].concat(s.cur.map(function(v){return v===null?"":v;})).concat([s.overall===null?"":s.overall,s.grade||"",s.diag.pre?Math.round(mean(s.diag.pre.scores)):"",s.diag.post?Math.round(mean(s.diag.post.scores)):""]);}));
      var csv="﻿"+lines.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(",");}).join("\n");
      var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="critiread-talabalar.csv";a.click();URL.revokeObjectURL(a.href);
    });
  }};
}

/* ---------- rubrika yordamchilari ---------- */
function criteriaHTML(ids,prefix){
  return ids.map(function(ci){var c=CRIT[ci];
    return '<details class="rubric-crit" open data-ci="'+ci+'"><summary><span class="crit-idx">'+(ci+1)+'</span><span><span class="crit-name">'+c.name+'</span> <span class="crit-en">'+c.en+'</span></span><span class="crit-score" data-score>—</span></summary><div class="levels">'+
     ["A","B","C","D"].map(function(L){return '<label class="lvl"><input type="radio" name="'+prefix+ci+'" value="'+L+'"><span class="tag">'+(L==="D"?"D · 1–2":L+" · "+PTS[L])+'</span><span class="desc">'+c[L]+'</span></label>';}).join("")+'</div></details>';}).join("");
}
function readItems(area){
  var items={};
  $$("details",area).forEach(function(d){var c=$("input:checked",d);if(c)items[d.dataset.ci]=c.value;});
  return items;
}
function previewScore(area,out){
  var det=$$("details",area),sum=0,max=0,n=0;
  det.forEach(function(d){max+=5;var c=$("input:checked",d),sc=$("[data-score]",d);
    if(c){var p=PTS[c.value];sum+=p;n++;sc.textContent=p+" / 5";sc.style.color="var(--ink)";}else{sc.textContent="—";sc.style.color="var(--slate)";}});
  var pct=max?Math.round(sum/max*100):0;
  $(out+" .pv-sum").textContent=sum;$(out+" .pv-max").textContent=max;$(out+" .pv-n").textContent=n+" / "+det.length;
  if(!n){$(out+" .pv-pct").textContent="—";$(out+" .pv-bar").style.width="0%";$(out+" .pv-grade").textContent="baho —";return 0;}
  $(out+" .pv-pct").textContent=pct+"%";$(out+" .pv-bar").style.width=pct+"%";$(out+" .pv-grade").textContent="baho "+grade(pct);
  return n;
}
function resultCard(btnLabel){
  return '<div class="result"><div class="result-card" id="pvCard"><div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px"><div><div class="rl">CT bahosi</div><div class="bignum pv-pct">—</div></div><span class="gradepill pv-grade">baho —</span></div>'+
   '<div class="meter"><i class="pv-bar" style="width:0%"></i></div>'+
   '<div class="kv"><span>To‘plangan ball</span><b class="pv-sum">0</b></div><div class="kv"><span>Maksimal ball</span><b class="pv-max">0</b></div><div class="kv"><span>Baholangan mezon</span><b class="pv-n">0</b></div>'+
   '<div style="margin-top:18px;display:flex;gap:10px"><button class="btn-primary" id="saveGrade" style="flex:1">'+btnLabel+'</button><button class="btn-ghost" id="clearGrade">Tozalash</button></div>'+
   '<p class="note" style="margin-top:13px">CT% = (ball ÷ maks) × 100 · 90–100 → 5 · 70–89 → 4 · 60–69 → 3 · 0–59 → 2.</p></div></div>';
}

/* ---------- o'qituvchi: baholash ---------- */
var RKINDS={reading:[0,1,2,3],writing:[1,2,3,4,5],peer:[2,4,5],diagnostic:[0,1,2,3,4,5]};
async function viewRubric(){
  var ls=await api("GET","teacher/students"),stus=ls.data.students||[];
  if(!stus.length)return{html:'<div class="section-head"><h2>Baholash</h2></div><div class="empty">Avval «Talabalar» bo‘limida talaba hisobini yarating.</div>',title:"Baholash"};
  var html='<div class="section-head"><div class="eyebrow">Kriterial baholash · Facione 6 × 4</div><h2>Topshiriqni rubrika bo‘yicha baholash</h2>'+
   '<p class="lede">Talaba va topshiriq turini tanlang, mezonlarni belgilang. «Saqlash» natijani talabaning CT-profiliga qo‘shadi.</p></div>'+
   '<div class="split"><div><div class="panel pad" style="margin-bottom:18px"><div class="grid2">'+
   '<div><label class="fld" for="g_stu">Talaba</label><select id="g_stu">'+stus.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+(s.grp?" — "+esc(s.grp):"")+'</option>';}).join("")+'</select></div>'+
   '<div><label class="fld" for="g_kind">Topshiriq turi</label><select id="g_kind"><option value="reading">O‘qish / matn tahlili — mezon 1–4</option><option value="writing">Yozma / esse-insho — mezon 2–6</option><option value="peer">Peer &amp; self-review — 3, 5, 6</option><option value="diagnostic">Kompleks — barcha 6</option></select></div>'+
   '<div><label class="fld" for="g_topic">Mavzu (ixtiyoriy)</label><select id="g_topic"><option value="">—</option>'+MODULES.map(function(m){return '<option value="'+m.n+'">'+m.n+'. '+esc(m.en)+'</option>';}).join("")+'</select></div></div></div>'+
   '<div id="rubricArea"></div></div>'+resultCard("Saqlash")+'</div>';
  return{html:html,title:"Baholash",after:function(){
    var area=$("#rubricArea");
    function draw(){area.innerHTML=criteriaHTML(RKINDS[$("#g_kind").value],"c");previewScore(area,"#pvCard");}
    draw();
    $("#g_kind").addEventListener("change",draw);
    $("#clearGrade").addEventListener("click",draw);
    area.addEventListener("change",function(){previewScore(area,"#pvCard");});
    $("#saveGrade").addEventListener("click",async function(){
      var items=readItems(area);
      if(!Object.keys(items).length){toast("Avval mezonlarni belgilang");return;}
      var r=await api("POST","teacher/grade",{student_id:+$("#g_stu").value,kind:$("#g_kind").value,topic:$("#g_topic").value?+$("#g_topic").value:null,items:items});
      if(r.status!==200){toast(r.data.error||"Xatolik");return;}
      toast("Saqlandi: "+r.data.pct+"% · baho "+r.data.grade);draw();
    });
  }};
}

/* ---------- o'qituvchi: esse navbati ---------- */
async function viewQueue(arg){
  await ensureAi();
  if(arg){
    var er=await api("GET","teacher/essays/"+parseInt(arg,10));
    if(er.status!==200)return{html:'<div class="empty">'+esc(er.data.error||"Esse topilmadi")+' <a href="#/queue">Navbatga qaytish</a></div>',title:"Esse"};
    var e=er.data.essay,m=MODULES[e.topic-1];
    var html='<div class="crumbs"><a href="#/queue">Esse navbati</a> / '+esc(e.name)+'</div>'+
     '<div class="section-head"><div class="eyebrow">Mavzu '+e.topic+'</div><h2>'+esc(m?m.en:"Esse")+'</h2><p class="lede">'+esc(e.name)+' · '+esc(String(e.created_at).slice(0,16))+'</p></div>'+
     '<div class="split"><div><div class="essay-text">'+esc(e.body)+'</div><div id="aiBar"></div><div id="rubricArea" style="margin-top:18px">'+(e.status==="graded"?'<div class="empty">Bu esse allaqachon baholangan.</div>':criteriaHTML([1,2,3,4,5],"e"))+'</div></div>'+
     (e.status==="graded"?'':resultCard("Baholash va saqlash"))+'</div>';
    return{html:html,title:"Esse",after:function(){
      if(e.status==="graded")return;
      var area=$("#rubricArea");previewScore(area,"#pvCard");
      area.addEventListener("change",function(){previewScore(area,"#pvCard");});
      wireSuggest(e.id,area);
      $("#clearGrade").addEventListener("click",function(){area.innerHTML=criteriaHTML([1,2,3,4,5],"e");previewScore(area,"#pvCard");});
      $("#saveGrade").addEventListener("click",async function(){
        var items=readItems(area);if(!Object.keys(items).length){toast("Avval mezonlarni belgilang");return;}
        var r=await api("POST","teacher/essays/"+e.id+"/grade",{items:items});
        if(r.status!==200){toast(r.data.error||"Xatolik");return;}
        toast("Baholandi: "+r.data.pct+"% · baho "+r.data.grade);location.hash="#/queue";});
    }};
  }
  var q=await api("GET","teacher/queue"),list=q.data.queue||[];
  var h2='<div class="section-head"><div class="eyebrow">Yozma topshiriqlar</div><h2>Esse navbati</h2><p class="lede">Baholanishi kutilayotgan esselar. Birini oching va rubrika bo‘yicha baholang.</p></div>'+
   (list.length?list.map(function(x){var mm=MODULES[x.topic-1];
     return '<a class="queue-item" href="#/queue/'+x.id+'"><div><b>'+esc(x.name)+(x.grp?" · "+esc(x.grp):"")+'</b><div class="note">Mavzu '+x.topic+'. '+esc(mm?mm.en:"")+' · '+esc(String(x.created_at).slice(0,16))+'</div></div><span class="status-pill sub">baholash →</span></a>';}).join(""):'<div class="empty">Navbat bo‘sh. Barcha esselar baholangan.</div>');
  return{html:h2,title:"Esse navbati"};
}

/* ---------- o'qituvchi: tadqiqot (Cohen's d, haqiqiy ma'lumotdan) ---------- */
function interp(d){var a=Math.abs(d);return a>=0.8?"kuchli ta’sir":a>=0.5?"o‘rta ta’sir":a>=0.2?"kichik ta’sir":"juda kichik";}
function ciText(d,n){var se=Math.sqrt(1/n+d*d/(2*n));return "95% CI ["+(d-1.96*se).toFixed(2)+"; "+(d+1.96*se).toFixed(2)+"]";}
async function viewResearch(){
  var r=await api("GET","teacher/panel"),rs=(r.data.research||[]);
  var f1=function(v){return v==null?"—":v.toFixed(1);};
  var html='<div class="section-head"><div class="eyebrow">Eksperimental o‘lchov · PRE va POST</div><h2>Samaradorlik (Cohen’s d)</h2>'+
   '<p class="lede">Hisob faqat PRE <b>va</b> POST ni topshirgan talabalar bo‘yicha, haqiqiy ma’lumotdan olinadi. Guruhni talaba yaratishda belgilang (masalan E — eksperimental, N — nazorat).</p></div>'+
   (rs.length?'<div class="tbl-wrap"><table style="min-width:0"><thead><tr><th>Guruh</th><th class="num">Talaba</th><th class="num">PRE+POST (n)</th><th class="num">PRE (M ± SD)</th><th class="num">POST (M ± SD)</th><th class="num">Δ</th><th class="num">Cohen’s d</th><th>Izoh</th></tr></thead><tbody>'+
   rs.map(function(g){var dl=g.n?g.postMean-g.preMean:null;
     return '<tr><td><b>'+esc(g.group)+'</b></td><td class="num">'+g.students+'</td><td class="num">'+g.n+'</td><td class="num">'+f1(g.preMean)+' ± '+f1(g.preSD)+'</td><td class="num">'+f1(g.postMean)+' ± '+f1(g.postSD)+'</td><td class="num">'+(dl==null?"—":(dl>=0?"+":"")+dl.toFixed(1))+'</td><td class="num"><b>'+(g.d==null?"—":g.d.toFixed(2))+'</b></td><td>'+(g.d==null?"n ≥ 2 kerak":interp(g.d)+" · "+ciText(g.d,g.n))+'</td></tr>';}).join("")+'</tbody></table></div>':'<div class="empty">Hali ma’lumot yo‘q.</div>')+
   '<div class="panel pad" style="margin-top:22px"><h3 style="font-size:20px;margin-bottom:12px">Guruhlararo farq (o‘sish farqi)</h3><div class="grid2"><div><label class="fld" for="r_e">Eksperimental guruh</label><select id="r_e">'+rs.map(function(g,i){return '<option value="'+i+'">'+esc(g.group)+'</option>';}).join("")+'</select></div>'+
   '<div><label class="fld" for="r_c">Nazorat guruhi</label><select id="r_c">'+rs.map(function(g,i){return '<option value="'+i+'"'+(i===1?" selected":"")+'>'+esc(g.group)+'</option>';}).join("")+'</select></div></div>'+
   '<div class="tiles" style="margin-top:16px"><div class="tile hl"><div class="lab">d (guruhlararo)</div><div class="big" id="r_d">—</div><div class="sub" id="r_s">—</div></div></div>'+
   '<p class="note" style="margin-top:14px">d = (M<sub>post</sub> − M<sub>pre</sub>) / SD<sub>pooled</sub>, SD<sub>pooled</sub> = √((SD<sub>pre</sub>² + SD<sub>post</sub>²) / 2). Guruhlararo: (ΔE − ΔC) / SD<sub>pooled</sub>(post). |d| ≥ 0.8 — kuchli, 0.5–0.8 — o‘rta, 0.2–0.5 — kichik ta’sir. Kichik n da natijalar taxminiy.</p></div>';
  return{html:html,title:"Tadqiqot",after:function(){
    function calc(){
      var e=rs[+$("#r_e").value],c=rs[+$("#r_c").value];
      if(!e||!c||e===c||e.n<2||c.n<2){$("#r_d").textContent="—";$("#r_s").textContent=e===c?"Turli guruhlarni tanlang":"Har ikki guruhda n ≥ 2 kerak";return;}
      var sp=Math.sqrt((e.postSD*e.postSD+c.postSD*c.postSD)/2);
      var d=sp?((e.postMean-e.preMean)-(c.postMean-c.preMean))/sp:0;
      $("#r_d").textContent=d.toFixed(2);$("#r_s").textContent=interp(d);
    }
    if(rs.length){$("#r_e").addEventListener("change",calc);$("#r_c").addEventListener("change",calc);calc();}
  }};
}

/* ---------- ishga tushirish ---------- */
async function boot(){
  applyTheme();
  $("#themeBtn").addEventListener("click",function(){
    var cur=document.documentElement.getAttribute("data-theme");S.theme=cur==="dark"?"light":"dark";applyTheme();
    try{localStorage.setItem("critiread.theme",S.theme);}catch(e){}});
  var st=await api("GET","status");S.setup=!!(st.data&&st.data.setup);
  if(!S.setup){var me=await api("GET","me");if(me.status===200)S.user=me.data.user;}
  else location.hash="#/login";
  window.addEventListener("hashchange",route);
  route();
}
boot();

/* ---------- taklif havolalari (o'qituvchi) ---------- */
function inviteLink(code){return location.origin+"/#/join/"+code;}
function invitePanel(invs){
  return '<div class="panel pad" style="margin-bottom:22px"><h3 style="font-size:20px;margin-bottom:6px">Talabalar uchun taklif havolasi</h3>'+
   '<p class="note" style="margin-bottom:14px">Havolani guruhga yuboring: talaba o‘zi ism, email va parol bilan ro‘yxatdan o‘tadi va tanlangan guruhga tushadi. Limit tugasa yoki muddati o‘tsa havola ishlamaydi; istalgan vaqtda o‘chirishingiz mumkin.</p>'+
   '<form id="newInvite"><div class="form-row">'+
   '<div><label class="fld" for="i_grp">Guruh (E / N …)</label><input class="num" id="i_grp" maxlength="40"></div>'+
   '<div><label class="fld" for="i_max">Nechta talaba (limit)</label><input class="num" id="i_max" type="number" min="1" max="500" value="30"></div>'+
   '<div><label class="fld" for="i_days">Necha kun amal qiladi</label><input class="num" id="i_days" type="number" min="1" max="90" value="14"></div>'+
   '<div><button class="btn-primary" type="submit">Havola yaratish</button></div></div></form><div id="invMsg"></div>'+
   (invs.length?'<div style="margin-top:16px">'+invs.map(function(v){
     var left=Math.max(0,Math.ceil((v.expires_at-Date.now())/86400000));
     return '<div class="queue-item" style="cursor:default;flex-wrap:wrap"><div style="min-width:220px;flex:1"><b>'+(v.grp?esc(v.grp)+" guruhi":"Guruhsiz")+'</b> '+
      (v.valid?'<span class="status-pill gr">faol</span>':'<span class="status-pill sub">yopiq</span>')+
      '<div class="note">'+v.used+' / '+v.max_uses+' ro‘yxatdan o‘tdi · '+(v.valid?left+" kun qoldi":(v.active?"muddat/limit tugagan":"o‘chirilgan"))+'</div>'+
      (v.valid?'<div class="note" style="word-break:break-all">'+esc(inviteLink(v.code))+'</div>':'')+'</div>'+
      '<div class="row-actions">'+(v.valid?'<button data-inv="copy" data-code="'+esc(v.code)+'">Nusxalash</button><button data-inv="revoke" data-id="'+v.id+'">O‘chirish</button>':'')+'</div></div>';}).join("")+'</div>':'')+'</div>';
}
function wireInvites(){
  var f=$("#newInvite");if(!f)return;
  f.addEventListener("submit",async function(e){e.preventDefault();
    var r=await api("POST","teacher/invites",{grp:$("#i_grp").value,max_uses:+$("#i_max").value,days:+$("#i_days").value});
    if(r.status!==200){$("#invMsg").innerHTML='<div class="form-err">'+esc(r.data.error||"Xatolik")+'</div>';return;}
    var link=inviteLink(r.data.code);
    try{await navigator.clipboard.writeText(link);toast("Havola yaratildi va nusxalandi");}catch(x){toast("Havola yaratildi");}
    route();});
  $$("[data-inv]").forEach(function(b){b.addEventListener("click",async function(){
    if(b.dataset.inv==="copy"){var l=inviteLink(b.dataset.code);try{await navigator.clipboard.writeText(l);toast("Havola nusxalandi");}catch(x){prompt("Havolani nusxalang:",l);}return;}
    if(!confirm("Havola o‘chirilsinmi? Yangi talabalar u orqali kira olmaydi."))return;
    var r=await api("POST","teacher/invites/"+b.dataset.id+"/revoke",{});toast(r.status===200?"Havola o‘chirildi":(r.data.error||"Xatolik"));route();});});
}

/* ---------- talaba: havola orqali ro'yxatdan o'tish ---------- */
async function viewJoin(code){
  if(S.user)return{html:'<div class="auth-wrap"><div class="auth-card"><h2>Siz tizimga kirgansiz</h2><p class="note" style="margin-top:8px">Yangi hisob yaratish uchun avval chiqing.</p><a class="btn-primary" href="#/" style="margin-top:20px">Bosh sahifa</a></div></div>',title:"Ro‘yxatdan o‘tish"};
  var r=await api("GET","invites/"+encodeURIComponent(code||""));
  if(!r.data.valid)return{html:'<div class="auth-wrap"><div class="auth-card"><div class="eyebrow">CritiRead</div><h2>Havola yaroqsiz</h2><p class="note" style="margin-top:8px">Taklif havolasining muddati tugagan, limiti to‘lgan yoki o‘chirilgan. O‘qituvchingizdan yangi havola so‘rang.</p><a class="btn-ghost" href="#/login" style="margin-top:20px">Hisobim bor — kirish</a></div></div>',title:"Ro‘yxatdan o‘tish"};
  var html='<div class="auth-wrap"><form class="auth-card" id="joinForm"><div class="eyebrow">CritiRead'+(r.data.grp?" · "+esc(r.data.grp)+" guruhi":"")+'</div><h2>Ro‘yxatdan o‘tish</h2>'+
   '<p class="note" style="margin-top:6px">Hisob yaratib, tanqidiy fikrlash kursiga qo‘shiling.</p>'+
   '<div class="fld-row"><label class="fld" for="j_name">Ism-familiya</label><input class="num" id="j_name" autocomplete="name" required></div>'+
   '<div class="fld-row"><label class="fld" for="j_email">Email</label><input class="num" id="j_email" type="email" autocomplete="username" required></div>'+
   '<div class="fld-row"><label class="fld" for="j_pass">Parol (kamida 8 belgi)</label><input class="num" id="j_pass" type="password" autocomplete="new-password" minlength="8" required></div>'+
   '<div class="fld-row"><label class="fld" for="j_pass2">Parolni takrorlang</label><input class="num" id="j_pass2" type="password" autocomplete="new-password" required></div>'+
   '<div id="joinMsg"></div><button class="btn-primary" type="submit">Hisobni yaratish</button>'+
   '<p class="note" style="margin-top:14px">Hisobingiz bor bo‘lsa, <a href="#/login">kiring</a>.</p></form></div>';
  return{html:html,title:"Ro‘yxatdan o‘tish",after:function(){
    $("#joinForm").addEventListener("submit",async function(e){e.preventDefault();
      var msg=$("#joinMsg"),btn=$("button[type=submit]",this);msg.innerHTML="";
      if($("#j_pass").value!==$("#j_pass2").value){msg.innerHTML='<div class="form-err">Parollar mos kelmadi</div>';return;}
      btn.disabled=true;
      var res=await api("POST","join",{code:code,name:$("#j_name").value,email:$("#j_email").value,password:$("#j_pass").value});
      btn.disabled=false;
      if(res.status!==200){msg.innerHTML='<div class="form-err">'+esc(res.data.error||"Xatolik")+'</div>';return;}
      var me=await api("GET","me");S.user=me.data.user;S.quizzes=null;
      toast("Xush kelibsiz, "+S.user.name);chrome();location.hash="#/test";});
  }};
}

/* ---------- AI yordamchilari ---------- */
async function ensureAi(){
  if(S.aiEnabled===undefined&&S.user){var r=await api("GET","ai/status");S.aiEnabled=!!(r.data&&r.data.enabled);}
  return !!S.aiEnabled;
}
function aiFeedbackHTML(e){
  var fb=e.feedback||[];
  return fb.map(function(f){return '<div class="ai-box"><div class="ai-tag">AI fikri · baho emas</div><div class="ai-text">'+esc(f.body)+'</div></div>';}).join("")+
   (S.aiEnabled&&fb.length<2?'<div style="margin-top:10px"><button class="btn-ghost btn-sm" data-ai-fb="'+e.id+'">AI fikrini olish ('+(2-fb.length)+' marta qoldi)</button></div>':'');
}
function wireFeedback(){
  $$("[data-ai-fb]").forEach(function(b){b.addEventListener("click",async function(){
    b.disabled=true;b.textContent="AI o‘qiyapti… (10–30 soniya)";
    var r=await api("POST","essays/"+b.dataset.aiFb+"/feedback",{});
    if(r.status!==200){toast(r.data.error||"AI xatosi");b.disabled=false;b.textContent="Qayta urinish";return;}
    route();});});
}

/* ---------- o'qituvchi: AI rubrika tavsiyasi ---------- */
function wireSuggest(essayId,area){
  var bar=$("#aiBar");if(!bar)return;
  if(!S.aiEnabled){bar.innerHTML='<div class="ai-bar"><p>AI tavsiyasi hozircha o‘chiq (API kaliti sozlanmagan).</p></div>';return;}
  bar.innerHTML='<div class="ai-bar"><p><b>AI tavsiyasi.</b> Claude esseni o‘qib, har mezon uchun daraja taklif qiladi va asosini ko‘rsatadi. U faqat taklif: darajalarni siz tekshirasiz va o‘zgartirasiz, baho sizniki.</p><button class="btn-primary btn-sm" id="aiSuggest">AI tavsiyasini olish</button></div><div id="aiSummary"></div>';
  $("#aiSuggest").addEventListener("click",async function(){
    var b=this;b.disabled=true;b.textContent="AI o‘qiyapti… (15–40 soniya)";
    var r=await api("POST","teacher/essays/"+essayId+"/ai-suggest",{});
    b.disabled=false;b.textContent="Qayta olish";
    if(r.status!==200){toast(r.data.error||"AI xatosi");return;}
    r.data.criteria.forEach(function(c){
      var inp=$('input[name="e'+c.index+'"][value="'+c.level+'"]',area);if(inp)inp.checked=true;
      var det=$('details[data-ci="'+c.index+'"]',area);
      if(det){var old=$(".ai-note",det);if(old)old.remove();
        var n=document.createElement("div");n.className="ai-note";
        n.innerHTML='<b>AI taklifi: '+esc(c.level)+'.</b> '+esc(c.reason)+(c.evidence?' <q>'+esc(c.evidence)+'</q>':'');
        det.appendChild(n);}
    });
    area.dispatchEvent(new Event("change"));
    $("#aiSummary").innerHTML='<div class="ai-box"><div class="ai-tag">AI xulosasi · taklif</div><div class="ai-text">'+esc(r.data.summary)+'</div></div>';
    toast("Darajalar belgilandi. Tekshirib, kerak bo‘lsa o‘zgartiring");
  });
}

/* ---------- talaba: AI-murabbiy (modul sahifasida) ---------- */
S.chat={};
async function initCoach(n){
  var blk=$("#coachBlock");if(!blk)return;
  if(!S.user||S.user.role!=="student"){blk.remove();return;}
  if(!(await ensureAi())){blk.remove();return;}
  var log=S.chat[n]=S.chat[n]||[];
  blk.innerHTML='<h3>AI-murabbiy</h3><p class="note">Mavzu bo‘yicha savol bering yoki fikringizni yozing. Murabbiy javobni tayyor aytmaydi, savollar va maslahatlar bilan o‘ylashga yo‘naltiradi. Kuniga 30 ta xabar.</p>'+
   '<div class="chat-log" id="chatLog"></div><form class="chat-form" id="chatForm"><input class="num" id="chatIn" maxlength="1500" placeholder="Savolingizni yozing…" autocomplete="off"><button class="btn-primary btn-sm" type="submit">Yuborish</button></form>';
  function draw(){var el=$("#chatLog");el.innerHTML=log.map(function(m){return '<div class="chat-msg '+(m.role==="user"?"u":"a")+'">'+esc(m.content)+'</div>';}).join("");el.scrollTop=el.scrollHeight;}
  draw();
  $("#chatForm").addEventListener("submit",async function(e){
    e.preventDefault();var inp=$("#chatIn"),t=inp.value.trim();if(!t)return;
    inp.value="";log.push({role:"user",content:t});draw();
    var btn=$("button",this);btn.disabled=true;
    var r=await api("POST","coach",{module:n,messages:log});
    btn.disabled=false;
    if(r.status!==200){log.pop();draw();toast(r.data.error||"AI xatosi");inp.value=t;return;}
    log.push({role:"assistant",content:r.data.reply});draw();
  });
}

/* ---------- o'qituvchi: AI savol loyihalari ---------- */
async function viewAiq(){
  await ensureAi();
  var html='<div class="section-head"><div class="eyebrow">O‘qituvchi vositasi</div><h2>AI bilan savol loyihasi</h2>'+
   '<p class="lede">Mavzuni tanlang, AI test savolining loyihasini yozadi. Bu faqat <b>loyiha</b>: har bir savolni o‘zingiz tekshirib, kerak bo‘lsa tahrirlab, keyin kursga kiritasiz. AI xato qilishi mumkin: javob kaliti va izohni albatta tekshiring.</p></div>'+
   (S.aiEnabled?'':'<div class="form-err">AI hozircha o‘chiq (API kaliti sozlanmagan).</div>')+
   '<div class="panel pad" style="margin-bottom:18px"><div class="form-row"><div><label class="fld" for="q_mod">Mavzu</label><select id="q_mod">'+MODULES.map(function(m){return '<option value="'+m.n+'">'+m.n+'. '+esc(m.en)+'</option>';}).join("")+'</select></div>'+
   '<div><label class="fld" for="q_cnt">Nechta savol</label><select id="q_cnt"><option>3</option><option>2</option><option>1</option><option>5</option></select></div>'+
   '<div><button class="btn-primary" id="q_go"'+(S.aiEnabled?'':' disabled')+'>Loyiha yozish</button></div></div></div><div id="qOut"></div>';
  return{html:html,title:"AI savollar",after:function(){
    $("#q_go").addEventListener("click",async function(){
      var b=this;b.disabled=true;b.textContent="AI yozmoqda… (15–40 soniya)";
      var r=await api("POST","teacher/ai/questions",{module:+$("#q_mod").value,count:+$("#q_cnt").value});
      b.disabled=false;b.textContent="Loyiha yozish";
      if(r.status!==200){$("#qOut").innerHTML='<div class="form-err">'+esc(r.data.error||"AI xatosi")+'</div>';return;}
      var L=["A","B","C","D"];
      $("#qOut").innerHTML=r.data.questions.map(function(q,i){
        return '<div class="qdraft"><div class="ai-tag">Loyiha '+(i+1)+' · '+esc(SKILLS[q.skill]?SKILLS[q.skill].k:"")+'</div>'+(q.p?'<p class="q-passage">'+esc(q.p)+'</p>':'')+
         '<p class="q-text"><b>'+esc(q.t)+'</b></p>'+q.o.map(function(o,j){return '<div class="opt-line'+(j===q.a?" ok":"")+'">'+L[j]+'. '+esc(o)+(j===q.a?"  ✓":"")+'</div>';}).join("")+
         '<p class="note" style="margin-top:8px">Izoh: '+esc(q.why)+'</p><div class="row-actions" style="margin-top:10px"><button data-copy="'+i+'">JSON nusxalash</button></div></div>';}).join("");
      $$("[data-copy]").forEach(function(c){c.addEventListener("click",function(){
        var q=r.data.questions[+c.dataset.copy];
        navigator.clipboard.writeText(JSON.stringify({t:q.t,o:q.o,a:q.a,why:q.why,p:q.p||undefined},null,1)).then(function(){toast("Nusxalandi");},function(){toast("Nusxalab bo‘lmadi");});});});
    });
  }};
}
