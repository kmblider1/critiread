const fs=require('fs');const p='functions/api/[[path]].js';let s=fs.readFileSync(p,'utf8');
function rep(a,b){if(!s.includes(a))throw new Error('topilmadi: '+a.slice(0,70));s=s.replace(a,b);}
rep("import { QUIZ, TEST } from '../_content.js';",
"import { QUIZ, TEST } from '../_content.js';\nimport { AiError, aiEnabled, suggestRubric, essayFeedback, draftQuestions, coachReply, cleanChat } from '../_ai.js';");
rep("// ---------- marshrutlar ----------",
`// ---------- AI kvotasi ----------
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

// ---------- marshrutlar ----------`);
rep("    return json({ essays: r.results });",
`    const fb = await env.DB.prepare('SELECT id,essay_id,body,created_at FROM essay_feedback WHERE user_id=? ORDER BY id').bind(user.id).all();
    return json({ essays: r.results.map((e) => ({ ...e, feedback: fb.results.filter((x) => x.essay_id === e.id) })) });`);
rep("  // --- profil, esse ---",
`  // --- AI (talaba) ---
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

  // --- profil, esse ---`);
{
  const marker = "    const e = sub.match(";
  const at = s.indexOf(marker);
  if (at < 0) throw new Error('marker topilmadi');
  const ins = `    const sg = sub.match(new RegExp('^essays/([0-9]+)/ai-suggest$'));
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
`;
  s = s.slice(0, at) + ins + s.slice(at);
}
fs.writeFileSync(p,s);console.log('patched');
