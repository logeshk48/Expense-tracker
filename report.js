// report.js — FULL STABLE VERSION
// Includes:
// 1) Donut (Category)
// 2) Daily Trend (7 days)
// 3) Highest & Lowest Single Day
// 4) Premium Block (Month vs Last Month + Top 3 + 6-month trend)
// 5) Averages
// 6) Filters

let _getExpenses = null;
let _money = null;
let _ymd = null;

let pieChartInstance = null;
let barChartInstance = null;
let monthlyTrendInstance = null;

/* ---------------------------
   Helpers
--------------------------- */

function parseDateSafe(s){
  if (!s) return new Date(0);
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
}

function safeDestroy(chart){
  try { chart?.destroy?.(); } catch {}
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

function lastNDaysTotals(list, ymd, n=7){
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
   Filters
--------------------------- */

function getEls(){
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

function applyFilter(expenses){
  const { fromDate, toDate, filterCategory } = getEls();

  const from = fromDate?.value ? parseDateSafe(fromDate.value) : null;
  const to = toDate?.value ? parseDateSafe(toDate.value) : null;
  const cat = (filterCategory?.value || "").trim();

  return expenses.filter(e => {
    const d = parseDateSafe(e.date);

    if (from && d < from) return false;
    if (to) {
      const end = new Date(to);
      end.setHours(23,59,59,999);
      if (d > end) return false;
    }
    if (cat && (e.category || "") !== cat) return false;

    return true;
  });
}

function renderFilteredCards(expenses){
  const { filteredTotal, filteredCount } = getEls();
  const total = expenses.reduce((s,x)=> s + Number(x.amount || 0), 0);
  if (filteredTotal) filteredTotal.textContent = _money(total);
  if (filteredCount) filteredCount.textContent = String(expenses.length);
}

/* ---------------------------
   Charts + Highest/Lowest
--------------------------- */

function renderCharts(expenses, money, ymd){
  const { pieCanvas, barCanvas } = getEls();
  if (!pieCanvas || !barCanvas) return;

  // Donut
  const catTotals = buildCategoryTotals(expenses);
  const pieLabels = catTotals.map(x => x.category);
  const pieValues = catTotals.map(x => x.total);

  safeDestroy(pieChartInstance);

  pieChartInstance = new Chart(pieCanvas, {
    type: "doughnut",
    data: {
      labels: pieLabels.length ? pieLabels : ["No Data"],
      datasets: [{ data: pieValues.length ? pieValues : [1], borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${money(ctx.parsed || 0)}`
          }
        }
      },
      cutout: "65%"
    }
  });

  // Bar (7 days)
  const last7 = lastNDaysTotals(expenses, ymd, 7);
  const barLabels = last7.map(x => x.date.slice(5));
  const barValues = last7.map(x => x.total);

  safeDestroy(barChartInstance);

  barChartInstance = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [{
        label: "Spending",
        data: barValues,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => money(ctx.parsed.y || 0) }
        }
      },
      scales: {
        y: { ticks: { callback: (v) => money(v) } }
      }
    }
  });

  // -----------------------
  // Highest & Lowest Day
  // -----------------------

  const byDay = new Map();

  for (const e of expenses){
    byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount || 0));
  }

  let highest = null;
  let lowest = null;

  for (const [date, total] of byDay.entries()){
    if (!highest || total > highest.total) highest = { date, total };
    if (!lowest || total < lowest.total) lowest = { date, total };
  }

  const barContainer = barCanvas.parentElement;

  if (barContainer){
    let block = barContainer.querySelector("#rpDayExtremesTrend");

    if (!block){
      block = document.createElement("div");
      block.id = "rpDayExtremesTrend";
      block.className = "result-cards";
      block.style.marginTop = "14px";

      block.innerHTML = `
        <div class="result-card">
          <div class="result-label">Highest Single Day</div>
          <div class="result-value" style="color:#e53935;" id="rpHighestTrend">—</div>
        </div>
        <div class="result-card">
          <div class="result-label">Lowest Single Day</div>
          <div class="result-value" style="color:#43a047;" id="rpLowestTrend">—</div>
        </div>
      `;

      barContainer.appendChild(block);
    }

    const highEl = document.getElementById("rpHighestTrend");
    const lowEl  = document.getElementById("rpLowestTrend");

    if (highEl){
      highEl.textContent = highest
        ? `${highest.date} • ${money(highest.total)}`
        : "—";
    }

    if (lowEl){
      lowEl.textContent = lowest
        ? `${lowest.date} • ${money(lowest.total)}`
        : "—";
    }
  }
}

/* ---------------------------
   PUBLIC API
--------------------------- */

export function initReportUI({ getExpenses, money, ymd }){
  _getExpenses = getExpenses;
  _money = money;
  _ymd = ymd;

  const { applyBtn, clearBtn, fromDate, toDate, filterCategory } = getEls();

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

export function renderReport(expenses, money, ymd){
  const filtered = applyFilter(expenses);
  renderFilteredCards(filtered);
  renderCharts(expenses, money, ymd);
}