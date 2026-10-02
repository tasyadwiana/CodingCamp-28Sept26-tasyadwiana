(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utility Functions
  // ---------------------------------------------------------------------------

  /**
   * Generates a unique ID string.
   * Uses crypto.randomUUID() when available, falls back to a timestamp+random
   * string combination for environments that don't support it.
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /**
   * Formats a numeric amount as a USD currency string (e.g. "$1,234.56").
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Show a non-blocking toast message.
   * Sets #toast textContent and a type class, then auto-clears after `duration` ms.
   * The element already carries role="status" aria-live="polite" in the HTML so
   * screen readers announce the message without any extra work here.
   * @param {string} message
   * @param {'warning'|'error'} type
   * @param {number} [duration=4000]
   * Requirements: 5.4, 5.5, 2.7
   */
  function showToast(message, type, duration) {
    var ms = (typeof duration === 'number' && duration > 0) ? duration : 4000;
    var toastEl = document.getElementById('toast');
    if (!toastEl) return;

    // Clear any previously scheduled dismiss so back-to-back toasts
    // don't dismiss each other prematurely.
    if (showToast._timerId) {
      clearTimeout(showToast._timerId);
    }

    // Remove any existing type class before applying the new one.
    toastEl.classList.remove('warning', 'error');
    toastEl.textContent = message;
    toastEl.classList.add(type);

    showToast._timerId = setTimeout(function() {
      toastEl.textContent = '';
      toastEl.classList.remove(type);
      showToast._timerId = null;
    }, ms);
  }

  /** @type {number|null} — timer handle for auto-dismiss */
  showToast._timerId = null;

  /** @type {ReadonlyArray<string>} */
  var DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
  var VALID_CATEGORIES = DEFAULT_CATEGORIES.slice();

  /**
   * Reduces a transactions array into per-category spending totals.
   * Transactions with an unrecognised category are skipped and a console.warn
   * is emitted for each one.
   * @param {Array<{category: string, amount: number}>} transactions
   * @returns {{ Food: number, Transport: number, Fun: number }}
   */
  function computeCategoryTotals(transaction) {
    var totals = {};

    VALID_CATEGORIES.forEach(function(category) {
      totals[category] = 0;
    });

    transaction.forEach(function(tx){
      if (VALID_CATEGORIES.indexOf(tx.category) === -1) {
        console.warn(
          'computeCategoryTotals: unknown category "' + tx.category + '" - transaction skipped.',
          tx
        );
        return;
      }

      totals[tx.category] += tx.amount;
    });

    return totals;
  }

  // ---------------------------------------------------------------------------
  // Persistence Layer
  // ---------------------------------------------------------------------------

  /** The localStorage key used to store all transactions. */
  var STORAGE_KEY = 'expense_transactions';
  var CATEGORY_STORAGE_KEY = 'expense_categories';

  /**
   * Load transactions from localStorage.
   * Wraps `localStorage.getItem` + `JSON.parse` in a try/catch.
   * Returns an empty array and shows a warning toast on any error
   * (unavailable storage, quota exceeded, JSON parse failure, etc.).
   * @returns {Array<Transaction>}
   */
  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // Key not present yet — first run, return empty list silently.
        return [];
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Stored value is not an array.');
      }
      return parsed;
    } catch (err) {
      console.warn('loadFromStorage: failed to read transactions.', err);
      if (typeof showToast === 'function') {
        showToast('Saved data could not be loaded. Starting fresh.', 'warning');
      }
      return [];
    }
  }

  function loadCategories() {
    try {
      var raw = localStorage.getItem(CATEGORY_STORAGE_KEY);

      if (raw === null) {
        return DEFAULT_CATEGORIES.slice();
      }

      var parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        throw new Error('Stored categories are not an array');
      }

      return parsed;
    } catch (err) {
      console.warn('loadCategories: failed to read categories.', err);
      return DEFAULT_CATEGORIES.slice();
    }
  }

  function saveCaterogies(categories) {
    try {
      localStorage.setItem(
        CATEGORY_STORAGE_KEY,
        JSON.stringify(categories)
      );
    } catch (err) {
      console.error('saveCategories: failed to save categories.', err);
      showToast('Category could not be saved.','error');
    }
  }

  function renderCategoryOptions() {
    var categoryEl = document.getElementById('category');

    if (!categoryEl) return;

    categoryEl.innerHTML = '';

    var defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Category --';
    categoryEl.appendChild(defaultOption);

    VALID_CATEGORIES.forEach(function(category){
      var option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryEl.appendChild(option);
    });
  }
 
  /**
   * Serialize the transaction list to localStorage.
   * Wraps `localStorage.setItem` + `JSON.stringify` in a try/catch.
   * On failure shows an error toast but does NOT throw — the caller continues
   * to operate on the in-memory state regardless.
   * @param {Array<Transaction>} txList
   */
  function saveToStorage(txList) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(txList));
    } catch (err) {
      console.error('saveToStorage: failed to write transactions.', err);
      if (typeof showToast === 'function') {
        showToast('Changes could not be saved.', 'error');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /** Maximum allowed transaction amount. */
  var MAX_AMOUNT = 999999999.99;

  /**
   * Validate raw form values.
   * Pure function — no side effects.
   * @param {{ name: string, amount: string, category: string }} fields
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  function validateForm(fields) {
    var errors = {};

    // --- Name ---
    if (!fields.name || fields.name.trim() === '') {
      errors.name = 'Item name is required.';
    }

    // --- Amount ---
    var rawAmount = fields.amount;
    if (rawAmount === '' || rawAmount === null || rawAmount === undefined) {
      errors.amount = 'Amount is required.';
    } else {
      var numAmount = Number(rawAmount);
      if (isNaN(numAmount)) {
        errors.amount = 'Amount must be a valid number.';
      } else if (numAmount <= 0) {
        errors.amount = 'Amount must be greater than 0.';
      } else if (numAmount > MAX_AMOUNT) {
        errors.amount = 'Amount must not exceed 999,999,999.99.';
      }
    }

    // --- Category ---
    if (!fields.category || VALID_CATEGORIES.indexOf(fields.category) === -1) {
      errors.category = 'Please select a category.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
    };
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** @type {Array<{id: string, name: string, amount: number, category: string, date: string}>} */
  var transactions = [];

  /**
   * Holds the Chart.js pie chart instance.
   * Created once on first render; updated in place on subsequent renders.
   * @type {Chart|null}
   */
  var chartInstance = null;

  // ---------------------------------------------------------------------------
  // Rendering Functions
  // ---------------------------------------------------------------------------

  /**
   * Renders the transaction list into the DOM.
   * - Clears #transaction-list.
   * - If `transactions` is empty: hides the <ul> and shows #empty-message.
   * - Otherwise: shows the <ul>, hides #empty-message, and appends one <li>
   *   per transaction containing the item name, formatted amount, category
   *   badge, and a delete button with data-id set to the transaction's id.
   * Requirements: 2.1, 2.2, 2.4, 2.5
   */
  function getSortedTransactions() {
    var sortValue = document.getElementById('sort-select').value;
    var sorted = transactions.slice();

    if (sortValue === 'amount-asc') {
      sorted.sort(function(a, b) {
        return a.amount - b.amount;
      });
    } else if (sortValue === 'amount-desc') {
      sorted.sort(function(a, b) {
        return b.amount - a.amount;
      });
    } else if (sortValue === 'category') {
      sorted.sort(function(a, b) {
        return a.category.localeCompare(b.category);
      });
    }

    return sorted;
  }
  
  function renderTransactionList() {
    var listEl = document.getElementById('transaction-list');
    var emptyMsg = document.getElementById('empty-message');

    if (!listEl || !emptyMsg) return;

    // Clear all existing items
    listEl.innerHTML = '';

    if (transactions.length === 0) {
      listEl.hidden = true;
      emptyMsg.hidden = false;
      return;
    }

    listEl.hidden = false;
    emptyMsg.hidden = true;

    getSortedTransactions().forEach(function(tx) {
      var li = document.createElement('li');
      li.className = 'transaction-item';

      // Item name
      var nameSpan = document.createElement('span');
      nameSpan.className = 'tx-name';
      nameSpan.textContent = tx.name;

      // Formatted amount
      var amountSpan = document.createElement('span');
      amountSpan.className = 'tx-amount';
      amountSpan.textContent = formatCurrency(tx.amount);

      // Category badge
      var categorySpan = document.createElement('span');
      categorySpan.className = 'tx-category category-badge';
      categorySpan.textContent = tx.category;

      // Delete button
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.id = tx.id;
      deleteBtn.setAttribute('aria-label', 'Delete ' + tx.name);
      deleteBtn.textContent = 'Delete';

      li.appendChild(nameSpan);
      li.appendChild(amountSpan);
      li.appendChild(categorySpan);
      li.appendChild(deleteBtn);

      listEl.appendChild(li);
    });
  }

  /**
   * Recomputes the balance from the in-memory `transactions` array and writes
   * the formatted value into #balance-value.
   * - Empty array → shows "$0.00" (Req 3.4)
   * - Non-empty array → shows sum of all amounts formatted as currency (Req 3.1)
   * Called automatically after every add/delete so the display stays in sync
   * without a page reload (Req 3.2, 3.3).
   */
  function renderBalance() {
    var balanceEl = document.getElementById('balance-value');
    if (!balanceEl) return;

    var sum = transactions.reduce(function(total, tx) {
      return total + tx.amount;
    }, 0);

    balanceEl.textContent = formatCurrency(sum);
  }

  /**
   * Updates or initialises the Chart.js pie chart from the current `transactions`
   * array.
   *
   * Behaviour:
   *  - Empty transactions → hides #spending-chart, shows #chart-placeholder,
   *    returns early.  (Req 4.4, 4.5)
   *  - Non-empty transactions → hides #chart-placeholder, shows #spending-chart.
   *    • If `chartInstance` is null a new Chart is created (Req 4.1, 4.2).
   *    • If `chartInstance` already exists its dataset is updated in place and
   *      `.update()` is called (Req 4.3).
   *
   * Data is always derived via `computeCategoryTotals` so the chart stays in
   * sync with the in-memory state. (Req 4.1)
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  function renderChart() {
    var canvasEl = document.getElementById('spending-chart');
    var placeholderEl = document.getElementById('chart-placeholder');

    if (!canvasEl || !placeholderEl) return;

    if (transactions.length === 0) {
      canvasEl.hidden = true;
      placeholderEl.hidden = false;
      return;
    }

    // Non-empty — make sure canvas is visible and placeholder is hidden.
    placeholderEl.hidden = true;
    canvasEl.hidden = false;

    var totals = computeCategoryTotals(transactions);
    var labels = VALID_CATEGORIES.slice();
    var data = labels.map(function(category) {
      return totals[category];
    });

    var colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#8BC34A',
      '#E91E63',
      '#795548',
      '#00ACC1',
      '#AB47BC',
      '#26A69A',
    ];

    if (chartInstance === null) {
      // Guard: if Chart.js didn't load from CDN, bail out gracefully.
      if (typeof Chart === 'undefined') return;

      chartInstance = new Chart(canvasEl, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,

          plugins: {
            legend: {
              position: 'bottom',
            },
          },
        },
      });
    } else {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.data.datasets[0].backgroundColor = colors;
      chartInstance.update();
    }
  }
  // ---------------------------------------------------------------------------
  // Form Actions
  // ---------------------------------------------------------------------------

  /**
   * Resets the add-transaction form to its default empty state.
   * Requirements: 1.7
   */
  function resetForm() {
    var nameEl = document.getElementById('item-name');
    var amountEl = document.getElementById('amount');
    var categoryEl = document.getElementById('category');

    if (nameEl) nameEl.value = '';
    if (amountEl) amountEl.value = '';
    if (categoryEl) categoryEl.selectedIndex = 0;
  }

  /**
   * Validates and processes a new transaction submission.
   *
   * - Calls `validateForm`; on failure sets inline error spans and returns early.
   * - On success: clears error spans, creates a Transaction object, pushes it to
   *   `transactions`, persists via `saveToStorage`, then re-renders all UI
   *   components and resets the form.
   *
   * @param {{ name: string, amount: string, category: string }} data
   * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 3.2, 4.2, 5.1
   */
  function addTransaction(data) {
    var result = validateForm({
      name: data.name,
      amount: data.amount,
      category: data.category,
    });

    // Always grab all three error spans up front.
    var nameErrorEl     = document.getElementById('item-name-error');
    var amountErrorEl   = document.getElementById('amount-error');
    var categoryErrorEl = document.getElementById('category-error');

    if (!result.valid) {
      // Display inline errors for each failing field.
      if (nameErrorEl)     nameErrorEl.textContent     = result.errors.name     || '';
      if (amountErrorEl)   amountErrorEl.textContent   = result.errors.amount   || '';
      if (categoryErrorEl) categoryErrorEl.textContent = result.errors.category || '';
      return;
    }

    // Valid — clear all error spans.
    if (nameErrorEl)     nameErrorEl.textContent     = '';
    if (amountErrorEl)   amountErrorEl.textContent   = '';
    if (categoryErrorEl) categoryErrorEl.textContent = '';

    // Build the Transaction object.
    var tx = {
      id:       generateId(),
      name:     data.name.trim(),
      amount:   Number(data.amount),
      category: data.category,
      date:     new Date().toISOString(),
    };

    transactions.push(tx);
    saveToStorage(transactions);

    renderTransactionList();
    renderBalance();
    renderChart();
    resetForm();
  }

  /**
   * Removes a transaction from the in-memory array by id, persists the
   * updated list via `saveToStorage`, then re-renders all UI components.
   *
   * If `saveToStorage` fails (e.g. localStorage unavailable), it shows an
   * error toast internally but does NOT throw — the UI still updates from
   * the mutated in-memory state so the user sees the deletion.
   *
   * @param {string} id  The transaction id to remove.
   * Requirements: 2.6, 2.7, 3.3, 4.3, 5.2
   */
  function deleteTransaction(id) {
    // Filter out the transaction with the matching id (mutates the reference).
    transactions = transactions.filter(function(tx) {
      return tx.id !== id;
    });

    // Persist — errors are handled inside saveToStorage (shows toast, no throw).
    saveToStorage(transactions);

    // Re-render all dependent UI components.
    renderTransactionList();
    renderBalance();
    renderChart();
  }

  function addCustomCategory() {
    var inputE1 = document.getElementById('custom-category');

    if (!inputE1) return;

    var categoryName = inputE1.value.trim();

    if (categoryName === '') {
      showToast('Category name is required.', 'warning');
      return;
    }

    if (VALID_CATEGORIES.indexOf(categoryName) !== -1) {
      showToast('Category already exist.', 'warning');
      return;
    }

    VALID_CATEGORIES.push(categoryName);
    console.log('Categories:', VALID_CATEGORIES);
    saveCaterogies(VALID_CATEGORIES);
    renderCategoryOptions();

    document.getElementById('category').value = categoryName;
    inputE1.value = '';

    showToast('Category added successfully.', 'warning');
  }


  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Bootstraps the app on page load: restores persisted transactions from
   * localStorage and performs an initial full render of all UI components.
   * Requirements: 5.3, 7.1
   */
  document.addEventListener('DOMContentLoaded', function() {
    VALID_CATEGORIES = loadCategories();

    renderCategoryOptions();
    transactions = loadFromStorage();
    renderTransactionList();
    renderBalance();
    renderChart();

    var addCategoryBtn = document.getElementById('add-category-btn');

    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', function() {
        addCustomCategory();
      });
    }

    var themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
      themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');

        if (document.body.classList.contains('dark-mode')) {
          themeToggle.textContent = 'Light Mode';
        } else {
          themeToggle.textContent = 'Dark Mode';
        }
      });
    }
  });

  /**
   * Handles form submission: prevents the default browser submit, reads the
   * three field values, and delegates to `addTransaction` for validation,
   * persistence, and re-rendering.
   * Requirements: 1.2, 7.1
   */
  var formEl = document.getElementById('transaction-form');
  if (formEl) {
    formEl.addEventListener('submit', function(event) {
      event.preventDefault();
      var name     = document.getElementById('item-name').value;
      var amount   = document.getElementById('amount').value;
      var category = document.getElementById('category').value;
      addTransaction({ name: name, amount: amount, category: category });
    });
  }

  /**
   * Handles delete button clicks via event delegation on the transaction list.
   * A single listener on the parent <ul> catches clicks from any child delete
   * button so we don't need to attach/remove individual listeners when the list
   * re-renders.
   * Requirements: 2.6, 7.1
   */
  var listEl = document.getElementById('transaction-list');
  if (listEl) {
    listEl.addEventListener('click', function(event) {
      var target = event.target;
      if (target && target.dataset && target.dataset.id) {
        deleteTransaction(target.dataset.id);
      }
    });
  }
  var sortEl = document.getElementById('sort-select');

  if (sortEl) {
    sortEl.addEventListener('change', function() {
      renderTransactionList();
    });
  }

  // ---------------------------------------------------------------------------
  // Export for testing (Vitest / Node environments)
  // ---------------------------------------------------------------------------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateId, formatCurrency, computeCategoryTotals, loadFromStorage, saveToStorage, validateForm, showToast, renderTransactionList, renderBalance, renderChart, resetForm, addTransaction, deleteTransaction };
  }

})();

// ---------------------------------------------------------------------------
// Chart CDN error handler — must be global so the inline onerror attribute
// on the <script> tag can call it before app.js IIFE has fully initialised.
// Requirements: 6.4
// ---------------------------------------------------------------------------

/**
 * Called by the Chart.js CDN <script onerror> attribute when the script fails
 * to load (network error, CDN unavailable, etc.).
 * Hides the #spending-chart canvas and shows a static error message in
 * #chart-placeholder so the user gets clear feedback instead of a blank area.
 */
function handleChartLoadError() {
  var canvasEl = document.getElementById('spending-chart');
  var placeholderEl = document.getElementById('chart-placeholder');

  if (canvasEl) {
    canvasEl.hidden = true;
  }

  if (placeholderEl) {
    placeholderEl.textContent = 'Chart could not be loaded.';
    placeholderEl.hidden = false;
  }
}
