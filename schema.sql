-- CritiRead D1 sxemasi. Cloudflare D1 konsolida yoki `wrangler d1 execute` bilan ishga tushiring.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher')),
  grp TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_fail (
  email TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_fail ON login_fail(email, ts);

-- Rubrika bo'yicha baholangan urinishlar (o'qituvchi yoki esse). items: {"0":"B","3":"A"} (mezon indeksi -> A/B/C/D)
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  topic INTEGER,
  items TEXT NOT NULL,
  pct INTEGER NOT NULL,
  grade INTEGER NOT NULL,
  graded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);

-- Modul mashqlari (bir marta javob beriladi)
CREATE TABLE IF NOT EXISTS quiz (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module INTEGER NOT NULL,
  choice INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, module)
);

-- PRE/POST diagnostika: faqat Δ va Cohen's d uchun, bahoga qo'shilmaydi
CREATE TABLE IF NOT EXISTS diagnostics (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('pre','post')),
  scores TEXT NOT NULL,
  right_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, phase)
);

CREATE TABLE IF NOT EXISTS essays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic INTEGER NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded')),
  attempt_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  graded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_essays_status ON essays(status);
