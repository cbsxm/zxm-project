import http from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { wordBanks as baseWordBanks } from "./word-banks.mjs";
import { studyGoals as baseStudyGoals } from "./study-goals.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDemo = process.env.PUBLIC_DEMO === "1";
const port = Number(process.env.PORT || 5178);
const host = process.env.HOST || (publicDemo ? "0.0.0.0" : "127.0.0.1");
const dataDir = process.env.DATA_DIR || join(root, publicDemo ? "demo-data" : "data");
const dbPath = join(dataDir, "english-study.sqlite");
const sessionCookieName = "english_study_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const cookieSecure = process.env.COOKIE_SECURE === "1";
const authRateLimitPerMinute = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE || 20);
const legacyUserId = "local-legacy-user";
const demoUserId = "public-demo-user";
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

const taskMeta = [
  { id: "words", title: "背新词" },
  { id: "review", title: "复习旧词" },
  { id: "listening", title: "听力 15 分钟" },
  { id: "shadowing", title: "跟读 10 分钟" },
  { id: "writing", title: "英文输出" },
];

const taskIds = new Set(taskMeta.map((task) => task.id));
const difficulties = new Set(["easy", "medium", "hard"]);
const reviewResults = new Set(["known", "fuzzy", "unknown"]);
const reviewIntervals = [1, 3, 7, 14, 30];
const customBank = {
  id: "custom",
  name: "我的自定义词库",
  level: "自建",
  description: "把课堂、生活或听力里遇到的新词先存到这里，再分批加入复习。",
  words: [],
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    text TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    phrase TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    definition TEXT NOT NULL DEFAULT '',
    my_sentence TEXT NOT NULL DEFAULT '',
    bank_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'learning',
    review_stage INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, normalized_text),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS listening (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    minutes INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS journals (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_logs (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    task_id TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, date, task_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bank_words (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    text TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    phrase TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    definition TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, bank_id, normalized_text),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS review_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    result TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS writing_feedback (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    engine TEXT NOT NULL,
    score INTEGER NOT NULL,
    summary TEXT NOT NULL,
    strengths_json TEXT NOT NULL,
    fixes_json TEXT NOT NULL,
    suggested_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id, date) REFERENCES journals(user_id, date) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS speaking_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    practice_type TEXT NOT NULL,
    target_text TEXT NOT NULL,
    transcript TEXT NOT NULL DEFAULT '',
    score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function createPasswordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(String(password), salt, 64).toString("hex");
  return { passwordHash, salt };
}

function ensureSystemUser(id, email, displayName, isDemo = false) {
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (existing) return;

  const { passwordHash, salt } = createPasswordRecord(randomUUID());
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, display_name, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, passwordHash, salt, displayName, isDemo ? 1 : 0, new Date().toISOString());
}

function tableSql(tableName) {
  return (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)?.sql || ""
  );
}

function tableColumns(tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
}

function scopedUserExpr(columns) {
  return columns.has("user_id")
    ? "COALESCE((SELECT users.id FROM users WHERE users.id = legacy.user_id), ?)"
    : "?";
}

function legacyColumn(columns, name, fallbackSql) {
  return columns.has(name) ? `legacy.${name}` : fallbackSql;
}

function migrateTableIfNeeded(tableName, isCurrent, createSql, copyFactory) {
  const sql = tableSql(tableName);
  if (!sql || isCurrent(sql)) return;

  const legacyName = `${tableName}_legacy_migration`;
  const columns = tableColumns(tableName);
  db.exec("BEGIN");
  db.exec("PRAGMA defer_foreign_keys = ON");
  try {
    db.exec(`DROP TABLE IF EXISTS ${legacyName}`);
    db.exec(`ALTER TABLE ${tableName} RENAME TO ${legacyName}`);
    db.exec(createSql);
    const copy = copyFactory(legacyName, columns);
    db.prepare(copy.sql).run(...copy.params);
    db.exec(`DROP TABLE ${legacyName}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrateStudyTables() {
  migrateTableIfNeeded(
    "words",
    (sql) => /\buser_id\b/i.test(sql) && /UNIQUE\s*\(\s*user_id\s*,\s*normalized_text\s*\)/i.test(sql),
    `CREATE TABLE words (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      text TEXT NOT NULL,
      meaning TEXT NOT NULL DEFAULT '',
      phrase TEXT NOT NULL DEFAULT '',
      example TEXT NOT NULL DEFAULT '',
      definition TEXT NOT NULL DEFAULT '',
      my_sentence TEXT NOT NULL DEFAULT '',
      bank_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'learning',
      review_stage INTEGER NOT NULL DEFAULT 0,
      next_review_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, normalized_text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (legacyName, columns) => {
      const textExpr = legacyColumn(columns, "text", "''");
      return {
        sql: `INSERT OR IGNORE INTO words (
          id, user_id, normalized_text, text, meaning, phrase, example, definition,
          my_sentence, bank_id, status, review_stage, next_review_at, created_at
        )
        SELECT
          ${legacyColumn(columns, "id", "lower(hex(randomblob(16)))")},
          ${scopedUserExpr(columns)},
          ${legacyColumn(columns, "normalized_text", `lower(trim(${textExpr}))`)},
          ${textExpr},
          ${legacyColumn(columns, "meaning", "''")},
          ${legacyColumn(columns, "phrase", "''")},
          ${legacyColumn(columns, "example", "''")},
          ${legacyColumn(columns, "definition", "''")},
          ${legacyColumn(columns, "my_sentence", "''")},
          ${legacyColumn(columns, "bank_id", "''")},
          ${legacyColumn(columns, "status", "'learning'")},
          ${legacyColumn(columns, "review_stage", "0")},
          ${legacyColumn(columns, "next_review_at", "date('now')")},
          ${legacyColumn(columns, "created_at", "date('now')")}
        FROM ${legacyName} AS legacy
        WHERE trim(${textExpr}) <> ''`,
        params: [legacyUserId],
      };
    }
  );

  migrateTableIfNeeded(
    "listening",
    (sql) => /\buser_id\b/i.test(sql),
    `CREATE TABLE listening (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      minutes INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (legacyName, columns) => ({
      sql: `INSERT OR IGNORE INTO listening (
        id, user_id, title, url, minutes, difficulty, note, created_at
      )
      SELECT
        ${legacyColumn(columns, "id", "lower(hex(randomblob(16)))")},
        ${scopedUserExpr(columns)},
        ${legacyColumn(columns, "title", "'Listening practice'")},
        ${legacyColumn(columns, "url", "''")},
        ${legacyColumn(columns, "minutes", "15")},
        ${legacyColumn(columns, "difficulty", "'medium'")},
        ${legacyColumn(columns, "note", "''")},
        ${legacyColumn(columns, "created_at", "date('now')")}
      FROM ${legacyName} AS legacy`,
      params: [legacyUserId],
    })
  );

  migrateTableIfNeeded(
    "journals",
    (sql) => /\buser_id\b/i.test(sql) && /PRIMARY KEY\s*\(\s*user_id\s*,\s*date\s*\)/i.test(sql),
    `CREATE TABLE journals (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (legacyName, columns) => ({
      sql: `INSERT OR REPLACE INTO journals (user_id, date, content, updated_at)
      SELECT
        ${scopedUserExpr(columns)},
        ${legacyColumn(columns, "date", "date('now')")},
        ${legacyColumn(columns, "content", "''")},
        ${legacyColumn(columns, "updated_at", "datetime('now')")}
      FROM ${legacyName} AS legacy
      WHERE trim(${legacyColumn(columns, "content", "''")}) <> ''`,
      params: [legacyUserId],
    })
  );

  migrateTableIfNeeded(
    "task_logs",
    (sql) => /\buser_id\b/i.test(sql) && /PRIMARY KEY\s*\(\s*user_id\s*,\s*date\s*,\s*task_id\s*\)/i.test(sql),
    `CREATE TABLE task_logs (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      task_id TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, date, task_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (legacyName, columns) => ({
      sql: `INSERT OR REPLACE INTO task_logs (user_id, date, task_id, done)
      SELECT
        ${scopedUserExpr(columns)},
        ${legacyColumn(columns, "date", "date('now')")},
        ${legacyColumn(columns, "task_id", "''")},
        ${legacyColumn(columns, "done", "1")}
      FROM ${legacyName} AS legacy
      WHERE trim(${legacyColumn(columns, "task_id", "''")}) <> ''`,
      params: [legacyUserId],
    })
  );

  migrateTableIfNeeded(
    "bank_words",
    (sql) => /\buser_id\b/i.test(sql) && /UNIQUE\s*\(\s*user_id\s*,\s*bank_id\s*,\s*normalized_text\s*\)/i.test(sql),
    `CREATE TABLE bank_words (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      text TEXT NOT NULL,
      meaning TEXT NOT NULL DEFAULT '',
      phrase TEXT NOT NULL DEFAULT '',
      example TEXT NOT NULL DEFAULT '',
      definition TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, bank_id, normalized_text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (legacyName, columns) => {
      const textExpr = legacyColumn(columns, "text", "''");
      return {
        sql: `INSERT OR IGNORE INTO bank_words (
          id, user_id, bank_id, normalized_text, text, meaning, phrase, example, definition, created_at, updated_at
        )
        SELECT
          ${legacyColumn(columns, "id", "lower(hex(randomblob(16)))")},
          ${scopedUserExpr(columns)},
          ${legacyColumn(columns, "bank_id", "'custom'")},
          ${legacyColumn(columns, "normalized_text", `lower(trim(${textExpr}))`)},
          ${textExpr},
          ${legacyColumn(columns, "meaning", "''")},
          ${legacyColumn(columns, "phrase", "''")},
          ${legacyColumn(columns, "example", "''")},
          ${legacyColumn(columns, "definition", "''")},
          ${legacyColumn(columns, "created_at", "date('now')")},
          ${legacyColumn(columns, "updated_at", "datetime('now')")}
        FROM ${legacyName} AS legacy
        WHERE trim(${textExpr}) <> ''`,
        params: [legacyUserId],
      };
    }
  );
}

ensureSystemUser(legacyUserId, "local@english-study.local", "Local Study", false);
ensureSystemUser(demoUserId, "demo@english-study.local", "Demo Account", true);
migrateStudyTables();

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_words_user_next_review_at ON words(user_id, next_review_at);
  CREATE INDEX IF NOT EXISTS idx_listening_user_created_at ON listening(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_bank_words_user_bank_id ON bank_words(user_id, bank_id);
  CREATE INDEX IF NOT EXISTS idx_review_events_user_date ON review_events(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_review_events_user_word ON review_events(user_id, word_id);
  CREATE INDEX IF NOT EXISTS idx_writing_feedback_user_date ON writing_feedback(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_speaking_attempts_user_date ON speaking_attempts(user_id, date);
`);

const statements = {
  userByEmail: db.prepare(`
    SELECT id, email, password_hash, salt, display_name, is_demo, created_at
    FROM users
    WHERE email = ?
  `),
  userById: db.prepare(`
    SELECT id, email, display_name, is_demo, created_at
    FROM users
    WHERE id = ?
  `),
  countRealUsers: db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_demo = 0 AND id <> ?"),
  insertUser: db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, display_name, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `),
  insertSession: db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `),
  sessionUser: db.prepare(`
    SELECT users.id, users.email, users.display_name, users.is_demo, users.created_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `),
  deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
  deleteExpiredSessions: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  allWords: db.prepare(`
    SELECT id, text, meaning, phrase, example, definition, my_sentence, bank_id,
           status, review_stage, next_review_at, created_at
    FROM words
    WHERE user_id = ?
    ORDER BY created_at DESC, rowid DESC
  `),
  dueWords: db.prepare(`
    SELECT id, text, meaning, phrase, example, definition, my_sentence, bank_id,
           status, review_stage, next_review_at, created_at
    FROM words
    WHERE user_id = ? AND next_review_at <= ?
    ORDER BY next_review_at ASC, rowid ASC
  `),
  wordById: db.prepare(`
    SELECT id, text, meaning, phrase, example, definition, my_sentence, bank_id,
           status, review_stage, next_review_at, created_at
    FROM words
    WHERE user_id = ? AND id = ?
  `),
  wordTexts: db.prepare("SELECT normalized_text FROM words WHERE user_id = ?"),
  insertWord: db.prepare(`
    INSERT OR IGNORE INTO words (
      id, user_id, normalized_text, text, meaning, phrase, example, definition,
      my_sentence, bank_id, status, review_stage, next_review_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateWordReview: db.prepare(`
    UPDATE words
    SET status = ?, review_stage = ?, next_review_at = ?
    WHERE user_id = ? AND id = ?
  `),
  insertReviewEvent: db.prepare(`
    INSERT INTO review_events (id, user_id, word_id, result, reviewed_at, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  allReviewEvents: db.prepare(`
    SELECT word_id, result, reviewed_at, date
    FROM review_events
    WHERE user_id = ?
    ORDER BY reviewed_at DESC
  `),
  troubleWords: db.prepare(`
    SELECT
      words.id,
      words.text,
      words.meaning,
      words.phrase,
      words.example,
      words.definition,
      words.my_sentence,
      words.bank_id,
      words.status,
      words.review_stage,
      words.next_review_at,
      words.created_at,
      SUM(CASE WHEN review_events.result = 'unknown' THEN 1 ELSE 0 END) AS unknown_count,
      SUM(CASE WHEN review_events.result = 'fuzzy' THEN 1 ELSE 0 END) AS fuzzy_count,
      COUNT(*) AS total_reviews,
      MAX(review_events.reviewed_at) AS last_reviewed_at
    FROM review_events
    JOIN words ON words.id = review_events.word_id AND words.user_id = review_events.user_id
    WHERE review_events.user_id = ? AND review_events.result IN ('fuzzy', 'unknown')
    GROUP BY words.id
    ORDER BY (unknown_count * 2 + fuzzy_count) DESC, last_reviewed_at DESC
    LIMIT 12
  `),
  updateWord: db.prepare(`
    UPDATE words
    SET
      normalized_text = ?,
      text = ?,
      meaning = ?,
      phrase = ?,
      example = ?,
      definition = ?,
      my_sentence = ?,
      bank_id = ?,
      status = ?,
      review_stage = ?,
      next_review_at = ?
    WHERE user_id = ? AND id = ?
  `),
  deleteWord: db.prepare("DELETE FROM words WHERE user_id = ? AND id = ?"),
  wordDuplicate: db.prepare(`
    SELECT id
    FROM words
    WHERE user_id = ? AND normalized_text = ? AND id <> ?
  `),
  allListening: db.prepare(`
    SELECT id, title, url, minutes, difficulty, note, created_at
    FROM listening
    WHERE user_id = ?
    ORDER BY created_at DESC, rowid DESC
  `),
  insertListening: db.prepare(`
    INSERT INTO listening (id, user_id, title, url, minutes, difficulty, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  allSpeakingAttempts: db.prepare(`
    SELECT id, practice_type, target_text, transcript, score, created_at, date
    FROM speaking_attempts
    WHERE user_id = ?
    ORDER BY created_at DESC
  `),
  insertSpeakingAttempt: db.prepare(`
    INSERT INTO speaking_attempts (
      id, user_id, practice_type, target_text, transcript, score, created_at, date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  allJournals: db.prepare("SELECT date, content FROM journals WHERE user_id = ? ORDER BY date DESC"),
  todayJournal: db.prepare("SELECT date, content FROM journals WHERE user_id = ? AND date = ?"),
  upsertJournal: db.prepare(`
    INSERT INTO journals (user_id, date, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `),
  deleteJournal: db.prepare("DELETE FROM journals WHERE user_id = ? AND date = ?"),
  allWritingFeedback: db.prepare(`
    SELECT date, engine, score, summary, strengths_json, fixes_json, suggested_text, created_at
    FROM writing_feedback
    WHERE user_id = ?
    ORDER BY date DESC
  `),
  todayWritingFeedback: db.prepare(`
    SELECT date, engine, score, summary, strengths_json, fixes_json, suggested_text, created_at
    FROM writing_feedback
    WHERE user_id = ? AND date = ?
  `),
  upsertWritingFeedback: db.prepare(`
    INSERT INTO writing_feedback (
      user_id, date, engine, score, summary, strengths_json, fixes_json, suggested_text, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      engine = excluded.engine,
      score = excluded.score,
      summary = excluded.summary,
      strengths_json = excluded.strengths_json,
      fixes_json = excluded.fixes_json,
      suggested_text = excluded.suggested_text,
      created_at = excluded.created_at
  `),
  deleteWritingFeedback: db.prepare("DELETE FROM writing_feedback WHERE user_id = ? AND date = ?"),
  allTasks: db.prepare("SELECT date, task_id, done FROM task_logs WHERE user_id = ? AND done = 1 ORDER BY date DESC"),
  allBankWords: db.prepare(`
    SELECT id, bank_id, normalized_text, text, meaning, phrase, example, definition, created_at, updated_at
    FROM bank_words
    WHERE user_id = ?
    ORDER BY bank_id ASC, created_at DESC, rowid DESC
  `),
  upsertBankWord: db.prepare(`
    INSERT INTO bank_words (
      id, user_id, bank_id, normalized_text, text, meaning, phrase, example, definition, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, bank_id, normalized_text) DO UPDATE SET
      text = excluded.text,
      meaning = excluded.meaning,
      phrase = excluded.phrase,
      example = excluded.example,
      definition = excluded.definition,
      updated_at = excluded.updated_at
  `),
  updateImportedWordsFromBank: db.prepare(`
    UPDATE words
    SET text = ?, meaning = ?, phrase = ?, example = ?, definition = ?
    WHERE user_id = ? AND normalized_text = ? AND (bank_id = ? OR bank_id = '')
  `),
  upsertTask: db.prepare(`
    INSERT INTO task_logs (user_id, date, task_id, done)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, date, task_id) DO UPDATE SET done = 1
  `),
  deleteTask: db.prepare("DELETE FROM task_logs WHERE user_id = ? AND date = ? AND task_id = ?"),
  clearWords: db.prepare("DELETE FROM words WHERE user_id = ?"),
  clearListening: db.prepare("DELETE FROM listening WHERE user_id = ?"),
  clearJournals: db.prepare("DELETE FROM journals WHERE user_id = ?"),
  clearTasks: db.prepare("DELETE FROM task_logs WHERE user_id = ?"),
  clearReviewEvents: db.prepare("DELETE FROM review_events WHERE user_id = ?"),
  clearWritingFeedback: db.prepare("DELETE FROM writing_feedback WHERE user_id = ?"),
  clearSpeakingAttempts: db.prepare("DELETE FROM speaking_attempts WHERE user_id = ?"),
  transferWords: db.prepare("UPDATE words SET user_id = ? WHERE user_id = ?"),
  transferListening: db.prepare("UPDATE listening SET user_id = ? WHERE user_id = ?"),
  transferJournals: db.prepare("UPDATE journals SET user_id = ? WHERE user_id = ?"),
  transferTasks: db.prepare("UPDATE task_logs SET user_id = ? WHERE user_id = ?"),
  transferBankWords: db.prepare("UPDATE bank_words SET user_id = ? WHERE user_id = ?"),
  transferReviewEvents: db.prepare("UPDATE review_events SET user_id = ? WHERE user_id = ?"),
  transferWritingFeedback: db.prepare("UPDATE writing_feedback SET user_id = ? WHERE user_id = ?"),
  transferSpeakingAttempts: db.prepare("UPDATE speaking_attempts SET user_id = ? WHERE user_id = ?"),
  countWords: db.prepare("SELECT COUNT(*) AS count FROM words WHERE user_id = ?"),
  countListening: db.prepare("SELECT COUNT(*) AS count FROM listening WHERE user_id = ?"),
  countJournals: db.prepare("SELECT COUNT(*) AS count FROM journals WHERE user_id = ?"),
  countTasks: db.prepare("SELECT COUNT(*) AS count FROM task_logs WHERE user_id = ? AND done = 1"),
};

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function nowDate() {
  return toDateKey(new Date());
}

function addDays(dateString, days) {
  const date = parseDateKey(dateString);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeWord(value) {
  return cleanText(value).toLowerCase();
}

function idValue(value) {
  const cleaned = cleanText(value);
  return cleaned || randomUUID();
}

function rowToWord(row) {
  return {
    id: row.id,
    text: row.text,
    meaning: row.meaning,
    phrase: row.phrase,
    example: row.example,
    definition: row.definition,
    mySentence: row.my_sentence,
    bankId: row.bank_id,
    status: row.status,
    reviewStage: Number(row.review_stage || 0),
    nextReviewAt: row.next_review_at,
    createdAt: row.created_at,
  };
}

function rowToListening(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    minutes: Number(row.minutes || 0),
    difficulty: row.difficulty,
    note: row.note,
    createdAt: row.created_at,
  };
}

function rowToSpeakingAttempt(row) {
  return {
    id: row.id,
    practiceType: row.practice_type,
    targetText: row.target_text,
    transcript: row.transcript,
    score: Number(row.score || 0),
    createdAt: row.created_at,
    date: row.date,
  };
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToWritingFeedback(row) {
  if (!row) return null;
  return {
    date: row.date,
    engine: row.engine,
    score: Number(row.score || 0),
    summary: row.summary,
    strengths: parseJsonArray(row.strengths_json),
    fixes: parseJsonArray(row.fixes_json),
    suggestedText: row.suggested_text,
    createdAt: row.created_at,
  };
}

function rowToBankWord(row) {
  return {
    id: row.id,
    text: row.text,
    meaning: row.meaning,
    phrase: row.phrase,
    example: row.example,
    definition: row.definition,
    bankId: row.bank_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    editable: true,
  };
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
  };
}

function getWordBanks(userId) {
  const banks = [
    ...baseWordBanks.map((bank) => ({ ...bank, words: [...bank.words] })),
    { ...customBank, words: [] },
  ];
  const bankMap = new Map(banks.map((bank) => [bank.id, bank]));

  if (!userId) return banks;

  for (const row of statements.allBankWords.all(userId)) {
    if (!bankMap.has(row.bank_id)) continue;

    const bank = bankMap.get(row.bank_id);
    const customWord = rowToBankWord(row);
    const existingIndex = bank.words.findIndex(
      (word) => normalizeWord(word.text) === row.normalized_text
    );

    if (existingIndex >= 0) {
      bank.words[existingIndex] = {
        ...bank.words[existingIndex],
        ...customWord,
      };
    } else {
      bank.words.unshift(customWord);
    }
  }

  return banks;
}

function getStudyGoals(userId) {
  const existing = userId ? getExistingWordTexts(userId) : new Set();
  return baseStudyGoals.map((goal) => {
    const bankId = `goal-${goal.id}`;
    const words = goal.words.map((word) => ({ ...word, bankId }));
    const imported = words.filter((word) => existing.has(normalizeWord(word.text))).length;
    return {
      id: goal.id,
      bankId,
      name: goal.name,
      level: goal.level,
      description: goal.description,
      words,
      total: words.length,
      imported,
      remaining: words.length - imported,
    };
  });
}

function getJournals(userId) {
  if (!userId) return {};
  return Object.fromEntries(statements.allJournals.all(userId).map((row) => [row.date, row.content]));
}

function getWritingFeedback(userId) {
  if (!userId) return {};
  return Object.fromEntries(
    statements.allWritingFeedback.all(userId).map((row) => [row.date, rowToWritingFeedback(row)])
  );
}

function getLogs(userId) {
  const logs = {};
  if (!userId) {
    logs[nowDate()] = { tasks: {} };
    return logs;
  }
  for (const row of statements.allTasks.all(userId)) {
    logs[row.date] ??= { tasks: {} };
    logs[row.date].tasks[row.task_id] = Boolean(row.done);
  }
  logs[nowDate()] ??= { tasks: {} };
  return logs;
}

function getWords(userId) {
  if (!userId) return [];
  return statements.allWords.all(userId).map(rowToWord);
}

function getDueWords(userId) {
  if (!userId) return [];
  return statements.dueWords.all(userId, nowDate()).map(rowToWord);
}

function getListening(userId) {
  if (!userId) return [];
  return statements.allListening.all(userId).map(rowToListening);
}

function getSpeakingAttempts(userId) {
  if (!userId) return [];
  return statements.allSpeakingAttempts.all(userId).map(rowToSpeakingAttempt);
}

function getReviewEvents(userId) {
  if (!userId) return [];
  return statements.allReviewEvents.all(userId).map((row) => ({
    wordId: row.word_id,
    result: row.result,
    reviewedAt: row.reviewed_at,
    date: row.date,
  }));
}

function getState(userId) {
  return {
    words: getWords(userId),
    listening: getListening(userId),
    speakingAttempts: getSpeakingAttempts(userId),
    journals: getJournals(userId),
    writingFeedback: getWritingFeedback(userId),
    logs: getLogs(userId),
  };
}

function hasStudyData(userId) {
  if (!userId) return false;
  return (
    statements.countWords.get(userId).count > 0 ||
    statements.countListening.get(userId).count > 0 ||
    statements.countJournals.get(userId).count > 0 ||
    statements.countTasks.get(userId).count > 0
  );
}

function hasRealAccounts() {
  return statements.countRealUsers.get(legacyUserId).count > 0;
}

function transferStudyData(fromUserId, toUserId) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  db.exec("BEGIN");
  db.exec("PRAGMA defer_foreign_keys = ON");
  try {
    statements.transferWords.run(toUserId, fromUserId);
    statements.transferListening.run(toUserId, fromUserId);
    statements.transferJournals.run(toUserId, fromUserId);
    statements.transferTasks.run(toUserId, fromUserId);
    statements.transferBankWords.run(toUserId, fromUserId);
    statements.transferReviewEvents.run(toUserId, fromUserId);
    statements.transferWritingFeedback.run(toUserId, fromUserId);
    statements.transferSpeakingAttempts.run(toUserId, fromUserId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function getOverview(userId) {
  const state = getState(userId);
  const totalMinutes = state.listening.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const knownWords = state.words.filter((word) => word.status === "known").length;
  const speakingScores = state.speakingAttempts.map((item) => Number(item.score || 0)).filter((score) => score > 0);
  const averageSpeakingScore = speakingScores.length
    ? Math.round(speakingScores.reduce((sum, score) => sum + score, 0) / speakingScores.length)
    : 0;
  return {
    totalWords: state.words.length,
    knownWords,
    totalMinutes,
    totalJournals: Object.keys(state.journals).length,
    totalSpeakingAttempts: state.speakingAttempts.length,
    averageSpeakingScore,
    dueWords: getDueWords(userId).length,
    streakDays: calculateStreak(state.logs),
  };
}

function getTroubleWords(userId) {
  if (!userId) return [];

  return statements.troubleWords.all(userId).map((row) => ({
    ...rowToWord(row),
    unknownCount: Number(row.unknown_count || 0),
    fuzzyCount: Number(row.fuzzy_count || 0),
    totalReviews: Number(row.total_reviews || 0),
    lastReviewedAt: row.last_reviewed_at,
    troubleScore: Number(row.unknown_count || 0) * 2 + Number(row.fuzzy_count || 0),
  }));
}

function getDailyPlan(userId) {
  const dueCount = getDueWords(userId).length;
  const totalWords = getWords(userId).length;
  const troubleWords = getTroubleWords(userId);
  const todayTasks = getLogs(userId)[nowDate()]?.tasks || {};
  const finishedTasks = taskMeta.filter((task) => todayTasks[task.id]).length;
  const newWords = dueCount > 25 ? 0 : dueCount > 12 ? 5 : 10;
  const reviewWords = Math.min(Math.max(dueCount, troubleWords.length ? 8 : 5), 30);
  const focusWord = troubleWords[0]?.text || "";

  return {
    reviewWords,
    newWords,
    listeningMinutes: 15,
    writingSentences: 3,
    finishedTasks,
    totalWords,
    dueWords: dueCount,
    focus: focusWord
      ? `先复习高频错词 ${focusWord}`
      : dueCount
        ? "先完成今天到期复习"
        : totalWords
          ? "加入少量新词，再做英文输出"
          : "先从英国留学词库加入 10 个词",
    reason:
      dueCount > 25
        ? "今天到期词较多，先暂停新词，保护复习质量。"
        : troubleWords.length
          ? "最近有模糊或不认识的记录，优先把易忘词捡回来。"
          : "当前压力不高，可以用少量新词配合听力和输出。",
  };
}

function getInsights(userId) {
  return {
    dailyPlan: getDailyPlan(userId),
    troubleWords: getTroubleWords(userId),
  };
}

function calculateStreak(logs) {
  let count = 0;
  const cursor = parseDateKey(nowDate());

  while (count < 366) {
    const key = toDateKey(cursor);
    const tasks = logs[key]?.tasks || {};
    if (!Object.values(tasks).some(Boolean)) break;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

function getBootstrap(user) {
  const userId = user?.id;
  return {
    publicDemo,
    authenticated: Boolean(user),
    user: rowToUser(user),
    wordBanks: getWordBanks(userId),
    studyGoals: getStudyGoals(userId),
    state: getState(userId),
    hasStudyData: hasStudyData(userId),
    progress: getOverview(userId),
    insights: getInsights(userId),
  };
}

function getBankById(userId, bankId) {
  return getWordBanks(userId).find((bank) => bank.id === bankId);
}

function getExistingWordTexts(userId) {
  return new Set(statements.wordTexts.all(userId).map((row) => row.normalized_text));
}

function insertWord(userId, word) {
  const today = nowDate();
  const text = cleanText(word.text);
  const normalized = normalizeWord(text);
  if (!userId || !normalized) return;

  statements.insertWord.run(
    idValue(word.id),
    userId,
    normalized,
    text,
    cleanText(word.meaning),
    cleanText(word.phrase),
    cleanText(word.example),
    cleanText(word.definition, "a useful English word for study and daily life"),
    cleanText(word.mySentence),
    cleanText(word.bankId),
    word.status === "known" ? "known" : "learning",
    Number.isFinite(Number(word.reviewStage)) ? Number(word.reviewStage) : 0,
    isDateKey(word.nextReviewAt) ? word.nextReviewAt : today,
    isDateKey(word.createdAt) ? word.createdAt : today
  );
}

function setTaskDone(userId, taskId, done, date = nowDate()) {
  if (!userId) {
    throw httpError(401, "Please log in first");
  }
  if (!taskIds.has(taskId)) {
    throw httpError(400, "Unknown task id");
  }
  if (!isDateKey(date)) {
    throw httpError(400, "Invalid date");
  }
  if (done) {
    statements.upsertTask.run(userId, date, taskId);
  } else {
    statements.deleteTask.run(userId, date, taskId);
  }
}

function importBankWords(userId, bankId) {
  const bank = getBankById(userId, bankId);
  if (!bank) {
    throw httpError(404, "Word bank not found");
  }

  const today = nowDate();
  const existing = getExistingWordTexts(userId);
  const wordsToAdd = bank.words
    .filter((word) => !existing.has(normalizeWord(word.text)))
    .slice(0, 10);

  for (const word of wordsToAdd) {
    insertWord(userId, {
      ...word,
      id: randomUUID(),
      mySentence: "",
      bankId: bank.id,
      status: "learning",
      reviewStage: 0,
      nextReviewAt: today,
      createdAt: today,
    });
  }

  if (wordsToAdd.length) {
    setTaskDone(userId, "words", true);
  }
}

function importStudyGoalWords(userId, goalId) {
  const goal = getStudyGoals(userId).find((item) => item.id === goalId);
  if (!goal) {
    throw httpError(404, "Study goal not found");
  }

  const today = nowDate();
  const existing = getExistingWordTexts(userId);
  const wordsToAdd = goal.words
    .filter((word) => !existing.has(normalizeWord(word.text)))
    .slice(0, 10);

  for (const word of wordsToAdd) {
    insertWord(userId, {
      ...word,
      id: randomUUID(),
      mySentence: "",
      bankId: goal.bankId,
      status: "learning",
      reviewStage: 0,
      nextReviewAt: today,
      createdAt: today,
    });
  }

  if (wordsToAdd.length) {
    setTaskDone(userId, "words", true);
  }
}

function saveBankWord(userId, bankId, payload) {
  const bank = getBankById(userId, bankId);
  if (!bank) {
    throw httpError(404, "Word bank not found");
  }

  const text = cleanText(payload.text);
  const normalized = normalizeWord(text);
  const meaning = cleanText(payload.meaning);
  const phrase = cleanText(payload.phrase);
  const example = cleanText(payload.example);
  const definition = cleanText(payload.definition, "a useful English word for study and daily life");

  if (!text) throw httpError(400, "Word is required");
  if (!meaning) throw httpError(400, "Meaning is required");

  const now = new Date().toISOString();
  statements.upsertBankWord.run(
    randomUUID(),
    userId,
    bankId,
    normalized,
    text,
    meaning,
    phrase,
    example,
    definition,
    nowDate(),
    now
  );

  statements.updateImportedWordsFromBank.run(
    text,
    meaning,
    phrase,
    example,
    definition,
    userId,
    normalized,
    bankId
  );
}

function saveWord(userId, wordId, payload) {
  const current = statements.wordById.get(userId, wordId);
  if (!current) {
    throw httpError(404, "Word not found");
  }

  const text = cleanText(payload.text ?? current.text);
  const normalized = normalizeWord(text);
  const meaning = cleanText(payload.meaning ?? current.meaning);
  const status = payload.status === "known" ? "known" : "learning";
  const reviewStage = Number.isFinite(Number(payload.reviewStage))
    ? Math.max(0, Math.min(Number(payload.reviewStage), reviewIntervals.length - 1))
    : Number(current.review_stage || 0);
  const nextReviewAt = isDateKey(payload.nextReviewAt) ? payload.nextReviewAt : current.next_review_at;

  if (!text) throw httpError(400, "Word is required");
  if (!meaning) throw httpError(400, "Meaning is required");
  if (statements.wordDuplicate.get(userId, normalized, wordId)) {
    throw httpError(409, "This word already exists");
  }

  statements.updateWord.run(
    normalized,
    text,
    meaning,
    cleanText(payload.phrase ?? current.phrase),
    cleanText(payload.example ?? current.example),
    cleanText(payload.definition ?? current.definition, "a useful English word for study and daily life"),
    cleanText(payload.mySentence ?? current.my_sentence),
    cleanText(payload.bankId ?? current.bank_id),
    status,
    reviewStage,
    nextReviewAt,
    userId,
    wordId
  );
}

function deleteWord(userId, wordId) {
  const result = statements.deleteWord.run(userId, wordId);
  if (!result.changes) {
    throw httpError(404, "Word not found");
  }
}

function reviewWord(userId, wordId, result) {
  if (!reviewResults.has(result)) {
    throw httpError(400, "Invalid review result");
  }

  const word = statements.wordById.get(userId, wordId);
  if (!word) {
    throw httpError(404, "Word not found");
  }

  let reviewStage = Number(word.review_stage || 0);
  let status = "learning";
  let nextReviewAt = addDays(nowDate(), 1);

  if (result === "known") {
    reviewStage = Math.min(reviewStage + 1, reviewIntervals.length - 1);
    status = reviewStage >= 4 ? "known" : "learning";
    nextReviewAt = addDays(nowDate(), reviewIntervals[reviewStage]);
  }

  if (result === "fuzzy") {
    reviewStage = Math.max(reviewStage, 1);
  }

  if (result === "unknown") {
    reviewStage = 0;
  }

  db.exec("BEGIN");
  try {
    const reviewedAt = new Date().toISOString();
    statements.insertReviewEvent.run(randomUUID(), userId, wordId, result, reviewedAt, nowDate());
    statements.updateWordReview.run(status, reviewStage, nextReviewAt, userId, wordId);
    setTaskDone(userId, "review", true);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function saveListening(userId, payload) {
  const title = cleanText(payload.title);
  const url = cleanText(payload.url);
  const note = cleanText(payload.note);
  const minutes = Number(payload.minutes);
  const difficulty = difficulties.has(payload.difficulty) ? payload.difficulty : "medium";

  if (!title) throw httpError(400, "Title is required");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw httpError(400, "Minutes must be between 1 and 240");
  }

  statements.insertListening.run(randomUUID(), userId, title, url, minutes, difficulty, note, nowDate());
  setTaskDone(userId, "listening", true);
}

const speakingPracticeTypes = new Set(["review", "listening", "output", "progress", "custom"]);

function saveSpeakingAttempt(userId, payload) {
  const targetText = cleanText(payload.targetText ?? payload.target);
  const transcript = cleanText(payload.transcript);
  const rawScore = Number(payload.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  const practiceType = speakingPracticeTypes.has(payload.practiceType) ? payload.practiceType : "custom";

  if (!targetText) {
    throw httpError(400, "Target text is required");
  }
  if (targetText.length > 1000 || transcript.length > 1000) {
    throw httpError(400, "Speaking text is too long");
  }

  statements.insertSpeakingAttempt.run(
    randomUUID(),
    userId,
    practiceType,
    targetText,
    transcript,
    score,
    new Date().toISOString(),
    nowDate()
  );
  setTaskDone(userId, "shadowing", true);
}

function splitSentences(content) {
  return cleanText(content)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sentenceCase(text) {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function generateLocalWritingFeedback(content) {
  const cleaned = cleanText(content).replace(/\r\n/g, "\n");
  const words = cleaned.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const sentences = splitSentences(cleaned);
  const fixes = [];
  const strengths = [];
  let suggestedText = sentenceCase(cleaned.replace(/[，。！？；：]/g, (mark) => {
    const map = { "，": ",", "。": ".", "！": "!", "？": "?", "；": ";", "：": ":" };
    return map[mark] || mark;
  })).replace(/\bi\b/g, "I");

  if (words.length >= 30) {
    strengths.push("You wrote enough detail to practise real expression.");
  } else if (words.length >= 12) {
    strengths.push("You wrote a clear short paragraph.");
  } else {
    fixes.push({
      issue: "The writing is still very short.",
      suggestion: "Add one more sentence with a reason or example.",
      example: "I feel nervous because I need to speak with new classmates.",
    });
  }

  if (sentences.length >= 3) {
    strengths.push("You used more than one sentence, which helps fluency.");
  } else {
    fixes.push({
      issue: "There are not many complete sentences yet.",
      suggestion: "Write 2-3 short complete sentences instead of one long thought.",
      example: "I learned one useful phrase. I will use it tomorrow.",
    });
  }

  if (/[.!?]\s*$/.test(cleaned)) {
    strengths.push("Your final sentence has clear punctuation.");
  } else {
    fixes.push({
      issue: "The final sentence is missing ending punctuation.",
      suggestion: "End the sentence with '.', '?' or '!'.",
      example: "I will practise this sentence again tomorrow.",
    });
    suggestedText = `${suggestedText}.`;
  }

  if (/\bi\b/.test(cleaned)) {
    fixes.push({
      issue: "The pronoun 'I' should be capitalized.",
      suggestion: "Write 'I' with a capital letter when you talk about yourself.",
      example: "Today I learned one useful sentence.",
    });
  }

  if (/(^|[.!?]\s+)[a-z]/.test(cleaned)) {
    fixes.push({
      issue: "Some sentences start with a lowercase letter.",
      suggestion: "Start each sentence with a capital letter.",
      example: "Today I practised listening.",
    });
  } else {
    strengths.push("Sentence starts look tidy.");
  }

  if (/\b(am|is|are|was|were|will|can|could|need|want|learned|practised|practiced)\b/i.test(cleaned)) {
    strengths.push("You used useful everyday verbs.");
  } else {
    fixes.push({
      issue: "The writing could use clearer action verbs.",
      suggestion: "Use simple verbs like need, want, can, learned, or practised.",
      example: "I can ask a question more confidently.",
    });
  }

  const score = Math.max(1, Math.min(5, 5 - Math.min(fixes.length, 4)));
  return {
    engine: "local-rules-v1",
    score,
    summary:
      fixes.length === 0
        ? "This is clear and useful practice. Keep writing short daily paragraphs."
        : "This is a good start. Fix one small sentence issue and add a little more detail.",
    strengths: strengths.slice(0, 3),
    fixes: fixes.slice(0, 4),
    suggestedText,
  };
}

function saveWritingFeedback(userId, date, content) {
  const feedback = generateLocalWritingFeedback(content);
  statements.upsertWritingFeedback.run(
    userId,
    date,
    feedback.engine,
    feedback.score,
    feedback.summary,
    JSON.stringify(feedback.strengths),
    JSON.stringify(feedback.fixes),
    feedback.suggestedText,
    new Date().toISOString()
  );
}

function saveTodayJournal(userId, payload) {
  const today = nowDate();
  const content = cleanText(payload.content ?? payload.journal);

  db.exec("BEGIN");
  try {
    if (content) {
      statements.upsertJournal.run(userId, today, content, new Date().toISOString());
      saveWritingFeedback(userId, today, content);
      setTaskDone(userId, "writing", true);
    } else {
      statements.deleteWritingFeedback.run(userId, today);
      statements.deleteJournal.run(userId, today);
      setTaskDone(userId, "writing", false);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function clearStudyData(userId) {
  db.exec("BEGIN");
  try {
    statements.clearReviewEvents.run(userId);
    statements.clearWritingFeedback.run(userId);
    statements.clearSpeakingAttempts.run(userId);
    statements.clearWords.run(userId);
    statements.clearListening.run(userId);
    statements.clearJournals.run(userId);
    statements.clearTasks.run(userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedPublicDemoData(userId) {
  importBankWords(userId, "uk-life");
  importBankWords(userId, "academic-writing-starter");
  const demoReviewWords = getDueWords(userId).slice(0, 3);
  if (demoReviewWords[0]) reviewWord(userId, demoReviewWords[0].id, "unknown");
  if (demoReviewWords[1]) reviewWord(userId, demoReviewWords[1].id, "fuzzy");
  if (demoReviewWords[2]) reviewWord(userId, demoReviewWords[2].id, "known");
  setTaskDone(userId, "review", true);
  saveListening(userId, {
    title: "BBC Learning English: The English We Speak",
    url: "https://www.bbc.co.uk/learningenglish",
    minutes: 15,
    difficulty: "medium",
    note: "I caught the phrase student accommodation and practised saying it twice.",
  });
  saveSpeakingAttempt(userId, {
    practiceType: "listening",
    targetText: "Could you tell me when the tenancy agreement starts?",
    transcript: "Could you tell me when the tenancy agreement starts",
    score: 96,
  });
  saveTodayJournal(userId, {
    content:
      "Today I learned how to talk about accommodation and assignments.\nI found it difficult to remember long words, but the review steps helped me.\nWhen I go to the UK, I need to ask questions more confidently.",
  });
}

function resetStudyData(userId) {
  clearStudyData(userId);
  if (publicDemo) {
    seedPublicDemoData(userId);
  }
}

function importLocalState(userId, payload) {
  const localState = payload?.state || payload;
  if (!localState || typeof localState !== "object") {
    throw httpError(400, "Invalid local state");
  }
  if (hasStudyData(userId)) {
    throw httpError(409, "Server already has study data");
  }

  db.exec("BEGIN");
  try {
    for (const word of Array.isArray(localState.words) ? localState.words : []) {
      insertWord(userId, word);
    }

    for (const item of Array.isArray(localState.listening) ? localState.listening : []) {
      const title = cleanText(item.title);
      const minutes = Number(item.minutes);
      if (!title || !Number.isInteger(minutes) || minutes < 1 || minutes > 240) continue;
      statements.insertListening.run(
        idValue(item.id),
        userId,
        title,
        cleanText(item.url),
        minutes,
        difficulties.has(item.difficulty) ? item.difficulty : "medium",
        cleanText(item.note),
        isDateKey(item.createdAt) ? item.createdAt : nowDate()
      );
    }

    for (const [date, content] of Object.entries(localState.journals || {})) {
      if (isDateKey(date) && cleanText(content)) {
        const cleanedContent = cleanText(content);
        statements.upsertJournal.run(userId, date, cleanedContent, new Date().toISOString());
        saveWritingFeedback(userId, date, cleanedContent);
      }
    }

    for (const [date, log] of Object.entries(localState.logs || {})) {
      if (!isDateKey(date)) continue;
      for (const [taskId, done] of Object.entries(log?.tasks || {})) {
        if (taskIds.has(taskId) && done) {
          statements.upsertTask.run(userId, date, taskId);
        }
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function validateAccountPayload(payload, mode) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const displayName = cleanText(payload.displayName) || email.split("@")[0] || "Learner";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, "Please enter a valid email");
  }
  if (mode === "register" && password.length < 8) {
    throw httpError(400, "Password must be at least 8 characters");
  }
  if (mode === "login" && !password) {
    throw httpError(400, "Password is required");
  }

  return { email, password, displayName };
}

function verifyPassword(password, userRow) {
  const expected = Buffer.from(userRow.password_hash, "hex");
  const actual = scryptSync(String(password), userRow.salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createUserSession(response, userId) {
  const sessionId = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + sessionMaxAgeSeconds * 1000);
  statements.deleteExpiredSessions.run(createdAt.toISOString());
  statements.insertSession.run(sessionId, userId, createdAt.toISOString(), expiresAt.toISOString());
  setCookie(response, sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
    secure: cookieSecure,
  });
}

function readCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
      })
  );
}

function setCookie(response, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Number(options.maxAge)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");

  const current = response.getHeader("Set-Cookie");
  const cookies = Array.isArray(current) ? current : current ? [current] : [];
  response.setHeader("Set-Cookie", [...cookies, parts.join("; ")]);
}

function clearSessionCookie(response) {
  setCookie(response, sessionCookieName, "", {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    secure: cookieSecure,
  });
}

function getRequestUser(request) {
  if (publicDemo) {
    return statements.userById.get(demoUserId);
  }

  const sessionId = readCookies(request)[sessionCookieName];
  if (!sessionId) return null;
  return statements.sessionUser.get(sessionId, new Date().toISOString()) || null;
}

function requireUser(user) {
  if (!user) {
    throw httpError(401, "Please log in first");
  }
  return user;
}

function registerUser(payload) {
  if (publicDemo) {
    throw httpError(403, "Registration is disabled in public demo mode");
  }

  const { email, password, displayName } = validateAccountPayload(payload, "register");
  if (statements.userByEmail.get(email)) {
    throw httpError(409, "This email is already registered");
  }

  const shouldClaimLegacyData = !hasRealAccounts() && hasStudyData(legacyUserId);
  const { passwordHash, salt } = createPasswordRecord(password);
  const userId = randomUUID();
  statements.insertUser.run(userId, email, passwordHash, salt, displayName, new Date().toISOString());
  if (shouldClaimLegacyData && !hasStudyData(userId)) {
    transferStudyData(legacyUserId, userId);
  }
  return statements.userById.get(userId);
}

function loginUser(payload) {
  if (publicDemo) {
    throw httpError(403, "Login is disabled in public demo mode");
  }

  const { email, password } = validateAccountPayload(payload, "login");
  const user = statements.userByEmail.get(email);
  if (!user || !verifyPassword(password, user)) {
    throw httpError(401, "Email or password is incorrect");
  }
  return user;
}

function consumeRateBucket(buckets, key, limit, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= limit;
}

function clientKey(request, scope) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return `${scope}:${forwardedFor || request.socket.remoteAddress || "unknown"}`;
}

const demoRateBuckets = new Map();
const authRateBuckets = new Map();

function enforceDemoRateLimit(request) {
  if (!publicDemo || ["GET", "HEAD", "OPTIONS"].includes(request.method || "GET")) return;

  if (!consumeRateBucket(demoRateBuckets, clientKey(request, "demo"), 80, 60_000)) {
    throw httpError(429, "Too many demo requests. Please wait a minute.");
  }
}

function enforceAuthRateLimit(request) {
  if (authRateLimitPerMinute <= 0) return;

  if (!consumeRateBucket(authRateBuckets, clientKey(request, "auth"), authRateLimitPerMinute, 60_000)) {
    throw httpError(429, "Too many login attempts. Please wait a minute.");
  }
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) {
      throw httpError(413, "Request body is too large");
    }
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "Invalid JSON");
  }
}

function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  response.end(body);
}

function sendNotFound(response) {
  response.writeHead(404, { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

async function handleApiRequest(request, response, url) {
  try {
    const path = url.pathname;
    const method = request.method || "GET";
    enforceDemoRateLimit(request);
    const user = getRequestUser(request);

    if (method === "GET" && path === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        mode: publicDemo ? "public-demo" : "local-study",
        sqlite: true,
        publicDemo,
        authenticated: Boolean(user),
        time: new Date().toISOString(),
      });
      return;
    }

    if (method === "GET" && path === "/api/bootstrap") {
      sendJson(response, 200, getBootstrap(user));
      return;
    }

    if (method === "POST" && path === "/api/auth/register") {
      enforceAuthRateLimit(request);
      const nextUser = registerUser(await readJsonBody(request));
      createUserSession(response, nextUser.id);
      sendJson(response, 200, getBootstrap(nextUser));
      return;
    }

    if (method === "POST" && path === "/api/auth/login") {
      enforceAuthRateLimit(request);
      const nextUser = loginUser(await readJsonBody(request));
      createUserSession(response, nextUser.id);
      sendJson(response, 200, getBootstrap(nextUser));
      return;
    }

    if (method === "POST" && path === "/api/auth/logout") {
      const sessionId = readCookies(request)[sessionCookieName];
      if (sessionId) statements.deleteSession.run(sessionId);
      clearSessionCookie(response);
      sendJson(response, 200, getBootstrap(publicDemo ? getRequestUser(request) : null));
      return;
    }

    if (method === "GET" && path === "/api/auth/me") {
      sendJson(response, 200, { authenticated: Boolean(user), user: rowToUser(user) });
      return;
    }

    const activeUser = requireUser(user);
    const userId = activeUser.id;

    if (method === "POST" && path === "/api/import-local-state") {
      if (publicDemo) throw httpError(403, "Local migration is disabled in public demo mode");
      importLocalState(userId, await readJsonBody(request));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "POST" && path === "/api/reset") {
      resetStudyData(userId);
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/tasks/today") {
      sendJson(response, 200, getLogs(userId)[nowDate()] || { tasks: {} });
      return;
    }

    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (method === "PATCH" && taskMatch) {
      const body = await readJsonBody(request);
      setTaskDone(userId, decodeURIComponent(taskMatch[1]), Boolean(body.done));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/word-banks") {
      sendJson(response, 200, { wordBanks: getWordBanks(userId) });
      return;
    }

    if (method === "GET" && path === "/api/study-goals") {
      sendJson(response, 200, { studyGoals: getStudyGoals(userId) });
      return;
    }

    const studyGoalMatch = path.match(/^\/api\/study-goals\/([^/]+)\/import$/);
    if (method === "POST" && studyGoalMatch) {
      importStudyGoalWords(userId, decodeURIComponent(studyGoalMatch[1]));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    const bankMatch = path.match(/^\/api\/word-banks\/([^/]+)\/import$/);
    if (method === "POST" && bankMatch) {
      importBankWords(userId, decodeURIComponent(bankMatch[1]));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    const bankWordMatch = path.match(/^\/api\/word-banks\/([^/]+)\/words$/);
    if (method === "POST" && bankWordMatch) {
      saveBankWord(userId, decodeURIComponent(bankWordMatch[1]), await readJsonBody(request));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/words") {
      sendJson(response, 200, { words: getWords(userId) });
      return;
    }

    const wordMatch = path.match(/^\/api\/words\/([^/]+)$/);
    if ((method === "PUT" || method === "PATCH") && wordMatch) {
      saveWord(userId, decodeURIComponent(wordMatch[1]), await readJsonBody(request));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "DELETE" && wordMatch) {
      deleteWord(userId, decodeURIComponent(wordMatch[1]));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/reviews/today") {
      sendJson(response, 200, { words: getDueWords(userId) });
      return;
    }

    const reviewMatch = path.match(/^\/api\/reviews\/([^/]+)$/);
    if (method === "PATCH" && reviewMatch) {
      const body = await readJsonBody(request);
      reviewWord(userId, decodeURIComponent(reviewMatch[1]), body.result);
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/listening") {
      sendJson(response, 200, { listening: getListening(userId) });
      return;
    }

    if (method === "GET" && path === "/api/speaking-attempts") {
      sendJson(response, 200, { speakingAttempts: getSpeakingAttempts(userId) });
      return;
    }

    if (method === "POST" && path === "/api/speaking-attempts") {
      saveSpeakingAttempt(userId, await readJsonBody(request));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "POST" && path === "/api/listening") {
      saveListening(userId, await readJsonBody(request));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/journals") {
      sendJson(response, 200, { journals: getJournals(userId) });
      return;
    }

    if (method === "GET" && path === "/api/writing-feedback") {
      sendJson(response, 200, { writingFeedback: getWritingFeedback(userId) });
      return;
    }

    if (method === "GET" && path === "/api/writing-feedback/today") {
      sendJson(response, 200, {
        feedback: rowToWritingFeedback(statements.todayWritingFeedback.get(userId, nowDate())),
      });
      return;
    }

    if (method === "GET" && path === "/api/journal/today") {
      sendJson(response, 200, statements.todayJournal.get(userId, nowDate()) || { date: nowDate(), content: "" });
      return;
    }

    if (method === "PUT" && path === "/api/journal/today") {
      saveTodayJournal(userId, await readJsonBody(request));
      sendJson(response, 200, getBootstrap(activeUser));
      return;
    }

    if (method === "GET" && path === "/api/progress") {
      sendJson(response, 200, getOverview(userId));
      return;
    }

    if (method === "GET" && path === "/api/insights") {
      sendJson(response, 200, getInsights(userId));
      return;
    }

    if (method === "GET" && path === "/api/export") {
      sendJson(response, 200, {
        exportedAt: new Date().toISOString(),
        user: rowToUser(activeUser),
        state: getState(userId),
        reviewEvents: getReviewEvents(userId),
        insights: getInsights(userId),
      });
      return;
    }

    sendJson(response, 404, { error: "API route not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, error.status || 500, { error: error.message || "Server error" });
  }
}

function handleStaticRequest(request, response, url) {
  const safePath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const target = resolve(join(root, safePath));
  const relativeTarget = relative(root, target);
  const isPrivateData =
    relativeTarget === "data" ||
    relativeTarget.startsWith(`data${sep}`) ||
    relativeTarget === "demo-data" ||
    relativeTarget.startsWith(`demo-data${sep}`);

  if (
    isPrivateData ||
    relativeTarget.startsWith("..") ||
    isAbsolute(relativeTarget) ||
    !existsSync(target) ||
    !statSync(target).isFile()
  ) {
    sendNotFound(response);
    return;
  }

  response.writeHead(200, {
    ...securityHeaders,
    "Content-Type": types[extname(target)] || "application/octet-stream",
  });
  createReadStream(target).pipe(response);
}

if (publicDemo) {
  resetStudyData(demoUserId);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    void handleApiRequest(request, response, url);
    return;
  }

  handleStaticRequest(request, response, url);
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  const mode = publicDemo ? "public demo" : "local study";
  console.log(`English Study (${mode}): http://${displayHost}:${port}`);
});
