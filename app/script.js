// PakExpense - core logic
// Data model: { id, title, amount, category, date }

const STORAGE_KEY = 'pakexpense_data';

const expenseForm = document.getElementById('expenseForm');
const titleInput = document.getElementById('titleInput');
const amountInput = document.getElementById('amountInput');
const categoryInput = document.getElementById('categoryInput');
const dateInput = document.getElementById('dateInput');
const expenseList = document.getElementById('expenseList');
const emptyState = document.getElementById('emptyState');
const filterCategory = document.getElementById('filterCategory');

const totalAmountEl = document.getElementById('totalAmount');
const totalCountEl = document.getElementById('totalCount');
const topCategoryEl = document.getElementById('topCategory');

let expenses = loadExpenses();

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// Escapes HTML so a title like "<img src=x onerror=alert(1)>" can't inject markup
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderExpenses() {
  const filter = filterCategory ? filterCategory.value : 'all';
  const visible = filter === 'all' ? expenses : expenses.filter((e) => e.category === filter);

  expenseList.innerHTML = '';

  visible.forEach((exp) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(exp.title)}</strong> - Rs ${exp.amount}
        <div class="expense-meta">${escapeHtml(exp.category)} • ${exp.date}</div>
      </div>
      <button class="delete-btn" data-id="${exp.id}">Delete</button>
    `;
    expenseList.appendChild(li);
  });

  emptyState.style.display = visible.length === 0 ? 'block' : 'none';

  // Listeners are rebuilt every render because innerHTML replacement above
  // destroys any listener that was attached to the old elements.
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteExpense(btn.dataset.id);
    });
  });

  updateSummary();
}

function updateSummary() {
  const categoryTotals = {};
  
  expenses.forEach(expense => {
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
  });
  
  // Calculate totals
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('totalAmount').textContent = `Rs ${totalAmount}`;
  document.getElementById('totalCount').textContent = expenses.length;
  
  // Find top category - use strict > (not >=) to keep the first category on ties
  let topCategory = '-';
  let maxTotal = 0;
  
  Object.entries(categoryTotals).forEach(([category, total]) => {
    if (total > maxTotal) {  // Strict > keeps first category on tie
      maxTotal = total;
      topCategory = category;
    }
  });
  
  document.getElementById('topCategory').textContent = topCategory;
}

function addExpense(title, amountRaw, category, date) {
  const newExpense = {
    id: Date.now().toString(),
    title: title.trim(),
    amount: parseFloat(amountRaw),
    category,
    date,
  };

  // parseFloat('') is NaN, and NaN silently breaks totals downstream,
  // so it is rejected here instead of trusting the form's own validation.
  if (!newExpense.title || isNaN(newExpense.amount) || newExpense.amount <= 0) {
    return { ok: false, error: 'Please enter a valid title and a positive amount.' };
  }

  expenses.unshift(newExpense);
  saveExpenses();
  renderExpenses();
  return { ok: true, expense: newExpense };
}

function deleteExpense(id) {
  expenses = expenses.filter((exp) => exp.id !== id);
  saveExpenses();
  renderExpenses();
}

if (expenseForm) {
  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = addExpense(
      titleInput.value,
      amountInput.value,
      categoryInput.value,
      dateInput.value
    );
    if (!result.ok) {
      alert(result.error);
      return;
    }
    expenseForm.reset();
  });

  filterCategory.addEventListener('change', renderExpenses);

  renderExpenses();
}

// Exported for the Jest test suite (Node/CommonJS); ignored by the browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { addExpense, deleteExpense, updateSummary, escapeHtml, renderExpenses };
}
