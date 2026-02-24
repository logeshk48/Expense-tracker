// report.js — Report tab module (Chart.js + Filters + Premium Additions)
// Includes:
// 1) Category Distribution donut
// 2) Daily Spending Trend (last 7 days)
// 3) Filter UI + filtered cards
// 4) Premium card: Month vs Last Month + Top 3 categories + 6-month trend
// 5) Averages: Avg/Active Day + Avg/Calendar Day + Avg/Month
// 6) Highest & Lowest single day shown under Daily Trend

let _getExpenses = null;
let _money = null;
let _ymd = null;

let pieChartInstance = null;
let barChartInstance = null;
let monthlyTrendInstance = null;

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
   Filter UI helpers
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
   Core charts (existing) + Highest/Lowest under bar chart
--------------------------- */
function renderCharts(expenses, money, ymd){
  const { pieCanvas, barCanvas } = getEls();
  if (!pieCanvas || !barCanvas) return;

  // Category totals (donut)
  const catTotals = buildCategoryTotals(expenses);
  const pieLabels = catTotals.map(x => x.category);
  const pieValues = catTotals.map(x => x.total);

  // Last 7 days (bar)
  const last7 = lastNDaysTotals(expenses, ymd, 7);
  const barLabels = last7.map(x => x.date.slice(5));
  const barValues = last7.map(x => x.total);

  // Destroy old charts
  safeDestroy(pieChartInstance);
  safeDestroy(barChartInstance);

  // Donut chart
  pieChartInstance = new Chart(pieCanvas, {
    type: "doughnut",
    data: {
      labels: pieLabels.length ? pieLabels : ["No Data"],
      datasets: [{
        data: pieValues.length ? pieValues : [1],
        borderWidth: 0,
      }]
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

  // Bar chart
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

  // -----------------------------
  // HIGHEST & LOWEST SINGLE DAY
  // -----------------------------

  const byDay = new Map();

  for (const e of expenses){
    byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount || 0));
  }

  let highest = null;
  let lowest = null;

  for (const [date, total] of byDay.entries()){
    if (!highest || total > highest.total){
      highest = { date, total };
    }
    if (!lowest || total < lowest.total){
      lowest = { date, total };
    }
  }

  const barContainer = barCanvas.parentElement;

  if (barContainer){

    let dayBlock = barContainer.querySelector("#rpDayExtremesTrend");

    if (!dayBlock){
      dayBlock = document.createElement("div");
      dayBlock.id = "rpDayExtremesTrend";
      dayBlock.className = "result-cards";
      dayBlock.style.marginTop = "14px";

      dayBlock.innerHTML = `
        <div class="result-card">
          <div class="result-label">Highest Single Day</div>
          <div class="result-value" style="color:#e53935;" id="rpHighestTrend">—</div>
        </div>
        <div class="result-card">
          <div class="result-label">Lowest Single Day</div>
          <div class="result-value" style="color:#43a047;" id="rpLowestTrend">—</div>
        </div>
      `;

      barContainer.appendChild(dayBlock);
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
   PREMIUM REPORT ADDITIONS (no HTML edits)
--------------------------- */
function monthKey(dateObj){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2,"0");
  return `${y}-${m}`;
}

function inMonth(e, y, m0){
  const d = parseDateSafe(e.date);
  return d.getFullYear() === y && d.getMonth() === m0;
}

function computeMonthTotals(all){
  const now = new Date();
  const y = now.getFullYear();
  const m0 = now.getMonth();

  const lastMonthDate = new Date(y, m0 - 1, 1);
  const ly = lastMonthDate.getFullYear();
  const lm0 = lastMonthDate.getMonth();

  const thisMonth = all.filter(e => inMonth(e, y, m0));
  const lastMonth = all.filter(e => inMonth(e, ly, lm0));

  const thisTotal = thisMonth.reduce((s,x)=> s + Number(x.amount||0), 0);
  const lastTotal = lastMonth.reduce((s,x)=> s + Number(x.amount||0), 0);

  const diff = thisTotal - lastTotal;
  const pct = lastTotal > 0 ? (diff / lastTotal) * 100 : null;

  return { thisTotal, lastTotal, diff, pct, thisMonth };
}

function lastNMonthsSeries(all, n=6){
  const now = new Date();
  const keys = [];
  for (let i=n-1; i>=0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }

  const totals = new Map(keys.map(k => [k, 0]));
  for (const e of all){
    const d = parseDateSafe(e.date);
    const k = monthKey(d);
    if (totals.has(k)) totals.set(k, totals.get(k) + Number(e.amount||0));
  }

  return {
    labels: keys.map(k => k.slice(5)), // MM
    values: keys.map(k => totals.get(k) || 0),
  };
}

function ensurePremiumCard(){
  const reportSection = document.getElementById("report");
  if (!reportSection) return null;

  // Prevent duplicates
  const existing = reportSection.querySelector('[data-report-premium="1"]');
  if (existing) return existing;

  // Create a new card using existing classes (design stays same)
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("data-report-premium", "1");

  card.innerHTML = `
    <div class="card-header">
      <h2>Insights & Trends</h2>
      <p class="subtitle">Month comparison • Top categories • 6-month trend</p>
    </div>

    <div class="result-cards" id="rpBaseCards">
      <div class="result-card">
        <div class="result-label">This Month</div>
        <div class="result-value" id="rpThisMonth">₹0</div>
      </div>
      <div class="result-card">
        <div class="result-label">Last Month</div>
        <div class="result-value" id="rpLastMonth">₹0</div>
      </div>
      <div class="result-card">
        <div class="result-label">Change</div>
        <div class="result-value" id="rpChange">₹0</div>
      </div>
      <div class="result-card">
        <div class="result-label">Top Category</div>
        <div class="result-value" id="rpTopCat">—</div>
      </div>
      <div class="result-card">
        <div class="result-label">2nd Category</div>
        <div class="result-value" id="rpTopCat2">—</div>
      </div>
      <div class="result-card">
        <div class="result-label">3rd Category</div>
        <div class="result-value" id="rpTopCat3">—</div>
      </div>
    </div>

    <div class="chart-container" style="margin-top:14px;">
      <canvas id="monthlyTrendChart"></canvas>
    </div>
  `;

  // Append at end of report section (no HTML file edit)
  reportSection.appendChild(card);
  return card;
}

function renderPremium(allExpenses){
  const card = ensurePremiumCard();
  if (!card) return;

  const thisEl = document.getElementById("rpThisMonth");
  const lastEl = document.getElementById("rpLastMonth");
  const chgEl  = document.getElementById("rpChange");
  const top1El = document.getElementById("rpTopCat");
  const top2El = document.getElementById("rpTopCat2");
  const top3El = document.getElementById("rpTopCat3");
  const trendCanvas = document.getElementById("monthlyTrendChart");

  const { thisTotal, lastTotal, diff, pct, thisMonth } = computeMonthTotals(allExpenses);

  if (thisEl) thisEl.textContent = _money(thisTotal);
  if (lastEl) lastEl.textContent = _money(lastTotal);

  const sign = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
  const pctText = pct == null ? "" : ` (${pct.toFixed(1)}%)`;
  if (chgEl) chgEl.textContent = `${sign} ${_money(Math.abs(diff))}${pctText}`;

  // Top 3 categories from THIS MONTH
  const top = buildCategoryTotals(thisMonth);
  const t1 = top[0] ? `${top[0].category} • ${_money(top[0].total)}` : "—";
  const t2 = top[1] ? `${top[1].category} • ${_money(top[1].total)}` : "—";
  const t3 = top[2] ? `${top[2].category} • ${_money(top[2].total)}` : "—";
  if (top1El) top1El.textContent = t1;
  if (top2El) top2El.textContent = t2;
  if (top3El) top3El.textContent = t3;

  // 6-month trend chart
  if (trendCanvas){
    const series = lastNMonthsSeries(allExpenses, 6);

    safeDestroy(monthlyTrendInstance);
    monthlyTrendInstance = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [{
          label: "Monthly Spend",
          data: series.values,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3
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
          y: { ticks: { callback: (v) => _money(v) } }
        }
      }
    });
  }

  // -----------------------------
  // AVERAGE CALCULATIONS (Premium Card)
  // -----------------------------
  const totalOverall = allExpenses.reduce((s,x)=> s + Number(x.amount||0), 0);

  const uniqueDays = new Set(allExpenses.map(e => e.date)).size || 1;
  const avgPerActiveDay = totalOverall / uniqueDays;

  const now = new Date();
  const daysPassed = now.getDate() || 1;
  const avgPerCalendarDay = thisTotal / daysPassed;

  const monthSet = new Set(
    allExpenses.map(e => {
      const d = parseDateSafe(e.date);
      return `${d.getFullYear()}-${d.getMonth()}`; // unique month bucket
    })
  );
  const totalMonths = monthSet.size || 1;
  const avgPerMonth = totalOverall / totalMonths;

  let avgBlock = document.getElementById("rpAveragesBlock");
  if (!avgBlock){
    avgBlock = document.createElement("div");
    avgBlock.id = "rpAveragesBlock";
    avgBlock.className = "result-cards";
    avgBlock.style.marginTop = "12px";

    avgBlock.innerHTML = `
      <div class="result-card">
        <div class="result-label">Avg / Active Day</div>
        <div class="result-value" id="rpAvgActive">₹0</div>
      </div>
      <div class="result-card">
        <div class="result-label">Avg / Calendar Day</div>
        <div class="result-value" id="rpAvgCalendar">₹0</div>
      </div>
      <div class="result-card">
        <div class="result-label">Avg / Month</div>
        <div class="result-value" id="rpAvgMonth">₹0</div>
      </div>
    `;

    card.appendChild(avgBlock);
  }

  const a1 = document.getElementById("rpAvgActive");
  const a2 = document.getElementById("rpAvgCalendar");
  const a3 = document.getElementById("rpAvgMonth");
  if (a1) a1.textContent = _money(avgPerActiveDay);
  if (a2) a2.textContent = _money(avgPerCalendarDay);
  if (a3) a3.textContent = _money(avgPerMonth);
}

/* ---------------------------
   Public API
--------------------------- */
export function initReportUI({ getExpenses, money, ymd }){
  _getExpenses = getExpenses;
  _money = money;
  _ymd = ymd;

  const { applyBtn, clearBtn, fromDate, toDate, filterCategory } = getEls();

  // Prevent double binding
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

  // Initial cards + premium card
  const all = _getExpenses ? _getExpenses() : [];
  renderFilteredCards(all);
  ensurePremiumCard();
  renderPremium(all);
}

export function renderReport(expenses, money, ymd){
  // Filter cards follow current selection
  const filtered = applyFilter(expenses);
  renderFilteredCards(filtered);

  // Charts show ALL expenses (recommended)
  renderCharts(expenses, money, ymd);

  // Premium block
  renderPremium(expenses);
}