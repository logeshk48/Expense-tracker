// app.js (STABLE + MODULAR REPORT)
// IMPORTANT: report.js handles charts + filter UI
import { auth } from "./firebase-config.js?v=901";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  loadExpensesFromCloud,
  saveExpenseToCloud,
  deleteExpenseFromCloud
} from "./firebase-db.js?v=901";

import { initReportUI, renderReport } from "./report.js?v=901";

/* ---------------------------
   Helpers
--------------------------- */
function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function ymd(d) { return d.toISOString().slice(0, 10); }
function parseDateSafe(s){
  if (!s) return new Date(0);
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

/* ---------------------------
   Main
--------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  if (!location.pathname.toLowerCase().includes("dashboard.html")) return;

  // ✅ auth guard
  const uid = await new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => resolve(user ? user.uid : null));
  });
  if (!uid) { location.href = "index.html"; return; }

  // Elements: Overview
  const todayTotalEl = document.getElementById("todayTotal");
  const weekTotalEl  = document.getElementById("weekTotal");
  const monthTotalEl = document.getElementById("monthTotal");
  const yearTotalEl  = document.getElementById("yearTotal");
  const countPill    = document.getElementById("countPill");

  // Form
  const expenseForm = document.getElementById("expenseForm");
  const amountEl = document.getElementById("amount");
  const categoryEl = document.getElementById("category");
  const dateEl = document.getElementById("date");
  const noteEl = document.getElementById("note");

  // Table
  const expenseList = document.getElementById("expenseList");

  // Buttons
  const exportBtn = document.getElementById("exportBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  // Tabs
  const tabBtns = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  // Tips
  const generateTipsBtn = document.getElementById("generateTipsBtn");
  const tipsList = document.getElementById("tipsList");

  // Analyze
  const insightsBox = document.getElementById("insightsBox");
  const topCategoryBox = document.getElementById("topCategoryBox");

  // Chat
  const chatBox = document.getElementById("chatBox");
  const chatInput = document.getElementById("chatInput");
  const sendChatBtn = document.getElementById("sendChatBtn");

  // Default date
  if (dateEl && !dateEl.value) dateEl.value = ymd(new Date());

  // Load expenses
  let expenses = await loadExpensesFromCloud(uid);

  // ✅ Init report module ONCE
  initReportUI({
    getExpenses: () => expenses,
    money,
    ymd
  });

  /* ---------------------------
     Tabs logic
  --------------------------- */
  function setActiveTab(tabId){
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle("active", p.id === tabId));

    if (tabId === "report") renderReport(expenses, money, ymd);
    if (tabId === "tips") renderTipsPreview();
    if (tabId === "analyze") renderAnalyze();
    if (tabId === "chat") renderChatWelcome();
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  /* ---------------------------
     Expense Overview + List
  --------------------------- */
  function computeTotals(){
    const now = new Date();
    const todayStr = ymd(now);
    const weekStart = startOfWeek(now);
    const m = now.getMonth();
    const y = now.getFullYear();

    let today = 0, week = 0, month = 0, year = 0;

    for (const e of expenses){
      const amt = Number(e.amount || 0);
      const d = parseDateSafe(e.date);

      if ((e.date || "") === todayStr) today += amt;
      if (d >= weekStart) week += amt;
      if (d.getFullYear() === y && d.getMonth() === m) month += amt;
      if (d.getFullYear() === y) year += amt;
    }

    if (todayTotalEl) todayTotalEl.textContent = money(today);
    if (weekTotalEl)  weekTotalEl.textContent  = money(week);
    if (monthTotalEl) monthTotalEl.textContent = money(month);
    if (yearTotalEl)  yearTotalEl.textContent  = money(year);
    if (countPill)    countPill.textContent    = `${expenses.length} items`;
  }

  function renderList(){
    if (!expenseList) return;
    expenseList.innerHTML = "";

    const rows = [...expenses].sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    for (const e of rows){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.date || ""}</td>
        <td>${e.category || ""}</td>
        <td>${money(e.amount || 0)}</td>
        <td>${(e.note || "").replaceAll("<","&lt;").replaceAll(">","&gt;")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-del="${e.id}">Delete</button>
          </div>
        </td>
      `;
      expenseList.appendChild(tr);
    }
  }

  function renderAll(){
    computeTotals();
    renderList();

    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "report") renderReport(expenses, money, ymd);
    if (activePanel === "analyze") renderAnalyze();
  }

  /* ---------------------------
     Add expense
  --------------------------- */
  if (expenseForm){
    expenseForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const amount = Number(amountEl?.value || 0);
      const category = categoryEl?.value || "";
      const date = dateEl?.value || "";
      const note = (noteEl?.value || "").trim();

      if (!amount || amount <= 0) return alert("Enter a valid amount.");
      if (!category) return alert("Select a category.");
      if (!date) return alert("Select a date.");

      const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const item = { id, uid, amount, category, date, note, createdAt: Date.now() };

      try {
        await saveExpenseToCloud(item);
      } catch (err) {
        console.error("Firestore save failed:", err);
        alert("Not saved to cloud. Check Firestore Rules (Permissions).");
        return;
      }

      expenses.push(item);
      renderAll();

      expenseForm.reset();
      if (dateEl) dateEl.value = ymd(new Date());
    });
  }

  /* ---------------------------
     Delete expense
  --------------------------- */
  if (expenseList){
    expenseList.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-del]");
      if (!btn) return;

      const id = btn.getAttribute("data-del");
      try {
        await deleteExpenseFromCloud(id);
      } catch (err) {
        console.error("Firestore delete failed:", err);
        alert("Delete failed. Check Firestore Rules.");
        return;
      }

      expenses = expenses.filter(x => x.id !== id);
      renderAll();
    });
  }

  /* ---------------------------
     Export CSV
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
     Clear All
  --------------------------- */
  if (clearAllBtn){
    clearAllBtn.addEventListener("click", async () => {
      if (!confirm("Clear all expenses?")) return;
      for (const e of expenses) await deleteExpenseFromCloud(e.id);
      expenses = [];
      renderAll();
    });
  }

  /* ---------------------------
     Shared for Tips + Analyze + Chat
  --------------------------- */
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

  /* ---------------------------
     TIPS (rule-based)
  --------------------------- */
  function renderTipsPreview(){
    if (!tipsList) return;
    if (!expenses.length) {
      tipsList.innerHTML = `<li class="tip-placeholder">Add some expenses to generate tips.</li>`;
    }
  }

  function generateTips(){
    if (!tipsList) return;
    if (!expenses.length){
      tipsList.innerHTML = `<li class="tip-placeholder">Add some expenses to generate tips.</li>`;
      return;
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const thisMonth = expenses.filter(e => {
      const d = parseDateSafe(e.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });

    const total = thisMonth.reduce((s,x)=> s + Number(x.amount||0), 0);
    const catTotals = buildCategoryTotals(thisMonth);

    const tips = [];

    if (total > 0) tips.push(`Your total spend this month is <strong>${money(total)}</strong>. Keep tracking daily for better control.`);

    const top = catTotals[0];
    if (top) tips.push(`Your highest category is <strong>${top.category}</strong> (${money(top.total)}). Consider setting a mini-limit for this category.`);

    const food = catTotals.find(x => x.category.toLowerCase() === "food");
    if (food && total > 0 && (food.total/total) > 0.35){
      tips.push(`Food spending is above <strong>35%</strong> this month. Try 2–3 home meals per week to reduce cost.`);
    }

    const travel = catTotals.find(x => x.category.toLowerCase() === "travel");
    if (travel && travel.total > 0){
      tips.push(`Travel spend is <strong>${money(travel.total)}</strong>. Group trips and prefer weekly passes when possible.`);
    }

    const last7 = lastNDaysTotals(expenses, 7);
    const avg7 = last7.reduce((s,x)=>s+x.total,0) / 7;
    tips.push(`Your 7-day average spend is <strong>${money(avg7)}</strong>. Try to keep daily spend near this average.`);

    tipsList.innerHTML = tips.map(t => `<li>${t}</li>`).join("");
  }

  if (generateTipsBtn) generateTipsBtn.addEventListener("click", generateTips);

  /* ---------------------------
     ANALYZE
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
     CHAT (simple local)
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
      const a = answerChat(q);
      addChatMessage(a, "bot");
    });
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatBtn.click();
    });
  }

  // Initial render
  renderAll();
});