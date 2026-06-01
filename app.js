const STORAGE_KEY = "english-study-mvp-v1";
const MIGRATION_KEY = `${STORAGE_KEY}:backend-migrated`;

const taskMeta = [
  {
    id: "words",
    title: "背新词",
    detail: "选词库，先听读音，再看英文例句。",
  },
  {
    id: "review",
    title: "复习旧词",
    detail: "用英文解释理解，中文只作为隐藏提示。",
  },
  {
    id: "listening",
    title: "听力 15 分钟",
    detail: "先听声音，再抓一个完整英文句子。",
  },
  {
    id: "shadowing",
    title: "跟读 10 分钟",
    detail: "把单词、例句或听力句子大声读出来。",
  },
  {
    id: "writing",
    title: "英文输出",
    detail: "用英文提示写 3-5 句，最后读一遍。",
  },
];

let wordBanks = [];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const nowDate = () => toDateKey(new Date());

const formatDate = (dateString) => {
  const date = parseDateKey(dateString);
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
};

const reviewSteps = ["sound", "example", "definition", "speak", "rate"];

const reviewStepMeta = {
  sound: { label: "听读音", index: 1 },
  example: { label: "看例句", index: 2 },
  definition: { label: "英文解释", index: 3 },
  speak: { label: "开口跟读", index: 4 },
  rate: { label: "自我评分", index: 5 },
};

const learningFlow = [
  {
    id: "sound",
    title: "Listen first",
    label: "听声音",
    detail: "先让耳朵认识英文，不急着翻译。",
    taskIds: ["listening"],
    speakText: "Listen first. Do not translate too early.",
  },
  {
    id: "sentence",
    title: "Catch a sentence",
    label: "抓英文句子",
    detail: "从例句或听力里抓一个完整英文句子。",
    taskIds: ["words", "listening"],
    speakText: "I can understand this sentence in context.",
  },
  {
    id: "meaning",
    title: "Think in English",
    label: "英文理解",
    detail: "用简单英文解释意思，中文只当最后提示。",
    taskIds: ["review"],
    speakText: "It means something simple in English.",
  },
  {
    id: "speak",
    title: "Say it out loud",
    label: "开口跟读",
    detail: "把单词、句子或日记读出来。",
    taskIds: ["shadowing"],
    speakText: "I will say it out loud.",
  },
  {
    id: "output",
    title: "Use it yourself",
    label: "自己输出",
    detail: "写 3-5 句，或者录一小段英文。",
    taskIds: ["writing"],
    speakText: "I can use English by myself.",
  },
];

const listeningPractices = [
  {
    id: "accommodation-question",
    title: "Accommodation question",
    sentence: "Could you tell me when the tenancy agreement starts?",
    phrase: "tenancy agreement",
    definition: "You are asking for the first day of a rental contract.",
    chinese: "你在询问租房合同什么时候开始。",
    minutes: 5,
    difficulty: "medium",
  },
  {
    id: "seminar-clarification",
    title: "Seminar clarification",
    sentence: "Sorry, could you explain that point again more slowly?",
    phrase: "explain that point",
    definition: "You ask someone to repeat an idea in a clearer and slower way.",
    chinese: "你在请求对方更慢、更清楚地解释一个点。",
    minutes: 5,
    difficulty: "easy",
  },
  {
    id: "library-deadline",
    title: "Library deadline",
    sentence: "The books are due back by Friday afternoon.",
    phrase: "due back",
    definition: "Something must be returned before a certain time.",
    chinese: "这些书必须在周五下午前归还。",
    minutes: 5,
    difficulty: "medium",
  },
];

const outputPractices = [
  {
    id: "ask-for-help",
    title: "Ask for help",
    prompt: "Your tutor explained something too fast.",
    model: "Could you clarify this point for me, please?",
    phrase: "clarify this point",
    definition: "You politely ask someone to explain an idea again.",
    chinese: "你礼貌地请别人再解释一下某个点。",
    starter: "Could you clarify this point for me, please?\nI want to understand it clearly before I continue.",
  },
  {
    id: "introduce-concern",
    title: "Explain a concern",
    prompt: "You are worried about accommodation before going to the UK.",
    model: "I am a little worried about finding suitable accommodation.",
    phrase: "suitable accommodation",
    definition: "You describe a problem that matters to you in a calm way.",
    chinese: "你平静地说明自己担心住宿问题。",
    starter: "I am a little worried about finding suitable accommodation.\nI need a place that is safe and close to campus.",
  },
  {
    id: "make-a-plan",
    title: "Make a study plan",
    prompt: "You want to study English every day.",
    model: "I will practise listening first, then I will say one sentence out loud.",
    phrase: "practise listening",
    definition: "You describe the next action you will take.",
    chinese: "你说明自己下一步会怎么练习英语。",
    starter: "I will practise listening first.\nThen I will say one sentence out loud.\nAfter that, I will write my own sentence.",
  },
];

const createInitialState = () => {
  const today = nowDate();
  return {
    words: [],
    listening: [],
    journals: {},
    logs: {
      [today]: {
        tasks: {},
      },
    },
  };
};

let state = createInitialState();
let activeReviewIndex = 0;
let activeReviewId = null;
let reviewStep = "sound";
let chineseVisible = false;
let lastAutoSpokenReviewId = null;
let activeListeningPracticeIndex = 0;
let listeningPracticeStep = "sound";
let listeningChineseVisible = false;
let lastAutoSpokenListeningId = null;
let activeOutputPracticeIndex = 0;
let outputPracticeStep = "sound";
let outputChineseVisible = false;
let outputDraft = "";
let lastAutoSpokenOutputId = null;
let progressPracticeStep = "sound";
let progressChineseVisible = false;
let progressPracticeCompleted = false;
let lastAutoSpokenProgressId = null;
let isBootstrapped = false;
let isPublicDemo = false;

const api = {
  getBootstrap: () => requestJSON("/api/bootstrap"),
  importLocalState: (localState) =>
    requestJSON("/api/import-local-state", {
      method: "POST",
      body: JSON.stringify({ state: localState }),
    }),
  reset: () =>
    requestJSON("/api/reset", {
      method: "POST",
    }),
  updateTask: (taskId, done) =>
    requestJSON(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({ done }),
    }),
  importBank: (bankId) =>
    requestJSON(`/api/word-banks/${encodeURIComponent(bankId)}/import`, {
      method: "POST",
    }),
  saveBankWord: (bankId, payload) =>
    requestJSON(`/api/word-banks/${encodeURIComponent(bankId)}/words`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reviewWord: (wordId, result) =>
    requestJSON(`/api/reviews/${encodeURIComponent(wordId)}`, {
      method: "PATCH",
      body: JSON.stringify({ result }),
    }),
  saveListening: (payload) =>
    requestJSON("/api/listening", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  saveJournal: (content) =>
    requestJSON("/api/journal/today", {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
};

async function requestJSON(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function getLocalStateForMigration() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      words: Array.isArray(parsed.words) ? parsed.words : [],
      listening: Array.isArray(parsed.listening) ? parsed.listening : [],
      journals: parsed.journals || {},
      logs: parsed.logs || {},
    };
  } catch {
    return null;
  }
}

async function loadServerState() {
  const bootstrap = await api.getBootstrap();
  const localState = getLocalStateForMigration();
  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);

  if (!bootstrap.publicDemo && !bootstrap.hasStudyData && localState && !alreadyMigrated) {
    try {
      const imported = await api.importLocalState(localState);
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      applyBootstrap(imported);
      return;
    } catch (error) {
      console.warn("Local state migration skipped:", error);
    }
  }

  applyBootstrap(bootstrap);
}

function applyBootstrap(bootstrap) {
  isPublicDemo = Boolean(bootstrap.publicDemo);
  wordBanks = bootstrap.wordBanks || wordBanks;
  state = bootstrap.state || createInitialState();
  hydrateWordsFromBanks();
  ensureTodayLog();
}

async function applyMutation(promise) {
  const next = await promise;
  applyBootstrap(next);
  render();
}

function handleApiError(error) {
  console.error(error);
  window.alert(`保存失败：${error.message}`);
  void loadServerState().then(render).catch(console.error);
}

function resetReviewUi() {
  activeReviewIndex = 0;
  activeReviewId = null;
  reviewStep = "sound";
  chineseVisible = false;
  lastAutoSpokenReviewId = null;
}

function ensureTodayLog() {
  const today = nowDate();
  if (!state.logs[today]) {
    state.logs[today] = { tasks: {} };
  }
  if (!state.logs[today].tasks) {
    state.logs[today].tasks = {};
  }
  return state.logs[today];
}

function getTodayTasks() {
  return ensureTodayLog().tasks;
}

function getDueWords() {
  const today = nowDate();
  return state.words
    .filter((word) => word.nextReviewAt <= today)
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));
}

function normalizeWord(text) {
  return String(text || "").trim().toLowerCase();
}

function getBankById(bankId) {
  return wordBanks.find((bank) => bank.id === bankId);
}

function getWordSourceName(word) {
  return getBankById(word.bankId)?.name || "自定义词";
}

function getBankWordMatch(word) {
  const text = normalizeWord(word.text);

  if (word.bankId) {
    const bank = getBankById(word.bankId);
    const bankWord = bank?.words.find((item) => normalizeWord(item.text) === text);
    if (bank && bankWord) return { bank, bankWord };
  }

  for (const bank of wordBanks) {
    const bankWord = bank.words.find((item) => normalizeWord(item.text) === text);
    if (bankWord) return { bank, bankWord };
  }

  return null;
}

function getDefinition(word) {
  return word.definition || getBankWordMatch(word)?.bankWord.definition || "a useful English word for study and daily life";
}

function hydrateWordsFromBanks() {
  state.words = state.words.map((word) => {
    const match = getBankWordMatch(word);
    if (!match) {
      return {
        ...word,
        definition: word.definition || getDefinition(word),
      };
    }

    const nextWord = { ...word };
    const fields = ["definition", "meaning", "phrase", "example"];
    fields.forEach((field) => {
      if (!nextWord[field] && match.bankWord[field]) {
        nextWord[field] = match.bankWord[field];
      }
    });

    if (!nextWord.bankId) {
      nextWord.bankId = match.bank.id;
    }

    return nextWord;
  });
}

function soundIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4Z"></path>
      <path d="M16 9.5a4 4 0 0 1 0 5"></path>
      <path d="M18.5 7a7 7 0 0 1 0 10"></path>
    </svg>
  `;
}

function soundButton(word, kind = "word") {
  const label = kind === "example" ? "播放例句" : "播放读音";
  return `
    <button
      class="sound-button"
      type="button"
      data-speak-id="${escapeAttribute(word.id)}"
      data-speak-kind="${escapeAttribute(kind)}"
      aria-label="${label}"
      title="${label}"
    >
      ${soundIcon()}
    </button>
  `;
}

function textSoundButton(text, label = "播放英文") {
  return `
    <button
      class="sound-button"
      type="button"
      data-speak-text="${escapeAttribute(text)}"
      aria-label="${escapeAttribute(label)}"
      title="${escapeAttribute(label)}"
    >
      ${soundIcon()}
    </button>
  `;
}

function getEnglishVoice() {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang === "en-GB") ||
    voices.find((voice) => voice.lang?.startsWith("en-GB")) ||
    voices.find((voice) => voice.lang?.startsWith("en-US")) ||
    voices.find((voice) => voice.lang?.startsWith("en")) ||
    null
  );
}

function speakText(text, options = {}) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    if (!options.silent) {
      window.alert("当前浏览器不支持读音播放，可以换 Chrome 或 Edge 试试。");
    }
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.78;
  utterance.pitch = 1;

  const voice = getEnglishVoice();
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

function isViewActive(viewName) {
  return document.querySelector(`#view-${viewName}`)?.classList.contains("active");
}

function isWordsViewActive() {
  return isViewActive("words");
}

function bindSoundButtons(container) {
  container.querySelectorAll("[data-speak-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const word = state.words.find((item) => item.id === button.dataset.speakId);
      if (!word) return;
      const text = button.dataset.speakKind === "example" ? word.example : word.text;
      speakText(text || word.text);
    });
  });

  container.querySelectorAll("[data-speak-text]").forEach((button) => {
    button.addEventListener("click", () => {
      speakText(button.dataset.speakText);
    });
  });
}

function getBankProgress(bank) {
  const existingWords = new Set(state.words.map((word) => normalizeWord(word.text)));
  const imported = bank.words.filter((word) => existingWords.has(normalizeWord(word.text))).length;
  return {
    imported,
    remaining: bank.words.length - imported,
    total: bank.words.length,
  };
}

async function importBankWords(bankId) {
  resetReviewUi();
  await applyMutation(api.importBank(bankId));
}

async function saveBankWord(form) {
  const data = new FormData(form);
  const bankId = data.get("bankId");

  const payload = {
    text: data.get("text").trim(),
    meaning: data.get("meaning").trim(),
    phrase: data.get("phrase").trim(),
    example: data.get("example").trim(),
    definition: data.get("definition").trim(),
  };

  const next = await api.saveBankWord(bankId, payload);
  form.reset();
  form.elements.bankId.value = bankId;
  applyBootstrap(next);
  render();
}

async function markTask(taskId, done) {
  await applyMutation(api.updateTask(taskId, done));
}

function renderTasks() {
  const list = document.querySelector("#task-list");
  const tasks = getTodayTasks();

  list.innerHTML = taskMeta
    .map((task) => {
      const checked = tasks[task.id] ? "checked" : "";
      const doneClass = tasks[task.id] ? "done" : "";
      return `
        <article class="task-item ${doneClass}">
          <strong>${task.title}</strong>
          <p>${task.detail}</p>
          <label>
            <input type="checkbox" data-task="${task.id}" ${checked} />
            今天完成
          </label>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll("input[data-task]").forEach((input) => {
    input.addEventListener("change", (event) => {
      void markTask(event.target.dataset.task, event.target.checked).catch(handleApiError);
    });
  });
}

function renderTodayStats() {
  const today = nowDate();
  const tasks = getTodayTasks();
  const finished = taskMeta.filter((task) => tasks[task.id]).length;
  document.querySelector("#today-date").textContent = formatDate(today);
  document.querySelector("#today-complete").textContent = `${finished}/5`;
  document.querySelector("#streak-days").textContent = calculateStreak();
  document.querySelector("#due-count").textContent = getDueWords().length;
}

function calculateStreak() {
  let count = 0;
  const cursor = parseDateKey(nowDate());

  while (count < 366) {
    const key = toDateKey(cursor);
    const log = state.logs[key];
    const hasDone = log && log.tasks && Object.values(log.tasks).some(Boolean);
    if (!hasDone) break;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

function isFlowStepDone(step, tasks = getTodayTasks()) {
  return step.taskIds.some((taskId) => tasks[taskId]);
}

function renderTodayFlow() {
  const container = document.querySelector("#today-flow");
  if (!container) return;

  const tasks = getTodayTasks();
  container.innerHTML = learningFlow
    .map((step, index) => {
      const done = isFlowStepDone(step, tasks);
      return `
        <article class="flow-step ${done ? "done" : ""}">
          <div class="flow-index">${index + 1}</div>
          <div>
            <header>
              <strong>${escapeHTML(step.title)}</strong>
              ${textSoundButton(step.speakText, `播放 ${step.title}`)}
            </header>
            <span>${escapeHTML(step.label)}</span>
            <p>${escapeHTML(step.detail)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  bindSoundButtons(container);
}

function renderPathProgress() {
  const container = document.querySelector("#path-progress");
  if (!container) return;

  const tasks = getTodayTasks();
  container.innerHTML = learningFlow
    .map((step, index) => {
      const done = isFlowStepDone(step, tasks);
      return `
        <article class="path-step ${done ? "complete" : ""}">
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHTML(step.label)}</strong>
            <p>${done ? "今天已经练过" : escapeHTML(step.detail)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBankList() {
  const list = document.querySelector("#bank-list");
  const total = document.querySelector("#bank-total");
  if (!list || !total) return;

  total.textContent = `${state.words.length} 个在学`;
  list.innerHTML = wordBanks
    .map((bank) => {
      const progress = getBankProgress(bank);
      const percent = progress.total ? Math.round((progress.imported / progress.total) * 100) : 0;
      const buttonText = progress.remaining
        ? `加入 ${Math.min(10, progress.remaining)} 个`
        : progress.total
          ? "已全部加入"
          : "先添加词";
      const metaText = progress.total
        ? `${progress.imported}/${progress.total} 已加入`
        : "还没有词";
      const disabled = progress.remaining ? "" : "disabled";

      return `
        <article class="bank-card">
          <header>
            <div>
              <strong>${escapeHTML(bank.name)}</strong>
              <span>${escapeHTML(bank.description)}</span>
            </div>
            <span class="pill">${escapeHTML(bank.level)}</span>
          </header>
          <div class="bank-progress" aria-label="${escapeAttribute(bank.name)} 进度">
            <span style="width: ${percent}%"></span>
          </div>
          <div class="bank-meta">
            <span>${metaText}</span>
            <button class="primary-button" data-bank="${escapeAttribute(bank.id)}" ${disabled}>${buttonText}</button>
          </div>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll("[data-bank]").forEach((button) => {
    button.addEventListener("click", () => {
      void importBankWords(button.dataset.bank).catch(handleApiError);
    });
  });

  renderWordBankOptions();
}

function renderWordBankOptions() {
  const select = document.querySelector("#word-bank-select");
  if (!select) return;

  const currentValue = select.value || "custom";
  select.innerHTML = wordBanks
    .map((bank) => `<option value="${escapeAttribute(bank.id)}">${escapeHTML(bank.name)}</option>`)
    .join("");

  if (wordBanks.some((bank) => bank.id === currentValue)) {
    select.value = currentValue;
  }
}

function renderPracticeProgress(currentStep) {
  const currentIndex = reviewSteps.indexOf(currentStep);
  return `
    <div class="review-progress" aria-label="复习步骤">
      ${reviewSteps
        .map((step, index) => {
          const status = index < currentIndex ? "done" : index === currentIndex ? "active" : "";
          return `<span class="${status}">${index + 1}</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderReviewProgress() {
  return renderPracticeProgress(reviewStep);
}

function renderChineseHint(word) {
  return `
    <div class="chinese-hint">
      <button class="ghost-button" id="toggle-chinese" type="button">
        ${chineseVisible ? "隐藏中文" : "查看中文"}
      </button>
      ${
        chineseVisible
          ? `<p><strong>中文：</strong>${escapeHTML(word.meaning || "还没有中文解释")}</p>`
          : ""
      }
    </div>
  `;
}

function renderStepButton(nextStep, label) {
  return `<button class="primary-button" type="button" data-next-step="${nextStep}">${label}</button>`;
}

function renderReviewStep(word) {
  const definition = getDefinition(word);
  const example = word.example || "I can use this word in a real sentence.";

  if (reviewStep === "sound") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 1 · Sound</p>
        <h3>Listen first</h3>
        <p>先听声音，让耳朵认识这个词。不要急着翻译，先跟着读一遍。</p>
        ${renderStepButton("example", "下一步：看例句")}
      </section>
    `;
  }

  if (reviewStep === "example") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 2 · Sentence</p>
        <h3>Read the sentence</h3>
        <div class="english-box">
          <p>${escapeHTML(example)}</p>
          ${soundButton(word, "example")}
        </div>
        <p>通过句子猜意思，先别看中文。</p>
        ${renderStepButton("definition", "下一步：看英文解释")}
      </section>
    `;
  }

  if (reviewStep === "definition") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 3 · Meaning in English</p>
        <h3>Understand it in English</h3>
        <div class="definition-box">
          <strong>${escapeHTML(word.text)}</strong>
          <span>= ${escapeHTML(definition)}</span>
        </div>
        <p class="phrase-line">${escapeHTML(word.phrase || "No common phrase yet")}</p>
        ${renderStepButton("speak", "下一步：开口跟读")}
      </section>
    `;
  }

  if (reviewStep === "speak") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 4 · Speak</p>
        <h3>Say it out loud</h3>
        <div class="speak-stack">
          <div>
            <span>Word</span>
            <strong>${escapeHTML(word.text)}</strong>
            ${soundButton(word)}
          </div>
          <div>
            <span>Sentence</span>
            <p>${escapeHTML(example)}</p>
            ${soundButton(word, "example")}
          </div>
        </div>
        <button class="primary-button" type="button" data-next-step="rate">我已跟读</button>
      </section>
    `;
  }

  return `
    <section class="guided-step">
      <p class="eyebrow">Step 5 · Rate yourself</p>
      <h3>Can you recognize it next time?</h3>
      <p>根据刚才的声音、例句和英文解释评分，不需要追求一次记牢。</p>
      <div class="review-actions">
        <button data-review="known">认识</button>
        <button data-review="fuzzy">模糊</button>
        <button data-review="unknown">不认识</button>
      </div>
    </section>
  `;
}

function renderReview() {
  const dueWords = getDueWords();
  const reviewCard = document.querySelector("#review-card");
  document.querySelector("#review-total").textContent = `${dueWords.length} 个`;

  if (!dueWords.length) {
    activeReviewId = null;
    reviewStep = "sound";
    chineseVisible = false;
    lastAutoSpokenReviewId = null;
    reviewCard.className = "review-card empty";
    reviewCard.innerHTML = `
      <p>今天没有到期单词。可以从左侧词库加入 10 个新词，或者去听力页积累新句子。</p>
    `;
    return;
  }

  activeReviewIndex = Math.min(activeReviewIndex, dueWords.length - 1);
  const word = dueWords[activeReviewIndex];
  if (activeReviewId !== word.id) {
    activeReviewId = word.id;
    reviewStep = "sound";
    chineseVisible = false;
  }

  reviewCard.className = "review-card";
  const stepMeta = reviewStepMeta[reviewStep];
  reviewCard.innerHTML = `
    <div class="review-word">
      <div class="review-title">
        <strong>${escapeHTML(word.text)}</strong>
        ${soundButton(word)}
      </div>
      <span class="pill">${stepMeta.index}/5 ${stepMeta.label}</span>
    </div>
    ${renderReviewProgress()}
    ${renderReviewStep(word)}
    ${renderChineseHint(word)}
  `;

  reviewCard.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      reviewStep = button.dataset.nextStep;
      renderReview();
    });
  });

  const toggleChinese = reviewCard.querySelector("#toggle-chinese");
  if (toggleChinese) {
    toggleChinese.addEventListener("click", () => {
      chineseVisible = !chineseVisible;
      renderReview();
    });
  }

  bindSoundButtons(reviewCard);

  reviewCard.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => {
      void reviewWord(word.id, button.dataset.review).catch(handleApiError);
    });
  });

  if (isWordsViewActive() && reviewStep === "sound" && lastAutoSpokenReviewId !== word.id) {
    lastAutoSpokenReviewId = word.id;
    window.setTimeout(() => speakText(word.text, { silent: true }), 150);
  }
}

async function reviewWord(id, result) {
  resetReviewUi();
  await applyMutation(api.reviewWord(id, result));
}

function renderWordList() {
  const list = document.querySelector("#word-list");
  const words = [...state.words].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!words.length) {
    list.innerHTML = `<p class="empty-state">还没有在学单词。先从左侧选择一个词库，加入今天的 10 个词。</p>`;
    return;
  }

  list.innerHTML = words
    .slice(0, 12)
    .map(
      (word) => `
        <article class="word-row">
          <header>
            <div class="word-title">
              <strong>${escapeHTML(word.text)}</strong>
              ${soundButton(word)}
            </div>
            <span class="pill">${word.status === "known" ? "已掌握" : "学习中"}</span>
          </header>
          <p>${escapeHTML(word.meaning)} · ${escapeHTML(getWordSourceName(word))} · 下次复习 ${escapeHTML(word.nextReviewAt)}</p>
          <p>${escapeHTML(word.phrase || word.example || "还没有补充语境")}</p>
        </article>
      `
    )
    .join("");

  bindSoundButtons(list);
}

function getPracticeLabel(step, finalLabel) {
  if (step === "rate" && finalLabel) return finalLabel;
  return reviewStepMeta[step]?.label || "";
}

function renderPracticeTitle(title, step, finalLabel) {
  const stepMeta = reviewStepMeta[step];
  return `
    <div class="practice-title">
      <strong>${escapeHTML(title)}</strong>
      <span class="pill">${stepMeta.index}/5 ${escapeHTML(getPracticeLabel(step, finalLabel))}</span>
    </div>
    ${renderPracticeProgress(step)}
  `;
}

function renderPracticeChineseHint(text, visible, key) {
  return `
    <div class="chinese-hint">
      <button class="ghost-button" type="button" data-toggle-practice-chinese="${escapeAttribute(key)}">
        ${visible ? "隐藏中文" : "查看中文"}
      </button>
      ${visible ? `<p><strong>中文：</strong>${escapeHTML(text)}</p>` : ""}
    </div>
  `;
}

function renderPracticeSwitcher(items, activeIndex, kind) {
  return `
    <div class="practice-switcher" aria-label="选择系统练习">
      ${items
        .map(
          (item, index) => `
            <button
              class="${index === activeIndex ? "active" : ""}"
              type="button"
              data-practice-kind="${escapeAttribute(kind)}"
              data-practice-index="${index}"
            >
              ${index + 1}. ${escapeHTML(item.title)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function bindPracticeSwitcher(container) {
  container.querySelectorAll("[data-practice-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextIndex = Number(button.dataset.practiceIndex);
      if (!Number.isInteger(nextIndex)) return;

      if (button.dataset.practiceKind === "listening") {
        activeListeningPracticeIndex = nextIndex;
        listeningPracticeStep = "sound";
        listeningChineseVisible = false;
        lastAutoSpokenListeningId = null;
        renderListeningPractice();
      }

      if (button.dataset.practiceKind === "output") {
        activeOutputPracticeIndex = nextIndex;
        outputPracticeStep = "sound";
        outputChineseVisible = false;
        outputDraft = "";
        lastAutoSpokenOutputId = null;
        renderOutputPractice();
      }
    });
  });
}

function getActiveListeningPractice() {
  return listeningPractices[activeListeningPracticeIndex] || listeningPractices[0];
}

function renderListeningPracticeStep(practice) {
  if (listeningPracticeStep === "sound") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 1 · Sound</p>
        <h3>Listen first</h3>
        <p>先听声音，不看文字。听完后先在脑子里抓关键词，再进入下一步。</p>
        <div class="sound-focus">
          ${textSoundButton(practice.sentence, "播放听力句子")}
          <span>Audio first</span>
        </div>
        ${renderStepButton("example", "下一步：看句子")}
      </section>
    `;
  }

  if (listeningPracticeStep === "example") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 2 · Sentence</p>
        <h3>Catch the sentence</h3>
        <div class="english-box">
          <p>${escapeHTML(practice.sentence)}</p>
          ${textSoundButton(practice.sentence, "播放听力句子")}
        </div>
        <p>只看英文句子，试着通过语境理解它。</p>
        ${renderStepButton("definition", "下一步：看英文解释")}
      </section>
    `;
  }

  if (listeningPracticeStep === "definition") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 3 · Meaning in English</p>
        <h3>Understand it in English</h3>
        <div class="definition-box">
          <strong>${escapeHTML(practice.phrase)}</strong>
          <span>= ${escapeHTML(practice.definition)}</span>
        </div>
        ${renderStepButton("speak", "下一步：开口跟读")}
      </section>
    `;
  }

  if (listeningPracticeStep === "speak") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 4 · Speak</p>
        <h3>Repeat it out loud</h3>
        <div class="speak-stack">
          <div>
            <span>Phrase</span>
            <strong>${escapeHTML(practice.phrase)}</strong>
            ${textSoundButton(practice.phrase, "播放短语")}
          </div>
          <div>
            <span>Sentence</span>
            <p>${escapeHTML(practice.sentence)}</p>
            ${textSoundButton(practice.sentence, "播放听力句子")}
          </div>
        </div>
        <button class="primary-button" type="button" data-next-step="rate">我已跟读</button>
      </section>
    `;
  }

  return `
    <section class="guided-step">
      <p class="eyebrow">Step 5 · Rate yourself</p>
      <h3>How much did you catch?</h3>
      <p>根据刚才的声音、句子和英文解释评分。系统会把这次练习保存到听力记录。</p>
      <div class="review-actions">
        <button data-listening-result="known">听懂了</button>
        <button data-listening-result="fuzzy">有点模糊</button>
        <button data-listening-result="unknown">没听清</button>
      </div>
    </section>
  `;
}

function renderListeningPractice() {
  const container = document.querySelector("#listening-practice");
  if (!container) return;

  const practice = getActiveListeningPractice();
  container.innerHTML = `
    <article class="practice-card">
      ${renderPracticeTitle(practice.title, listeningPracticeStep, "自我评分")}
      ${renderListeningPracticeStep(practice)}
      ${renderPracticeChineseHint(practice.chinese, listeningChineseVisible, "listening")}
    </article>
    ${renderPracticeSwitcher(listeningPractices, activeListeningPracticeIndex, "listening")}
  `;

  container.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      listeningPracticeStep = button.dataset.nextStep;
      renderListeningPractice();
    });
  });

  container.querySelectorAll("[data-listening-result]").forEach((button) => {
    button.addEventListener("click", () => {
      void completeListeningPractice(button.dataset.listeningResult).catch(handleApiError);
    });
  });

  container.querySelector("[data-toggle-practice-chinese='listening']")?.addEventListener("click", () => {
    listeningChineseVisible = !listeningChineseVisible;
    renderListeningPractice();
  });

  bindPracticeSwitcher(container);
  bindSoundButtons(container);

  if (
    isViewActive("listening") &&
    listeningPracticeStep === "sound" &&
    lastAutoSpokenListeningId !== practice.id
  ) {
    lastAutoSpokenListeningId = practice.id;
    window.setTimeout(() => speakText(practice.sentence, { silent: true }), 150);
  }
}

async function completeListeningPractice(result) {
  const practice = getActiveListeningPractice();
  const difficulty = result === "known" ? "easy" : result === "unknown" ? "hard" : "medium";
  const next = await api.saveListening({
    title: practice.title,
    url: "",
    minutes: practice.minutes,
    difficulty,
    note: `${practice.sentence}\n${practice.definition}`,
  });
  applyBootstrap(next);
  applyBootstrap(await api.updateTask("shadowing", true));

  activeListeningPracticeIndex = (activeListeningPracticeIndex + 1) % listeningPractices.length;
  listeningPracticeStep = "sound";
  listeningChineseVisible = false;
  lastAutoSpokenListeningId = null;
  render();
}

function getActiveOutputPractice() {
  return outputPractices[activeOutputPracticeIndex] || outputPractices[0];
}

function getOutputDraftTemplate(practice) {
  const existing = state.journals[nowDate()]?.trim();
  return existing ? `${existing}\n\n${practice.starter}` : practice.starter;
}

function renderOutputPracticeStep(practice) {
  if (outputPracticeStep === "sound") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 1 · Sound</p>
        <h3>Listen to a useful sentence</h3>
        <p>先听一句可以直接模仿的英文，不急着写。</p>
        <div class="sound-focus">
          ${textSoundButton(practice.model, "播放输出例句")}
          <span>Model sentence</span>
        </div>
        ${renderStepButton("example", "下一步：看例句")}
      </section>
    `;
  }

  if (outputPracticeStep === "example") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 2 · Sentence</p>
        <h3>Read the model</h3>
        <p class="practice-scenario">${escapeHTML(practice.prompt)}</p>
        <div class="english-box">
          <p>${escapeHTML(practice.model)}</p>
          ${textSoundButton(practice.model, "播放输出例句")}
        </div>
        ${renderStepButton("definition", "下一步：看英文解释")}
      </section>
    `;
  }

  if (outputPracticeStep === "definition") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 3 · Meaning in English</p>
        <h3>Know what you are saying</h3>
        <div class="definition-box">
          <strong>${escapeHTML(practice.phrase)}</strong>
          <span>= ${escapeHTML(practice.definition)}</span>
        </div>
        ${renderStepButton("speak", "下一步：开口跟读")}
      </section>
    `;
  }

  if (outputPracticeStep === "speak") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 4 · Speak</p>
        <h3>Say the model first</h3>
        <div class="speak-stack">
          <div>
            <span>Phrase</span>
            <strong>${escapeHTML(practice.phrase)}</strong>
            ${textSoundButton(practice.phrase, "播放短语")}
          </div>
          <div>
            <span>Sentence</span>
            <p>${escapeHTML(practice.model)}</p>
            ${textSoundButton(practice.model, "播放输出例句")}
          </div>
        </div>
        <button class="primary-button" type="button" data-next-step="rate">我已跟读</button>
      </section>
    `;
  }

  const draft = outputDraft || getOutputDraftTemplate(practice);
  return `
    <section class="guided-step">
      <p class="eyebrow">Step 5 · Write</p>
      <h3>Use it yourself</h3>
      <p>用刚才的句型写 2-3 句。可以改内容，但尽量保留英文表达。</p>
      <textarea id="output-draft" class="practice-textarea" rows="7">${escapeHTML(draft)}</textarea>
      <button class="primary-button" type="button" data-save-output>保存今日输出</button>
    </section>
  `;
}

function renderOutputPractice() {
  const container = document.querySelector("#output-practice");
  if (!container) return;

  const practice = getActiveOutputPractice();
  container.innerHTML = `
    <article class="practice-card">
      ${renderPracticeTitle(practice.title, outputPracticeStep, "写下输出")}
      ${renderOutputPracticeStep(practice)}
      ${renderPracticeChineseHint(practice.chinese, outputChineseVisible, "output")}
    </article>
    ${renderPracticeSwitcher(outputPractices, activeOutputPracticeIndex, "output")}
  `;

  container.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      outputPracticeStep = button.dataset.nextStep;
      renderOutputPractice();
    });
  });

  const textarea = container.querySelector("#output-draft");
  if (textarea) {
    outputDraft = textarea.value;
    textarea.addEventListener("input", (event) => {
      outputDraft = event.target.value;
    });
  }

  container.querySelector("[data-save-output]")?.addEventListener("click", () => {
    const content = container.querySelector("#output-draft")?.value.trim() || "";
    void completeOutputPractice(content).catch(handleApiError);
  });

  container.querySelector("[data-toggle-practice-chinese='output']")?.addEventListener("click", () => {
    outputChineseVisible = !outputChineseVisible;
    renderOutputPractice();
  });

  bindPracticeSwitcher(container);
  bindSoundButtons(container);

  if (
    isViewActive("output") &&
    outputPracticeStep === "sound" &&
    lastAutoSpokenOutputId !== practice.id
  ) {
    lastAutoSpokenOutputId = practice.id;
    window.setTimeout(() => speakText(practice.model, { silent: true }), 150);
  }
}

async function completeOutputPractice(content) {
  if (!content) {
    window.alert("先写 1-2 句英文，再保存。");
    return;
  }

  applyBootstrap(await api.saveJournal(content));
  applyBootstrap(await api.updateTask("shadowing", true));

  activeOutputPracticeIndex = (activeOutputPracticeIndex + 1) % outputPractices.length;
  outputPracticeStep = "sound";
  outputChineseVisible = false;
  outputDraft = "";
  lastAutoSpokenOutputId = null;
  render();
}

function getProgressPractice() {
  const tasks = getTodayTasks();
  const finished = taskMeta.filter((task) => tasks[task.id]).length;
  const totalMinutes = state.listening.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const journalCount = Object.keys(state.journals).length;
  const knownWords = state.words.filter((word) => word.status === "known").length;
  const sentence = `Today I completed ${finished} of five study steps. I listened for ${totalMinutes} minutes and I have ${knownWords} familiar words.`;

  return {
    id: `progress-${nowDate()}-${finished}-${totalMinutes}-${journalCount}-${knownWords}`,
    title: "Daily progress review",
    sentence,
    phrase: "make progress",
    definition: "You describe what you practised and what improved today.",
    chinese: `今天我完成了 ${finished}/5 个学习步骤，听力 ${totalMinutes} 分钟，熟悉单词 ${knownWords} 个。`,
  };
}

function renderProgressPracticeStep(practice) {
  if (progressPracticeStep === "sound") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 1 · Sound</p>
        <h3>Listen to your progress</h3>
        <p>先听一遍英文复盘，让“进步”这件事也用英文表达。</p>
        <div class="sound-focus">
          ${textSoundButton(practice.sentence, "播放今日复盘")}
          <span>Daily review</span>
        </div>
        ${renderStepButton("example", "下一步：看句子")}
      </section>
    `;
  }

  if (progressPracticeStep === "example") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 2 · Sentence</p>
        <h3>Read the review sentence</h3>
        <div class="english-box">
          <p>${escapeHTML(practice.sentence)}</p>
          ${textSoundButton(practice.sentence, "播放今日复盘")}
        </div>
        ${renderStepButton("definition", "下一步：看英文解释")}
      </section>
    `;
  }

  if (progressPracticeStep === "definition") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 3 · Meaning in English</p>
        <h3>Understand the review</h3>
        <div class="definition-box">
          <strong>${escapeHTML(practice.phrase)}</strong>
          <span>= ${escapeHTML(practice.definition)}</span>
        </div>
        ${renderStepButton("speak", "下一步：开口跟读")}
      </section>
    `;
  }

  if (progressPracticeStep === "speak") {
    return `
      <section class="guided-step">
        <p class="eyebrow">Step 4 · Speak</p>
        <h3>Say your progress out loud</h3>
        <div class="speak-stack">
          <div>
            <span>Phrase</span>
            <strong>${escapeHTML(practice.phrase)}</strong>
            ${textSoundButton(practice.phrase, "播放短语")}
          </div>
          <div>
            <span>Sentence</span>
            <p>${escapeHTML(practice.sentence)}</p>
            ${textSoundButton(practice.sentence, "播放今日复盘")}
          </div>
        </div>
        <button class="primary-button" type="button" data-next-step="rate">我已跟读</button>
      </section>
    `;
  }

  return `
    <section class="guided-step">
      <p class="eyebrow">Step 5 · Finish</p>
      <h3>Complete the review</h3>
      <p>${progressPracticeCompleted ? "今日复盘已经完成。" : "点完成后，系统会把这次开口复盘记入今日练习。"}</p>
      <button class="primary-button" type="button" data-complete-progress ${progressPracticeCompleted ? "disabled" : ""}>
        ${progressPracticeCompleted ? "已完成复盘" : "完成复盘"}
      </button>
    </section>
  `;
}

function renderProgressPractice() {
  const container = document.querySelector("#progress-practice");
  if (!container) return;

  const practice = getProgressPractice();
  container.innerHTML = `
    <article class="practice-card">
      ${renderPracticeTitle(practice.title, progressPracticeStep, "完成复盘")}
      ${renderProgressPracticeStep(practice)}
      ${renderPracticeChineseHint(practice.chinese, progressChineseVisible, "progress")}
    </article>
  `;

  container.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      progressPracticeStep = button.dataset.nextStep;
      renderProgressPractice();
    });
  });

  container.querySelector("[data-complete-progress]")?.addEventListener("click", () => {
    void completeProgressPractice().catch(handleApiError);
  });

  container.querySelector("[data-toggle-practice-chinese='progress']")?.addEventListener("click", () => {
    progressChineseVisible = !progressChineseVisible;
    renderProgressPractice();
  });

  bindSoundButtons(container);

  if (
    isViewActive("progress") &&
    progressPracticeStep === "sound" &&
    lastAutoSpokenProgressId !== practice.id
  ) {
    lastAutoSpokenProgressId = practice.id;
    window.setTimeout(() => speakText(practice.sentence, { silent: true }), 150);
  }
}

async function completeProgressPractice() {
  applyBootstrap(await api.updateTask("shadowing", true));
  progressPracticeCompleted = true;
  render();
}

function renderListening() {
  const list = document.querySelector("#listening-list");
  const totalNode = document.querySelector("#listening-minutes");
  if (!list || !totalNode) return;

  const total = state.listening.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  totalNode.textContent = `${total} 分钟`;

  if (!state.listening.length) {
    list.innerHTML = `<p class="empty-state">还没有听力记录。今天先听 15 分钟就很好。</p>`;
    return;
  }

  list.innerHTML = [...state.listening]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((item) => {
      const difficulty = {
        easy: "简单",
        medium: "适中",
        hard: "太难",
      }[item.difficulty];
      const link = item.url
        ? `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHTML(item.url)}</a>`
        : "";
      const note = item.note || "No sentence saved yet.";
      return `
        <article class="record-row">
          <header>
            <strong>${escapeHTML(item.title)}</strong>
            <span class="pill">${item.minutes} 分钟</span>
          </header>
          <p>${escapeHTML(formatDate(item.createdAt))} · ${difficulty}</p>
          ${link}
          <div class="record-english">
            <p>${escapeHTML(note)}</p>
            ${textSoundButton(note, "播放听力记录")}
          </div>
        </article>
      `;
    })
    .join("");

  bindSoundButtons(list);
}

function renderJournals() {
  const list = document.querySelector("#journal-list");
  const countNode = document.querySelector("#journal-count");
  if (!list || !countNode) return;

  const entries = Object.entries(state.journals).sort((a, b) => b[0].localeCompare(a[0]));

  countNode.textContent = `${entries.length} 篇`;

  if (!entries.length) {
    list.innerHTML = `<p class="empty-state">还没有英文输出。三句就够，重点是每天开口或下笔。</p>`;
    return;
  }

  list.innerHTML = entries
    .slice(0, 10)
    .map(
      ([date, content]) => `
        <article class="record-row">
          <header>
            <strong>${escapeHTML(formatDate(date))}</strong>
            <span class="pill">${content.split(/\s+/).filter(Boolean).length} 词</span>
          </header>
          <div class="record-english">
            <p>${escapeHTML(content)}</p>
            ${textSoundButton(content, "播放英文输出")}
          </div>
        </article>
      `
    )
    .join("");

  bindSoundButtons(list);
}

function renderProgress() {
  const totalMinutes = state.listening.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const knownWords = state.words.filter((word) => word.status === "known").length;
  const journalCount = Object.keys(state.journals).length;

  document.querySelector("#total-words").textContent = state.words.length;
  document.querySelector("#known-words").textContent = knownWords;
  document.querySelector("#total-minutes").textContent = totalMinutes;
  document.querySelector("#total-journals").textContent = journalCount;

  const weekGrid = document.querySelector("#week-grid");
  const today = parseDateKey(nowDate());
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const key = toDateKey(date);
    const tasks = state.logs[key]?.tasks || {};
    const done = taskMeta.filter((task) => tasks[task.id]).length;
    days.push({ key, done });
  }

  weekGrid.innerHTML = days
    .map(
      (day) => `
        <div class="day-cell ${day.done ? "complete" : ""}">
          <strong>${escapeHTML(formatDate(day.key))}</strong>
          <span>${day.done}/5 个任务</span>
          <span>${day.done ? "有学习记录" : "等待点亮"}</span>
        </div>
      `
    )
    .join("");
}

function render() {
  if (!isBootstrapped) return;
  ensureTodayLog();
  renderDemoState();
  renderTasks();
  renderTodayStats();
  renderTodayFlow();
  renderBankList();
  renderReview();
  renderWordList();
  renderListeningPractice();
  renderListening();
  renderOutputPractice();
  renderJournals();
  renderProgress();
  renderPathProgress();
  renderProgressPractice();
}

function renderDemoState() {
  document.body.classList.toggle("public-demo", isPublicDemo);

  const banner = document.querySelector("#demo-banner");
  if (banner) {
    banner.hidden = !isPublicDemo;
  }

  const resetButton = document.querySelector("#reset-demo");
  if (resetButton) {
    resetButton.textContent = isPublicDemo ? "重置演示数据" : "重置数据";
    resetButton.title = isPublicDemo ? "恢复默认演示数据" : "清空本地学习数据";
  }
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}

function bindNavigation() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#view-${button.dataset.view}`).classList.add("active");
      if (button.dataset.view === "words") {
        lastAutoSpokenReviewId = null;
        renderReview();
      }
      if (button.dataset.view === "listening") {
        lastAutoSpokenListeningId = null;
        renderListeningPractice();
      }
      if (button.dataset.view === "output") {
        lastAutoSpokenOutputId = null;
        renderOutputPractice();
      }
      if (button.dataset.view === "progress") {
        lastAutoSpokenProgressId = null;
        renderProgressPractice();
      }
    });
  });
}

function bindForms() {
  document.querySelector("#word-bank-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveBankWord(event.currentTarget).catch(handleApiError);
  });
}

function bindQuickActions() {
  document.querySelector("#minimum-mode").addEventListener("click", () => {
    void applyMutation(api.updateTask("review", true)).catch(handleApiError);
  });

  document.querySelector("#reset-demo").addEventListener("click", () => {
    const confirmed = window.confirm("确定要清空本地学习数据吗？");
    if (!confirmed) return;

    resetReviewUi();
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    void applyMutation(api.reset()).catch(handleApiError);
  });
}

function showBootstrapError(error) {
  console.error(error);
  const workspace = document.querySelector(".workspace");
  workspace.innerHTML = `
    <section class="task-board">
      <h1>后端连接失败</h1>
      <p class="empty-state">请确认本地服务正在运行，然后刷新页面。错误：${escapeHTML(error.message)}</p>
    </section>
  `;
}

async function initialize() {
  bindNavigation();
  bindForms();
  bindQuickActions();

  try {
    await loadServerState();
    isBootstrapped = true;
    render();
  } catch (error) {
    showBootstrapError(error);
  }
}

void initialize();
