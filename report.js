// report.js
let pieChart = null;
let barChart = null;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

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

function ensureChart(ctx, existing, config){
  if (!ctx) return null;
  if (existing) existing.destroy();
  return new Chart(ctx, config);
}

function hexToRgb(hex){
  const h = (hex || "").replace("#","");
  if (h.length !== 6) return {r:255,g:255,b:255};
  return {
    r: parseInt(h.slice(0,2), 16),
    g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16)
  };
}
function rgba(hex, a){
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function initReportUI({ getExpenses, money, ymd }){
  // Filter buttons
  const applyBtn = document.getElementById("applyFilterBtn");
  const clearBtn = document.getElementById("clearFilterBtn");

  if (applyBtn){
    applyBtn.addEventListener("click", () => {
      const expenses = getExpenses();
      const filtered = filterExpenses(expenses);
      updateFilterCards(filtered, money);
    });
  }

  if (clearBtn){
    clearBtn.addEventListener("click", () => {
      const fromDateEl = document.getElementById("fromDate");
      const toDateEl = document.getElementById("toDate");
      const filterCategoryEl = document.getElementById("filterCategory");
      if (fromDateEl) fromDateEl.value = "";
      if (toDateEl) toDateEl.value = "";
      if (filterCategoryEl) filterCategoryEl.value = "";

      updateFilterCards([], money, true);
    });
  }

  // First paint
  renderReport(getExpenses(), money, ymd);
}

function filterExpenses(expenses){
  const fromDateEl = document.getElementById("fromDate");
  const toDateEl = document.getElementById("toDate");
  const filterCategoryEl = document.getElementById("filterCategory");

  const from = fromDateEl?.value ? parseDateSafe(fromDateEl.value) : null;
  const to = toDateEl?.value ? parseDateSafe(toDateEl.value) : null;
  const cat = (filterCategoryEl?.value || "").trim();

  return expenses.filter(e => {
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
}

function updateFilterCards(filtered, money, cleared=false){
  const filteredTotalEl = document.getElementById("filteredTotal");
  const filteredCountEl = document.getElementById("filteredCount");

  if (cleared){
    if (filteredTotalEl) filteredTotalEl.textContent = money(0);
    if (filteredCountEl) filteredCountEl.textContent = "0";
    return;
  }

  const total = filtered.reduce((s,x)=> s + Number(x.amount || 0), 0);
  if (filteredTotalEl) filteredTotalEl.textContent = money(total);
  if (filteredCountEl) filteredCountEl.textContent = String(filtered.length);
}

export function renderReport(expenses, money, ymd){
  // PIE
  const catTotals = buildCategoryTotals(expenses);
  const labels = catTotals.map(x => x.category);
  const values = catTotals.map(x => x.total);
  const total = values.reduce((a,b)=> a + (Number(b)||0), 0) || 1;

  const colorMap = {
    Food: "#00FFC8",
    Travel: "#7C4DFF",
    Shopping: "#FF4DA6",
    Bills: "#FFB020",
    Entertainment: "#00B7FF",
    Other: "#A0A7B4"
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

      const sum = values.reduce((a,b)=>a+(Number(b)||0),0);

      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "700 14px DM Sans, sans-serif";
      ctx.fillText("Total", x, y - 12);

      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "800 20px Syne, sans-serif";
      ctx.fillText(money(sum), x, y + 12);
      ctx.restore();
    }
  };

  const percentLabels = {
    id: "percentLabels",
    afterDatasetsDraw(chart){
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
        backgroundColor: baseColors.map(c => rgba(c, 0.55)), // replaced with gradients after area exists
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
                const pct = ((v / total) * 100);
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

  // BAR (last 7 days)
  const last7 = lastNDaysTotals(expenses, ymd, 7);
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