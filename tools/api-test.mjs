// API integratsion sinovi. Ishlatish: `npx wrangler pages dev --port 8788` ishlab turganda `node tools/api-test.mjs`
// Bo'sh lokal bazada ishga tushiring — "setup" bir marta ishlaydi.
import { QUIZ, TEST } from '../functions/_content.js';

const BASE = process.env.BASE || 'http://localhost:8788';
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name); } }

class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body, opts = {}) {
    const headers = { 'content-type': 'application/json' };
    if (method !== 'GET' && !opts.noCsrf) headers['x-cr'] = '1';
    if (this.cookie) headers.cookie = this.cookie;
    const r = await fetch(BASE + '/api/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie');
    if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }
}

const T = new Client(), S1 = new Client(), S2 = new Client(), anon = new Client();
const TPASS = 'teacher-pass-1', S1PASS = 'student-pass-1', S2PASS = 'student-pass-2';

console.log('1) ochiq / CSRF');
ok((await anon.call('GET', 'status')).data.setup === true, 'setup kerak');
ok((await anon.call('POST', 'login', { email: 'a@b.uz', password: 'x' }, { noCsrf: true })).status === 403, 'x-cr siz POST rad etiladi');
ok((await anon.call('GET', 'me')).status === 401, 'kirishsiz /me 401');
ok((await anon.call('GET', 'teacher/students')).status === 401, 'kirishsiz teacher 401');

console.log('2) setup / login');
ok((await T.call('POST', 'setup', { email: 'ustoz@critiread.uz', name: 'Ustoz', password: 'short' })).status === 400, 'qisqa parol rad');
ok((await T.call('POST', 'setup', { email: 'ustoz@critiread.uz', name: 'Ustoz', password: TPASS })).status === 200, 'setup o‘qituvchi yaratadi');
ok((await anon.call('POST', 'setup', { email: 'x@critiread.uz', name: 'X', password: 'another-pass-9' })).status === 403, 'ikkinchi setup rad');
ok((await T.call('GET', 'me')).data.user.role === 'teacher', 'o‘qituvchi sessiyasi');

console.log('3) talabalar yaratish');
ok((await T.call('POST', 'teacher/students', { name: 'Talaba Bir', email: 's1@critiread.uz', grp: 'E', password: S1PASS })).status === 200, 'talaba 1');
ok((await T.call('POST', 'teacher/students', { name: 'Talaba Ikki', email: 's2@critiread.uz', grp: 'E', password: S2PASS })).status === 200, 'talaba 2');
ok((await T.call('POST', 'teacher/students', { name: 'Talaba Uch', email: 's3@critiread.uz', grp: 'C', password: 'student-pass-3' })).status === 200, 'talaba 3 (nazorat guruhi)');
ok((await T.call('POST', 'teacher/students', { name: 'Dup', email: 's1@critiread.uz', password: 'whatever-123' })).status === 409, 'takroriy email 409');

console.log('4) talaba login, brute-force himoyasi');
const bf = new Client();
for (let i = 0; i < 5; i++) await bf.call('POST', 'login', { email: 's3@critiread.uz', password: 'wrong-pass-' + i });
ok((await bf.call('POST', 'login', { email: 's3@critiread.uz', password: 'student-pass-3' })).status === 429, '5 xatodan so‘ng (to‘g‘ri parol bilan ham) bloklanadi');
ok((await S1.call('POST', 'login', { email: 's1@critiread.uz', password: S1PASS })).status === 200, 'talaba 1 kiradi');

console.log('5) rollar');
ok((await S1.call('GET', 'teacher/students')).status === 403, 'talaba teacher API ga kira olmaydi');
ok((await S1.call('GET', 'teacher/panel')).status === 403, 'talaba panelga kira olmaydi');
ok((await T.call('POST', 'test/submit', { answers: TEST.map(() => 0) })).status === 403, 'o‘qituvchi test topshira olmaydi');

console.log('6) kalitlar sizib chiqmaydi');
const qz = (await S1.call('GET', 'quizzes')).data;
ok(Object.keys(qz.questions).length === 30, '30 ta mashq savoli');
ok(!JSON.stringify(qz.questions).includes('"a"') && !JSON.stringify(qz.questions).includes('why'), 'mashq savollarida kalit yo‘q');
const tq = (await S1.call('GET', 'test/questions')).data;
ok(tq.phase === 'pre' && tq.questions.length === 12, 'test savollari (PRE)');
ok(!JSON.stringify(tq).includes('"a"') && !JSON.stringify(tq).includes('why') && !JSON.stringify(tq).includes('"s"'), 'test savollarida kalit yo‘q');

console.log('7) mashq javobi');
const a1 = (await S1.call('POST', 'quizzes/5/answer', { choice: QUIZ[5].a })).data;
ok(a1.correct === true && a1.why, 'to‘g‘ri javob + izoh');
const a2 = (await S1.call('POST', 'quizzes/5/answer', { choice: 0 })).data;
ok(a2.already === true && a2.correct === true, 'ikkinchi urinish natijani o‘zgartirmaydi');
ok((await S1.call('POST', 'quizzes/99/answer', { choice: 0 })).status === 400, 'noto‘g‘ri modul 400');

console.log('8) PRE/POST diagnostika');
ok((await S1.call('POST', 'test/submit', { answers: [1, 2] })).status === 400, 'to‘liq bo‘lmagan javoblar 400');
const pre = (await S1.call('POST', 'test/submit', { answers: TEST.map((q, i) => (i % 2 ? q.a : (q.a + 1) % 4)) })).data;
ok(pre.phase === 'pre' && pre.right === 6 && pre.scores.length === 6, 'PRE: 6/12 to‘g‘ri');
ok(!('a' in pre) && !JSON.stringify(pre).includes('why'), 'PRE javobida kalit yo‘q');
const post = (await S1.call('POST', 'test/submit', { answers: TEST.map((q) => q.a) })).data;
ok(post.phase === 'post' && post.right === 12 && post.scores.every((x) => x === 100), 'POST: 12/12');
ok((await S1.call('POST', 'test/submit', { answers: TEST.map((q) => q.a) })).status === 409, 'uchinchi urinish 409');
const prof0 = (await S1.call('GET', 'me/profile')).data;
ok(prof0.overall === null && prof0.cur.every((x) => x === null), 'diagnostika CT-profilga/bahoga qo‘shilmaydi');
ok(prof0.diag.pre && prof0.diag.post, 'PRE va POST alohida saqlangan');
await S2.call('POST', 'login', { email: 's2@critiread.uz', password: S2PASS });
await S2.call('POST', 'test/submit', { answers: TEST.map((q, i) => (i % 3 ? q.a : (q.a + 1) % 4)) });
await S2.call('POST', 'test/submit', { answers: TEST.map((q, i) => (i % 6 ? q.a : (q.a + 1) % 4)) });

console.log('9) o‘qituvchi baholaydi');
const stus = (await T.call('GET', 'teacher/students')).data.students;
const s1 = stus.find((s) => s.email === 's1@critiread.uz');
const g1 = (await T.call('POST', 'teacher/grade', { student_id: s1.id, kind: 'reading', topic: 3, items: { 0: 'B', 1: 'A', 2: 'B', 3: 'C' } })).data;
ok(g1.pct === 80 && g1.grade === 4, 'CT% = 80, baho 4 (B,A,B,C = 16/20)');
ok((await T.call('POST', 'teacher/grade', { student_id: s1.id, kind: 'reading', items: { 5: 'A' } })).status === 400, 'reading uchun 6-mezon rad');
ok((await T.call('POST', 'teacher/grade', { student_id: s1.id, kind: 'reading', items: { 0: 'Z' } })).status === 400, 'noto‘g‘ri daraja rad');
const prof1 = (await S1.call('GET', 'me/profile')).data;
ok(prof1.overall !== null && prof1.cur[0] === 80 && prof1.cur[1] === 100 && prof1.cur[4] === null, 'profil faqat baholangan mezonlardan');
// baho chegaralari: 90->5, 70->4, 60->3, aks holda 2 (4 ta mezon, maks 20)
const bounds = [[{ 0: 'A', 1: 'A', 2: 'A', 3: 'C' }, 90, 5], [{ 0: 'A', 1: 'A', 2: 'B', 3: 'C' }, 85, 4], [{ 0: 'B', 1: 'B', 2: 'C', 3: 'C' }, 70, 4],
  [{ 0: 'B', 1: 'C', 2: 'C', 3: 'C' }, 65, 3], [{ 0: 'C', 1: 'C', 2: 'C', 3: 'C' }, 60, 3], [{ 0: 'C', 1: 'C', 2: 'C', 3: 'D' }, 55, 2]];
for (const [items, pct, g] of bounds) {
  const r = (await T.call('POST', 'teacher/grade', { student_id: s1.id, kind: 'reading', items })).data;
  ok(r.pct === pct && r.grade === g, `chegara: ${pct}% -> baho ${g}`);
}

console.log('10) esse navbati');
ok((await S1.call('POST', 'essays', { topic: 6, body: 'qisqa' })).status === 400, 'qisqa esse rad');
const longEssay = Array.from({ length: 60 }, (_, i) => 'word' + i).join(' ');
const es = (await S1.call('POST', 'essays', { topic: 6, body: longEssay })).data;
ok(es.ok && es.id, 'esse topshirildi');
ok((await T.call('GET', 'teacher/queue')).data.queue.length === 1, 'navbatda 1 ta');
ok((await S1.call('GET', 'teacher/queue')).status === 403, 'talaba navbatni ko‘ra olmaydi');
const eg = (await T.call('POST', `teacher/essays/${es.id}/grade`, { items: { 1: 'B', 2: 'B', 3: 'B', 4: 'B', 5: 'B' } })).data;
ok(eg.pct === 80, 'esse baholandi 80%');
ok((await T.call('POST', `teacher/essays/${es.id}/grade`, { items: { 1: 'A' } })).status === 409, 'ikki marta baholab bo‘lmaydi');
ok((await S1.call('GET', 'me/essays')).data.essays[0].status === 'graded', 'talaba natijani ko‘radi');

console.log('11) panel / Cohen’s d');
const panel = (await T.call('GET', 'teacher/panel')).data;
ok(panel.students === 3, 'panel: 3 talaba');
const rg = panel.research.find((r) => r.group === 'E');
ok(rg && rg.n === 2 && typeof rg.d === 'number' && rg.d > 0, 'Cohen’s d musbat (POST > PRE)');

console.log('12) parol almashtirish, reset, logout');
ok((await S2.call('POST', 'me/password', { current: 'wrong', next: 'new-pass-1234' })).status === 400, 'joriy parol noto‘g‘ri');
ok((await S2.call('POST', 'me/password', { current: S2PASS, next: 'new-pass-1234' })).status === 200, 'parol almashdi');
const s2id = stus.find((s) => s.email === 's2@critiread.uz').id;
ok((await T.call('POST', `teacher/students/${s2id}/reset-password`, { password: 'reset-pass-5678' })).status === 200, 'o‘qituvchi parolni tiklaydi');
ok((await S2.call('GET', 'me')).status === 401, 'tiklangach eski sessiya tugaydi');
ok((await S2.call('POST', 'login', { email: 's2@critiread.uz', password: 'reset-pass-5678' })).status === 200, 'yangi parol bilan kiradi');
ok((await S1.call('POST', 'logout')).status === 200 && (await S1.call('GET', 'me')).status === 401, 'logout sessiyani tugatadi');
ok((await T.call('POST', `teacher/students/${s2id}/reset-diagnostic`, { phase: 'post' })).status === 200, 'POST ni qayta ochish');

console.log('13) taklif havolasi orqali o‘zi ro‘yxatdan o‘tish');
const inv = (await T.call('POST', 'teacher/invites', { grp: 'E', max_uses: 2, days: 7 })).data;
ok(inv.ok && inv.code && inv.code.length >= 10, 'havola yaratildi');
ok((await anon.call('GET', 'invites/' + inv.code)).data.valid === true, 'havola yaroqli');
ok((await anon.call('GET', 'invites/yoq-kod')).data.valid === false, 'noma’lum kod yaroqsiz');
const J1 = new Client(), J2 = new Client(), J3 = new Client();
ok((await J1.call('POST', 'join', { code: inv.code, name: 'Havola Bir', email: 'j1@critiread.uz', password: 'short' })).status === 400, 'qisqa parol rad');
ok((await J1.call('POST', 'join', { code: 'noto-g-ri', name: 'X', email: 'j1@critiread.uz', password: 'join-pass-111' })).status === 403, 'noto‘g‘ri kod rad');
ok((await J1.call('POST', 'join', { code: inv.code, name: 'Havola Bir', email: 'j1@critiread.uz', password: 'join-pass-111' })).status === 200, '1-talaba ro‘yxatdan o‘tdi');
const me1 = (await J1.call('GET', 'me')).data.user;
ok(me1.role === 'student' && me1.grp === 'E', 'rol student, guruh havoladan (E)');
ok((await J1.call('GET', 'teacher/students')).status === 403, 'o‘zi ro‘yxatdan o‘tgan talaba o‘qituvchi API ga kira olmaydi');
ok((await J3.call('POST', 'join', { code: inv.code, name: 'Dup', email: 'j1@critiread.uz', password: 'join-pass-333' })).status === 409, 'band email 409 (o‘rin sarflanmaydi)');
ok((await J2.call('POST', 'join', { code: inv.code, name: 'Havola Ikki', email: 'j2@critiread.uz', password: 'join-pass-222' })).status === 200, '2-talaba ro‘yxatdan o‘tdi');
ok((await J3.call('POST', 'join', { code: inv.code, name: 'Uchinchi', email: 'j3@critiread.uz', password: 'join-pass-333' })).status === 403, 'limit (2) tugagach rad');
ok((await anon.call('GET', 'invites/' + inv.code)).data.valid === false, 'limit tugagach yaroqsiz');
const inv2 = (await T.call('POST', 'teacher/invites', { grp: 'C', max_uses: 5, days: 1 })).data;
const list = (await T.call('GET', 'teacher/invites')).data.invites;
const row2 = list.find((x) => x.code === inv2.code);
ok(row2 && row2.valid && row2.used === 0, 'ro‘yxatda ko‘rinadi');
ok((await T.call('POST', `teacher/invites/${row2.id}/revoke`)).status === 200, 'havola o‘chirildi');
ok((await J3.call('POST', 'join', { code: inv2.code, name: 'Uchinchi', email: 'j3@critiread.uz', password: 'join-pass-333' })).status === 403, 'o‘chirilgan havola rad');
ok(((await T.call('GET', 'teacher/students')).data.students.filter((x) => x.email.startsWith('j')).length) === 2, 'faqat 2 ta talaba qo‘shilgan');

console.log('14) AI (soxta Anthropic serveri bilan)');
const MOCK = process.env.MOCK || 'http://localhost:8799';
const last = async () => (await fetch(MOCK + '/_last')).json();
ok((await J1.call('GET', 'ai/status')).data.enabled === true, 'AI sozlangan');
const longEs = Array.from({ length: 60 }, (_, i) => 'idea' + i).join(' ');
const es2 = (await J1.call('POST', 'essays', { topic: 6, body: longEs })).data;
const fb1 = (await J1.call('POST', `essays/${es2.id}/feedback`)).data;
ok(fb1.ok && fb1.feedback.body.startsWith('Javob:'), 'talabaga AI fikri (1)');
let lr = await last();
ok(lr.body.model === 'claude-opus-5-5' && lr.key === 'test-key-not-real', 'model claude-opus-5-5, kalit SDK orqali yuborildi');
ok(lr.body.output_config.effort === 'low' && !('temperature' in lr.body) && !lr.body.thinking, 'effort=low, temperature/thinking yo‘q');
ok(JSON.stringify(lr.body.system).includes('Do NOT give a grade') && JSON.stringify(lr.body.messages).includes('<essay>'), 'baho berilmasligi va <essay> chegarasi');
ok((await J1.call('POST', `essays/${es2.id}/feedback`)).data.ok === true, 'talabaga AI fikri (2)');
ok((await J1.call('POST', `essays/${es2.id}/feedback`)).status === 409, 'uchinchisi rad (esse boshiga 2 ta)');
ok((await J2.call('POST', `essays/${es2.id}/feedback`)).status === 404, 'boshqa talabaning essesiga AI fikri olinmaydi');
const mine = (await J1.call('GET', 'me/essays')).data.essays.find((e) => e.id === es2.id);
ok(mine.feedback.length === 2, 'fikrlar saqlandi va ro‘yxatda ko‘rinadi');
ok((await T.call('POST', `essays/${es2.id}/feedback`)).status === 403, 'o‘qituvchi talaba AI fikrini ishlata olmaydi');
const sug = (await T.call('POST', `teacher/essays/${es2.id}/ai-suggest`)).data;
ok(sug.criteria && sug.criteria.length === 5 && sug.criteria.map((c) => c.level).join('') === 'BCBAC', 'o‘qituvchiga 5 mezon bo‘yicha tavsiya');
lr = await last();
ok(lr.body.output_config.format.type === 'json_schema' && lr.body.output_config.effort === 'medium', 'tuzilgan JSON (json_schema), effort=medium');
ok((await J1.call('POST', `teacher/essays/${es2.id}/ai-suggest`)).status === 403, 'talaba tavsiya ola olmaydi');
const qs = (await T.call('POST', 'teacher/ai/questions', { module: 5, count: 3 })).data.questions;
ok(qs.length === 3 && qs.every((q) => q.o.length === 4 && q.a >= 0 && q.a < 4), 'savol loyihalari tekshiruvdan o‘tdi (yaroqsizi tashlandi)');
ok((await T.call('POST', 'teacher/ai/questions', { module: 99 })).status === 400, 'noto‘g‘ri modul 400');
const c1 = (await J1.call('POST', 'coach', { module: 5, messages: [{ role: 'user', content: 'Fakt va fikr nima?' }] })).data;
ok(c1.reply && c1.reply.startsWith('Javob:'), 'murabbiy javob berdi');
lr = await last();
ok(!JSON.stringify(lr.body).includes('"answer"') && lr.body.system.includes('Socratic'), 'murabbiyga javob kalitlari berilmaydi');
ok((await J1.call('POST', 'coach', { module: 5, messages: [{ role: 'assistant', content: 'x' }] })).status === 400, 'foydalanuvchi xabarisiz so‘rov 400');
ok((await T.call('POST', 'coach', { module: 5, messages: [{ role: 'user', content: 'salom' }] })).status === 403, 'o‘qituvchi murabbiydan foydalanmaydi');
ok((await J2.call('POST', 'coach', { module: 5, messages: [{ role: 'user', content: 'TRIGGER_REFUSE' }] })).status === 422, 'rad etilgan javob 422 (tushunarli xabar)');
ok((await J2.call('POST', 'coach', { module: 5, messages: [{ role: 'user', content: 'TRIGGER_401' }] })).status === 503, 'noto‘g‘ri kalit 503');
let limitHit = 0;
for (let i = 0; i < 32; i++) { const r = await J1.call('POST', 'coach', { module: 5, messages: [{ role: 'user', content: 'savol ' + i }] }); if (r.status === 429) { limitHit = i; break; } }
ok(limitHit > 0 && limitHit <= 30, `kunlik limit (30) ishladi (${limitHit}-so‘rovda)`);
ok((await anon.call('POST', 'coach', { module: 5, messages: [{ role: 'user', content: 'x' }] })).status === 401, 'kirishsiz AI 401');

console.log(`\nNatija: ${pass} o‘tdi, ${fail} muvaffaqiyatsiz`);
process.exit(fail ? 1 : 0);
