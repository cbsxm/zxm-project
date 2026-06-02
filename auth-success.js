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

async function initializeSuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action") === "register" ? "register" : "login";

  try {
    const bootstrap = await requestJSON("/api/bootstrap");
    if (!bootstrap.authenticated && !bootstrap.publicDemo) {
      window.location.replace("./auth.html");
      return;
    }

    const userName = bootstrap.user?.displayName || bootstrap.user?.email || "Demo Account";
    document.querySelector("#success-eyebrow").textContent = action === "register" ? "Register success" : "Login success";
    document.querySelector("#success-title").textContent = action === "register" ? "注册成功" : "登录成功";
    document.querySelector("#success-copy").textContent = `欢迎，${userName}。今天继续完成一点点就很好。`;
  } catch (error) {
    document.querySelector("#success-title").textContent = "后端连接失败";
    document.querySelector("#success-copy").textContent = error.message;
  }

  document.querySelector("#enter-app")?.addEventListener("click", () => {
    window.location.assign("./");
  });
}

void initializeSuccessPage();
