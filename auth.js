const AUTH_KEY = "et_auth_v1";
const EXP_KEY  = "expenses"; // keep same key

function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
  catch { return null; }
}
function setAuth(obj) { localStorage.setItem(AUTH_KEY, JSON.stringify(obj)); }
function clearAuth() { localStorage.removeItem(AUTH_KEY); }

function isDashboard() {
  return location.pathname.toLowerCase().includes("dashboard.html");
}

function loadExpensesSafe() {
  try { return JSON.parse(localStorage.getItem(EXP_KEY) || "[]"); }
  catch { return []; }
}
function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/* Protect dashboard */
(() => {
  const auth = getAuth();
  if (isDashboard() && !auth) location.href = "index.html";
})();

/* Login page */
(() => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const fullName = document.getElementById("fullName");
  const pin = document.getElementById("pin");
  const err = document.getElementById("loginError");

  // Hero stats
  const heroToday = document.getElementById("heroToday");
  const heroMonth = document.getElementById("heroMonth");
  const heroCount = document.getElementById("heroCount");

  const expenses = loadExpensesSafe();
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();

  const todayTotal = expenses.reduce((s, x) => s + (x.date === todayStr ? Number(x.amount || 0) : 0), 0);
  const monthTotal = expenses.reduce((s, x) => {
    const d = new Date((x.date || "") + "T00:00:00");
    return (d.getMonth() === m && d.getFullYear() === y) ? s + Number(x.amount || 0) : s;
  }, 0);

  if (heroToday) heroToday.textContent = money(todayTotal);
  if (heroMonth) heroMonth.textContent = money(monthTotal);
  if (heroCount) heroCount.textContent = String(expenses.length);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    err.textContent = "";

    const name = (fullName.value || "").trim();
    const p = (pin.value || "").trim();

    if (name.length < 2) return (err.textContent = "Enter your name (min 2 letters).");
    if (!/^\d{4}$/.test(p)) return (err.textContent = "PIN must be exactly 4 digits.");

    setAuth({ name, pinLast2: p.slice(-2), ts: Date.now() });
    location.href = "dashboard.html";
  });
})();

/* Dashboard welcome + logout */
(() => {
  const welcomeLine = document.getElementById("welcomeLine");
  const logoutBtn = document.getElementById("logoutBtn");
  const auth = getAuth();

  if (welcomeLine && auth?.name) {
    welcomeLine.textContent = `Welcome, ${auth.name} • Smart Financial Insights`;
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth();
      location.href = "index.html";
    });
  }
})();

/* Parallax: disable on touch devices */
(() => {
  const isTouch = window.matchMedia("(pointer:coarse)").matches;
  if (isTouch) return;

  const strength = 10;
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * strength;
    const y = (e.clientY / window.innerHeight - 0.5) * strength;
    document.documentElement.style.setProperty("--bg-x", `${x}px`);
    document.documentElement.style.setProperty("--bg-y", `${y}px`);
  });
})();
