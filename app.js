import { auth } from "./firebase-config.js?v=800";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  loadExpensesFromCloud,
  saveExpenseToCloud,
  deleteExpenseFromCloud
} from "./firebase-db.js?v=800";

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
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/* ---------------------------
   Charts (kept global)
--------------------------- */
let pieChart, barChart, monthlyLineChart, budgetChart;

/* ---------------------------
   Main
--------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  if (!location.pathname.toLowerCase().includes("dashboard.html")) return;

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

  // Report elements
  const fromDateEl = document.getElementById("fromDate");
  const toDateEl = document.getElementById("toDate");
  const filterCategoryEl = document.getElementById("filterCategory");
  const applyFilterBtn = document.getElementById("applyFilterBtn");
  const clearFilterBtn = document.getElementById("clearFilterBtn");
  const filteredTotalEl = document.getElementById("filteredTotal");
  const filteredCountEl = document.getElementById("filteredCount");

  const top3ListEl = document.getElementById("top3List");
  const momLineEl = document.getElementById("momLine");

  const budgetInput = document.getElementById("budgetInput");
  const saveBudgetBtn = document.getElementById("saveBudgetBtn");
  const budgetNote = document.getElementById("budgetNote");

  const heatmapGrid = document.getElementById("heatmapGrid");
  const heatmapMonths = document.getElementById("heatmapMonths");

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

  /* ---------------------------
     Tabs logic
  --------------------------- */
  function setActiveTab(tabId){
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle("active", p.id === tabId));
    if (tabId === "report") renderReport();
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
    if (activePanel === "report") renderReport();
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
     REPORT ENGINE
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

  function lastNMonthsTotals(list, n=6){
    const now = new Date();
    const months = [];
    for (let i=n-1; i>=0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      months.push({ key, label: d.toLocaleString("en-US", { month:"short" }), total: 0 });
    }
    const idx = new Map(months.map((x,i)=> [x.key, i]));
    for (const e of list){
      const d = parseDateSafe(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const i = idx.get(key);
      if (i != null) months[i].total += Number(e.amount || 0);
    }
    return months;
  }

  function thisMonthVsLastMonth(list){
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const last = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const lastKey = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}`;

    let thisTotal = 0, lastTotal = 0;
    for (const e of list){
      const d = parseDateSafe(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const amt = Number(e.amount || 0);
      if (key === thisKey) thisTotal += amt;
      if (key === lastKey) lastTotal += amt;
    }

    const diff = thisTotal - lastTotal;
    const pct = lastTotal === 0 ? (thisTotal > 0 ? 100 : 0) : (diff / lastTotal) * 100;
    return { thisTotal, lastTotal, diff, pct };
  }

  function renderTop3(categoryTotals){
    if (!top3ListEl) return;
    if (!categoryTotals.length) { top3ListEl.textContent = "—"; return; }
    const top3 = categoryTotals.slice(0,3);
    top3ListEl.innerHTML = top3.map((x,i)=> `
      <div class="top3-item">
        <div class="top3-rank">#${i+1}</div>
        <div class="top3-name">${x.category}</div>
        <div class="top3-val">${money(x.total)}</div>
      </div>
    `).join("");
  }

  function renderMoM(mom){
    if (!momLineEl) return;
    const arrow = mom.diff >= 0 ? "▲" : "▼";
    const cls = mom.diff >= 0 ? "mom-up" : "mom-down";
    momLineEl.innerHTML = `
      <span class="mom-a">${money(mom.thisTotal)}</span>
      <span class="mom-b">vs</span>
      <span class="mom-a">${money(mom.lastTotal)}</span>
      <span class="mom-b">•</span>
      <span class="${cls}">${arrow} ${money(Math.abs(mom.diff))} (${Math.abs(mom.pct).toFixed(0)}%)</span>
    `;
  }

  function ensureChart(ctx, existing, config){
    if (!ctx) return null;
    if (existing) existing.destroy();
    return new Chart(ctx, config);
  }

  function renderHeatmap(list){
    if (!heatmapGrid || !heatmapMonths) return;

    const totalDays = 16 * 7;
    const today = new Date();
    today.setHours(0,0,0,0);

    const days = [];
    for (let i=totalDays-1; i>=0; i--){
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    const byDate = new Map();
    for (const e of list){
      const key = e.date;
      byDate.set(key, (byDate.get(key) || 0) + Number(e.amount || 0));
    }

    const values = days.map(d => byDate.get(ymd(d)) || 0);
    const max = Math.max(1, ...values);

    heatmapMonths.innerHTML = "";
    let lastMonth = -1;
    days.forEach((d, idx) => {
      if (idx % 7 !== 0) return;
      const m = d.getMonth();
      const div = document.createElement("div");
      if (m !== lastMonth){
        lastMonth = m;
        div.textContent = d.toLocaleString("en-US", { month:"short" });
      } else {
        div.textContent = "";
      }
      heatmapMonths.appendChild(div);
    });

    heatmapGrid.innerHTML = "";
    for (let col=0; col<16; col++){
      for (let row=0; row<7; row++){
        const i = col*7 + row;
        const v = values[i] || 0;
        const intensity = clamp(v / max, 0, 1);
        const level = v === 0 ? 0 : intensity < 0.25 ? 1 : intensity < 0.5 ? 2 : intensity < 0.75 ? 3 : 4;

        const cell = document.createElement("div");
        cell.className = `hm-cell hm-${level}`;
        cell.title = `${ymd(days[i])} • ${money(v)}`;
        heatmapGrid.appendChild(cell);
      }
    }
  }

  function renderReport(){
    const catTotals = buildCategoryTotals(expenses);
    const last7 = lastNDaysTotals(expenses, 7);
    const months6 = lastNMonthsTotals(expenses, 6);
    const mom = thisMonthVsLastMonth(expenses);

    renderTop3(catTotals);
    renderMoM(mom);
    renderHeatmap(expenses);

    /* ===========================
       ✅ PREMIUM PIE / DONUT CHART
       =========================== */
    const pieCanvas = document.getElementById("pieChart");
    const pieCtx = pieCanvas?.getContext("2d");

    const labels = catTotals.map(x => x.category);
    const values = catTotals.map(x => x.total);

    // Center text plugin (Total)
    const centerTotalPlugin = {
      id: "centerTotalPlugin",
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        const total = values.reduce((a, b) => a + (Number(b) || 0), 0);

        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.font = "700 18px DM Sans, sans-serif";
        ctx.fillText("Total", x, y - 10);
        ctx.font = "800 22px Syne, sans-serif";
        ctx.fillText(money(total), x, y + 16);
        ctx.restore();
      }
    };

    pieChart = ensureChart(pieCtx, pieChart, {
      type: "doughnut",
      plugins: [centerTotalPlugin],
      data: {
        labels,
        datasets: [{
          data: values,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.85)",
          hoverOffset: 12,
          spacing: 6,
          borderRadius: 12,
          cutout: "68%",
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 10 },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "rgba(255,255,255,0.85)",
              boxWidth: 14,
              boxHeight: 14,
              padding: 14,
              font: { size: 12, weight: "600" }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed || 0;
                return `${ctx.label}: ${money(v)}`;
              }
            }
          }
        }
      }
    });

    // Add subtle gradient per slice (premium feel)
    if (pieChart?.chartArea) {
      const { left, top, right, bottom } = pieChart.chartArea;
      const grads = values.map(() => {
        const g = pieChart.ctx.createLinearGradient(left, top, right, bottom);
        g.addColorStop(0, "rgba(255,255,255,0.28)");
        g.addColorStop(1, "rgba(255,255,255,0.06)");
        return g;
      });
      pieChart.data.datasets[0].backgroundColor = grads;
      pieChart.update();
    }
    /* =========================== */

    // Last 7 days bar
    const barCtx = document.getElementById("barChart")?.getContext("2d");
    barChart = ensureChart(barCtx, barChart, {
      type: "bar",
      data: {
        labels: last7.map(x => x.date.slice(5)),
        datasets: [{ label: "Spend", data: last7.map(x => x.total) }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // Monthly trend line
    const lineCtx = document.getElementById("monthlyLineChart")?.getContext("2d");
    monthlyLineChart = ensureChart(lineCtx, monthlyLineChart, {
      type: "line",
      data: {
        labels: months6.map(x => x.label),
        datasets: [{ label: "Monthly Spend", data: months6.map(x => x.total), tension: 0.35 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // Budget vs Actual
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const thisMonthTotal = months6.find(m => m.key === thisMonthKey)?.total || 0;

    const savedBudget = Number(localStorage.getItem("et_monthly_budget") || 0);
    if (budgetInput && !budgetInput.value) budgetInput.value = savedBudget ? String(savedBudget) : "";

    const budCtx = document.getElementById("budgetChart")?.getContext("2d");
    budgetChart = ensureChart(budCtx, budgetChart, {
      type: "bar",
      data: {
        labels: ["Budget", "Actual"],
        datasets: [{
          label: "₹",
          data: [savedBudget || 0, thisMonthTotal]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    if (budgetNote){
      if (!savedBudget) budgetNote.textContent = "Tip: Enter a budget and click Save.";
      else budgetNote.textContent = `Budget saved: ${money(savedBudget)} • This month: ${money(thisMonthTotal)}`;
    }
  }

  // Filter actions
  function applyFilters(){
    const from = fromDateEl?.value ? parseDateSafe(fromDateEl.value) : null;
    const to = toDateEl?.value ? parseDateSafe(toDateEl.value) : null;
    const cat = filterCategoryEl?.value || "";

    const filtered = expenses.filter(e => {
      const d = parseDateSafe(e.date);
      if (from && d < from) return false;
      if (to){
        const to2 = new Date(to);
        to2.setHours(23,59,59,999);
        if (d > to2) return false;
      }
      if (cat && e.category !== cat) return false;
      return true;
    });

    const total = filtered.reduce((s,x)=> s + Number(x.amount || 0), 0);
    if (filteredTotalEl) filteredTotalEl.textContent = money(total);
    if (filteredCountEl) filteredCountEl.textContent = String(filtered.length);
  }

  if (applyFilterBtn) applyFilterBtn.addEventListener("click", applyFilters);
  if (clearFilterBtn) clearFilterBtn.addEventListener("click", () => {
    if (fromDateEl) fromDateEl.value = "";
    if (toDateEl) toDateEl.value = "";
    if (filterCategoryEl) filterCategoryEl.value = "";
    if (filteredTotalEl) filteredTotalEl.textContent = money(0);
    if (filteredCountEl) filteredCountEl.textContent = "0";
  });

  // Budget save
  if (saveBudgetBtn){
    saveBudgetBtn.addEventListener("click", () => {
      const v = Number(budgetInput?.value || 0);
      if (!v || v <= 0) return alert("Enter a valid budget.");
      localStorage.setItem("et_monthly_budget", String(v));
      renderReport();
      alert("Budget saved!");
    });
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
     CHAT (simple local “AI”)
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