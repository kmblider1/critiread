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

console.log(`\nNatija: ${pass} o‘tdi, ${fail} muvaffaqiyatsiz`);
process.exit(fail ? 1 : 0);
