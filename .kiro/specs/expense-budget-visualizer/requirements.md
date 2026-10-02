# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses by adding transactions with a name, amount, and category. The application displays a running total balance, a scrollable transaction list with delete capability, and a live-updating pie chart that visualizes spending distribution by category. All data is persisted in the browser's Local Storage. The application is built with plain HTML, CSS, and Vanilla JavaScript — no backend or framework required.

## Glossary

- **App**: The Expense & Budget Visualizer web application running in the user's browser.
- **Transaction**: A single expense record consisting of an item name, a monetary amount, and a category.
- **Category**: One of three predefined expense groupings: Food, Transport, or Fun.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Input_Form**: The UI form component through which users enter new transaction data.
- **Balance_Display**: The UI component at the top of the page that shows the total sum of all transaction amounts.
- **Chart**: The pie chart UI component that visualizes spending distribution across categories.
- **Local_Storage**: The browser's Web Storage API used to persist transaction data client-side.
- **Validator**: The client-side logic that checks form field completeness before a transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to enter an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for item name accepting up to 100 characters, a numeric field for amount, and a dropdown selector for category with options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and valid, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage within 1 second.
3. WHEN the user submits the Input_Form, THE Validator SHALL check that the item name field is not empty, the amount field contains a positive numeric value between 0.01 and 999,999,999.99, and a category is selected.
4. IF the Validator detects that the item name field is empty, THEN THE Input_Form SHALL display an inline error message on the item name field and SHALL NOT add the transaction.
5. IF the Validator detects that the amount field is empty, zero, negative, or non-numeric, THEN THE Input_Form SHALL display an inline error message on the amount field and SHALL NOT add the transaction.
6. IF the Validator detects that no category is selected, THEN THE Input_Form SHALL display an inline error message on the category field and SHALL NOT add the transaction.
7. WHEN a transaction is successfully added, THE Input_Form SHALL reset the item name field to empty, the amount field to empty, and the category dropdown to its default unselected state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list so that I can review my expense history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions, each showing the item name, monetary amount, and category.
2. WHEN the Transaction_List is rendered with no stored transactions, THE Transaction_List SHALL display a message indicating that no transactions have been recorded.
3. WHILE the number of transactions exceeds the visible area of the Transaction_List, THE Transaction_List SHALL be scrollable to allow access to all entries.
4. WHEN a new transaction is added, THE Transaction_List SHALL update immediately to include the new entry without requiring a page reload.
5. THE Transaction_List SHALL display a delete button alongside each transaction entry.
6. WHEN the user activates the delete button for a transaction entry, THE App SHALL remove that transaction from the Transaction_List and from Local_Storage.
7. IF Local_Storage is unavailable when the user activates the delete button, THEN THE App SHALL display an error message indicating the deletion could not be completed and SHALL retain the transaction in the Transaction_List.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total expenditure at the top of the page so that I can understand my overall spending at a glance.

#### Acceptance Criteria

1. THE Balance_Display SHALL be positioned at the top of the page and SHALL show the sum of all transaction amounts formatted as a decimal number with exactly 2 decimal places and a currency symbol prefix.
2. WHEN a transaction is added, THE Balance_Display SHALL update automatically to reflect the new total without requiring a page reload.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update automatically to reflect the revised total without requiring a page reload.
4. WHILE no transactions are stored, THE Balance_Display SHALL show a total of 0.00 with the currency symbol prefix.
5. IF a transaction amount is negative, THEN THE Balance_Display SHALL include that amount as a deduction from the displayed total.

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart displaying the proportional spending for each category (Food, Transport, Fun) relative to the total of all transaction amounts, where each segment percentage is calculated as (category total / grand total) * 100.
2. WHEN a transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution within 1 second without requiring a page reload.
3. WHEN a transaction is deleted, THE Chart SHALL update automatically to reflect the revised spending distribution within 1 second without requiring a page reload.
4. WHILE no transactions are stored, THE Chart SHALL display a placeholder state that replaces the chart entirely and indicates that no spending data is available.
5. WHERE Chart.js or an equivalent client-side chart library is used, THE App SHALL use it to render the Chart with each category segment visually distinguishable by a distinct color.
6. IF a transaction contains a category value that does not match Food, Transport, or Fun, THEN THE Chart SHALL exclude that transaction from chart calculations and log a warning to the browser console.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my expense history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the updated transaction list to Local_Storage as a serialized array before updating the UI.
2. WHEN a transaction is deleted, THE App SHALL write the updated transaction list to Local_Storage as a serialized array before updating the UI.
3. WHEN the App loads, THE App SHALL read all transactions from Local_Storage and populate the Transaction_List, Balance_Display, and Chart with the stored data within 500 milliseconds.
4. IF Local_Storage is unavailable or returns a parse error on load, THEN THE App SHALL initialize with an empty transaction list and SHALL display a non-blocking warning message indicating that saved data could not be loaded.
5. IF a write to Local_Storage fails after a transaction is added or deleted, THEN THE App SHALL display a non-blocking error message indicating that the change could not be saved, and SHALL still update the UI to reflect the in-memory state.

---

### Requirement 6: Technology and Structure Constraints

**User Story:** As a developer, I want the project to use only HTML, CSS, and Vanilla JavaScript so that the application has no external runtime dependencies beyond an optional charting library.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no JavaScript frameworks or UI component libraries.
2. THE App SHALL contain exactly one CSS file located inside the `css/` directory.
3. THE App SHALL contain exactly one JavaScript file located inside the `js/` directory.
4. WHEN loaded in the latest stable release of Chrome, Firefox, Edge, or Safari, THE App SHALL render and function correctly with zero console errors.
5. THE App SHALL require no backend server and SHALL operate entirely in the user's browser.
6. WHERE a charting library is included, THE App SHALL load it as a single self-contained script file with no additional runtime dependencies.

---

### Requirement 7: UI Performance and Visual Design

**User Story:** As a user, I want the interface to feel responsive and visually clear so that I can use the app efficiently without confusion or lag.

#### Acceptance Criteria

1. WHEN the user interacts with the Input_Form, Transaction_List, or Chart, THE App SHALL reflect the resulting UI change within 100 milliseconds on a modern desktop browser running on hardware manufactured within the last 5 years.
2. THE App SHALL apply a clear visual hierarchy so that the Balance_Display, Input_Form, Transaction_List, and Chart are each visually distinct and consistently styled.
3. THE App SHALL use typography where all body text is no smaller than 14px and all text-to-background color pairings meet a minimum contrast ratio of 4.5:1 as defined by WCAG 2.1 Level AA.
4. THE App SHALL require no installation, configuration, or external account setup beyond opening the HTML file in a browser.
