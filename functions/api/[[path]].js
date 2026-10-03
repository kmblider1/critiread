// CritiRead API — Cloudflare Pages Functions + D1.
// Invariantlar (loyiha topshirig'idan):
//  1) baholash: A=5,B=4,C=3,D=2; CT% -> baho: 90->5, 70->4, 60->3, aks holda 2
//  2) ikki mustaqil oqim: (a) rubrika urinishlari -> CT% va profil; (b) PRE/POST -> faqat Δ va Cohen's d
//  3) javob kalitlari FAQAT serverda (../_content.js)
import { QUIZ, TEST } from '../_content.js';
import { AiError, aiEnabled, suggestRubric, essayFeedback, draftQuestions, coachReply, cleanChat } from '../_ai.js';

const PTS = { A: 5, B: 4, C: 3, D: 2 };
const SESSION_DAYS = 7;
const TASKS = { reading: [0, 1, 2, 3], writing: [1, 2, 3, 4, 5], peer: [2, 4, 5], diagnostic: [0, 1, 2, 3, 4, 5], essay: [1, 2, 3, 4, 5] };

// ---------- yordamchilar ----------
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
const err = (status, message) => json({ error: message }, status);
async function sha256(s) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: 100000 }, key, 256);
  return b64(bits);
}
function newSalt() { return b64(crypto.getRandomValues(new Uint8Array(16))); }
function timingEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const grade = (p) => (p >= 90 ? 5 : p >= 70 ? 4 : p >= 60 ? 3 : 2);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const validEmail = (e) => typeof e === 'string' && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const clean = (s, n) => String(s ?? '').trim().slice(0, n);

function parseCookies(req) {
  const out = {};
  (req.headers.get('cookie') || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function sessionCookie(token, maxAge, secure) {
  return `cr_session=${token}; Path=/; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Max-Age=${maxAge}`;
}

async function currentUser(req, env) {
  const t = parseCookies(req).cr_session;
  if (!t) return null;
  const h = await sha256(t);
  const row = await env.DB.prepare(
    'SELECT u.id,u.email,u.name,u.role,u.grp,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?'
  ).bind(h).first();
  if (!row) return null;
  if (row.expires_at < Date.now()) { await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(h).run(); return null; }
  return { id: row.id, email: row.email, name: row.name, role: row.role, grp: row.grp };
}

async function startSession(env, userId, secure) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
  const maxAge = SESSION_DAYS * 86400;
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token), userId, Date.now() + maxAge * 1000).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run();
  return sessionCookie(token, maxAge, secure);
}

// rubrika: items {ci:'A'..'D'} -> {pct, grade}
function scoreItems(items, allowed) {
  const keys = Object.keys(items || {});
  if (!keys.length) return null;
  let sum = 0;
  for (const k of keys) {
    const ci = Number(k);
    if (!Number.isInteger(ci) || !allowed.includes(ci) || !PTS[items[k]]) return null;
    sum += PTS[items[k]];
  }
  const pct = Math.round((sum / (5 * keys.length)) * 100);
  return { pct, grade: grade(pct) };
}

// profil: har ko'nikma bo'yicha baholangan mezonlarning o'rtacha foizi
async function buildProfile(env, userId) {
  const { results } = await env.DB.prepare('SELECT id,kind,topic,items,pct,grade,created_at FROM attempts WHERE user_id=? ORDER BY id').bind(userId).all();
  const sums = [0, 0, 0, 0, 0, 0], counts = [0, 0, 0, 0, 0, 0];
  for (const a of results) {
    const items = JSON.parse(a.items);
    for (const k of Object.keys(items)) { sums[k] += (PTS[items[k]] / 5) * 100; counts[k]++; }
  }
  const cur = sums.map((s, i) => (counts[i] ? Math.round(s / counts[i]) : null));
  const have = cur.filter((v) => v !== null);
  const overall = have.length ? Math.round(mean(have)) : null;
  const diag = {};
  const d = await env.DB.prepare('SELECT phase,scores,right_count,created_at FROM diagnostics WHERE user_id=?').bind(userId).all();
  for (const r of d.results) diag[r.phase] = { scores: JSON.parse(r.scores), right: r.right_count, at: r.created_at };
  return { cur, counts, overall, grade: overall === null ? null : grade(overall), attempts: results.map((a) => ({ id: a.id, kind: a.kind, topic: a.topic, pct: a.pct, grade: a.grade, at: a.created_at })), diag };
}

async function addAttempt(env, userId, kind, topic, items, sc, gradedBy) {
  const r = await env.DB.prepare('INSERT INTO attempts(user_id,kind,topic,items,pct,grade,graded_by) VALUES(?,?,?,?,?,?,?)')
    .bind(userId, kind, topic ?? null, JSON.stringify(items), sc.pct, sc.grade, gradedBy).run();
  return r.meta.last_row_id;
}

// ---------- AI kvotasi ----------
const AI_LIMITS = { feedback: 6, coach: 30, suggest: 60, qgen: 20 };
async function aiQuota(env, userId, kind) {
  const day = new Date().toISOString().slice(0, 10);
  const r = await env.DB.prepare('INSERT INTO ai_usage(user_id,day,kind,n) VALUES(?,?,?,1) ON CONFLICT(user_id,day,kind) DO UPDATE SET n=n+1 WHERE n<?').bind(userId, day, kind, AI_LIMITS[kind]).run();
  return r.meta.changes > 0 ? day : null;
}
async function withAi(env, user, kind, fn) {
  if (!aiEnabled(env)) return err(503, 'AI hali sozlanmagan');
  const day = await aiQuota(env, user.id, kind);
  if (!day) return err(429, 'Bugungi AI limiti tugadi. Ertaga qayta urining');
  try { return json(await fn()); } catch (e) {
    await env.DB.prepare('UPDATE ai_usage SET n=n-1 WHERE user_id=? AND day=? AND kind=? AND n>0').bind(user.id, day, kind).run();
    if (e instanceof AiError) return err(e.status, e.message);
    throw e;
  }
}

// ---------- marshrutlar ----------
async function route(req, env) {
  const url = new URL(req.url);
  const secure = url.protocol === 'https:';
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const method = req.method;
  const seg = path.split('/');

  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (req.headers.get('x-cr') !== '1') return err(403, 'Noto‘g‘ri so‘rov');
  }
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try { body = await req.json(); } catch { body = {}; }
  }

  // --- ochiq ---
  if (path === 'status' && method === 'GET') {
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM users').first();
    return json({ setup: c.n === 0 });
  }
  if (path === 'setup' && method === 'POST') {
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM users').first();
    if (c.n > 0) return err(403, 'Tizim allaqachon sozlangan');
    const email = clean(body.email, 120).toLowerCase(), name = clean(body.name, 100), password = String(body.password || '');
    if (!validEmail(email) || !name || password.length < 8 || password.length > 200) return err(400, 'Email, ism va kamida 8 belgili parol kerak');
    const salt = newSalt();
    const r = await env.DB.prepare('INSERT INTO users(email,name,role,grp,pass_hash,salt) VALUES(?,?,?,?,?,?)').bind(email, name, 'teacher', '', await hashPassword(password, salt), salt).run();
    const cookie = await startSession(env, r.meta.last_row_id, secure);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }
  if (path === 'login' && method === 'POST') {
    const email = clean(body.email, 120).toLowerCase(), password = String(body.password || '');
    if (!validEmail(email) || !password) return err(400, 'Email va parolni kiriting');
    const since = Date.now() - 10 * 60 * 1000;
    const f = await env.DB.prepare('SELECT COUNT(*) n FROM login_fail WHERE email=? AND ts>?').bind(email, since).first();
    if (f.n >= 5) return err(429, 'Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urining');
    const u = await env.DB.prepare('SELECT id,pass_hash,salt FROM users WHERE email=?').bind(email).first();
    const hash = await hashPassword(password, u ? u.salt : newSalt());
    if (!u || !timingEq(hash, u.pass_hash)) {
      await env.DB.prepare('INSERT INTO login_fail(email,ts) VALUES(?,?)').bind(email, Date.now()).run();
      await env.DB.prepare('DELETE FROM login_fail WHERE ts<?').bind(since).run();
      return err(401, 'Email yoki parol noto‘g‘ri');
    }
    await env.DB.prepare('DELETE FROM login_fail WHERE email=?').bind(email).run();
    return json({ ok: true }, 200, { 'set-cookie': await startSession(env, u.id, secure) });
  }
  if (path === 'logout' && method === 'POST') {
    const t = parseCookies(req).cr_session;
    if (t) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(t)).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, secure) });
  }

  // --- taklif havolasi orqali o'zi ro'yxatdan o'tish (ochiq) ---
  if (seg[0] === 'invites' && seg[1] && method === 'GET') {
    const row = await env.DB.prepare('SELECT grp,max_uses,used,expires_at,active FROM invites WHERE code=?').bind(seg[1].slice(0, 40)).first();
    const valid = !!row && row.active === 1 && row.used < row.max_uses && row.expires_at > Date.now();
    return json(valid ? { valid: true, grp: row.grp } : { valid: false });
  }
  if (path === 'join' && method === 'POST') {
    const code = clean(body.code, 40), email = clean(body.email, 120).toLowerCase(), name = clean(body.name, 100), password = String(body.password || '');
    if (!code || !validEmail(email) || !name || password.length < 8 || password.length > 200) return err(400, 'Ism, email va kamida 8 belgili parol kerak');
    const inv = await env.DB.prepare('SELECT id,grp FROM invites WHERE code=? AND active=1 AND used<max_uses AND expires_at>?').bind(code, Date.now()).first();
    if (!inv) return err(403, 'Taklif havolasi yaroqsiz yoki muddati tugagan');
    const ex = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if (ex) return err(409, 'Bu email bilan hisob mavjud. Tizimga kiring');
    // o'rinni band qilish (poyga holatiga qarshi): faqat bitta so'rov muvaffaqiyatli bo'ladi
    const claim = await env.DB.prepare('UPDATE invites SET used=used+1 WHERE id=? AND active=1 AND used<max_uses AND expires_at>?').bind(inv.id, Date.now()).run();
    if (!claim.meta.changes) return err(403, 'Taklif havolasi yaroqsiz yoki muddati tugagan');
    const salt = newSalt();
    let uid;
    try {
      const r = await env.DB.prepare('INSERT INTO users(email,name,role,grp,pass_hash,salt) VALUES(?,?,?,?,?,?)').bind(email, name, 'student', inv.grp, await hashPassword(password, salt), salt).run();
      uid = r.meta.last_row_id;
    } catch (e) {
      await env.DB.prepare('UPDATE invites SET used=used-1 WHERE id=?').bind(inv.id).run();
      return err(409, 'Bu email bilan hisob mavjud. Tizimga kiring');
    }
    return json({ ok: true }, 200, { 'set-cookie': await startSession(env, uid, secure) });
  }

  // --- kirish talab qilinadi ---
  const user = await currentUser(req, env);
  if (!user) return err(401, 'Tizimga kiring');

  if (path === 'me' && method === 'GET') return json({ user });
  if (path === 'me/password' && method === 'POST') {
    const row = await env.DB.prepare('SELECT pass_hash,salt FROM users WHERE id=?').bind(user.id).first();
    const cur = String(body.current || ''), next = String(body.next || '');
    if (next.length < 8 || next.length > 200) return err(400, 'Yangi parol kamida 8 belgi');
    if (!timingEq(await hashPassword(cur, row.salt), row.pass_hash)) return err(400, 'Joriy parol noto‘g‘ri');
    const salt = newSalt();
    await env.DB.prepare('UPDATE users SET pass_hash=?,salt=? WHERE id=?').bind(await hashPassword(next, salt), salt, user.id).run();
    return json({ ok: true });
  }

  // --- modul mashqlari (kalit faqat javobdan keyin) ---
  if (path === 'quizzes' && method === 'GET') {
    const mine = await env.DB.prepare('SELECT module,choice,correct FROM quiz WHERE user_id=?').bind(user.id).all();
    const done = {};
    for (const r of mine.results) done[r.module] = { choice: r.choice, correct: !!r.correct, a: QUIZ[r.module].a, why: QUIZ[r.module].why };
    const questions = {};
    for (const n of Object.keys(QUIZ)) questions[n] = { t: QUIZ[n].t, o: QUIZ[n].o };
    return json({ questions, done });
  }
  if (seg[0] === 'quizzes' && seg[2] === 'answer' && method === 'POST') {
    if (user.role !== 'student') return err(403, 'Faqat talaba javob beradi');
    const n = Number(seg[1]), q = QUIZ[n], choice = Number(body.choice);
    if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.o.length) return err(400, 'Noto‘g‘ri savol yoki javob');
    const ex = await env.DB.prepare('SELECT choice,correct FROM quiz WHERE user_id=? AND module=?').bind(user.id, n).first();
    if (ex) return json({ choice: ex.choice, correct: !!ex.correct, a: q.a, why: q.why, already: true });
    const ok = choice === q.a ? 1 : 0;
    await env.DB.prepare('INSERT INTO quiz(user_id,module,choice,correct) VALUES(?,?,?,?)').bind(user.id, n, choice, ok).run();
    return json({ choice, correct: !!ok, a: q.a, why: q.why });
  }

  // --- diagnostika (PRE/POST) ---
  if (path === 'test/questions' && method === 'GET') {
    const d = await env.DB.prepare('SELECT phase FROM diagnostics WHERE user_id=?').bind(user.id).all();
    const have = d.results.map((r) => r.phase);
    const next = !have.includes('pre') ? 'pre' : !have.includes('post') ? 'post' : null;
    return json({ phase: next, questions: next ? TEST.map((q) => ({ p: q.p, t: q.t, o: q.o })) : [] });
  }
  if (path === 'test/submit' && method === 'POST') {
    if (user.role !== 'student') return err(403, 'Faqat talaba topshiradi');
    const d = await env.DB.prepare('SELECT phase FROM diagnostics WHERE user_id=?').bind(user.id).all();
    const have = d.results.map((r) => r.phase);
    const phase = !have.includes('pre') ? 'pre' : !have.includes('post') ? 'post' : null;
    if (!phase) return err(409, 'PRE va POST allaqachon topshirilgan');
    const ans = body.answers;
    if (!Array.isArray(ans) || ans.length !== TEST.length || ans.some((x) => !Number.isInteger(x) || x < 0 || x > 3)) return err(400, 'Barcha savollarga javob bering');
    const ok = [0, 0, 0, 0, 0, 0], mx = [0, 0, 0, 0, 0, 0];
    let right = 0;
    TEST.forEach((q, i) => { mx[q.s]++; if (ans[i] === q.a) { ok[q.s]++; right++; } });
    const scores = ok.map((v, i) => Math.round((v / mx[i]) * 100));
    await env.DB.prepare('INSERT INTO diagnostics(user_id,phase,scores,right_count) VALUES(?,?,?,?)').bind(user.id, phase, JSON.stringify(scores), right).run();
    // To'g'ri javoblar ko'rsatilmaydi: POST sofligini saqlash uchun
    return json({ phase, scores, right, total: TEST.length });
  }

  // --- AI (talaba) ---
  if (path === 'ai/status' && method === 'GET') return json({ enabled: aiEnabled(env) });
  if (seg[0] === 'essays' && seg[2] === 'feedback' && method === 'POST') {
    if (user.role !== 'student') return err(403, 'Faqat talaba uchun');
    const essay = await env.DB.prepare('SELECT id,topic,body FROM essays WHERE id=? AND user_id=?').bind(Number(seg[1]), user.id).first();
    if (!essay) return err(404, 'Esse topilmadi');
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM essay_feedback WHERE essay_id=?').bind(essay.id).first();
    if (c.n >= 2) return err(409, 'Bu esse uchun AI fikri ikki marta olingan');
    return withAi(env, user, 'feedback', async () => {
      const text = await essayFeedback(env, essay);
      const r = await env.DB.prepare('INSERT INTO essay_feedback(essay_id,user_id,body) VALUES(?,?,?)').bind(essay.id, user.id, text).run();
      return { ok: true, feedback: { id: r.meta.last_row_id, essay_id: essay.id, body: text } };
    });
  }
  if (path === 'coach' && method === 'POST') {
    if (user.role !== 'student') return err(403, 'Faqat talaba uchun');
    const n = Number(body.module), msgs = cleanChat(body.messages);
    if (!Number.isInteger(n) || n < 1 || n > 30 || !msgs) return err(400, 'Savol noto‘g‘ri');
    return withAi(env, user, 'coach', async () => ({ reply: await coachReply(env, n, msgs) }));
  }

  // --- profil, esse ---
  if (path === 'me/profile' && method === 'GET') return json(await buildProfile(env, user.id));
  if (path === 'me/essays' && method === 'GET') {
    const r = await env.DB.prepare('SELECT e.id,e.topic,e.status,e.created_at,a.pct,a.grade FROM essays e LEFT JOIN attempts a ON a.id=e.attempt_id WHERE e.user_id=? ORDER BY e.id DESC').bind(user.id).all();
    const fb = await env.DB.prepare('SELECT id,essay_id,body,created_at FROM essay_feedback WHERE user_id=? ORDER BY id').bind(user.id).all();
    return json({ essays: r.results.map((e) => ({ ...e, feedback: fb.results.filter((x) => x.essay_id === e.id) })) });
  }
  if (path === 'essays' && method === 'POST') {
    if (user.role !== 'student') return err(403, 'Faqat talaba topshiradi');
    const text = clean(body.body, 20000), topic = Number(body.topic);
    if (text.split(/\s+/).length < 30) return err(400, 'Esse kamida 30 so‘zdan iborat bo‘lsin');
    if (!Number.isInteger(topic) || topic < 1 || topic > 30) return err(400, 'Mavzu raqami noto‘g‘ri');
    const r = await env.DB.prepare('INSERT INTO essays(user_id,topic,body) VALUES(?,?,?)').bind(user.id, topic, text).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }

  // --- o'qituvchi ---
  if (seg[0] === 'teacher') {
    if (user.role !== 'teacher') return err(403, 'Faqat o‘qituvchi uchun');
    const sub = seg.slice(1).join('/');

    if (sub === 'students' && method === 'GET') {
      const us = await env.DB.prepare("SELECT id,email,name,grp FROM users WHERE role='student' ORDER BY grp,name").all();
      const out = [];
      for (const u of us.results) { const p = await buildProfile(env, u.id); delete p.attempts; out.push({ ...u, ...p }); }
      return json({ students: out });
    }
    if (sub === 'students' && method === 'POST') {
      const email = clean(body.email, 120).toLowerCase(), name = clean(body.name, 100), grp = clean(body.grp, 40), password = String(body.password || '');
      if (!validEmail(email) || !name || password.length < 8 || password.length > 200) return err(400, 'Ism, email va kamida 8 belgili parol kerak');
      const ex = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
      if (ex) return err(409, 'Bu email band');
      const salt = newSalt();
      const r = await env.DB.prepare('INSERT INTO users(email,name,role,grp,pass_hash,salt) VALUES(?,?,?,?,?,?)').bind(email, name, 'student', grp, await hashPassword(password, salt), salt).run();
      return json({ ok: true, id: r.meta.last_row_id });
    }
    if (sub === 'invites' && method === 'GET') {
      const r = await env.DB.prepare('SELECT id,code,grp,max_uses,used,expires_at,active,created_at FROM invites ORDER BY id DESC LIMIT 50').all();
      return json({ invites: r.results.map((x) => ({ ...x, valid: x.active === 1 && x.used < x.max_uses && x.expires_at > Date.now() })) });
    }
    if (sub === 'invites' && method === 'POST') {
      const grp = clean(body.grp, 40);
      const max = Math.min(500, Math.max(1, Math.floor(Number(body.max_uses) || 30)));
      const days = Math.min(90, Math.max(1, Math.floor(Number(body.days) || 14)));
      const code = b64(crypto.getRandomValues(new Uint8Array(12))).replace(/[+/=]/g, '').slice(0, 14);
      await env.DB.prepare('INSERT INTO invites(code,grp,max_uses,expires_at,created_by) VALUES(?,?,?,?,?)').bind(code, grp, max, Date.now() + days * 86400000, user.id).run();
      return json({ ok: true, code });
    }
    const iv = sub.match(/^invites\/(\d+)\/revoke$/);
    if (iv && method === 'POST') {
      await env.DB.prepare('UPDATE invites SET active=0 WHERE id=?').bind(Number(iv[1])).run();
      return json({ ok: true });
    }
    const m = sub.match(/^students\/(\d+)\/(profile|reset-password|reset-diagnostic|group)$/);
    if (m) {
      const sid = Number(m[1]);
      const stu = await env.DB.prepare("SELECT id,email,name,grp FROM users WHERE id=? AND role='student'").bind(sid).first();
      if (!stu) return err(404, 'Talaba topilmadi');
      if (m[2] === 'profile' && method === 'GET') return json({ student: stu, ...(await buildProfile(env, sid)) });
      if (m[2] === 'reset-password' && method === 'POST') {
        const p = String(body.password || '');
        if (p.length < 8 || p.length > 200) return err(400, 'Parol kamida 8 belgi');
        const salt = newSalt();
        await env.DB.prepare('UPDATE users SET pass_hash=?,salt=? WHERE id=?').bind(await hashPassword(p, salt), salt, sid).run();
        await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(sid).run();
        return json({ ok: true });
      }
      if (m[2] === 'reset-diagnostic' && method === 'POST') {
        const phase = body.phase === 'pre' || body.phase === 'post' ? body.phase : null;
        if (!phase) return err(400, 'phase: pre yoki post');
        await env.DB.prepare('DELETE FROM diagnostics WHERE user_id=? AND phase=?').bind(sid, phase).run();
        return json({ ok: true });
      }
      if (m[2] === 'group' && method === 'POST') {
        await env.DB.prepare('UPDATE users SET grp=? WHERE id=?').bind(clean(body.grp, 40), sid).run();
        return json({ ok: true });
      }
    }

    if (sub === 'grade' && method === 'POST') {
      const sid = Number(body.student_id), kind = String(body.kind || '');
      if (!TASKS[kind] || kind === 'essay') return err(400, 'Topshiriq turi noto‘g‘ri');
      const stu = await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='student'").bind(sid).first();
      if (!stu) return err(404, 'Talaba topilmadi');
      const sc = scoreItems(body.items, TASKS[kind]);
      if (!sc) return err(400, 'Mezonlarni to‘g‘ri belgilang');
      const topic = Number.isInteger(Number(body.topic)) && Number(body.topic) >= 1 && Number(body.topic) <= 30 ? Number(body.topic) : null;
      const id = await addAttempt(env, sid, kind, topic, body.items, sc, user.id);
      return json({ ok: true, id, ...sc });
    }

    if (sub === 'queue' && method === 'GET') {
      const r = await env.DB.prepare("SELECT e.id,e.topic,e.created_at,u.name,u.grp FROM essays e JOIN users u ON u.id=e.user_id WHERE e.status='submitted' ORDER BY e.id").all();
      return json({ queue: r.results });
    }
    const sg = sub.match(new RegExp('^essays/([0-9]+)/ai-suggest$'));
    if (sg && method === 'POST') {
      const row = await env.DB.prepare('SELECT id,topic,body FROM essays WHERE id=?').bind(Number(sg[1])).first();
      if (!row) return err(404, 'Esse topilmadi');
      return withAi(env, user, 'suggest', () => suggestRubric(env, row));
    }
    if (sub === 'ai/questions' && method === 'POST') {
      const n = Number(body.module), count = Math.min(5, Math.max(1, Math.floor(Number(body.count) || 3)));
      if (!Number.isInteger(n) || n < 1 || n > 30) return err(400, 'Modul raqami noto‘g‘ri');
      return withAi(env, user, 'qgen', async () => ({ questions: await draftQuestions(env, n, count) }));
    }
    const e = sub.match(/^essays\/(\d+)(\/grade)?$/);
    if (e) {
      const row = await env.DB.prepare('SELECT e.id,e.user_id,e.topic,e.body,e.status,e.created_at,u.name FROM essays e JOIN users u ON u.id=e.user_id WHERE e.id=?').bind(Number(e[1])).first();
      if (!row) return err(404, 'Esse topilmadi');
      if (!e[2] && method === 'GET') return json({ essay: row });
      if (e[2] && method === 'POST') {
        if (row.status === 'graded') return err(409, 'Esse allaqachon baholangan');
        const sc = scoreItems(body.items, TASKS.essay);
        if (!sc) return err(400, 'Mezonlarni to‘g‘ri belgilang');
        const aid = await addAttempt(env, row.user_id, 'essay', row.topic, body.items, sc, user.id);
        await env.DB.prepare("UPDATE essays SET status='graded',attempt_id=?,graded_at=CURRENT_TIMESTAMP WHERE id=?").bind(aid, row.id).run();
        return json({ ok: true, ...sc });
      }
    }

    if (sub === 'panel' && method === 'GET') {
      const us = await env.DB.prepare("SELECT id,name,grp FROM users WHERE role='student'").all();
      const profiles = [];
      for (const u of us.results) profiles.push({ ...u, ...(await buildProfile(env, u.id)) });
      const skillAvg = [0, 1, 2, 3, 4, 5].map((i) => { const v = profiles.map((p) => p.cur[i]).filter((x) => x !== null); return v.length ? Math.round(mean(v)) : null; });
      const ovs = profiles.map((p) => p.overall).filter((x) => x !== null);
      const dist = { 2: 0, 3: 0, 4: 0, 5: 0 };
      ovs.forEach((o) => dist[grade(o)]++);
      // Cohen's d: guruh bo'yicha (PRE va POST bor talabalar), diagnostik umumiy foiz
      const names = [...new Set(profiles.map((p) => p.grp || '(guruhsiz)'))];
      const research = names.map((name) => {
        const inG = profiles.filter((p) => (p.grp || '(guruhsiz)') === name);
        const paired = inG.filter((p) => p.diag.pre && p.diag.post);
        const pre = paired.map((p) => mean(p.diag.pre.scores)), post = paired.map((p) => mean(p.diag.post.scores));
        const n = paired.length;
        let d = null;
        if (n >= 2) { const sp = Math.sqrt((sd(pre) ** 2 + sd(post) ** 2) / 2); d = sp === 0 ? 0 : (mean(post) - mean(pre)) / sp; }
        return { group: name, students: inG.length, n, preMean: n ? mean(pre) : null, preSD: n ? sd(pre) : null, postMean: n ? mean(post) : null, postSD: n ? sd(post) : null, d };
      });
      const q = await env.DB.prepare("SELECT COUNT(*) n FROM essays WHERE status='submitted'").first();
      return json({ students: profiles.length, overall: ovs.length ? Math.round(mean(ovs)) : null, skillAvg, dist, research, queue: q.n });
    }
    return err(404, 'Topilmadi');
  }

  return err(404, 'Topilmadi');
}

export async function onRequest(context) {
  try {
    if (!context.env.DB) return err(500, 'Baza ulanmagan (D1 binding "DB" kerak)');
    return await route(context.request, context.env);
  } catch (e) {
    return err(500, 'Server xatosi');
  }
}
