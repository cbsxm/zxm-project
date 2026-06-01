import http from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { wordBanks as baseWordBanks } from "./word-banks.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDemo = process.env.PUBLIC_DEMO === "1";
const port = Number(process.env.PORT || 5178);
const host = process.env.HOST || (publicDemo ? "0.0.0.0" : "127.0.0.1");
const dataDir = process.env.DATA_DIR || join(root, publicDemo ? "demo-data" : "data");
const dbPath = join(dataDir, "english-study.sqlite");

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

  CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY,
    normalized_text TEXT NOT NULL UNIQUE,
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
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listening (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    minutes INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS journals (
    date TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS task_logs (
    date TEXT NOT NULL,
    task_id TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (date, task_id)
  );

  CREATE TABLE IF NOT EXISTS bank_words (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    text TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    phrase TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    definition TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(bank_id, normalized_text)
  );

  CREATE INDEX IF NOT EXISTS idx_words_next_review_at ON words(next_review_at);
  CREATE INDEX IF NOT EXISTS idx_listening_created_at ON listening(created_at);
  CREATE INDEX IF NOT EXISTS idx_bank_words_bank_id ON bank_words(bank_id);
`);

const statements = {
  allWords: db.prepare(`
    SELECT id, text, meaning, phrase, example, definition, my_sentence, bank_id,
           status, review_stage, next_review_at, created_at
    FROM words
    ORDER BY created_at DESC, rowid DESC
  `),
  dueWords: db.prepare(`
    SELECT id, text, meaning, phrase, example, definition, my_sentence, bank_id,
           status, review_stage, next_review_at, created_at
    FROM words
    WHERE next_review_at <= ?
    ORDER BY next_review_at ASC, rowid ASC
  `),
  wordById: db.prepare(`
    SELECT id, text, meaning, phrase, example, definition, my_sentence, bank_id,
           status, review_stage, next_review_at, created_at
    FROM words
    WHERE id = ?
  `),
  wordTexts: db.prepare("SELECT normalized_text FROM words"),
  insertWord: db.prepare(`
    INSERT OR IGNORE INTO words (
      id, normalized_text, text, meaning, phrase, example, definition,
      my_sentence, bank_id, status, review_stage, next_review_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateWordReview: db.prepare(`
    UPDATE words
    SET status = ?, review_stage = ?, next_review_at = ?
    WHERE id = ?
  `),
  allListening: db.prepare(`
    SELECT id, title, url, minutes, difficulty, note, created_at
    FROM listening
    ORDER BY created_at DESC, rowid DESC
  `),
  insertListening: db.prepare(`
    INSERT INTO listening (id, title, url, minutes, difficulty, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  allJournals: db.prepare("SELECT date, content FROM journals ORDER BY date DESC"),
  todayJournal: db.prepare("SELECT date, content FROM journals WHERE date = ?"),
  upsertJournal: db.prepare(`
    INSERT INTO journals (date, content, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `),
  deleteJournal: db.prepare("DELETE FROM journals WHERE date = ?"),
  allTasks: db.prepare("SELECT date, task_id, done FROM task_logs WHERE done = 1 ORDER BY date DESC"),
  allBankWords: db.prepare(`
    SELECT id, bank_id, normalized_text, text, meaning, phrase, example, definition, created_at, updated_at
    FROM bank_words
    ORDER BY bank_id ASC, created_at DESC, rowid DESC
  `),
  upsertBankWord: db.prepare(`
    INSERT INTO bank_words (
      id, bank_id, normalized_text, text, meaning, phrase, example, definition, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bank_id, normalized_text) DO UPDATE SET
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
    WHERE normalized_text = ? AND (bank_id = ? OR bank_id = '')
  `),
  upsertTask: db.prepare(`
    INSERT INTO task_logs (date, task_id, done)
    VALUES (?, ?, 1)
    ON CONFLICT(date, task_id) DO UPDATE SET done = 1
  `),
  deleteTask: db.prepare("DELETE FROM task_logs WHERE date = ? AND task_id = ?"),
  clearWords: db.prepare("DELETE FROM words"),
  clearListening: db.prepare("DELETE FROM listening"),
  clearJournals: db.prepare("DELETE FROM journals"),
  clearTasks: db.prepare("DELETE FROM task_logs"),
  countWords: db.prepare("SELECT COUNT(*) AS count FROM words"),
  countListening: db.prepare("SELECT COUNT(*) AS count FROM listening"),
  countJournals: db.prepare("SELECT COUNT(*) AS count FROM journals"),
  countTasks: db.prepare("SELECT COUNT(*) AS count FROM task_logs WHERE done = 1"),
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

function getWordBanks() {
  const banks = [
    ...baseWordBanks.map((bank) => ({ ...bank, words: [...bank.words] })),
    { ...customBank, words: [] },
  ];
  const bankMap = new Map(banks.map((bank) => [bank.id, bank]));

  for (const row of statements.allBankWords.all()) {
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

function getJournals() {
  return Object.fromEntries(statements.allJournals.all().map((row) => [row.date, row.content]));
}

function getLogs() {
  const logs = {};
  for (const row of statements.allTasks.all()) {
    logs[row.date] ??= { tasks: {} };
    logs[row.date].tasks[row.task_id] = Boolean(row.done);
  }
  logs[nowDate()] ??= { tasks: {} };
  return logs;
}

function getWords() {
  return statements.allWords.all().map(rowToWord);
}

function getDueWords() {
  return statements.dueWords.all(nowDate()).map(rowToWord);
}

function getListening() {
  return statements.allListening.all().map(rowToListening);
}

function getState() {
  return {
    words: getWords(),
    listening: getListening(),
    journals: getJournals(),
    logs: getLogs(),
  };
}

function hasStudyData() {
  return (
    statements.countWords.get().count > 0 ||
    statements.countListening.get().count > 0 ||
    statements.countJournals.get().count > 0 ||
    statements.countTasks.get().count > 0
  );
}

function getOverview() {
  const state = getState();
  const totalMinutes = state.listening.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const knownWords = state.words.filter((word) => word.status === "known").length;
  return {
    totalWords: state.words.length,
    knownWords,
    totalMinutes,
    totalJournals: Object.keys(state.journals).length,
    dueWords: getDueWords().length,
    streakDays: calculateStreak(state.logs),
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

function getBootstrap() {
  return {
    publicDemo,
    wordBanks: getWordBanks(),
    state: getState(),
    hasStudyData: hasStudyData(),
    progress: getOverview(),
  };
}

function getBankById(bankId) {
  return getWordBanks().find((bank) => bank.id === bankId);
}

function getExistingWordTexts() {
  return new Set(statements.wordTexts.all().map((row) => row.normalized_text));
}

function insertWord(word) {
  const today = nowDate();
  const text = cleanText(word.text);
  const normalized = normalizeWord(text);
  if (!normalized) return;

  statements.insertWord.run(
    idValue(word.id),
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

function setTaskDone(taskId, done, date = nowDate()) {
  if (!taskIds.has(taskId)) {
    throw httpError(400, "Unknown task id");
  }
  if (!isDateKey(date)) {
    throw httpError(400, "Invalid date");
  }
  if (done) {
    statements.upsertTask.run(date, taskId);
  } else {
    statements.deleteTask.run(date, taskId);
  }
}

function importBankWords(bankId) {
  const bank = getBankById(bankId);
  if (!bank) {
    throw httpError(404, "Word bank not found");
  }

  const today = nowDate();
  const existing = getExistingWordTexts();
  const wordsToAdd = bank.words
    .filter((word) => !existing.has(normalizeWord(word.text)))
    .slice(0, 10);

  for (const word of wordsToAdd) {
    insertWord({
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
    setTaskDone("words", true);
  }
}

function saveBankWord(bankId, payload) {
  const bank = getBankById(bankId);
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
    normalized,
    bankId
  );
}

function reviewWord(wordId, result) {
  if (!reviewResults.has(result)) {
    throw httpError(400, "Invalid review result");
  }

  const word = statements.wordById.get(wordId);
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

  statements.updateWordReview.run(status, reviewStage, nextReviewAt, wordId);
  setTaskDone("review", true);
}

function saveListening(payload) {
  const title = cleanText(payload.title);
  const url = cleanText(payload.url);
  const note = cleanText(payload.note);
  const minutes = Number(payload.minutes);
  const difficulty = difficulties.has(payload.difficulty) ? payload.difficulty : "medium";

  if (!title) throw httpError(400, "Title is required");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw httpError(400, "Minutes must be between 1 and 240");
  }

  statements.insertListening.run(randomUUID(), title, url, minutes, difficulty, note, nowDate());
  setTaskDone("listening", true);
}

function saveTodayJournal(payload) {
  const today = nowDate();
  const content = cleanText(payload.content ?? payload.journal);

  if (content) {
    statements.upsertJournal.run(today, content, new Date().toISOString());
    setTaskDone("writing", true);
  } else {
    statements.deleteJournal.run(today);
    setTaskDone("writing", false);
  }
}

function clearStudyData() {
  db.exec("BEGIN");
  try {
    statements.clearWords.run();
    statements.clearListening.run();
    statements.clearJournals.run();
    statements.clearTasks.run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedPublicDemoData() {
  importBankWords("uk-life");
  importBankWords("academic-writing-starter");
  setTaskDone("review", true);
  saveListening({
    title: "BBC Learning English: The English We Speak",
    url: "https://www.bbc.co.uk/learningenglish",
    minutes: 15,
    difficulty: "medium",
    note: "I caught the phrase student accommodation and practised saying it twice.",
  });
  saveTodayJournal({
    content:
      "Today I learned how to talk about accommodation and assignments.\nI found it difficult to remember long words, but the review steps helped me.\nWhen I go to the UK, I need to ask questions more confidently.",
  });
}

function resetStudyData() {
  clearStudyData();
  if (publicDemo) {
    seedPublicDemoData();
  }
}

function importLocalState(payload) {
  const localState = payload?.state || payload;
  if (!localState || typeof localState !== "object") {
    throw httpError(400, "Invalid local state");
  }
  if (hasStudyData()) {
    throw httpError(409, "Server already has study data");
  }

  db.exec("BEGIN");
  try {
    for (const word of Array.isArray(localState.words) ? localState.words : []) {
      insertWord(word);
    }

    for (const item of Array.isArray(localState.listening) ? localState.listening : []) {
      const title = cleanText(item.title);
      const minutes = Number(item.minutes);
      if (!title || !Number.isInteger(minutes) || minutes < 1 || minutes > 240) continue;
      statements.insertListening.run(
        idValue(item.id),
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
        statements.upsertJournal.run(date, cleanText(content), new Date().toISOString());
      }
    }

    for (const [date, log] of Object.entries(localState.logs || {})) {
      if (!isDateKey(date)) continue;
      for (const [taskId, done] of Object.entries(log?.tasks || {})) {
        if (taskIds.has(taskId) && done) {
          statements.upsertTask.run(date, taskId);
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

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

async function handleApiRequest(request, response, url) {
  try {
    const path = url.pathname;
    const method = request.method || "GET";

    if (method === "GET" && path === "/api/bootstrap") {
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "POST" && path === "/api/import-local-state") {
      importLocalState(await readJsonBody(request));
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "POST" && path === "/api/reset") {
      resetStudyData();
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "GET" && path === "/api/tasks/today") {
      sendJson(response, 200, getLogs()[nowDate()] || { tasks: {} });
      return;
    }

    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (method === "PATCH" && taskMatch) {
      const body = await readJsonBody(request);
      setTaskDone(decodeURIComponent(taskMatch[1]), Boolean(body.done));
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "GET" && path === "/api/word-banks") {
      sendJson(response, 200, { wordBanks: getWordBanks() });
      return;
    }

    const bankMatch = path.match(/^\/api\/word-banks\/([^/]+)\/import$/);
    if (method === "POST" && bankMatch) {
      importBankWords(decodeURIComponent(bankMatch[1]));
      sendJson(response, 200, getBootstrap());
      return;
    }

    const bankWordMatch = path.match(/^\/api\/word-banks\/([^/]+)\/words$/);
    if (method === "POST" && bankWordMatch) {
      saveBankWord(decodeURIComponent(bankWordMatch[1]), await readJsonBody(request));
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "GET" && path === "/api/words") {
      sendJson(response, 200, { words: getWords() });
      return;
    }

    if (method === "GET" && path === "/api/reviews/today") {
      sendJson(response, 200, { words: getDueWords() });
      return;
    }

    const reviewMatch = path.match(/^\/api\/reviews\/([^/]+)$/);
    if (method === "PATCH" && reviewMatch) {
      const body = await readJsonBody(request);
      reviewWord(decodeURIComponent(reviewMatch[1]), body.result);
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "GET" && path === "/api/listening") {
      sendJson(response, 200, { listening: getListening() });
      return;
    }

    if (method === "POST" && path === "/api/listening") {
      saveListening(await readJsonBody(request));
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "GET" && path === "/api/journals") {
      sendJson(response, 200, { journals: getJournals() });
      return;
    }

    if (method === "GET" && path === "/api/journal/today") {
      sendJson(response, 200, statements.todayJournal.get(nowDate()) || { date: nowDate(), content: "" });
      return;
    }

    if (method === "PUT" && path === "/api/journal/today") {
      saveTodayJournal(await readJsonBody(request));
      sendJson(response, 200, getBootstrap());
      return;
    }

    if (method === "GET" && path === "/api/progress") {
      sendJson(response, 200, getOverview());
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
  const isPrivateData = relativeTarget === "data" || relativeTarget.startsWith(`data${sep}`);

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
    "Content-Type": types[extname(target)] || "application/octet-stream",
  });
  createReadStream(target).pipe(response);
}

if (publicDemo) {
  resetStudyData();
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
