// app.js (Controller + Modular)
// report.js handles charts + filter UI
// expense.js handles Expense tab logic
// tips.js handles Tips tab logic
import { initFloatingChat } from "./chat.js?v=999";
import { initAnalyzeUI, renderAnalyze as renderAnalyzeModule } from "./analyze.js?v=200";
import { auth } from "./firebase-config.js?v=901";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  loadExpensesFromCloud,
  deleteExpenseFromCloud
} from "./firebase-db.js?v=901";

import { initReportUI, renderReport } from "./report.js?v=902";
import { initExpenseEngine } from "./expense.js?v=901";
import { initTipsUI, renderTips } from "./tip.js?v=901";

/* ---------------------------
   Helpers
--------------------------- */
function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function ymd(d) { return d.toISOString().slice(0, 10); }

/* ---------------------------
   Main
--------------------------- */
/* ---------------------------
   Theme Toggle
--------------------------- */
function initThemeToggle() {
  const btn = document.getElementById("themeToggleBtn");
  const icon = document.getElementById("themeToggleIcon");
  if (!btn) return;

  // Load saved theme
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.classList.toggle("light", savedTheme === "light");
  updateThemeIcon();

  function updateThemeIcon() {
    const isLight = document.documentElement.classList.contains("light");
    if (icon) icon.textContent = isLight ? "☀️" : "🌙";
  }

  function applyTheme() {
    const isLightNow = document.documentElement.classList.contains("light");
    const nextIsLight = !isLightNow;

    document.documentElement.classList.toggle("light", nextIsLight);
    localStorage.setItem("theme", nextIsLight ? "light" : "dark");
    updateThemeIcon();
  }

  btn.addEventListener("click", () => {
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    if (!document.startViewTransition) {
      applyTheme();
      return;
    }

    const transition = document.startViewTransition(() => {
      applyTheme();
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    });
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  if (!location.pathname.toLowerCase().includes("dashboard.html")) return;
  initThemeToggle();

  // ✅ auth guard
  const uid = await new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => resolve(user ? user.uid : null));
  });
  if (!uid) { location.href = "index.html"; return; }

  // Buttons (Topbar)
  const exportBtn = document.getElementById("exportBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  // Tabs
  const tabBtns = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  // Analyze (still inside app.js for now; later we’ll move to analyze.js)
  const insightsBox = document.getElementById("insightsBox");
  const topCategoryBox = document.getElementById("topCategoryBox");

  // Chat (still inside app.js for now; later we’ll move to chat.js)
  const chatBox = document.getElementById("chatBox");
  const chatInput = document.getElementById("chatInput");
  const sendChatBtn = document.getElementById("sendChatBtn");

  // Load expenses (shared state owned by app.js)
  let expenses = await loadExpensesFromCloud(uid);
  initFloatingChat({
  getExpenses: () => expenses,
  money,
  parseDateSafe
});
  initAnalyzeUI({
  getExpenses: () => expenses,
  money,
  parseDateSafe
});
  const getExpenses = () => expenses;
  const setExpenses = (next) => { expenses = next; };

  /* ---------------------------
     Shared helpers for Analyze + Chat + Tips modules
  --------------------------- */
  function parseDateSafe(s){
    if (!s) return new Date(0);
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y, (m||1)-1, d||1);
  }

  function buildCategoryTotals(list){
    const m = new Map();
    for (const e of list){
      const c = e.category || "Other";
      m.set(c, (m.get(c) || 0) + Number(e.amount || 0));
    }
    const arr = Array.from(m.entries()).map(([k,v]) => ({ category: k, total: v }));
    arr.sort((a,b)=> b.total - a.total);
    return arr;
  }

  function lastNDaysTotals(list, n=7){
    const now = new Date();
    const days = [];
    for (let i=n-1; i>=0; i--){
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      days.push({ date: key, total: 0 });
    }
    const idx = new Map(days.map((x,i)=> [x.date, i]));
    for (const e of list){
      const i = idx.get(e.date);
      if (i != null) days[i].total += Number(e.amount || 0);
    }
    return days;
  }

  // ✅ Init report module ONCE
  initReportUI({ getExpenses, money, ymd });

  // ✅ Init tips module ONCE (NEW)
  initTipsUI({
    getExpenses,
    money,
    ymd,
    parseDateSafe
  });

  // ✅ Init expense module ONCE
  initExpenseEngine({
    uid,
    getExpenses,
    setExpenses,
    money,
    ymd,
    // expense.js will import these from firebase-db through app.js
    // so we pass the functions it needs:
    saveExpenseToCloud: (await import("./firebase-db.js?v=901")).saveExpenseToCloud,
    deleteExpenseFromCloud,
    onExpensesChanged
  });

  /* ---------------------------
     Tabs logic
  --------------------------- */
  function setActiveTab(tabId){
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle("active", p.id === tabId));

    if (tabId === "report") renderReport(expenses, money, ymd);
    if (tabId === "tips") renderTips();          // ✅ NEW
    if (tabId === "analyze") renderAnalyzeModule();
    if (tabId === "chat") renderChatWelcome();
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  /* ---------------------------
     When expenses change (used by expense.js now)
  --------------------------- */
  function onExpensesChanged(){
    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "report") renderReport(expenses, money, ymd);
    if (activePanel === "analyze") renderAnalyzeModule();
    // Tips module keeps preview until user clicks generate (by design)
  }

  /* ---------------------------
     Export CSV (Topbar)
  --------------------------- */
  if (exportBtn){
    exportBtn.addEventListener("click", () => {
      const header = ["date","category","amount","note"];
      const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
      const lines = [header.join(",")].concat(
        expenses.map(e => [e.date, e.category, e.amount, e.note].map(esc).join(","))
      );
      const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "expenses.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /* ---------------------------
     Clear All (Topbar)
  --------------------------- */
  if (clearAllBtn){
    clearAllBtn.addEventListener("click", async () => {
      if (!confirm("Clear all expenses?")) return;
      for (const e of expenses) await deleteExpenseFromCloud(e.id);
      expenses = [];
      onExpensesChanged();

      // Tell report to refresh if user is on report tab
      const activePanel = document.querySelector(".panel.active")?.id;
      if (activePanel === "report") renderReport(expenses, money, ymd);

      // Tips & Analyze refresh
      renderTips();      // ✅ NEW
      renderAnalyze();
    });
  }

  /* ---------------------------
     ANALYZE (still here for now)
  --------------------------- */
  function renderAnalyze(){
    if (!insightsBox || !topCategoryBox) return;

    const total = expenses.reduce((s,x)=> s + Number(x.amount||0), 0);
    const count = expenses.length;

    const catTotals = buildCategoryTotals(expenses);
    const top = catTotals[0];

    const byDay = new Map();
    for (const e of expenses){
      byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount||0));
    }
    let bestDay = null;
    for (const [date, val] of byDay.entries()){
      if (!bestDay || val > bestDay.val) bestDay = { date, val };
    }

    const uniqueDays = new Set(expenses.map(e => e.date)).size || 1;
    const avgPerDay = total / uniqueDays;

    const items = [
      { k: "Total Spend", v: money(total) },
      { k: "Total Records", v: String(count) },
      { k: "Avg Spend / Active Day", v: money(avgPerDay) },
      { k: "Most Expensive Day", v: bestDay ? `${bestDay.date} • ${money(bestDay.val)}` : "—" },
    ];

    insightsBox.innerHTML = items.map(x => `
      <div class="insight">
        <div class="k">${x.k}</div>
        <div class="v">${x.v}</div>
      </div>
    `).join("");

    const topHtml = top ? `${top.category} • ${money(top.total)}` : "—";
    topCategoryBox.querySelector(".highlight-content").textContent = topHtml;
  }

  /* ---------------------------
     CHAT (still here for now)
  --------------------------- */
  function renderChatWelcome(){
    if (!chatBox) return;
    if (chatBox.dataset.inited) return;
    chatBox.dataset.inited = "1";
    chatBox.innerHTML = `
      <div class="message message-bot">
        <div class="message-avatar">🤖</div>
        <div class="message-bubble">
          Ask me: <br/>
          • "this month total" <br/>
          • "top category" <br/>
          • "last 7 days" <br/>
          • "today spend"
        </div>
      </div>
    `;
  }

  function addChatMessage(text, who="user"){
    const div = document.createElement("div");
    div.className = `message message-${who}`;
    div.innerHTML = `
      <div class="message-avatar">${who==="user" ? "🧑" : "🤖"}</div>
      <div class="message-bubble">${text.replaceAll("<","&lt;").replaceAll(">","&gt;")}</div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function answerChat(q){
    const s = q.toLowerCase();
    const now = new Date();
    const todayKey = ymd(now);

    const monthTotal = expenses.filter(e=>{
      const d = parseDateSafe(e.date);
      return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    }).reduce((a,x)=>a+Number(x.amount||0),0);

    if (s.includes("this month")) return `Your total this month is ${money(monthTotal)}.`;
    if (s.includes("today")){
      const t = expenses.filter(e=>e.date===todayKey).reduce((a,x)=>a+Number(x.amount||0),0);
      return `Today's spend is ${money(t)}.`;
    }
    if (s.includes("last 7")){
      const last7 = lastNDaysTotals(expenses, 7);
      const total7 = last7.reduce((a,x)=>a+x.total,0);
      return `Last 7 days total is ${money(total7)}. Daily average is ${money(total7/7)}.`;
    }
    if (s.includes("top category")){
      const top = buildCategoryTotals(expenses)[0];
      return top ? `Your top category is ${top.category} with ${money(top.total)}.` : "No data yet.";
    }
    return `Try: "this month total", "top category", "last 7 days", "today spend".`;
  }

  if (sendChatBtn && chatInput && chatBox){
    sendChatBtn.addEventListener("click", () => {
      const q = (chatInput.value || "").trim();
      if (!q) return;
      addChatMessage(q, "user");
      chatInput.value = "";
      addChatMessage(answerChat(q), "bot");
    });
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatBtn.click();
    });
  }

  // Initial renders for non-expense tabs
  renderTips();     // ✅ NEW (shows preview from tips.js)
  renderAnalyze();
});