// report.js — FULL DEBUGGED VERSION (All Features Preserved)

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

  const catTotals = buildCategoryTotals(monthExpenses);
  const pieLabels = catTotals.map(x => x.category);
  const pieValues = catTotals.map(x => x.total);

  const last7 = lastNDaysTotals(monthExpenses, ymd, 7);
  const barLabels = last7.map(x => x.date.slice(5));
  const barValues = last7.map(x => x.total);

  safeDestroy(pieChartInstance);
  safeDestroy(barChartInstance);

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
          callbacks: { label: (ctx) => `${ctx.label}: ${money(ctx.parsed || 0)}` }
        }
      },
      cutout: "65%"
    }
  });

  barChartInstance = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [{ label: "Spending", data: barValues, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => money(ctx.parsed.y || 0) } }
      },
      scales: {
        y: { ticks: { callback: (v) => money(v) } }
      }
    }
  });

  /* ---------- Highest / Lowest Day ---------- */

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

  const reportSection = document.getElementById("report");

  if (reportSection){

    let extremesCard = document.getElementById("rpDayExtremesCard");

    if (!extremesCard){
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

    document.getElementById("rpHighestTrend").textContent =
      highest ? `${highest.date} • ${money(highest.total)}` : "—";

    document.getElementById("rpLowestTrend").textContent =
      lowest ? `${lowest.date} • ${money(lowest.total)}` : "—";
  }
}

/* ---------------------------
   Public API
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
function startOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}


export function renderReport(expenses, money, ymd){
  // ---------------------------
  // PIE (CURRENT MONTH ONLY ✅)
  // ---------------------------
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  // ✅ Only current month expenses for charts
  const monthExpenses = expenses.filter(e => {
    const d = parseDateSafe(e.date);
    return d >= from && d <= to;
  });
  const now = new Date();
  const startM = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endM = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthExpenses = (expenses || []).filter(e => {
    const d = parseDateSafe(e.date);
    return d >= startM && d <= endM;
  });

  const catTotals = buildCategoryTotals(monthExpenses);

  // fallback if no data in this month
  const labels = catTotals.length ? catTotals.map(x => x.category) : ["No data"];
  const values = catTotals.length ? catTotals.map(x => x.total) : [1];
  const realSum = catTotals.length ? values.reduce((a,b)=>a+(Number(b)||0),0) : 0;
  const total = values.reduce((a,b)=> a + (Number(b)||0), 0) || 1;

  const colorMap = {
    Food: "#00FFC8",
    Travel: "#7C4DFF",
    Shopping: "#FF4DA6",
    Bills: "#FFB020",
    Entertainment: "#00B7FF",
    Other: "#A0A7B4",
    "No data": "#A0A7B4"
  };
  const baseColors = labels.map(l => colorMap[l] || "#A0A7B4");

  const donutShadow = {
    id: "donutShadow",
    beforeDatasetsDraw(chart){
      const ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 10;
    },
    afterDatasetsDraw(chart){
      chart.ctx.restore();
    }
  };

  const centerTotalPlugin = {
    id: "centerTotalPlugin",
    afterDraw(chart){
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "700 14px DM Sans, sans-serif";
      ctx.fillText("This Month", x, y - 12);

      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "800 20px Syne, sans-serif";
      ctx.fillText(money(realSum), x, y + 12);
      ctx.restore();
    }
  };

  const percentLabels = {
    id: "percentLabels",
    afterDatasetsDraw(chart){
      if (!catTotals.length) return; // don't show % for "No data"
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;

      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 12px DM Sans, sans-serif";

      meta.data.forEach((arc, i) => {
        const v = Number(values[i] || 0);
        if (!v) return;

        const pct = (v / total) * 100;
        if (pct < 4) return;

        const p = arc.getProps(["x","y","startAngle","endAngle","innerRadius","outerRadius"], true);
        const angle = (p.startAngle + p.endAngle) / 2;
        const r = (p.innerRadius + p.outerRadius) / 2;

        const x = p.x + Math.cos(angle) * r;
        const y = p.y + Math.sin(angle) * r;

        ctx.fillText(`${pct.toFixed(0)}%`, x, y);
      });

      ctx.restore();
    }
  };

  const pieCtx = document.getElementById("pieChart")?.getContext("2d");
  pieChart = ensureChart(pieCtx, pieChart, {
    type: "doughnut",
    plugins: [donutShadow, centerTotalPlugin, percentLabels],
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: baseColors.map(c => rgba(c, 0.55)),
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.85)",
        spacing: 7,
        borderRadius: 14,
        cutout: "70%",
        hoverBorderWidth: 3,
        hoverBorderColor: "rgba(255,255,255,0.98)",
        hoverOffset: 14
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 12 },
      animation: {
        duration: 1200,
        easing: "easeOutQuart",
        animateRotate: true,
        animateScale: true
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "rgba(255,255,255,0.88)",
            boxWidth: 12,
            boxHeight: 12,
            padding: 14,
            font: { size: 12, weight: "600" },
            generateLabels(chart){
              const ds = chart.data.datasets[0];
              return chart.data.labels.map((l, i) => {
                const v = Number(ds.data[i] || 0);
                const pct = catTotals.length ? ((v / total) * 100) : 0;
                return {
                  text: `${l} • ${pct.toFixed(0)}%`,
                  fillStyle: baseColors[i],
                  strokeStyle: "rgba(255,255,255,0.25)",
                  lineWidth: 1,
                  hidden: !chart.getDataVisibility(i),
                  index: i
                };
              });
            }
          },
          onClick(e, legendItem, legend){
            const i = legendItem.index;
            legend.chart.toggleDataVisibility(i);
            legend.chart.update();
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (!catTotals.length) return `No expenses in current month`;
              const v = Number(ctx.parsed || 0);
              const pct = (v / total) * 100;
              return `${ctx.label}: ${money(v)} (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });

  // Apply gradients after chart area exists
  if (pieChart?.chartArea){
    const { ctx, chartArea } = pieChart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;

    const grads = baseColors.map((hex) => {
      const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(chartArea.width, chartArea.height) / 2);
      g.addColorStop(0, rgba(hex, 0.95));
      g.addColorStop(0.55, rgba(hex, 0.55));
      g.addColorStop(1, rgba(hex, 0.18));
      return g;
    });

    pieChart.data.datasets[0].backgroundColor = grads;
    pieChart.update();
  }

  // ---------------------------
  // BAR (last 7 days) ✅ (keep as is)
  // ---------------------------
  const last7 = lastNDaysTotals(monthExpenses, ymd, 7);
  const barCtx = document.getElementById("barChart")?.getContext("2d");

  barChart = ensureChart(barCtx, barChart, {
    type: "bar",
    data: {
      labels: last7.map(x => x.date.slice(5)),
      datasets: [{
        label: "Spend",
        data: last7.map(x => x.total),
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "rgba(255,255,255,0.75)" }, grid: { color: "rgba(255,255,255,0.08)" } },
        x: { ticks: { color: "rgba(255,255,255,0.75)" }, grid: { display: false } }
      }
    }
  });
}