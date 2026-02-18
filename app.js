const EXP_KEY = "expenses";

function loadExpenses() {
  try { return JSON.parse(localStorage.getItem(EXP_KEY) || "[]"); }
  catch { return []; }
}
function saveExpenses(items) {
  localStorage.setItem(EXP_KEY, JSON.stringify(items));
}
function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function ymd(d) { return d.toISOString().slice(0,10); }
function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function parseDateSafe(s){
  // ensure consistent parsing
  return new Date((s || "") + "T00:00:00");
}

document.addEventListener("DOMContentLoaded", () => {
  // If not on dashboard, do nothing
  if (!location.pathname.toLowerCase().includes("dashboard.html")) return;

  // Elements
  const expenseForm = document.getElementById("expenseForm");
  const amountEl = document.getElementById("amount");
  const categoryEl = document.getElementById("category");
  const dateEl = document.getElementById("date");
  const noteEl = document.getElementById("note");

  const todayTotalEl = document.getElementById("todayTotal");
  const weekTotalEl  = document.getElementById("weekTotal");
  const monthTotalEl = document.getElementById("monthTotal");
  const yearTotalEl  = document.getElementById("yearTotal");

  const countPill = document.getElementById("countPill");
  const expenseList = document.getElementById("expenseList");

  const exportBtn = document.getElementById("exportBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  const fromDate = document.getElementById("fromDate");
  const toDate   = document.getElementById("toDate");
  const filterCategory = document.getElementById("filterCategory");
  const applyFilterBtn = document.getElementById("applyFilterBtn");
  const clearFilterBtn = document.getElementById("clearFilterBtn");
  const filteredTotalEl = document.getElementById("filteredTotal");
  const filteredCountEl = document.getElementById("filteredCount");

  const generateTipsBtn = document.getElementById("generateTipsBtn");
  const tipsList = document.getElementById("tipsList");

  const insightsBox = document.getElementById("insightsBox");
  const topCategoryBox = document.getElementById("topCategoryBox");

  // Tabs
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  function setTab(name){
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    panels.forEach(p => p.classList.toggle("active", p.id === name));
    // charts may need resize when tab becomes visible
    if (name === "report") setTimeout(renderCharts, 50);
  }

  tabs.forEach(t => {
    t.addEventListener("click", () => setTab(t.dataset.tab));
  });

  // Default date = today
  if (dateEl) dateEl.value = ymd(new Date());

  let expenses = loadExpenses();

  function totals(){
    const now = new Date();
    const todayStr = ymd(now);

    const weekStart = startOfWeek(now);
    const month = now.getMonth(), year = now.getFullYear();

    let t=0,w=0,m=0,y=0;
    for (const e of expenses){
      const amt = Number(e.amount || 0);
      const d = parseDateSafe(e.date);
      const dStr = e.date;

      if (dStr === todayStr) t += amt;

      if (d >= weekStart) w += amt;

      if (d.getFullYear() === year && d.getMonth() === month) m += amt;

      if (d.getFullYear() === year) y += amt;
    }

    if (todayTotalEl) todayTotalEl.textContent = money(t);
    if (weekTotalEl) weekTotalEl.textContent  = money(w);
    if (monthTotalEl) monthTotalEl.textContent = money(m);
    if (yearTotalEl) yearTotalEl.textContent  = money(y);

    if (countPill) countPill.textContent = `${expenses.length} items`;
  }

  function renderList(){
    if (!expenseList) return;

    const rows = [...expenses].sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    expenseList.innerHTML = "";
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

  function renderCharts(){
    // Chart.js is optional; if not loaded, skip.
    if (typeof Chart === "undefined") return;

    // Pie by category
    const byCat = {};
    for (const e of expenses){
      const c = e.category || "Other";
      byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
    }

    // Last 7 days bars
    const now = new Date();
    const days = [];
    for (let i=6;i>=0;i--){
      const d = new Date(now);
      d.setDate(now.getDate()-i);
      days.push(ymd(d));
    }
    const byDay = Object.fromEntries(days.map(d=>[d,0]));
    for (const e of expenses){
      if (byDay[e.date] != null) byDay[e.date] += Number(e.amount || 0);
    }

    const pieCanvas = document.getElementById("pieChart");
    const barCanvas = document.getElementById("barChart");

    // Destroy existing charts if present
    if (window.__pieChart) { window.__pieChart.destroy(); window.__pieChart=null; }
    if (window.__barChart) { window.__barChart.destroy(); window.__barChart=null; }

    if (pieCanvas){
      window.__pieChart = new Chart(pieCanvas, {
        type: "pie",
        data: {
          labels: Object.keys(byCat),
          datasets: [{ data: Object.values(byCat) }]
        },
        options: { responsive:true, maintainAspectRatio:false }
      });
    }

    if (barCanvas){
      window.__barChart = new Chart(barCanvas, {
        type: "bar",
        data: {
          labels: days,
          datasets: [{ data: days.map(d=>byDay[d]) }]
        },
        options: { responsive:true, maintainAspectRatio:false }
      });
    }
  }

  function renderAnalyze(){
    if (!insightsBox || !topCategoryBox) return;

    // Insights
    const total = expenses.reduce((s,e)=> s + Number(e.amount||0), 0);
    const avg   = expenses.length ? Math.round(total / expenses.length) : 0;

    // Top category
    const byCat = {};
    for (const e of expenses){
      const c = e.category || "Other";
      byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
    }
    const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];

    insightsBox.innerHTML = `
      <div class="insight"><div class="k">All-time total</div><div class="v">${money(total)}</div></div>
      <div class="insight"><div class="k">Average / entry</div><div class="v">${money(avg)}</div></div>
      <div class="insight"><div class="k">Entries</div><div class="v">${expenses.length}</div></div>
      <div class="insight"><div class="k">Top category spend</div><div class="v">${top ? money(top[1]) : "₹0"}</div></div>
    `;

    topCategoryBox.querySelector(".highlight-content").textContent =
      top ? `${top[0]} • ${money(top[1])}` : "—";
  }

  function renderAll(){
    totals();
    renderList();
    renderCharts();
    renderAnalyze();
  }

  // Add expense
  if (expenseForm){
    expenseForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const amount = Number(amountEl.value);
      const category = categoryEl.value;
      const date = dateEl.value;
      const note = (noteEl.value || "").trim();

      if (!amount || amount <= 0) return alert("Enter a valid amount.");
      if (!category) return alert("Select a category.");
      if (!date) return alert("Select a date.");

      const item = {
        id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
        amount,
        category,
        date,
        note
      };

      expenses.push(item);
      saveExpenses(expenses);

      expenseForm.reset();
      dateEl.value = ymd(new Date());
      renderAll();
    });
  }

  // Delete
  if (expenseList){
    expenseList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del]");
      if (!btn) return;
      const id = btn.getAttribute("data-del");
      expenses = expenses.filter(x => x.id !== id);
      saveExpenses(expenses);
      renderAll();
    });
  }

  // Export CSV
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

  // Clear all
  if (clearAllBtn){
    clearAllBtn.addEventListener("click", () => {
      if (!confirm("Clear all expenses? This cannot be undone.")) return;
      expenses = [];
      saveExpenses(expenses);
      renderAll();
    });
  }

  // Filters
  function applyFilter(){
    const f = fromDate?.value ? parseDateSafe(fromDate.value) : null;
    const t = toDate?.value ? parseDateSafe(toDate.value) : null;
    const cat = filterCategory?.value || "";

    let filtered = [...expenses];
    if (f) filtered = filtered.filter(e => parseDateSafe(e.date) >= f);
    if (t) filtered = filtered.filter(e => parseDateSafe(e.date) <= t);
    if (cat) filtered = filtered.filter(e => (e.category || "") === cat);

    const total = filtered.reduce((s,e)=> s + Number(e.amount||0), 0);
    if (filteredTotalEl) filteredTotalEl.textContent = money(total);
    if (filteredCountEl) filteredCountEl.textContent = String(filtered.length);
  }

  if (applyFilterBtn) applyFilterBtn.addEventListener("click", applyFilter);
  if (clearFilterBtn) clearFilterBtn.addEventListener("click", () => {
    if (fromDate) fromDate.value = "";
    if (toDate) toDate.value = "";
    if (filterCategory) filterCategory.value = "";
    if (filteredTotalEl) filteredTotalEl.textContent = "₹0";
    if (filteredCountEl) filteredCountEl.textContent = "0";
  });

  // Tips (simple rules-based tips from your data)
  if (generateTipsBtn && tipsList){
    generateTipsBtn.addEventListener("click", () => {
      const total = expenses.reduce((s,e)=> s + Number(e.amount||0), 0);
      const byCat = {};
      for (const e of expenses){
        const c = e.category || "Other";
        byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
      }
      const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];

      const tips = [];
      tips.push(`Your all-time spending is ${money(total)}. Try setting a weekly budget and track it.`);
      if (top) tips.push(`Top category is **${top[0]}** (${money(top[1])}). Consider reducing it by 10% this week.`);
      tips.push(`Use the Report tab to spot spikes. If a day is unusually high, add notes to remember why.`);
      tips.push(`A simple rule: save at least 20% of income. Track essentials vs wants separately.`);

      tipsList.innerHTML = tips.map(t => `<li>${t}</li>`).join("");
    });
  }

  // Initial render
  renderAll();
});
