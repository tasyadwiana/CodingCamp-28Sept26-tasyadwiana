# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side single-page application using plain HTML, one CSS file, and one Vanilla JavaScript file. Chart.js is loaded from CDN. The implementation follows the unidirectional data flow defined in the design: every user action mutates the in-memory `transactions[]` array, persists to `localStorage`, then re-renders all UI components.

## Tasks

- [~] 1. Set up project file structure
  - Create `index.html` at the workspace root with the full HTML skeleton from the design (header, main sections, toast container, CDN script tags, local script tag)
  - Create `css/style.css` as an empty file
  - Create `js/app.js` as an empty file with a single IIFE wrapper `(function() { 'use strict'; })();`
  - Verify the three files exist and the browser can open `index.html` without console errors
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 2. Implement HTML structure and semantic layout
  - [x] 2.1 Write the complete HTML markup inside `index.html`
    - Add `<header>` with `<h1>` title and `#balance-display` / `#balance-value` span
    - Add `<main>` with three `<section>` elements: `#form-section`, `#list-section`, `#chart-section`
    - Inside `#form-section`: `<form id="transaction-form">` with three `.field-group` divs — text input `#item-name` (maxlength="100"), number input `#amount` (step="0.01"), select `#category` with blank default + Food/Transport/Fun options, each followed by a `<span class="error">` element
    - Inside `#list-section`: `<ul id="transaction-list">` and `<p id="empty-message" hidden>`
    - Inside `#chart-section`: `<canvas id="spending-chart">` and `<p id="chart-placeholder" hidden>`
    - Add `<div id="toast" role="status" aria-live="polite">` before closing `</body>`
    - Load Chart.js CDN script with `onerror` attribute referencing a `handleChartLoadError` function
    - Load `js/app.js` as the last script
    - _Requirements: 1.1, 2.1, 2.2, 4.4, 6.1, 6.4_

- [x] 3. Implement CSS styling
  - [x] 3.1 Write base layout and typography styles in `css/style.css`
    - CSS reset/box-sizing, body font family, minimum body text size of 14px
    - Page layout: center-constrained max-width container, column flow for header → main sections
    - Visually distinct sections for header (Balance_Display), form, list, and chart using background, border, or spacing
    - _Requirements: 7.2, 7.3_
  - [x] 3.2 Write form, list, and chart component styles
    - Form: label+input layout, focus rings, submit button style
    - `.error` spans: visible red text, hidden by default (use empty content to collapse)
    - `#transaction-list`: max-height with `overflow-y: auto` for scrollability; list-item layout showing name, amount, category, and delete button side-by-side
    - Delete button: accessible size (min 44×44 px tap target), distinct visual style
    - Chart section: centered canvas, placeholder paragraph style
    - Toast `#toast`: fixed position, visually distinct for warning vs error types, hidden when empty
    - _Requirements: 2.3, 2.5, 7.2, 7.3_

- [x] 4. Implement utility functions in `js/app.js`
  - [x] 4.1 Write `generateId()`, `formatCurrency(amount)`, and `computeCategoryTotals(transactions)`
    - `generateId`: use `crypto.randomUUID()` with a `Date.now() + Math.random()` string fallback
    - `formatCurrency`: return a string formatted as `$#,##0.00` (use `Intl.NumberFormat` with `style: 'currency'`, `currency: 'USD'`)
    - `computeCategoryTotals`: reduce over transactions, skip and `console.warn` unknown categories, return `{ Food, Transport, Fun }` object
    - _Requirements: 3.1, 4.1, 4.6_
  - [ ]* 4.2 Write property test for `computeCategoryTotals` (Property 7 & 8)
    - **Property 7: Category totals sum to grand total** — for any `Transaction[]` with valid categories, sum of `{ Food + Transport + Fun }` must equal sum of all `amount` fields
    - **Property 8: Unknown category is excluded** — for any transaction with category outside the enum, its amount must not appear in any bucket
    - _Validates: Requirements 4.1, 4.6_
  - [ ]* 4.3 Write unit tests for `generateId` and `formatCurrency`
    - `generateId`: returns non-empty string; two successive calls produce different values
    - `formatCurrency`: `0` → `$0.00`, `0.01` → `$0.01`, `999999999.99` → `$999,999,999.99`, values with more than 2 decimal places are rounded correctly
    - _Requirements: 3.1_

- [x] 5. Implement localStorage persistence layer
  - [x] 5.1 Write `loadFromStorage()` and `saveToStorage(txList)`
    - `loadFromStorage`: wrap `localStorage.getItem` + `JSON.parse` in `try/catch`; on any error call `showToast` with warning and return `[]`
    - `saveToStorage`: wrap `localStorage.setItem` + `JSON.stringify` in `try/catch`; on failure call `showToast` with error (do NOT throw — let caller continue with in-memory state)
    - Key: `"expense_transactions"`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 5.2 Write property test for persistence round-trip (Property 1)
    - **Property 1: Transaction persistence round-trip** — for any array of valid `Transaction` objects, `JSON.parse(JSON.stringify(txList))` must deeply equal the original
    - _Validates: Requirements 5.1, 5.2, 5.3_

- [x] 6. Implement form validation
  - [x] 6.1 Write `validateForm(fields)` pure function
    - Accept `{ name, amount, category }` as raw strings
    - Name: fail if trimmed value is empty; error message: `"Item name is required."`
    - Amount: fail if empty (`"Amount is required."`), fail if zero/negative (`"Amount must be greater than 0."`), fail if non-numeric (`"Amount must be a valid number."`), fail if > 999999999.99 (`"Amount must not exceed 999,999,999.99."`)
    - Category: fail if value is `""` or not in enum; error message: `"Please select a category."`
    - Return `{ valid: boolean, errors: { name?, amount?, category? } }`
    - _Requirements: 1.3, 1.4, 1.5, 1.6_
  - [ ]* 6.2 Write property test for whitespace name rejection (Property 5)
    - **Property 5: Whitespace-only name is always rejected** — for any string composed entirely of `\s` characters, `validateForm` must return `valid: false` with a `name` error
    - _Validates: Requirements 1.3, 1.4_
  - [ ]* 6.3 Write property test for invalid amount rejection (Property 6)
    - **Property 6: Invalid amount is always rejected** — for values `0`, negatives, strings like `"abc"`, and numbers > 999999999.99, `validateForm` must return `valid: false` with an `amount` error
    - _Validates: Requirements 1.3, 1.5_
  - [ ]* 6.4 Write example-based unit tests for `validateForm`
    - Test each exact error message copy from the design
    - Test that a fully valid input returns `{ valid: true, errors: {} }`
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [x] 7. Implement rendering functions
  - [x] 7.1 Write `renderTransactionList()`
    - Clear `#transaction-list`; if `transactions` is empty, show `#empty-message` and hide `<ul>`; otherwise hide `#empty-message`, show `<ul>`, and append one `<li>` per transaction
    - Each `<li>` must show: item name, formatted amount, category badge, and a delete `<button>` with `data-id` attribute equal to the transaction's `id`
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  - [x] 7.2 Write `renderBalance()`
    - Sum all `transactions[].amount` values and write the result of `formatCurrency(sum)` into `#balance-value`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 7.3 Write property test for balance computation (Property 2 & 3)
    - **Property 2: Balance equals sum of all amounts** — for any non-empty `Transaction[]`, the computed sum must equal the arithmetic sum of all `amount` fields
    - **Property 3: Empty-state balance is zero** — for an empty array, the computed sum must be exactly `0`
    - _Validates: Requirements 3.1, 3.4_

- [x] 8. Implement Chart.js integration
  - [x] 8.1 Write `renderChart()`
    - If `transactions` is empty: hide `#spending-chart`, show `#chart-placeholder`, return early
    - Otherwise: hide `#chart-placeholder`, show `#spending-chart`
    - If `chartInstance` is `null`, create a new `Chart` with `type: 'pie'`, labels `['Food', 'Transport', 'Fun']`, and distinct colors (e.g. `#FF6384`, `#36A2EB`, `#FFCE56`)
    - If `chartInstance` already exists, update its `.data.datasets[0].data` and call `.update()`
    - Use `computeCategoryTotals` to derive the data array `[Food, Transport, Fun]`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [~] 8.2 Write `handleChartLoadError()` and wire it to the CDN `<script onerror>`
    - Hide `#spending-chart` canvas
    - Show a static message element: `"Chart could not be loaded."`
    - _Requirements: 6.4_

- [x] 9. Implement toast notification system
  - [x] 9.1 Write `showToast(message, type, duration)`
    - Set `#toast` textContent to `message` and add a class matching `type` (`"warning"` or `"error"`)
    - After `duration` ms (default 4000), clear textContent and remove the class
    - The element already has `role="status"` and `aria-live="polite"` in the HTML
    - _Requirements: 5.4, 5.5, 2.7_

- [x] 10. Implement add and delete transaction logic
  - [x] 10.1 Write `addTransaction(data)`
    - Call `validateForm`; if invalid, display inline errors by setting each `#*-error` span's textContent and return
    - On valid: clear all error spans, create a `Transaction` object via `generateId()` and `new Date().toISOString()`, push to `transactions`, call `saveToStorage`, then call `renderTransactionList()`, `renderBalance()`, `renderChart()`, and `resetForm()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 3.2, 4.2, 5.1_
  - [ ]* 10.2 Write property test for add-then-retrieve (Property 4)
    - **Property 4: Add then retrieve — list grows by one** — for any valid transaction data and any existing list, after `addTransaction` the list length increases by exactly 1 and the new transaction appears in the list
    - _Validates: Requirements 1.2, 2.4_
  - [x] 10.3 Write `deleteTransaction(id)` and `resetForm()`
    - `deleteTransaction`: filter `transactions` to remove the entry with matching `id`, call `saveToStorage`, then call `renderTransactionList()`, `renderBalance()`, `renderChart()`; if `saveToStorage` fails, the toast is shown by `saveToStorage` itself and the UI still updates from in-memory state
    - `resetForm`: set `#item-name` value to `""`, `#amount` value to `""`, `#category` selectedIndex to `0`
    - _Requirements: 1.7, 2.6, 2.7, 3.3, 4.3, 5.2_
  - [ ]* 10.4 Write property test for delete-then-retrieve (Property 9)
    - **Property 9: Delete then retrieve — list shrinks by one** — for any non-empty `Transaction[]`, after `deleteTransaction(id)` the list length decreases by exactly 1 and the deleted id is absent
    - _Validates: Requirements 2.6, 5.2_
  - [ ]* 10.5 Write property test for form reset after add (Property 10)
    - **Property 10: Form reset after successful add** — after any successful `addTransaction`, `#item-name`, `#amount`, and `#category` must return to their default empty/unselected states
    - _Validates: Requirements 1.7_

- [x] 11. Wire event handlers
  - [~] 11.1 Write `DOMContentLoaded` handler and form submit handler
    - On `DOMContentLoaded`: call `loadFromStorage()` and assign result to `transactions`; call `renderTransactionList()`, `renderBalance()`, `renderChart()`
    - On `#transaction-form` submit: `preventDefault`, read values from `#item-name`, `#amount`, `#category`, call `addTransaction({ name, amount, category })`
    - _Requirements: 5.3, 1.2, 7.1_
  - [x] 11.2 Write delete button event delegation handler
    - Attach a single `click` listener on `#transaction-list` (event delegation)
    - If `event.target` is a delete button (`dataset.id` exists), call `deleteTransaction(event.target.dataset.id)`
    - _Requirements: 2.6, 7.1_

- [ ] 12. Checkpoint — verify complete end-to-end flow
  - Open `index.html` in a browser; confirm zero console errors on load
  - Add three transactions (one per category); verify list, balance, and chart all update
  - Delete one transaction; verify list, balance, and chart all update
  - Refresh the page; verify data reloads from `localStorage`
  - Ensure all automated tests pass: `npx vitest run`
  - Ask the user if any questions or adjustments are needed before finalizing

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Testing tasks use [fast-check](https://github.com/dubzzz/fast-check) for property-based tests and [Vitest](https://vitest.dev/) as the test runner (`npx vitest run` for single execution)
- Test files live in `tests/app.unit.test.js` and `tests/app.property.test.js`
- Property test tasks reference their corresponding Design Property numbers (Property 1–10)
- The single JS file uses an IIFE to avoid polluting the global scope; pure functions (validators, computations) must be exported or exposed so test files can import them
- Checkpoints ensure incremental validation at reasonable milestones

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["3.1", "3.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "5.1", "6.1"] },
    { "id": 3, "tasks": ["5.2", "6.2", "6.3", "6.4", "7.1", "7.2", "8.1", "8.2", "9.1"] },
    { "id": 4, "tasks": ["7.3", "10.1", "10.3"] },
    { "id": 5, "tasks": ["10.2", "10.4", "10.5", "11.1", "11.2"] }
  ]
}
```
