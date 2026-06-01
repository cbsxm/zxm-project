const STORAGE_KEY = "english-study-mvp-v1";

const taskMeta = [
  {
    id: "words",
    title: "背新词",
    detail: "从适合你的词库里加入 10 个左右的新词。",
  },
  {
    id: "review",
    title: "复习旧词",
    detail: "用认识、模糊、不认识来安排下一次复习。",
  },
  {
    id: "listening",
    title: "听力 15 分钟",
    detail: "选能听懂一半以上的材料，记录新句子。",
  },
  {
    id: "shadowing",
    title: "跟读 10 分钟",
    detail: "听一句，暂停，模仿一句，先让嘴巴动起来。",
  },
  {
    id: "writing",
    title: "英文输出",
    detail: "写 3-5 句，尽量用今天学过的词。",
  },
];

const wordBanks = [
  {
    id: "uk-life",
    name: "英国留学生活",
    level: "先学",
    description: "签证、住宿、银行、看病、超市等刚到英国最常见的词。",
    words: [
      {
        text: "accommodation",
        meaning: "住宿",
        phrase: "student accommodation",
        example: "I am looking for student accommodation near campus.",
        definition: "a place where you live or stay",
      },
      {
        text: "deposit",
        meaning: "押金；存款",
        phrase: "pay a deposit",
        example: "I need to pay a deposit before moving in.",
        definition: "money you pay first to keep or rent something",
      },
      {
        text: "tenancy",
        meaning: "租赁；租期",
        phrase: "tenancy agreement",
        example: "Please read the tenancy agreement carefully.",
        definition: "the period or situation of renting a place",
      },
      {
        text: "landlord",
        meaning: "房东",
        phrase: "contact the landlord",
        example: "I contacted the landlord about the heating.",
        definition: "a person who rents a room or house to you",
      },
      {
        text: "appointment",
        meaning: "预约；约定",
        phrase: "book an appointment",
        example: "I booked an appointment with the GP.",
        definition: "a planned time to meet someone or get a service",
      },
      {
        text: "prescription",
        meaning: "处方",
        phrase: "get a prescription",
        example: "The doctor gave me a prescription.",
        definition: "a doctor's note that lets you get medicine",
      },
      {
        text: "refund",
        meaning: "退款",
        phrase: "ask for a refund",
        example: "Can I ask for a refund?",
        definition: "money that is given back after you return something",
      },
      {
        text: "receipt",
        meaning: "收据；小票",
        phrase: "keep the receipt",
        example: "Keep the receipt in case you need to return it.",
        definition: "a piece of paper or message that proves you paid",
      },
      {
        text: "queue",
        meaning: "队伍；排队",
        phrase: "stand in a queue",
        example: "People were standing in a queue outside the store.",
        definition: "a line of people waiting for something",
      },
      {
        text: "branch",
        meaning: "分行；分店",
        phrase: "bank branch",
        example: "There is a bank branch near my campus.",
        definition: "one local office or shop of a larger company",
      },
    ],
  },
  {
    id: "academic",
    name: "课堂与作业",
    level: "高频",
    description: "听课、交作业、考试和邮件里反复出现的校园词。",
    words: [
      {
        text: "assignment",
        meaning: "作业；任务",
        phrase: "submit an assignment",
        example: "The assignment is due next Friday.",
        definition: "a piece of work you must finish for a course",
      },
      {
        text: "deadline",
        meaning: "截止日期",
        phrase: "meet the deadline",
        example: "I need to meet the deadline for my essay.",
        definition: "the final time or date when work must be finished",
      },
      {
        text: "lecture",
        meaning: "讲座；课程",
        phrase: "attend a lecture",
        example: "I attended a lecture on academic writing.",
        definition: "a class where a teacher talks to a group of students",
      },
      {
        text: "seminar",
        meaning: "研讨课",
        phrase: "join a seminar",
        example: "We discussed the reading in the seminar.",
        definition: "a small class where students discuss a topic",
      },
      {
        text: "tutorial",
        meaning: "辅导课；小课",
        phrase: "weekly tutorial",
        example: "The tutorial helped me understand the topic.",
        definition: "a small class or meeting for help with study",
      },
      {
        text: "feedback",
        meaning: "反馈；意见",
        phrase: "receive feedback",
        example: "I received useful feedback from my tutor.",
        definition: "comments that help you improve your work",
      },
      {
        text: "reference",
        meaning: "参考文献；引用",
        phrase: "add a reference",
        example: "You need to add references to your essay.",
        definition: "information that shows where an idea came from",
      },
      {
        text: "plagiarism",
        meaning: "抄袭",
        phrase: "avoid plagiarism",
        example: "Universities take plagiarism very seriously.",
        definition: "using someone else's work or ideas as your own",
      },
      {
        text: "extension",
        meaning: "延期",
        phrase: "request an extension",
        example: "I requested an extension because I was ill.",
        definition: "extra time to finish something",
      },
      {
        text: "criteria",
        meaning: "标准；准则",
        phrase: "marking criteria",
        example: "Check the marking criteria before writing.",
        definition: "standards used to judge or decide something",
      },
    ],
  },
  {
    id: "speaking",
    name: "开口表达高频词",
    level: "实用",
    description: "让你在问问题、表达不懂、描述困难时更容易开口。",
    words: [
      {
        text: "clarify",
        meaning: "澄清；说明",
        phrase: "clarify a point",
        example: "Could you clarify this point for me?",
        definition: "to make something easier to understand",
      },
      {
        text: "explain",
        meaning: "解释",
        phrase: "explain the reason",
        example: "Could you explain the reason again?",
        definition: "to make an idea clear by giving details",
      },
      {
        text: "repeat",
        meaning: "重复",
        phrase: "repeat the question",
        example: "Could you repeat the question, please?",
        definition: "to say or do something again",
      },
      {
        text: "recommend",
        meaning: "推荐；建议",
        phrase: "recommend a book",
        example: "Can you recommend a good grammar book?",
        definition: "to say that something is good or useful",
      },
      {
        text: "prefer",
        meaning: "更喜欢",
        phrase: "prefer to study alone",
        example: "I prefer to study in the library.",
        definition: "to like one thing more than another thing",
      },
      {
        text: "struggle",
        meaning: "吃力；挣扎",
        phrase: "struggle with listening",
        example: "I struggle with fast English sometimes.",
        definition: "to find something difficult and try hard to do it",
      },
      {
        text: "improve",
        meaning: "提高；改善",
        phrase: "improve my speaking",
        example: "I want to improve my speaking before I go abroad.",
        definition: "to become better or make something better",
      },
      {
        text: "confident",
        meaning: "自信的",
        phrase: "feel confident",
        example: "I feel more confident when I practise every day.",
        definition: "feeling sure that you can do something",
      },
      {
        text: "confusing",
        meaning: "令人困惑的",
        phrase: "a confusing sentence",
        example: "This sentence is confusing to me.",
        definition: "not easy to understand",
      },
      {
        text: "basically",
        meaning: "基本上；简单来说",
        phrase: "basically means",
        example: "It basically means you need to practise more.",
        definition: "used when you explain the main idea simply",
      },
    ],
  },
  {
    id: "ielts-core",
    name: "雅思基础核心",
    level: "备考",
    description: "阅读、听力和写作中常见的基础学术词。",
    words: [
      {
        text: "benefit",
        meaning: "好处；受益",
        phrase: "the main benefit",
        example: "The main benefit is that students become more independent.",
        definition: "a good or useful result",
      },
      {
        text: "challenge",
        meaning: "挑战",
        phrase: "face a challenge",
        example: "Living abroad can be a challenge at first.",
        definition: "something difficult that tests your ability",
      },
      {
        text: "require",
        meaning: "需要；要求",
        phrase: "require attention",
        example: "Academic writing requires careful planning.",
        definition: "to need something or make something necessary",
      },
      {
        text: "develop",
        meaning: "发展；培养",
        phrase: "develop a habit",
        example: "You can develop a habit by studying a little every day.",
        definition: "to grow or make something grow over time",
      },
      {
        text: "increase",
        meaning: "增加",
        phrase: "increase gradually",
        example: "Your vocabulary will increase gradually.",
        definition: "to become bigger in number, amount, or level",
      },
      {
        text: "reduce",
        meaning: "减少",
        phrase: "reduce stress",
        example: "A clear plan can reduce stress.",
        definition: "to make something smaller or less",
      },
      {
        text: "evidence",
        meaning: "证据",
        phrase: "supporting evidence",
        example: "Use evidence to support your opinion.",
        definition: "facts or information that show something is true",
      },
      {
        text: "impact",
        meaning: "影响",
        phrase: "have an impact on",
        example: "Sleep has an impact on learning.",
        definition: "the effect that something has on someone or something",
      },
      {
        text: "significant",
        meaning: "重要的；显著的",
        phrase: "a significant difference",
        example: "Small daily practice can make a significant difference.",
        definition: "important or large enough to notice",
      },
      {
        text: "approach",
        meaning: "方法；处理方式",
        phrase: "a practical approach",
        example: "This is a practical approach to vocabulary learning.",
        definition: "a way of doing or thinking about something",
      },
    ],
  },
];

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

const addDays = (dateString, days) => {
  const date = parseDateKey(dateString);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const formatDate = (dateString) => {
  const date = parseDateKey(dateString);
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
};

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const reviewSteps = ["sound", "example", "definition", "speak", "rate"];

const reviewStepMeta = {
  sound: { label: "听读音", index: 1 },
  example: { label: "看例句", index: 2 },
  definition: { label: "英文解释", index: 3 },
  speak: { label: "开口跟读", index: 4 },
  rate: { label: "自我评分", index: 5 },
};

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

let state = loadState();
let activeReviewIndex = 0;
let activeReviewId = null;
let reviewStep = "sound";
let chineseVisible = false;
let lastAutoSpokenReviewId = null;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createInitialState();

  try {
    const parsed = JSON.parse(saved);
    return {
      words: parsed.words || [],
      listening: parsed.listening || [],
      journals: parsed.journals || {},
      logs: parsed.logs || {},
    };
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  let changed = false;

  state.words = state.words.map((word) => {
    const match = getBankWordMatch(word);
    if (!match) {
      if (word.definition) return word;
      changed = true;
      return {
        ...word,
        definition: getDefinition(word),
      };
    }

    const nextWord = { ...word };
    const fields = ["definition", "meaning", "phrase", "example"];
    fields.forEach((field) => {
      if (!nextWord[field] && match.bankWord[field]) {
        nextWord[field] = match.bankWord[field];
        changed = true;
      }
    });

    if (!nextWord.bankId) {
      nextWord.bankId = match.bank.id;
      changed = true;
    }

    return nextWord;
  });

  if (changed) saveState();
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

function isWordsViewActive() {
  return document.querySelector("#view-words")?.classList.contains("active");
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

function importBankWords(bankId) {
  const bank = getBankById(bankId);
  if (!bank) return;

  const today = nowDate();
  const existingWords = new Set(state.words.map((word) => normalizeWord(word.text)));
  const wordsToAdd = bank.words
    .filter((word) => !existingWords.has(normalizeWord(word.text)))
    .slice(0, 10);

  if (!wordsToAdd.length) return;

  const newWords = wordsToAdd.map((word) => ({
    id: uid(),
    ...word,
    mySentence: word.mySentence || "",
    bankId: bank.id,
    status: "learning",
    reviewStage: 0,
    nextReviewAt: today,
    createdAt: today,
  }));

  state.words.unshift(...newWords);
  getTodayTasks().words = true;
  activeReviewIndex = 0;
  activeReviewId = null;
  reviewStep = "sound";
  chineseVisible = false;
  lastAutoSpokenReviewId = null;
  saveState();
  render();
}

function markTask(taskId, done) {
  const tasks = getTodayTasks();
  tasks[taskId] = done;
  saveState();
  render();
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
      markTask(event.target.dataset.task, event.target.checked);
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

function renderBankList() {
  const list = document.querySelector("#bank-list");
  const total = document.querySelector("#bank-total");
  if (!list || !total) return;

  total.textContent = `${state.words.length} 个在学`;
  list.innerHTML = wordBanks
    .map((bank) => {
      const progress = getBankProgress(bank);
      const percent = Math.round((progress.imported / progress.total) * 100);
      const buttonText = progress.remaining
        ? `加入 ${Math.min(10, progress.remaining)} 个`
        : "已全部加入";
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
            <span>${progress.imported}/${progress.total} 已加入</span>
            <button class="primary-button" data-bank="${escapeAttribute(bank.id)}" ${disabled}>${buttonText}</button>
          </div>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll("[data-bank]").forEach((button) => {
    button.addEventListener("click", () => importBankWords(button.dataset.bank));
  });
}

function renderReviewProgress() {
  const currentIndex = reviewSteps.indexOf(reviewStep);
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
    button.addEventListener("click", () => reviewWord(word.id, button.dataset.review));
  });

  if (isWordsViewActive() && reviewStep === "sound" && lastAutoSpokenReviewId !== word.id) {
    lastAutoSpokenReviewId = word.id;
    window.setTimeout(() => speakText(word.text, { silent: true }), 150);
  }
}

function reviewWord(id, result) {
  const intervals = [1, 3, 7, 14, 30];
  const today = nowDate();
  const word = state.words.find((item) => item.id === id);
  if (!word) return;

  if (result === "known") {
    word.reviewStage = Math.min((word.reviewStage || 0) + 1, intervals.length - 1);
    word.status = word.reviewStage >= 4 ? "known" : "learning";
    word.nextReviewAt = addDays(today, intervals[word.reviewStage]);
  }

  if (result === "fuzzy") {
    word.reviewStage = Math.max((word.reviewStage || 0), 1);
    word.status = "learning";
    word.nextReviewAt = addDays(today, 1);
  }

  if (result === "unknown") {
    word.reviewStage = 0;
    word.status = "learning";
    word.nextReviewAt = addDays(today, 1);
  }

  getTodayTasks().review = true;
  activeReviewIndex = 0;
  activeReviewId = null;
  reviewStep = "sound";
  chineseVisible = false;
  lastAutoSpokenReviewId = null;
  saveState();
  render();
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

function renderListening() {
  const list = document.querySelector("#listening-list");
  const total = state.listening.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  document.querySelector("#listening-minutes").textContent = `${total} 分钟`;

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
      return `
        <article class="record-row">
          <header>
            <strong>${escapeHTML(item.title)}</strong>
            <span class="pill">${item.minutes} 分钟</span>
          </header>
          <p>${escapeHTML(formatDate(item.createdAt))} · ${difficulty}</p>
          ${link}
          <p>${escapeHTML(item.note || "没有记录新句子")}</p>
        </article>
      `;
    })
    .join("");
}

function renderJournals() {
  const today = nowDate();
  const form = document.querySelector("#journal-form");
  const list = document.querySelector("#journal-list");
  const entries = Object.entries(state.journals).sort((a, b) => b[0].localeCompare(a[0]));

  form.elements.journal.value = state.journals[today] || "";
  document.querySelector("#journal-count").textContent = `${entries.length} 篇`;

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
          <p>${escapeHTML(content)}</p>
        </article>
      `
    )
    .join("");
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
  ensureTodayLog();
  renderTasks();
  renderTodayStats();
  renderBankList();
  renderReview();
  renderWordList();
  renderListening();
  renderJournals();
  renderProgress();
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
    });
  });
}

function bindForms() {
  document.querySelector("#listening-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    state.listening.unshift({
      id: uid(),
      title: data.get("title").trim(),
      url: data.get("url").trim(),
      minutes: Number(data.get("minutes")),
      difficulty: data.get("difficulty"),
      note: data.get("note").trim(),
      createdAt: nowDate(),
    });

    getTodayTasks().listening = true;
    form.reset();
    form.elements.minutes.value = 15;
    form.elements.difficulty.value = "medium";
    saveState();
    render();
  });

  document.querySelector("#journal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const content = form.elements.journal.value.trim();
    const today = nowDate();

    if (content) {
      state.journals[today] = content;
      getTodayTasks().writing = true;
    } else {
      delete state.journals[today];
      getTodayTasks().writing = false;
    }

    saveState();
    render();
  });
}

function bindQuickActions() {
  document.querySelector("#minimum-mode").addEventListener("click", () => {
    const tasks = getTodayTasks();
    tasks.review = true;
    saveState();
    render();
  });

  document.querySelector("#reset-demo").addEventListener("click", () => {
    const confirmed = window.confirm("确定要清空本地学习数据吗？");
    if (!confirmed) return;
    state = createInitialState();
    activeReviewIndex = 0;
    activeReviewId = null;
    reviewStep = "sound";
    chineseVisible = false;
    lastAutoSpokenReviewId = null;
    saveState();
    render();
  });
}

hydrateWordsFromBanks();
bindNavigation();
bindForms();
bindQuickActions();
render();
