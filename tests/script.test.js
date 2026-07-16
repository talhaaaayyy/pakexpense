/**
 * script.test.js
 *
 * Test cases were first drafted by prompting Claude with the PakExpense
 * source (script.js) and asking it to generate Jest tests covering
 * functional behaviour, edge cases, and error handling for the
 * add / delete / summary logic described in Assignment 3.
 * Cases were then reviewed and two were adjusted (see Section 3 of the
 * report) because the AI-generated versions assumed a synchronous
 * localStorage mock that jsdom does not provide by default.
 */

const fs = require('fs');
const path = require('path');

let addExpense, deleteExpense, updateSummary, escapeHtml, renderExpenses;

function loadFreshApp() {
  // Load the real markup so script.js finds the same element IDs it
  // expects in the browser, then require the script fresh so its
  // module-level `expenses` array resets between tests.
  const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/, '');
  localStorage.clear();
  jest.resetModules();
  ({ addExpense, deleteExpense, updateSummary, escapeHtml, renderExpenses } = require('../app/script.js'));
}

beforeEach(() => {
  loadFreshApp();
});

describe('Functional coverage', () => {
  test('adds a valid expense and returns ok:true', () => {
    const result = addExpense('Cafeteria lunch', '250', 'Food', '2026-07-10');
    expect(result.ok).toBe(true);
    expect(result.expense.title).toBe('Cafeteria lunch');
    expect(result.expense.amount).toBe(250);
  });

  test('renders an added expense into the DOM list', () => {
    addExpense('Bus fare', '60', 'Transport', '2026-07-10');
    const items = document.querySelectorAll('#expenseList li');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Bus fare');
    expect(items[0].textContent).toContain('60');
  });

  test('persists expenses to localStorage', () => {
    addExpense('Photocopies', '20', 'Stationery', '2026-07-11');
    const stored = JSON.parse(localStorage.getItem('pakexpense_data'));
    expect(stored.length).toBe(1);
    expect(stored[0].category).toBe('Stationery');
  });

  test('updateSummary computes total, count, and top category correctly', () => {
    addExpense('Lunch', '300', 'Food', '2026-07-10');
    addExpense('Dinner', '400', 'Food', '2026-07-10');
    addExpense('Bus', '50', 'Transport', '2026-07-10');
    updateSummary();
    expect(document.getElementById('totalAmount').textContent).toBe('Rs 750');
    expect(document.getElementById('totalCount').textContent).toBe('3');
    expect(document.getElementById('topCategory').textContent).toBe('Food');
  });

  test('deleteExpense removes the correct entry and re-renders', () => {
    const first = addExpense('Mobile load', '500', 'Mobile/Internet', '2026-07-10').expense;
    addExpense('Notebook', '150', 'Stationery', '2026-07-10');
    deleteExpense(first.id);
    const stored = JSON.parse(localStorage.getItem('pakexpense_data'));
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe('Notebook');
  });
});

describe('Edge cases', () => {
  test('rejects an empty title', () => {
    const result = addExpense('   ', '100', 'Food', '2026-07-10');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid title/i);
  });

  test('rejects a zero amount', () => {
    const result = addExpense('Free sample', '0', 'Food', '2026-07-10');
    expect(result.ok).toBe(false);
  });

  test('rejects a negative amount', () => {
    const result = addExpense('Refund', '-50', 'Food', '2026-07-10');
    expect(result.ok).toBe(false);
  });

  test('top category stays "-" when there are no expenses', () => {
    updateSummary();
    expect(document.getElementById('topCategory').textContent).toBe('-');
  });

  test('ties on category totals keep the first category seen', () => {
    addExpense('Lunch', '200', 'Food', '2026-07-10');
    addExpense('Bus', '200', 'Transport', '2026-07-10');
    updateSummary();
    // Object.entries preserves insertion order, so the category
    // inserted first (Food) wins a tie — this documents that behaviour
    // rather than asserting an arbitrary "correct" winner.
    expect(document.getElementById('topCategory').textContent).toBe('Food');
  });

  test('escapeHtml neutralizes a title containing markup', () => {
    const escaped = escapeHtml('<img src=x onerror=alert(1)>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');
  });
});

describe('Error handling', () => {
  test('amount left as non-numeric text is rejected instead of becoming NaN', () => {
    const result = addExpense('Mystery charge', 'abc', 'Other', '2026-07-10');
    expect(result.ok).toBe(false);
    const stored = JSON.parse(localStorage.getItem('pakexpense_data') || '[]');
    expect(stored.length).toBe(0);
  });

  test('delete buttons keep working after the list has been filtered once', () => {
    // Regression test for Bug 1 from Assignment 3: listeners were lost
    // after a re-render triggered by changing the category filter.
    const a = addExpense('Lunch', '200', 'Food', '2026-07-10').expense;
    addExpense('Bus', '60', 'Transport', '2026-07-10');

    const filterSelect = document.getElementById('filterCategory');
    filterSelect.value = 'Food';
    renderExpenses();

    filterSelect.value = 'all';
    renderExpenses();

    const btn = document.querySelector(`.delete-btn[data-id="${a.id}"]`);
    expect(btn).not.toBeNull();
    btn.click();

    const stored = JSON.parse(localStorage.getItem('pakexpense_data'));
    expect(stored.find((e) => e.id === a.id)).toBeUndefined();
  });

  test('corrupted localStorage data does not crash the app on load', () => {
    localStorage.setItem('pakexpense_data', '{not valid json');
    jest.resetModules();
    expect(() => require('../app/script.js')).not.toThrow();
  });
});
