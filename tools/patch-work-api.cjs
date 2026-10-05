const fs=require('fs');const p='functions/api/[[path]].js';let s=fs.readFileSync(p,'utf8');
const marker="    const m = sub.match(";
const at=s.indexOf(marker);if(at<0)throw new Error('marker topilmadi');
const ins=`    if (sub === 'work' && method === 'GET') {
      const us = await env.DB.prepare("SELECT id,name,email,grp FROM users WHERE role='student' ORDER BY grp,name").all();
      const agg = async (sql) => (await env.DB.prepare(sql).all()).results;
      const by = (rows) => Object.fromEntries(rows.map((r) => [r.user_id, r]));
      const Q = by(await agg('SELECT user_id,COUNT(*) n,SUM(correct) c FROM quiz GROUP BY user_id'));
      const E = by(await agg("SELECT user_id,COUNT(*) n,SUM(CASE WHEN status='graded' THEN 1 ELSE 0 END) g FROM essays GROUP BY user_id"));
      const A = by(await agg('SELECT user_id,COUNT(*) n FROM attempts GROUP BY user_id'));
      const D = await agg('SELECT user_id,phase FROM diagnostics');
      const L = by(await agg('SELECT user_id,MAX(t) t FROM (SELECT user_id,created_at t FROM quiz UNION ALL SELECT user_id,created_at FROM essays UNION ALL SELECT user_id,created_at FROM attempts UNION ALL SELECT user_id,created_at FROM diagnostics) GROUP BY user_id'));
      return json({ students: us.results.map((u) => ({ ...u, quizDone: Q[u.id]?.n || 0, quizRight: Q[u.id]?.c || 0, essays: E[u.id]?.n || 0, essaysGraded: E[u.id]?.g || 0, graded: A[u.id]?.n || 0,
        pre: D.some((d) => d.user_id === u.id && d.phase === 'pre'), post: D.some((d) => d.user_id === u.id && d.phase === 'post'), last: L[u.id]?.t || null })) });
    }
    const wk = sub.match(new RegExp('^students/([0-9]+)/work$'));
    if (wk && method === 'GET') {
      const sid = Number(wk[1]);
      const stu = await env.DB.prepare("SELECT id,name,email,grp FROM users WHERE id=? AND role='student'").bind(sid).first();
      if (!stu) return err(404, 'Talaba topilmadi');
      const quiz = (await env.DB.prepare('SELECT module,choice,correct,created_at FROM quiz WHERE user_id=? ORDER BY created_at').bind(sid).all()).results;
      const essays = (await env.DB.prepare('SELECT e.id,e.topic,e.body,e.status,e.created_at,e.graded_at,a.pct,a.grade,a.items FROM essays e LEFT JOIN attempts a ON a.id=e.attempt_id WHERE e.user_id=? ORDER BY e.id DESC').bind(sid).all()).results;
      const fb = (await env.DB.prepare('SELECT essay_id,body,created_at FROM essay_feedback WHERE user_id=? ORDER BY id').bind(sid).all()).results;
      const prof = await buildProfile(env, sid);
      return json({ student: stu, quiz: quiz.map((q) => ({ ...q, right: QUIZ[q.module] ? QUIZ[q.module].a : null })), essays: essays.map((e) => ({ ...e, feedback: fb.filter((x) => x.essay_id === e.id) })), attempts: prof.attempts, diag: prof.diag, cur: prof.cur, overall: prof.overall, grade: prof.grade });
    }
`;
s=s.slice(0,at)+ins+s.slice(at);fs.writeFileSync(p,s);console.log('api patched');
