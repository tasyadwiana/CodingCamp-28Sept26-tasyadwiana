# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page web application. It allows users to record personal expense transactions (name, amount, category), view a running total balance, browse a scrollable transaction history, and understand spending distribution via a live-updating pie chart. All state is persisted in the browser's `localStorage` so data survives page reloads.

The application is intentionally minimal in its technology footprint: plain HTML, one CSS file, one JavaScript file, and Chart.js loaded from a CDN. There is no build step, no backend, and no authentication.

### Key Design Goals

- **Zero dependencies beyond Chart.js** — no frameworks, no bundlers, no package manager at runtime.
- **Single source of truth** — `localStorage` and an in-memory array are kept in sync; all UI components derive their state from that array.
- **Immediate UI feedback** — all user actions (add, delete, load) must reflect in the UI within 100 ms; chart updates within 1 second.
- **Graceful degradation** — if `localStorage` is unavailable or corrupted, the app initializes from an empty state and notifies the user non-blockingly.
- **WCAG 2.1 AA accessibility** — color contrast ≥ 4.5:1, body text ≥ 14 px, semantic HTML, keyboard-navigable form.

---

## Architecture

The application follows a **single-module event-driven architecture** with a unidirectional data flow:

```
User Action
    │
    ▼
Input Handler (validate → mutate state → persist → render)
    │
    ├──▶ localStorage (write)
    │
    └──▶ UI Render Functions
              ├── renderTransactionList()
              ├── renderBalance()
              └── renderChart()
```

Because there is only one JS file, the code is organized into clearly separated **logical layers** (not separate files):

| Layer | Responsibility |
|---|---|
| **State** | In-memory `transactions[]` array (single source of truth) |
| **Persistence** | `loadFromStorage()` / `saveToStorage()` wrappers around `localStorage` |
| **Validation** | `validateForm()` — pure function, returns error map |
| **Rendering** | `renderTransactionList()`, `renderBalance()`, `renderChart()` |
| **Event Handlers** | Form submit, delete button delegation, DOMContentLoaded |

### Data Flow on Each Mutation

```
addTransaction(data)
  1. validateForm(data)            → abort if invalid, show inline errors
  2. transactions.push(newTx)      → mutate in-memory state
  3. saveToStorage(transactions)   → persist (show non-blocking error on failure)
  4. renderTransactionList()       → update DOM
  5. renderBalance()               → update DOM
  6. renderChart()                 → update Chart.js instance
  7. resetForm()                   → clear input fields
```

`deleteTransaction(id)` follows the same pattern: mutate → persist → render (steps 2–6).

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">          <!-- Balance_Display -->
      <span id="balance-value">$0.00</span>
    </div>
  </header>

  <main>
    <section id="form-section">         <!-- Input_Form -->
      <form id="transaction-form">
        <div class="field-group">
          <input id="item-name" type="text" maxlength="100" />
          <span class="error" id="item-name-error"></span>
        </div>
        <div class="field-group">
          <input id="amount" type="number" step="0.01" />
          <span class="error" id="amount-error"></span>
        </div>
        <div class="field-group">
          <select id="category">
            <option value="">-- Select Category --</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Fun">Fun</option>
          </select>
          <span class="error" id="category-error"></span>
        </div>
        <button type="submit">Add Transaction</button>
      </form>
    </section>

    <section id="list-section">         <!-- Transaction_List -->
      <ul id="transaction-list"></ul>
      <p id="empty-message" hidden>No transactions recorded yet.</p>
    </section>

    <section id="chart-section">        <!-- Chart -->
      <canvas id="spending-chart"></canvas>
      <p id="chart-placeholder" hidden>No spending data available.</p>
    </section>
  </main>

  <div id="toast" role="status" aria-live="polite"></div> <!-- non-blocking messages -->

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="js/app.js"></script>
</body>
```

### JavaScript Module Interface (`js/app.js`)

All functions live in a single IIFE or module-pattern to avoid polluting the global scope.

#### State

```js
// The single source of truth
let transactions = [];   // Transaction[]

// Chart.js instance (singleton, created once, updated via .update())
let chartInstance = null;
```

#### Persistence API

```js
/**
 * Load transactions from localStorage.
 * Returns an empty array and shows a warning toast on parse error or unavailability.
 * @returns {Transaction[]}
 */
function loadFromStorage() { ... }

/**
 * Serialize transactions to localStorage.
 * Shows an error toast on failure; does NOT block the in-memory update.
 * @param {Transaction[]} txList
 */
function saveToStorage(txList) { ... }
```

#### Validation API

```js
/**
 * Validate raw form values.
 * Pure function — no side effects.
 * @param {{ name: string, amount: string, category: string }} fields
 * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateForm(fields) { ... }
```

#### Rendering API

```js
/** Re-render the full transaction list from `transactions`. */
function renderTransactionList() { ... }

/** Recompute and display the balance sum. */
function renderBalance() { ... }

/**
 * Update or initialize the Chart.js pie chart.
 * Shows placeholder if transactions is empty.
 */
function renderChart() { ... }
```

#### Mutation API

```js
/**
 * Add a validated transaction to state, persist, and re-render.
 * @param {{ name: string, amount: number, category: string }} data
 */
function addTransaction(data) { ... }

/**
 * Delete a transaction by id, persist, and re-render.
 * @param {string} id
 */
function deleteTransaction(id) { ... }
```

#### Utility

```js
/** Generate a pseudo-random unique string id (crypto.randomUUID or fallback). */
function generateId() { ... }

/**
 * Show a non-blocking toast message.
 * @param {string} message
 * @param {'warning'|'error'} type
 * @param {number} [duration=4000]
 */
function showToast(message, type, duration) { ... }

/** Format a number as a currency string (e.g. "$1,234.56"). */
function formatCurrency(amount) { ... }
```

---

## Data Models

### `Transaction` Object

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - Unique identifier (UUID or timestamp-based fallback)
 * @property {string}  name      - Item name, 1–100 characters, non-empty after trim
 * @property {number}  amount    - Positive decimal, 0.01 ≤ amount ≤ 999_999_999.99
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {string}  createdAt - ISO 8601 timestamp string (for display ordering)
 */
```

### `localStorage` Schema

Key: `"expense_transactions"`

Value: JSON-serialized `Transaction[]`

```json
[
  {
    "id": "a1b2c3d4",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": "2024-01-15T12:30:00.000Z"
  }
]
```

**Constraints enforced at write time:**
- `id` — non-empty string
- `name` — trimmed, non-empty, length ≤ 100
- `amount` — finite number, 0.01 ≤ x ≤ 999_999_999.99
- `category` — strict enum: `"Food"`, `"Transport"`, or `"Fun"`

### Validation Error Map

```js
/**
 * @typedef {Object} ValidationErrors
 * @property {string} [name]      - Error message for the name field
 * @property {string} [amount]    - Error message for the amount field
 * @property {string} [category]  - Error message for the category field
 */
```

`validateForm` returns `{ valid: true, errors: {} }` when all fields pass, or `{ valid: false, errors: { ... } }` with one entry per failing field.

### Chart Data Derived State

The chart data is always derived from `transactions` — never stored separately:

```js
/**
 * @typedef {Object} CategoryTotals
 * @property {number} Food
 * @property {number} Transport
 * @property {number} Fun
 */

/** @returns {CategoryTotals} */
function computeCategoryTotals(transactions) {
  return transactions.reduce(
    (acc, tx) => {
      if (["Food", "Transport", "Fun"].includes(tx.category)) {
        acc[tx.category] += tx.amount;
      }
      return acc;
    },
    { Food: 0, Transport: 0, Fun: 0 }
  );
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction persistence round-trip

*For any* array of valid Transaction objects, serializing it to `localStorage` and then deserializing it should produce an array that is deeply equal to the original.

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 2: Balance equals sum of all amounts

*For any* non-empty array of transactions, the value displayed by `renderBalance` (i.e., the output of the balance computation) must equal the arithmetic sum of all `amount` fields in that array.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 3: Empty-state balance is zero

*For any* empty transaction list, the computed balance must equal exactly 0.00.

**Validates: Requirements 3.4**

---

### Property 4: Add then retrieve — list grows by one

*For any* valid transaction data and any existing transaction list, after calling `addTransaction`, the list length must increase by exactly 1 and the new transaction must appear in the list.

**Validates: Requirements 1.2, 2.4**

---

### Property 5: Whitespace-only name is always rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), `validateForm` must reject it as an invalid name, and the transaction list must remain unchanged.

**Validates: Requirements 1.3, 1.4**

---

### Property 6: Invalid amount is always rejected

*For any* amount value that is zero, negative, non-numeric, or greater than 999,999,999.99, `validateForm` must return an error for the amount field and the transaction list must remain unchanged.

**Validates: Requirements 1.3, 1.5**

---

### Property 7: Category totals sum to grand total

*For any* transaction list, the sum of all per-category totals computed by `computeCategoryTotals` must equal the grand total (sum of all `amount` fields).

**Validates: Requirements 4.1**

---

### Property 8: Unknown category is excluded from chart totals

*For any* transaction carrying a category value outside `["Food", "Transport", "Fun"]`, `computeCategoryTotals` must exclude that transaction's amount from all category buckets.

**Validates: Requirements 4.6**

---

### Property 9: Delete then retrieve — list shrinks by one

*For any* non-empty transaction list, deleting a transaction by its `id` must decrease the list length by exactly 1, and the deleted transaction must no longer appear in the list.

**Validates: Requirements 2.6, 5.2**

---

### Property 10: Form reset after successful add

*For any* successful `addTransaction` call, the name, amount, and category fields must all return to their default empty/unselected states afterward.

**Validates: Requirements 1.7**

---

## Error Handling

### localStorage Unavailability

`localStorage` can be unavailable (private browsing with strict settings, storage quota exceeded, or security policy). Both the read and write paths must be wrapped in `try/catch`:

| Scenario | Behavior |
|---|---|
| `localStorage` unavailable on **load** | Initialize `transactions = []`, show warning toast: *"Saved data could not be loaded. Starting fresh."* |
| JSON parse error on **load** | Initialize `transactions = []`, show warning toast |
| Write fails after **add** | Update in-memory state and UI anyway; show error toast: *"Changes could not be saved."* |
| Write fails after **delete** | Update in-memory state and UI anyway; show error toast: *"Changes could not be saved."* |
| Write fails after **delete** + `localStorage` unavailable | Retain transaction in list per Req 2.7; show error toast |

### Validation Errors

Validation errors are shown as **inline messages** directly below each failing field. They are cleared on the next successful submit. This approach gives immediate, field-level feedback without blocking the rest of the UI.

Error message copy:

| Field | Condition | Message |
|---|---|---|
| Name | Empty or whitespace-only | *"Item name is required."* |
| Amount | Empty | *"Amount is required."* |
| Amount | Zero or negative | *"Amount must be greater than 0."* |
| Amount | Non-numeric | *"Amount must be a valid number."* |
| Amount | Exceeds max | *"Amount must not exceed 999,999,999.99."* |
| Category | Not selected | *"Please select a category."* |

### Unknown Category in Data

If a transaction loaded from `localStorage` carries an unrecognized category (data corruption or manual edit):
- The transaction is **still shown** in the Transaction_List (to avoid silently losing data).
- It is **excluded** from chart calculations.
- A `console.warn` is emitted with the transaction id and category value.

### Chart.js CDN Failure

If the Chart.js CDN script fails to load:
- The `<canvas>` is hidden and replaced with a static message: *"Chart could not be loaded."*
- The rest of the application (form, list, balance) continues to function normally.
- This is detected via the `<script>` tag's `onerror` callback.

---

## Testing Strategy

### Approach

The app's pure-function core (validation, balance computation, category totals, serialization) is well-suited to property-based testing. The DOM-interaction layer is better covered by example-based unit tests and a small set of manual/integration checks.

**Dual testing approach:**
- **Property-based tests** — validate universal invariants across many generated inputs (100+ iterations per property).
- **Example-based unit tests** — cover specific edge cases and integration points.

### Property-Based Testing

**Library:** [fast-check](https://github.com/dubzzz/fast-check) (MIT license, no runtime dependency, runs in Node with a test runner like Vitest or Jest).

Each property-based test is tagged with a reference to its design property:

```
// Feature: expense-budget-visualizer, Property 1: Transaction persistence round-trip
```

**Properties to implement as PBT:**

| Test | Design Property | Generator |
|---|---|---|
| `localStorage` round-trip | Property 1 | Arbitrary `Transaction[]` arrays |
| Balance equals sum | Property 2 | Arbitrary non-empty `Transaction[]` |
| Empty-state balance is zero | Property 3 | N/A (no generator needed — deterministic) |
| Add grows list by 1 | Property 4 | Arbitrary `Transaction` + existing list |
| Whitespace name rejected | Property 5 | Strings of `\s` characters (spaces, tabs, newlines) |
| Invalid amount rejected | Property 6 | Out-of-range numbers (0, negatives, > max, NaN, Infinity) |
| Category totals sum to grand total | Property 7 | Arbitrary `Transaction[]` with valid categories |
| Unknown category excluded | Property 8 | `Transaction[]` with random non-enum categories |
| Delete shrinks list by 1 | Property 9 | Arbitrary non-empty `Transaction[]` |
| Form reset after add | Property 10 | Arbitrary valid form data |

Minimum iterations per test: **100** (fast-check default).

### Example-Based Unit Tests

Focus areas:
- **Currency formatting** — edge values: `0`, `0.01`, `999_999_999.99`, numbers with many decimal places.
- **`generateId()`** — returns non-empty string; two calls produce different values.
- **`validateForm` with specific inputs** — empty string, `"  "`, `"0"`, `"-1"`, `"abc"`, valid values, missing category.
- **Chart placeholder** — `renderChart()` with empty array shows placeholder element; non-empty hides it.
- **Toast** — `showToast` adds element to DOM, auto-removes after duration.

### Integration / Manual Checks

| Check | Method |
|---|---|
| Add a transaction → appears in list and `localStorage` | Manual / Playwright smoke test |
| Delete a transaction → removed from list and `localStorage` | Manual / Playwright smoke test |
| Refresh page → data reloads correctly | Manual |
| `localStorage` blocked (Incognito strict mode) → warning shown | Manual |
| WCAG contrast ratio | Browser DevTools / axe extension |
| Cross-browser render | Manual in Chrome, Firefox, Edge, Safari |

### Test File Structure

```
js/
  app.js
tests/
  app.unit.test.js       # example-based unit tests
  app.property.test.js   # property-based tests (fast-check)
```

Run command (single execution, no watch mode):
```
npx vitest run
```
