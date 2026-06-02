async function requestJSON(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
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

const authApi = {
  getBootstrap: () => requestJSON("/api/bootstrap"),
  login: (payload) =>
    requestJSON("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload) =>
    requestJSON("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

function setAuthMessage(text, tone = "") {
  const message = document.querySelector("#auth-message");
  if (!message) return;
  message.textContent = text;
  message.className = `auth-message ${tone}`.trim();
}

function setFormBusy(form, busy) {
  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = busy;
  });
}

async function submitAuthForm(form, action) {
  const data = new FormData(form);
  const payload = {
    email: String(data.get("email") || "").trim(),
    password: String(data.get("password") || ""),
    displayName: String(data.get("displayName") || "").trim(),
  };

  setFormBusy(form, true);
  setAuthMessage(action === "register" ? "正在创建账号..." : "正在登录...", "muted");
  try {
    if (action === "register") {
      await authApi.register(payload);
    } else {
      await authApi.login(payload);
    }
    window.location.assign(`./auth-success.html?action=${encodeURIComponent(action)}`);
  } catch (error) {
    setAuthMessage(error.message, "error");
    setFormBusy(form, false);
  }
}

async function initializeAuthPage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("loggedOut") === "1") {
    setAuthMessage("已退出登录。", "muted");
  }

  try {
    const bootstrap = await authApi.getBootstrap();
    if (bootstrap.authenticated || bootstrap.publicDemo) {
      window.location.replace("./");
      return;
    }
  } catch (error) {
    setAuthMessage(`后端连接失败：${error.message}`, "error");
  }

  document.querySelector("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAuthForm(event.currentTarget, "login");
  });

  document.querySelector("#register-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAuthForm(event.currentTarget, "register");
  });
}

void initializeAuthPage();
