// report.js — FULL WORKING VERSION (No ensureChart, Today included, Month Pie)

let _getExpenses = null;
let _money = null;
let _ymd = null;

let pieChartInstance = null;
let barChartInstance = null;

/* ---------------------------
   Helpers
--------------------------- */

function parseDateSafe(s) {
  if (!s) return new Date(0);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// ✅ IMPORTANT: local YYYY-MM-DD (NOT toISOString)
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeDestroy(chart) {
  try { chart?.destroy?.(); } catch {}
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function buildCategoryTotals(list) {
  const m = new Map();
  for (const e of list) {
    const c = e.category || "Other";
    m.set(c, (m.get(c) || 0) + Number(e.amount || 0));
  }
  const arr = Array.from(m.entries()).map(([k, v]) => ({ category: k, total: v }));
  arr.sort((a, b) => b.total - a.total);
  return arr;
}

// ✅ Last N days INCLUDING TODAY (local dates)
function lastNDaysTotals(list, n = 7) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: ymdLocal(d), total: 0 });
  }

  const idx = new Map(days.map((x, i) => [x.date, i]));
  for (const e of list) {
    const i = idx.get(e.date);
    if (i != null) days[i].total += Number(e.amount || 0);
  }

  return days;
}

/* ---------------------------
   DOM
--------------------------- */

function getEls() {
  return {
    pieCanvas: document.getElementById("pieChart"),
    barCanvas: document.getElementById("barChart"),

    fromDate: document.getElementById("fromDate"),
    toDate: document.getElementById("toDate"),
    filterCategory: document.getElementById("filterCategory"),
    applyBtn: document.getElementById("applyFilterBtn"),
    clearBtn: document.getElementById("clearFilterBtn"),

    filteredTotal: document.getElementById("filteredTotal"),
    filteredCount: document.getElementById("filteredCount"),
  };
}

/* ---------------------------
   Filtering
--------------------------- */

function applyFilter(expenses) {
  const { fromDate, toDate, filterCategory } = getEls();

  const from = fromDate?.value ? parseDateSafe(fromDate.value) : null;
  const to = toDate?.value ? parseDateSafe(toDate.value) : null;
  const cat = (filterCategory?.value || "").trim();

  return (expenses || []).filter(e => {
    const d = parseDateSafe(e.date);

    if (from && d < from) return false;

    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }

    if (cat && (e.category || "") !== cat) return false;

    return true;
  });
}

function renderFilteredCards(expenses) {
  const { filteredTotal, filteredCount } = getEls();
  const total = (expenses || []).reduce((s, x) => s + Number(x.amount || 0), 0);

  if (filteredTotal) filteredTotal.textContent = _money(total);
  if (filteredCount) filteredCount.textContent = String((expenses || []).length);
}

/* ---------------------------
   Extra card: Highest/Lowest day
--------------------------- */

function renderDailyExtremes(expenses) {
  const byDay = new Map();
  for (const e of (expenses || [])) {
    if (!e.date) continue;
    byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount || 0));
  }

  let highest = null;
  let lowest = null;

  for (const [date, total] of byDay.entries()) {
    if (!highest || total > highest.total) highest = { date, total };
    if (!lowest || total < lowest.total) lowest = { date, total };
  }

  const reportSection = document.getElementById("report");
  if (!reportSection) return;

  let extremesCard = document.getElementById("rpDayExtremesCard");
  if (!extremesCard) {
    extremesCard = document.createElement("div");
    extremesCard.id = "rpDayExtremesCard";
    extremesCard.className = "card";
    extremesCard.style.marginTop = "16px";

    extremesCard.innerHTML = `
      <div class="card-header">
        <h2>Daily Extremes</h2>
        <p class="subtitle">Highest & lowest spending day</p>
      </div>
      <div class="result-cards">
        <div class="result-card">
          <div class="result-label">Highest Single Day</div>
          <div class="result-value" style="color:#e53935;" id="rpHighestTrend">—</div>
        </div>
        <div class="result-card">
          <div class="result-label">Lowest Single Day</div>
          <div class="result-value" style="color:#43a047;" id="rpLowestTrend">—</div>
        </div>
      </div>
    `;

    reportSection.appendChild(extremesCard);
  }

  const hiEl = document.getElementById("rpHighestTrend");
  const loEl = document.getElementById("rpLowestTrend");

  if (hiEl) hiEl.textContent = highest ? `${highest.date} • ${_money(highest.total)}` : "—";
  if (loEl) loEl.textContent = lowest ? `${lowest.date} • ${_money(lowest.total)}` : "—";
}

/* ---------------------------
   Charts (Pie + Bar)
--------------------------- */

function renderCharts(expenses) {
  const { pieCanvas, barCanvas } = getEls();
  if (!pieCanvas || !barCanvas) return;

  const now = new Date();
  const fromM = startOfMonth(now);
  const toM = endOfMonth(now);

  // ✅ Current Month ONLY for PIE
  const monthExpenses = (expenses || []).filter(e => {
    const d = parseDateSafe(e.date);
    return d >= fromM && d <= toM;
  });

  const catTotals = buildCategoryTotals(monthExpenses);
  const pieLabels = catTotals.length ? catTotals.map(x => x.category) : ["No data"];
  const pieValues = catTotals.length ? catTotals.map(x => x.total) : [1];

  // ✅ Bar: last 7 days INCLUDING TODAY (use all expenses)
  const last7 = lastNDaysTotals(expenses || [], 7);
  const barLabels = last7.map(x => x.date.slice(5)); // MM-DD
  const barValues = last7.map(x => x.total);

  safeDestroy(pieChartInstance);
  safeDestroy(barChartInstance);

  // PIE
  pieChartInstance = new Chart(pieCanvas, {
    type: "doughnut",
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieValues,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${_money(ctx.parsed || 0)}`
          }
        }
      }
    }
  });

  // BAR
  barChartInstance = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [{
        label: "Spending",
        data: barValues,
        borderWidth: 0,
        borderRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => _money(ctx.parsed.y || 0) } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => _money(v) } }
      }
    }
  });

  // Daily extremes based on filtered/current list? -> use ALL expenses
  renderDailyExtremes(expenses || []);
}

/* ---------------------------
   Public API
--------------------------- */

export function initReportUI({ getExpenses, money, ymd }) {
  _getExpenses = getExpenses;
  _money = money;
  _ymd = ymd; // kept for compatibility (not used now)

  const { applyBtn, clearBtn, fromDate, toDate, filterCategory } = getEls();

  // prevent double-binding
  if (applyBtn && applyBtn.dataset.bound === "1") return;
  if (applyBtn) applyBtn.dataset.bound = "1";

  applyBtn?.addEventListener("click", () => {
    const all = _getExpenses ? _getExpenses() : [];
    const filtered = applyFilter(all);
    renderFilteredCards(filtered);
  });

  clearBtn?.addEventListener("click", () => {
    if (fromDate) fromDate.value = "";
    if (toDate) toDate.value = "";
    if (filterCategory) filterCategory.value = "";
    const all = _getExpenses ? _getExpenses() : [];
    renderFilteredCards(all);
  });

  const all = _getExpenses ? _getExpenses() : [];
  renderFilteredCards(all);
}

export function renderReport(expenses, money, ymd) {
  // Use passed args if available (safety)
  if (money) _money = money;
  if (ymd) _ymd = ymd;

  renderCharts(expenses || []);
}