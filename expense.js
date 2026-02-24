// expense.js — Expense tab engine (no UI changes)

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

export function initExpenseEngine({
  uid,
  getExpenses,
  setExpenses,
  money,
  ymd,
  saveExpenseToCloud,
  deleteExpenseFromCloud,
  onExpensesChanged
}) {
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

  // Default date
  if (dateEl && !dateEl.value) dateEl.value = ymd(new Date());

  function computeTotals(expenses){
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

  function renderList(expenses){
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

  function renderExpense(){
    const expenses = getExpenses();
    computeTotals(expenses);
    renderList(expenses);
  }

  // Add expense
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

      setExpenses([...getExpenses(), item]);
      renderExpense();
      onExpensesChanged?.();

      expenseForm.reset();
      if (dateEl) dateEl.value = ymd(new Date());
    });
  }

  // Delete expense
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

      setExpenses(getExpenses().filter(x => x.id !== id));
      renderExpense();
      onExpensesChanged?.();
    });
  }

  // initial render
  renderExpense();

  return { renderExpense };
}