// =====================================================
// Expense Tracker - app.js (Full Updated)
// =====================================================

// ---------- Helpers ----------
function loadExpenses() {
  return JSON.parse(localStorage.getItem("expenses") || "[]");
}
function saveExpenses(expenses) {
  localStorage.setItem("expenses", JSON.stringify(expenses));
}
function formatMoney(n) {
  return `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
function toDateOnly(d) {
  return new Date(d + "T00:00:00");
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeek(date) {
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

// ---------- Count-up animation ----------
function animateNumber(el, toValue) {
  if (!el) return;
  const from = Number((el.textContent || "0").replace(/[^\d]/g, "")) || 0;
  const start = performance.now();
  const duration = 450;

  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (toValue - from) * eased);
    el.textContent = formatMoney(val);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- Tabs ----------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function switchTab(tabName) {
  tabs.forEach((b) => b.classList.remove("active"));
  panels.forEach((p) => p.classList.remove("active"));

  const btn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const panel = document.getElementById(tabName);

  if (btn) btn.classList.add("active");
  if (panel) panel.classList.add("active");

  if (tabName === "report") renderCharts();
  if (tabName === "analyze") renderAnalysis();
}

tabs.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ---------- Elements ----------
const form = document.getElementById("expenseForm");
const expenseList = document.getElementById("expenseList");

const todayTotalEl = document.getElementById("todayTotal");
const weekTotalEl = document.getElementById("weekTotal");
const monthTotalEl = document.getElementById("monthTotal");
const yearTotalEl = document.getElementById("yearTotal");

const countPill = document.getElementById("countPill");

const fromDateEl = document.getElementById("fromDate");
const toDateEl = document.getElementById("toDate");
const filterCategoryEl = document.getElementById("filterCategory");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");
const filteredTotalEl = document.getElementById("filteredTotal");
const filteredCountEl = document.getElementById("filteredCount");

const exportBtn = document.getElementById("exportBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

const tipsList = document.getElementById("tipsList");
const generateTipsBtn = document.getElementById("generateTipsBtn");

const insightsBox = document.getElementById("insightsBox");
const topCategoryBox = document.getElementById("topCategoryBox");

// Chat mock
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

// Default date = today
const dateInput = document.getElementById("date");
if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

let activeFilter = { from: "", to: "", category: "" };

// ---------- Filter logic ----------
function getFilteredExpenses(expenses) {
  const { from, to, category } = activeFilter;

  return expenses.filter((ex) => {
    if (from && ex.date < from) return false;
    if (to && ex.date > to) return false;
    if (category && ex.category !== category) return false;
    return true;
  });
}

// ---------- Render ----------
function render() {
  const expenses = loadExpenses();
  const filtered = getFilteredExpenses(expenses);

  // table
  expenseList.innerHTML = "";
  filtered
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((ex) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ex.date}</td>
        <td>
          <span style="
            display:inline-block;
            padding:4px 10px;
            border-radius:999px;
            background: rgba(16, 185, 129, 0.15);
            color: #10b981;
            font-size:12px;
            font-weight:800;">
            ${ex.category}
          </span>
        </td>
        <td style="font-weight:900;">${formatMoney(ex.amount)}</td>
        <td style="color: rgba(255,255,255,.65);">${ex.note || "—"}</td>
        <td><button class="delete-btn" data-id="${ex.id}">Delete</button></td>
      `;
      expenseList.appendChild(tr);
    });

  countPill.textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;

  // totals
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const month = now.getMonth();
  const year = now.getFullYear();

  let todayTotal = 0, weekTotal = 0, monthTotal = 0, yearTotal = 0;

  for (const ex of expenses) {
    const d = toDateOnly(ex.date);
    if (ex.date === todayStr) todayTotal += ex.amount;
    if (d >= weekStart && d <= weekEnd) weekTotal += ex.amount;
    if (d.getMonth() === month && d.getFullYear() === year) monthTotal += ex.amount;
    if (d.getFullYear() === year) yearTotal += ex.amount;
  }

  animateNumber(todayTotalEl, todayTotal);
  animateNumber(weekTotalEl, weekTotal);
  animateNumber(monthTotalEl, monthTotal);
  animateNumber(yearTotalEl, yearTotal);

  // filter totals
  const filteredTotal = filtered.reduce((sum, x) => sum + x.amount, 0);
  filteredTotalEl.textContent = formatMoney(filteredTotal);
  filteredCountEl.textContent = String(filtered.length);

  // refresh charts/analyze
  renderCharts();
  renderAnalysis();
}

// Add expense
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const amount = Number(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const date = document.getElementById("date").value;
  const note = document.getElementById("note").value;

  if (!amount || amount < 0 || !category || !date) {
    showToast("Please enter valid values");
    return;
  }

  const expenses = loadExpenses();
  expenses.push({ id: crypto.randomUUID(), amount, category, date, note });

  saveExpenses(expenses);
  form.reset();
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  render();
  showToast("Expense added ✅");
});

// Delete
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-btn")) {
    const id = e.target.getAttribute("data-id");
    const expenses = loadExpenses().filter((x) => x.id !== id);
    saveExpenses(expenses);
    render();
    showToast("Expense deleted");
  }
});

// Filters
applyFilterBtn.addEventListener("click", () => {
  activeFilter = {
    from: fromDateEl.value,
    to: toDateEl.value,
    category: filterCategoryEl.value,
  };
  render();
  showToast("Filter applied");
});

clearFilterBtn.addEventListener("click", () => {
  activeFilter = { from: "", to: "", category: "" };
  fromDateEl.value = "";
  toDateEl.value = "";
  filterCategoryEl.value = "";
  render();
  showToast("Filter cleared");
});

// Export CSV
exportBtn.addEventListener("click", () => {
  const expenses = loadExpenses().sort((a, b) => a.date.localeCompare(b.date));
  const header = ["date", "category", "amount", "note"];
  const rows = expenses.map((e) => [
    e.date,
    e.category,
    String(e.amount),
    (e.note || "").replaceAll('"', '""'),
  ]);

  const csv = [header, ...rows].map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses.csv";
  a.click();

  URL.revokeObjectURL(url);
  showToast("CSV exported 📄");
});

// Clear all
clearAllBtn.addEventListener("click", () => {
  const ok = confirm("⚠️ This will delete ALL expenses. Are you sure?");
  if (!ok) return;
  localStorage.removeItem("expenses");
  render();
  showToast("All expenses cleared");
});

// ---------- Charts ----------
let pieChartInstance = null;
let barChartInstance = null;

function groupByCategory(expenses) {
  const map = {};
  for (const ex of expenses) map[ex.category] = (map[ex.category] || 0) + ex.amount;
  return map;
}

function lastNDaysTotals(expenses, n = 7) {
  const today = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
  }

  const totals = Object.fromEntries(days.map((d) => [d, 0]));
  for (const ex of expenses) if (totals[ex.date] !== undefined) totals[ex.date] += ex.amount;

  return { labels: days, values: days.map((d) => totals[d]) };
}

function renderCharts() {
  const expenses = loadExpenses();

  // Pie
  const catMap = groupByCategory(expenses);
  const pieLabels = Object.keys(catMap);
  const pieValues = Object.values(catMap);

  const pieCanvas = document.getElementById("pieChart");
  if (pieCanvas) {
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(pieCanvas, {
      type: "pie",
      data: {
        labels: pieLabels.length ? pieLabels : ["No data"],
        datasets: [{
          data: pieValues.length ? pieValues : [1],
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)",
            "rgba(20, 184, 166, 0.8)",
            "rgba(6, 182, 212, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(168, 85, 247, 0.8)",
          ],
          borderColor: "rgba(255,255,255,.10)",
          borderWidth: 2,
        }],
      },
      options: {
        plugins: {
          legend: {
            labels: {
              color: "rgba(255,255,255,.85)",
              font: { size: 13, family: "DM Sans" },
              padding: 15,
            },
          },
        },
      },
    });
  }

  // Bar
  const { labels, values } = lastNDaysTotals(expenses, 7);
  const barCanvas = document.getElementById("barChart");
  if (barCanvas) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels: labels.map((d) =>
          new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
        ),
        datasets: [{
          data: values,
          backgroundColor: "rgba(16, 185, 129, 0.8)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: {
        scales: {
          x: { ticks: { color: "rgba(255,255,255,.7)" }, grid: { color: "rgba(255,255,255,.05)" } },
          y: {
            ticks: {
              color: "rgba(255,255,255,.7)",
              callback: (v) => "₹" + v.toLocaleString("en-IN"),
            },
            grid: { color: "rgba(255,255,255,.05)" },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }
}

// ---------- Tips ----------
function computeStats(expenses) {
  const total = expenses.reduce((s, x) => s + x.amount, 0);
  const byCat = groupByCategory(expenses);
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const top = entries[0] ? { category: entries[0][0], amount: entries[0][1] } : null;

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  let last30Total = 0;
  const dayMap = {};
  for (const ex of expenses) {
    const d = toDateOnly(ex.date);
    if (d >= start) last30Total += ex.amount;
    dayMap[ex.date] = (dayMap[ex.date] || 0) + ex.amount;
  }
  const avgPerDay = last30Total / 30;

  const dayEntries = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
  const biggestDay = dayEntries[0] ? { date: dayEntries[0][0], amount: dayEntries[0][1] } : null;

  return { total, top, avgPerDay, biggestDay, byCat };
}

generateTipsBtn.addEventListener("click", () => {
  const expenses = loadExpenses();
  const { total, top, avgPerDay, biggestDay, byCat } = computeStats(expenses);

  const tips = [];
  if (!expenses.length) {
    tips.push("🎯 Start by adding today's expenses. Consistency beats perfection!");
  } else {
    if (top) {
      const pct = total > 0 ? Math.round((top.amount / total) * 100) : 0;
      tips.push(`📊 Top category: <strong>${top.category}</strong> (${pct}%). Try setting a weekly limit.`);
    }
    tips.push(`💰 Avg daily spend (30d): <strong>${formatMoney(avgPerDay)}</strong>`);
    if (biggestDay) tips.push(`📈 Highest day: <strong>${biggestDay.date}</strong> — ${formatMoney(biggestDay.amount)}`);

    const food = byCat["Food"] || 0;
    const travel = byCat["Travel"] || 0;
    if (food > 0 && food >= travel) tips.push("🍽️ Food: reduce impulse snacks; plan meals for 3 days.");
    if (travel > 0 && travel > food) tips.push("🚗 Travel: combine trips or use public transport for savings.");

    tips.push("💡 Rule: 50% needs, 30% wants, 20% savings.");
  }

  tipsList.innerHTML = tips.map((t) => `<li>${t}</li>`).join("");
  showToast("Tips generated ✨");
});

// ---------- Analyze ----------
function renderAnalysis() {
  const expenses = loadExpenses();
  const { total, top, avgPerDay } = computeStats(expenses);

  const month = new Date().getMonth();
  const year = new Date().getFullYear();

  const monthTotal = expenses.reduce((s, x) => {
    const d = toDateOnly(x.date);
    return d.getMonth() === month && d.getFullYear() === year ? s + x.amount : s;
  }, 0);

  const uniqueDays = new Set(expenses.map((x) => x.date)).size;
  const avgPerEntry = expenses.length ? total / expenses.length : 0;

  const blocks = [
    { k: "Total Spending", v: formatMoney(total) },
    { k: "This Month", v: formatMoney(monthTotal) },
    { k: "Total Entries", v: String(expenses.length) },
    { k: "Days Tracked", v: String(uniqueDays) },
    { k: "Avg per Entry", v: formatMoney(avgPerEntry) },
    { k: "Avg per Day (30d)", v: formatMoney(avgPerDay || 0) },
  ];

  insightsBox.innerHTML = blocks
    .map((b) => `<div class="insight"><div class="k">${b.k}</div><div class="v">${b.v}</div></div>`)
    .join("");

  if (!top) {
    topCategoryBox.innerHTML = '<div class="highlight-content">—</div>';
  } else {
    const pct = total > 0 ? Math.round((top.amount / total) * 100) : 0;
    topCategoryBox.innerHTML = `
      <div class="highlight-content">
        ${top.category}<br>
        <span style="font-size: 20px; opacity: 0.7;">${formatMoney(top.amount)} • ${pct}%</span>
      </div>`;
  }
}

// ---------- Chat (mock) ----------
function appendMsg(type, text) {
  const div = document.createElement("div");
  div.className = `message message-${type}`;
  div.innerHTML = `
    <div class="message-avatar">${type === "bot" ? "🤖" : "👤"}</div>
    <div class="message-bubble">${text}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendChatBtn.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMsg("user", text);
  chatInput.value = "";

  setTimeout(() => {
    appendMsg("bot", "Chatbot integration is coming soon ✅ For now, use Tips and Analyze for insights.");
  }, 450);
});

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatBtn.click();
});

// ---------- Toast ----------
function showToast(message) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(20, 184, 166, 0.95));
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    font-family: 'DM Sans', sans-serif;
    font-weight: 800;
    font-size: 14px;
    z-index: 10000;
    animation: slideInUp 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOutDown 0.3s ease-out";
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// inject toast keyframes once
(function injectToastKeyframes() {
  if (document.getElementById("toastKeyframes")) return;
  const style = document.createElement("style");
  style.id = "toastKeyframes";
  style.textContent = `
    @keyframes slideInUp {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideOutDown {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(100px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();

// ---------- Init ----------
render();
switchTab("expense");
// ---------- Parallax Background ----------
(function parallaxBg(){
  const strength = 10; // increase to 15 for more effect
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * strength;
    const y = (e.clientY / window.innerHeight - 0.5) * strength;

    document.documentElement.style.setProperty("--bg-x", `${x}px`);
    document.documentElement.style.setProperty("--bg-y", `${y}px`);
  });
})();
