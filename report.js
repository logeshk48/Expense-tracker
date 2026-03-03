// report.js — CLEAN FULL VERSION (Current Month Charts + Filters + Extremes)

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

function safeDestroy(chart) {
  try { chart?.destroy?.(); } catch {}
}
function hexToRgb(hex){
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function rgba(hex, a){
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ✅ helper: safely reuse chart instance
function ensureChart(ctx, instance, config){
  if (!ctx) return instance;
  safeDestroy(instance);
  return new Chart(ctx, config);
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

function lastNDaysTotals(list, ymd, n = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);   // ✅ force start of day

  const days = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const key = ymd(d);   // formatted YYYY-MM-DD
    days.push({ date: key, total: 0 });
  }

  const indexMap = new Map(days.map((x, i) => [x.date, i]));

  for (const e of list) {
    if (!e.date) continue;
    const idx = indexMap.get(e.date);
    if (idx !== undefined) {
      days[idx].total += Number(e.amount || 0);
    }
  }

  return days;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
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
   Filters
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

function renderFilteredCards(list) {
  const { filteredTotal, filteredCount } = getEls();
  const total = (list || []).reduce((s, x) => s + Number(x.amount || 0), 0);
  if (filteredTotal) filteredTotal.textContent = _money(total);
  if (filteredCount) filteredCount.textContent = String((list || []).length);
}

/* ---------------------------
   Extremes Card (Highest/Lowest day)
--------------------------- */
function renderExtremesCard(expenses, money) {
  const byDay = new Map();
  for (const e of expenses) {
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

  if (hiEl) hiEl.textContent = highest ? `${highest.date} • ${money(highest.total)}` : "—";
  if (loEl) loEl.textContent = lowest ? `${lowest.date} • ${money(lowest.total)}` : "—";
}

/* ---------------------------
   Charts (CURRENT MONTH ONLY)
--------------------------- */
function renderChartsCurrentMonth(allExpenses, money, ymd) {
  const { pieCanvas, barCanvas } = getEls();
  if (!pieCanvas || !barCanvas) return;

  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const monthExpenses = (allExpenses || []).filter(e => {
    const d = parseDateSafe(e.date);
    return d >= from && d <= to;
  });

  // PIE
  const catTotals = buildCategoryTotals(monthExpenses);
  const pieLabels = catTotals.length ? catTotals.map(x => x.category) : ["No data"];
  const pieValues = catTotals.length ? catTotals.map(x => x.total) : [1];

  // BAR (last 7 days inside current month list)
  const last7 = lastNDaysTotals(monthExpenses, ymd, 7);
  const barLabels = last7.map(x => x.date.slice(5));
  const barValues = last7.map(x => x.total);

  safeDestroy(pieChartInstance);
  safeDestroy(barChartInstance);

  pieChartInstance = new Chart(pieCanvas, {
    type: "doughnut",
    data: {
      labels: pieLabels,
      datasets: [{ data: pieValues, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (!catTotals.length) return "No expenses in current month";
              return `${ctx.label}: ${money(ctx.parsed || 0)}`;
            }
          }
        }
      }
    }
  });

  barChartInstance = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [{ label: "Spending", data: barValues, borderWidth: 0, borderRadius: 10 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => money(ctx.parsed.y || 0) } }
      }
    }
  });
}

/* ---------------------------
   Public API
--------------------------- */
export function initReportUI({ getExpenses, money, ymd }) {
  _getExpenses = getExpenses;
  _money = money;
  _ymd = ymd;

  const { applyBtn, clearBtn, fromDate, toDate, filterCategory } = getEls();

  // prevent double binding
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
  // keep filter cards updated
  renderFilteredCards(expenses);

  // charts only current month ✅
  renderChartsCurrentMonth(expenses, money, ymd);

  // extremes card (based on ALL data — if you want month only tell me)
  renderExtremesCard(expenses, money);
}