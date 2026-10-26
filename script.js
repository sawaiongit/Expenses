
"use strict";

/* =========================================================
   PENNYWISE — PERSONAL EXPENSE TRACKER
   Built to match the supplied index.html
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "pennywise-data-v1";

const CURRENCY_SYMBOLS = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£"
};

const CATEGORIES = {
    food: "Food & Dining",
    transport: "Transportation",
    education: "Education",
    shopping: "Shopping",
    entertainment: "Entertainment",
    bills: "Bills & Utilities",
    health: "Health",
    housing: "Rent & Housing",
    personal: "Personal Care",
    salary: "Salary",
    "pocket-money": "Pocket Money",
    scholarship: "Scholarship",
    freelance: "Freelance / Business",
    other: "Other"
};

const EXPENSE_CATEGORIES = [
    "food", "transport", "education", "shopping",
    "entertainment", "bills", "health", "housing",
    "personal", "other"
];

const CATEGORY_COLORS = [
    "#6478f5", "#21b8a6", "#f5a742", "#e879a9",
    "#8b70e8", "#ef7777", "#43a6dd", "#94a3b8",
    "#65b982", "#c084fc"
];

const DEFAULT_STATE = {
    profile: {
        name: "",
        accountType: "student",
        currency: "INR",
        incomeFrequency: "monthly",
        incomeAmount: 0,
        budgetPeriod: "monthly",
        setupComplete: false
    },
    transactions: [],
    budget: {
        name: "Monthly budget",
        amount: 0,
        period: "monthly"
    },
    categoryBudgets: [],
    goals: [],
    settings: {
        summaryPeriod: "this-month"
    }
};

let state = loadState();
let editingTransactionId = null;
let editingGoalId = null;
let contributingGoalId = null;
let confirmationCallback = null;
let toastTimeout = null;


/* =========================================================
   STATE AND STORAGE
   ========================================================= */

function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return cloneDefaultState();

        const saved = JSON.parse(raw);
        const defaults = cloneDefaultState();

        return {
            ...defaults,
            ...saved,
            profile: { ...defaults.profile, ...(saved.profile || {}) },
            budget: { ...defaults.budget, ...(saved.budget || {}) },
            settings: { ...defaults.settings, ...(saved.settings || {}) },
            transactions: Array.isArray(saved.transactions)
                ? saved.transactions : [],
            categoryBudgets: Array.isArray(saved.categoryBudgets)
                ? saved.categoryBudgets : [],
            goals: Array.isArray(saved.goals) ? saved.goals : []
        };
    } catch (error) {
        console.error("Could not load PennyWise data:", error);
        return cloneDefaultState();
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Could not save PennyWise data:", error);
        showToast("Could not save data. Export a backup if possible.", "error");
    }
}

function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayString() {
    const now = new Date();
    const localDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().slice(0, 10);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function money(value) {
    const currency = state.profile.currency || "INR";

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    } catch {
        return `${CURRENCY_SYMBOLS[currency] || "₹"}${(
            Number(value) || 0
        ).toFixed(2)}`;
    }
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function categoryName(category) {
    return CATEGORIES[category] || "Other";
}

function selectedTransactionType() {
    return $('input[name="transaction-type"]:checked')?.value || "income";
}

function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
        !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}


/* =========================================================
   TOAST NOTIFICATIONS
   ========================================================= */

function showToast(message, type = "success") {
    const toast = $("#toast-message");
    const text = $("#toast-text");
    const icon = $("#toast-icon");

    if (!toast || !text) return;

    text.textContent = message;

    if (icon) {
        icon.innerHTML = type === "error"
            ? '<i class="fa-solid fa-circle-exclamation"></i>'
            : '<i class="fa-solid fa-circle-check"></i>';
    }

    toast.hidden = false;
    toast.classList.remove("toast-error", "toast-success");
    toast.classList.add(type === "error" ? "toast-error" : "toast-success");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.hidden = true;
    }, 3500);
}


/* =========================================================
   MODAL HELPERS
   ========================================================= */

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.hidden = false;
    document.body.classList.add("modal-open");

    const focusTarget = modal.querySelector(
        "input:not([type=hidden]):not([disabled]), select, textarea, button"
    );

    setTimeout(() => focusTarget?.focus(), 0);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.hidden = true;

    if (!$(".modal-overlay:not([hidden])")) {
        document.body.classList.remove("modal-open");
    }
}

function closeAllModals() {
    $$(".modal-overlay").forEach((modal) => {
        modal.hidden = true;
    });
    document.body.classList.remove("modal-open");
}

function showConfirmation(title, message, callback, confirmLabel = "Confirm") {
    $("#confirmation-title").textContent = title;
    $("#confirmation-message").textContent = message;
    $("#confirmation-accept").textContent = confirmLabel;

    confirmationCallback = callback;
    openModal("confirmation-modal");
}


/* =========================================================
   ACCOUNT SETUP
   ========================================================= */

function updateAccountTypeUI() {
    const type = $('input[name="account-type"]:checked')?.value || "student";
    const student = $("#student-option");
    const professional = $("#professional-option");
    const label = $("#income-label-text");
    const help = $("#income-help");

    student?.classList.toggle("selected", type === "student");
    professional?.classList.toggle("selected", type === "professional");

    if (label) {
        label.textContent = type === "student"
            ? "Monthly pocket money"
            : "Monthly income / salary";
    }

    if (help) {
        help.textContent = type === "student"
            ? "Enter the money you expect from pocket money, scholarships, or part-time work."
            : "Enter the money you expect from salary, freelance work, or your business.";
    }
}

function updateCurrencySymbols() {
    const symbol = CURRENCY_SYMBOLS[state.profile.currency] || "₹";

    [
        "income-currency-symbol",
        "transaction-currency-symbol",
        "budget-currency-symbol",
        "category-budget-currency-symbol",
        "goal-currency-symbol",
        "goal-initial-currency-symbol",
        "contribution-currency-symbol",
        "edit-currency-symbol"
    ].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = symbol;
    });

    const setupCurrency = $("#currency");
    if (setupCurrency) {
        const selected = setupCurrency.value;
        const setupSymbol = CURRENCY_SYMBOLS[selected] || "₹";
        $("#income-currency-symbol").textContent = setupSymbol;
    }
}

function showSetup() {
    const setup = $("#account-setup");
    if (setup) setup.hidden = state.profile.setupComplete;
}

function handleSetupSubmit(event) {
    event.preventDefault();

    const name = $("#user-name").value.trim();
    const amount = numberValue($("#income-amount").value);

    if (!name) {
        showToast("Please enter your name.", "error");
        $("#user-name").focus();
        return;
    }

    if (amount <= 0) {
        showToast("Please enter an income amount greater than zero.", "error");
        $("#income-amount").focus();
        return;
    }

    state.profile.name = name;
    state.profile.accountType =
        $('input[name="account-type"]:checked')?.value || "student";
    state.profile.currency = $("#currency").value || "INR";
    state.profile.incomeFrequency = $("#income-frequency").value;
    state.profile.incomeAmount = amount;
    state.profile.budgetPeriod = $("#budget-period").value || "monthly";
    state.profile.setupComplete = true;

    // The setup amount is the starting balance, not a duplicate transaction.
    // Add later income through the Add Income form.
    if (numberValue(state.budget.amount) <= 0) {
        state.budget.amount = amount;
        state.budget.period = state.profile.budgetPeriod;
        state.budget.name = state.profile.budgetPeriod === "weekly"
            ? "Weekly budget" : "Monthly budget";
    }

    saveState();
    renderAll();
    showToast("Your PennyWise dashboard is ready!");
}


/* =========================================================
   PROFILE AND SETTINGS
   ========================================================= */

function renderProfile() {
    const name = state.profile.name || "Welcome!";
    const accountType = state.profile.accountType === "student"
        ? "Student account" : "Working account";

    if ($("#profile-name")) $("#profile-name").textContent = name;
    if ($("#profile-type")) $("#profile-type").textContent = accountType;
    if ($("#welcome-name")) $("#welcome-name").textContent = name;
    if ($("#footer-year")) $("#footer-year").textContent = new Date().getFullYear();

    if ($("#settings-name")) $("#settings-name").value = state.profile.name;
    if ($("#settings-account-type")) {
        $("#settings-account-type").value = state.profile.accountType;
    }
    if ($("#settings-currency")) {
        $("#settings-currency").value = state.profile.currency;
    }
    if ($("#settings-frequency")) {
        $("#settings-frequency").value = state.profile.incomeFrequency;
    }

    const date = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());

    if ($("#current-date")) $("#current-date").textContent = date;
}

function handleSettingsSubmit(event) {
    event.preventDefault();

    const name = $("#settings-name").value.trim();
    if (!name) {
        showToast("Please enter your name.", "error");
        return;
    }

    state.profile.name = name;
    state.profile.accountType = $("#settings-account-type").value;
    state.profile.currency = $("#settings-currency").value;
    state.profile.incomeFrequency = $("#settings-frequency").value;

    saveState();
    renderAll();
    showToast("Settings saved successfully.");
}


/* =========================================================
   NAVIGATION AND MOBILE MENU
   ========================================================= */

function navigateTo(sectionId) {
    const validSections = ["dashboard", "transactions", "budgets", "savings", "settings"];
    if (!validSections.includes(sectionId)) sectionId = "dashboard";

    $$(".page-section").forEach((section) => {
        section.hidden = section.id !== sectionId;
    });

    $$(".nav-link[data-section]").forEach((link) => {
        const active = link.dataset.section === sectionId;
        link.classList.toggle("active", active);

        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    const activeLink = $(`.nav-link[data-section="${sectionId}"]`);
    if ($("#breadcrumb-title")) {
        $("#breadcrumb-title").textContent =
            activeLink?.querySelector("span")?.textContent || "Dashboard";
    }

    history.replaceState(null, "", `#${sectionId}`);

    $("#sidebar")?.classList.remove("sidebar-open");
    $("#mobile-menu-btn")?.setAttribute("aria-expanded", "false");
}

function toggleMobileMenu() {
    const sidebar = $("#sidebar");
    const button = $("#mobile-menu-btn");
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle("sidebar-open");
    button?.setAttribute("aria-expanded", String(isOpen));
}


/* =========================================================
   PERIOD HELPERS AND TRANSACTION TOTALS
   ========================================================= */

function startOfWeek(date = new Date()) {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - ((day + 6) % 7));
    result.setHours(0, 0, 0, 0);
    return result;
}

function periodBounds(period) {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (period === "last-month") {
        return {
            start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            end: new Date(now.getFullYear(), now.getMonth(), 1)
        };
    }

    if (period === "this-week") {
        const start = startOfWeek(now);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return { start, end };
    }

    return {
        start: currentMonth,
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
}

function transactionInPeriod(transaction, period) {
    if (period === "all-time") return true;

    const date = new Date(`${transaction.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;

    const bounds = periodBounds(period);
    return date >= bounds.start && date < bounds.end;
}

function getTransactionsForPeriod(period = "this-month") {
    return state.transactions.filter((transaction) =>
        transactionInPeriod(transaction, period)
    );
}

function sumTransactions(transactions, type) {
    return transactions
        .filter((transaction) => transaction.type === type)
        .reduce((sum, transaction) => sum + numberValue(transaction.amount), 0);
}

function getSummaryPeriod() {
    return $("#summary-period")?.value ||
        state.settings.summaryPeriod || "this-month";
}


/* =========================================================
   SUMMARY CARDS AND BUDGET OVERVIEW
   ========================================================= */

function renderSummary() {
    const period = getSummaryPeriod();
    const transactions = getTransactionsForPeriod(period);

    const income = sumTransactions(transactions, "income");
    const expenses = sumTransactions(transactions, "expense");
    const balance = income - expenses;

    if ($("#total-income")) $("#total-income").textContent = money(income);
    if ($("#total-expenses")) $("#total-expenses").textContent = money(expenses);
    if ($("#remaining-balance")) $("#remaining-balance").textContent = money(balance);
    if ($("#total-savings")) $("#total-savings").textContent = money(balance);

    const periodLabels = {
        "this-month": "This month",
        "last-month": "Last month",
        "all-time": "All time"
    };

    if ($("#income-summary-note")) {
        $("#income-summary-note").textContent =
            `${periodLabels[period] || "Selected period"} income`;
    }
    if ($("#expense-summary-note")) {
        $("#expense-summary-note").textContent =
            `${periodLabels[period] || "Selected period"} expenses`;
    }
    if ($("#balance-summary-note")) {
        $("#balance-summary-note").textContent =
            balance < 0 ? "Expenses exceed income in this period" : "Income minus expenses";
    }
    if ($("#savings-summary-note")) {
        $("#savings-summary-note").textContent =
            "Net amount left after recorded expenses";
    }

    renderBudgetOverview();
}

function getBudgetPeriodTransactions() {
    const period = state.budget.period || state.profile.budgetPeriod || "monthly";

    if (period === "weekly") {
        return state.transactions.filter((transaction) => {
            if (transaction.type !== "expense") return false;
            const date = new Date(`${transaction.date}T00:00:00`);
            const bounds = periodBounds("this-week");
            return date >= bounds.start && date < bounds.end;
        });
    }

    return state.transactions.filter((transaction) =>
        transaction.type === "expense" &&
        transactionInPeriod(transaction, "this-month")
    );
}

function renderBudgetOverview() {
    const expenses = getBudgetPeriodTransactions()
        .reduce((sum, transaction) => sum + numberValue(transaction.amount), 0);

    const budget = numberValue(state.budget.amount);
    const remaining = budget - expenses;
    const percentage = budget > 0 ? Math.round((expenses / budget) * 100) : 0;
    const clampedPercentage = Math.min(100, Math.max(0, percentage));

    if ($("#budget-limit")) $("#budget-limit").textContent = money(budget);
    if ($("#budget-spent")) $("#budget-spent").textContent = money(expenses);
    if ($("#budget-percentage")) $("#budget-percentage").textContent = `${percentage}%`;
    if ($("#budget-remaining")) {
        $("#budget-remaining").textContent = `${money(remaining)} remaining`;
    }

    const fill = $("#budget-progress-fill");
    if (fill) fill.style.width = `${clampedPercentage}%`;

    const track = $("#budget-progress-track");
    if (track) track.setAttribute("aria-valuenow", String(clampedPercentage));

    if ($("#budget-status")) {
        if (budget <= 0) {
            $("#budget-status").textContent = "Set a budget to start tracking.";
        } else if (remaining < 0) {
            $("#budget-status").textContent = "You have exceeded your budget.";
        } else if (percentage >= 80) {
            $("#budget-status").textContent = "You're getting close to your budget limit.";
        } else {
            $("#budget-status").textContent = "You're within your budget.";
        }
    }

    if ($("#budget-page-total")) $("#budget-page-total").textContent = money(budget);
    if ($("#budget-page-spent")) $("#budget-page-spent").textContent = money(expenses);
    if ($("#budget-page-left")) $("#budget-page-left").textContent = money(remaining);
}


/* =========================================================
   TRANSACTION MODAL AND CRUD
   ========================================================= */

function setTransactionType(type) {
    const radio = $(`input[name="transaction-type"][value="${type}"]`);
    if (radio) radio.checked = true;

    $$(".transaction-type-option").forEach((option) => {
        const input = option.querySelector('input[name="transaction-type"]');
        option.classList.toggle("selected", input?.value === type);
    });

    const category = $("#transaction-category");
    if (!category) return;

    const incomeOptions = ["salary", "pocket-money", "scholarship", "freelance", "other"];
    const current = category.value;

    if (type === "income") {
        if (!incomeOptions.includes(current)) category.value = "pocket-money";
    } else {
        if (["salary", "pocket-money", "scholarship", "freelance"].includes(current)) {
            category.value = "food";
        }
    }
}

function openTransactionModal(type = "expense", transaction = null) {
    const form = $("#transaction-form");
    if (!form) return;

    form.reset();
    editingTransactionId = transaction?.id || null;

    $("#transaction-modal-title").textContent =
        transaction ? "Edit Transaction" : "Add Transaction";

    $("#save-transaction-button").innerHTML = transaction
        ? '<i class="fa-solid fa-check"></i> Save Changes'
        : '<i class="fa-solid fa-check"></i> Save Transaction';

    if (transaction) {
        setTransactionType(transaction.type);
        $("#transaction-title").value = transaction.title || "";
        $("#transaction-amount").value = transaction.amount;
        $("#transaction-category").value = transaction.category || "other";
        $("#transaction-date").value = transaction.date || todayString();
        $("#transaction-payment-method").value = transaction.paymentMethod || "upi";
        $("#transaction-notes").value = transaction.notes || "";
    } else {
        setTransactionType(type);
        $("#transaction-date").value = todayString();
        $("#transaction-category").value = type === "income" ? "pocket-money" : "food";
    }

    updateCurrencySymbols();
    openModal("transaction-modal");
}

function handleTransactionSubmit(event) {
    event.preventDefault();

    const title = $("#transaction-title").value.trim();
    const amount = numberValue($("#transaction-amount").value);
    const date = $("#transaction-date").value;
    const type = selectedTransactionType();

    if (!title || amount <= 0 || !isValidDate(date)) {
        showToast("Enter a valid name, amount, and date.", "error");
        return;
    }

    const transaction = {
        id: editingTransactionId || createId(),
        title,
        amount,
        type,
        category: $("#transaction-category").value || "other",
        date,
        paymentMethod: $("#transaction-payment-method").value || "other",
        notes: $("#transaction-notes").value.trim(),
        updatedAt: new Date().toISOString()
    };

    if (editingTransactionId) {
        const index = state.transactions.findIndex(
            (item) => item.id === editingTransactionId
        );
        if (index >= 0) state.transactions[index] = transaction;
    } else {
        transaction.createdAt = new Date().toISOString();
        state.transactions.push(transaction);
    }

    editingTransactionId = null;
    saveState();
    closeModal("transaction-modal");
    renderAll();
    showToast(transaction.type === "income"
        ? "Income saved successfully."
        : "Expense saved successfully.");
}

function editTransaction(id) {
    const transaction = state.transactions.find((item) => item.id === id);
    if (!transaction) return;
    openTransactionModal(transaction.type, transaction);
}

function deleteTransaction(id) {
    const transaction = state.transactions.find((item) => item.id === id);
    if (!transaction) return;

    showConfirmation(
        "Delete transaction?",
        `Delete "${transaction.title}"? This cannot be undone.`,
        () => {
            state.transactions = state.transactions.filter((item) => item.id !== id);
            saveState();
            renderAll();
            showToast("Transaction deleted.");
        },
        "Delete"
    );
}

function transactionRow(transaction, includeType = false) {
    const amountClass = transaction.type === "income"
        ? "transaction-income-amount" : "transaction-expense-amount";
    const sign = transaction.type === "income" ? "+" : "−";

    return `
        <tr>
            <td>
                <div class="transaction-name-cell">
                    <strong>${escapeHTML(transaction.title)}</strong>
                    ${transaction.notes
                        ? `<small>${escapeHTML(transaction.notes)}</small>` : ""}
                </div>
            </td>
            ${includeType ? `
                <td>
                    <span class="transaction-type-badge ${escapeHTML(transaction.type)}">
                        ${transaction.type === "income" ? "Income" : "Expense"}
                    </span>
                </td>` : ""}
            <td>${escapeHTML(categoryName(transaction.category))}</td>
            <td>${escapeHTML(formatDate(transaction.date))}</td>
            <td class="${amountClass}">
                ${sign}${escapeHTML(money(transaction.amount))}
            </td>
            <td>
                <div class="table-actions">
                    <button type="button" class="table-action-btn"
                        data-action="edit-transaction"
                        data-id="${escapeHTML(transaction.id)}"
                        aria-label="Edit ${escapeHTML(transaction.title)}"
                        title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="table-action-btn danger"
                        data-action="delete-transaction"
                        data-id="${escapeHTML(transaction.id)}"
                        aria-label="Delete ${escapeHTML(transaction.title)}"
                        title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}

function getRecentTransactions() {
    const typeFilter = $("#transaction-filter")?.value || "all";
    const search = ($("#transaction-search")?.value || "").trim().toLowerCase();

    return [...state.transactions]
        .filter((transaction) => typeFilter === "all" || transaction.type === typeFilter)
        .filter((transaction) => {
            const text = [
                transaction.title, transaction.notes,
                categoryName(transaction.category), transaction.paymentMethod
            ].join(" ").toLowerCase();
            return text.includes(search);
        })
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function renderRecentTransactions() {
    const body = $("#transactions-list");
    if (!body) return;

    const transactions = getRecentTransactions().slice(0, 6);
    body.innerHTML = transactions.map((item) => transactionRow(item)).join("");

    const empty = $("#transactions-empty");
    if (empty) empty.hidden = transactions.length > 0;

    if ($("#transaction-count")) {
        const total = getRecentTransactions().length;
        $("#transaction-count").textContent =
            `${total} transaction${total === 1 ? "" : "s"} shown`;
    }
}

function renderAllTransactions() {
    const body = $("#all-transactions-list");
    if (!body) return;

    const typeFilter = $("#all-transaction-filter")?.value || "all";
    const categoryFilter = $("#all-category-filter")?.value || "all";
    const startDate = $("#transaction-start-date")?.value || "";
    const endDate = $("#transaction-end-date")?.value || "";

    const transactions = [...state.transactions]
        .filter((item) => typeFilter === "all" || item.type === typeFilter)
        .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
        .filter((item) => !startDate || item.date >= startDate)
        .filter((item) => !endDate || item.date <= endDate)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    body.innerHTML = transactions.map((item) => transactionRow(item, true)).join("");

    if ($("#all-transactions-empty")) {
        $("#all-transactions-empty").hidden = transactions.length > 0;
    }
}

function clearTransactionFilters() {
    if ($("#all-transaction-filter")) $("#all-transaction-filter").value = "all";
    if ($("#all-category-filter")) $("#all-category-filter").value = "all";
    if ($("#transaction-start-date")) $("#transaction-start-date").value = "";
    if ($("#transaction-end-date")) $("#transaction-end-date").value = "";
    renderAllTransactions();
}


/* =========================================================
   SPENDING CHART
   ========================================================= */

function renderSpendingChart() {
    const canvas = $("#spending-chart");
    const legend = $("#spending-legend");
    const empty = $("#spending-empty");
    if (!canvas || !legend) return;

    const expenses = getTransactionsForPeriod(getSummaryPeriod())
        .filter((transaction) => transaction.type === "expense");

    const totals = {};
    expenses.forEach((transaction) => {
        const key = transaction.category || "other";
        totals[key] = (totals[key] || 0) + numberValue(transaction.amount);
    });

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    legend.innerHTML = entries.map(([category, amount], index) => `
        <div class="legend-item">
            <span class="legend-color" style="background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></span>
            <span class="legend-name">${escapeHTML(categoryName(category))}</span>
            <strong>${escapeHTML(money(amount))}</strong>
        </div>
    `).join("");

    if (empty) empty.hidden = entries.length > 0;

    const context = canvas.getContext("2d");
    if (!context) return;

    const width = Math.max(canvas.clientWidth || 280, 220);
    const height = 220;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (!entries.length) return;

    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.36;
    const innerRadius = radius * 0.62;

    let startAngle = -Math.PI / 2;

    entries.forEach(([, amount], index) => {
        const angle = (amount / total) * Math.PI * 2;
        context.beginPath();
        context.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        context.arc(centerX, centerY, innerRadius, startAngle + angle, startAngle, true);
        context.closePath();
        context.fillStyle = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
        context.fill();
        startAngle += angle;
    });

    context.fillStyle = getComputedStyle(document.body).color || "#1f2937";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 14px Inter, sans-serif";
    context.fillText("Total spent", centerX, centerY - 9);
    context.font = "700 13px Inter, sans-serif";
    context.fillText(money(total), centerX, centerY + 12);
}


/* =========================================================
   BUDGET MODAL AND CATEGORY BUDGETS
   ========================================================= */

function openBudgetModal() {
    $("#budget-name").value = state.budget.name || "Monthly budget";
    $("#budget-amount").value = state.budget.amount || "";
    $("#budget-period-modal").value =
        state.budget.period || state.profile.budgetPeriod || "monthly";

    updateCurrencySymbols();
    openModal("budget-modal");
}

function handleBudgetSubmit(event) {
    event.preventDefault();

    const name = $("#budget-name").value.trim();
    const amount = numberValue($("#budget-amount").value);
    const period = $("#budget-period-modal").value;

    if (!name || amount <= 0) {
        showToast("Enter a budget name and a valid amount.", "error");
        return;
    }

    state.budget = { name, amount, period };
    state.profile.budgetPeriod = period;

    saveState();
    closeModal("budget-modal");
    renderAll();
    showToast("Budget updated successfully.");
}

function openCategoryBudgetModal(categoryBudget = null) {
    if (categoryBudget) {
        $("#category-budget-category").value = categoryBudget.category;
        $("#category-budget-amount").value = categoryBudget.amount;
        $("#category-budget-modal-title").textContent = "Edit Category Budget";
    } else {
        $("#category-budget-form").reset();
        $("#category-budget-modal-title").textContent = "Category Budget";
    }

    updateCurrencySymbols();
    openModal("category-budget-modal");
}

function handleCategoryBudgetSubmit(event) {
    event.preventDefault();

    const category = $("#category-budget-category").value;
    const amount = numberValue($("#category-budget-amount").value);

    if (amount <= 0) {
        showToast("Enter a valid category budget.", "error");
        return;
    }

    const existing = state.categoryBudgets.find((item) => item.category === category);

    if (existing) {
        existing.amount = amount;
    } else {
        state.categoryBudgets.push({ id: createId(), category, amount });
    }

    saveState();
    closeModal("category-budget-modal");
    renderAll();
    showToast("Category budget saved.");
}

function deleteCategoryBudget(id) {
    showConfirmation(
        "Remove category budget?",
        "This will remove the limit for this category.",
        () => {
            state.categoryBudgets = state.categoryBudgets.filter((item) => item.id !== id);
            saveState();
            renderAll();
            showToast("Category budget removed.");
        },
        "Remove"
    );
}

function renderCategoryBudgets() {
    const container = $("#category-budget-list");
    if (!container) return;

    const expenses = getBudgetPeriodTransactions();
    const budgets = state.categoryBudgets;

    container.innerHTML = budgets.map((budget) => {
        const spent = expenses
            .filter((item) => item.category === budget.category)
            .reduce((sum, item) => sum + numberValue(item.amount), 0);

        const limit = numberValue(budget.amount);
        const percentage = limit > 0 ? Math.round(spent / limit * 100) : 0;
        const width = Math.min(100, Math.max(0, percentage));

        return `
            <article class="category-budget-item">
                <div class="category-budget-top">
                    <div>
                        <strong>${escapeHTML(categoryName(budget.category))}</strong>
                        <p>${escapeHTML(money(spent))} spent of ${escapeHTML(money(limit))}</p>
                    </div>
                    <div class="table-actions">
                        <button type="button" class="table-action-btn"
                            data-action="edit-category-budget"
                            data-id="${escapeHTML(budget.id)}"
                            aria-label="Edit category budget">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="table-action-btn danger"
                            data-action="delete-category-budget"
                            data-id="${escapeHTML(budget.id)}"
                            aria-label="Delete category budget">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${width}%"></div>
                </div>
                <small>${percentage}% used${percentage > 100 ? " — over budget" : ""}</small>
            </article>`;
    }).join("");

    if ($("#category-budget-empty")) {
        $("#category-budget-empty").hidden = budgets.length > 0;
    }
}


/* =========================================================
   SAVINGS GOALS
   ========================================================= */

function openSavingsGoalModal(goal = null) {
    editingGoalId = goal?.id || null;

    $("#savings-goal-form").reset();
    $("#savings-goal-modal-title").textContent =
        goal ? "Edit Savings Goal" : "Create a Savings Goal";

    if (goal) {
        $("#savings-goal-name").value = goal.name;
        $("#savings-goal-target").value = goal.target;
        $("#savings-goal-initial").value = goal.saved || 0;
        $("#savings-goal-deadline").value = goal.deadline || "";
    } else {
        $("#savings-goal-initial").value = "0";
    }

    updateCurrencySymbols();
    openModal("savings-goal-modal");
}

function handleSavingsGoalSubmit(event) {
    event.preventDefault();

    const name = $("#savings-goal-name").value.trim();
    const target = numberValue($("#savings-goal-target").value);
    const saved = numberValue($("#savings-goal-initial").value);
    const deadline = $("#savings-goal-deadline").value;

    if (!name || target <= 0 || saved < 0) {
        showToast("Enter a goal name and valid amounts.", "error");
        return;
    }

    const goal = {
        id: editingGoalId || createId(),
        name,
        target,
        saved: Math.min(saved, target),
        deadline,
        contributions: editingGoalId
            ? (state.goals.find((item) => item.id === editingGoalId)?.contributions || [])
            : []
    };

    if (editingGoalId) {
        const index = state.goals.findIndex((item) => item.id === editingGoalId);
        if (index >= 0) state.goals[index] = goal;
    } else {
        state.goals.push(goal);
    }

    editingGoalId = null;
    saveState();
    closeModal("savings-goal-modal");
    renderAll();
    showToast("Savings goal saved.");
}

function renderSavingsGoals() {
    const container = $("#savings-goals-list");
    if (!container) return;

    const totalTarget = state.goals.reduce((sum, goal) => sum + numberValue(goal.target), 0);
    const totalSaved = state.goals.reduce((sum, goal) => sum + numberValue(goal.saved), 0);
    const totalLeft = Math.max(0, totalTarget - totalSaved);

    if ($("#savings-goal-total")) $("#savings-goal-total").textContent = money(totalTarget);
    if ($("#savings-goal-saved")) $("#savings-goal-saved").textContent = money(totalSaved);
    if ($("#savings-goal-left")) $("#savings-goal-left").textContent = money(totalLeft);

    container.innerHTML = state.goals.map((goal) => {
        const target = numberValue(goal.target);
        const saved = numberValue(goal.saved);
        const percentage = target > 0 ? Math.round(saved / target * 100) : 0;
        const width = Math.min(100, Math.max(0, percentage));

        return `
            <article class="savings-goal-card">
                <div class="savings-goal-top">
                    <div>
                        <h3>${escapeHTML(goal.name)}</h3>
                        <p>${escapeHTML(money(saved))} saved of ${escapeHTML(money(target))}</p>
                    </div>
                    <div class="table-actions">
                        <button type="button" class="table-action-btn"
                            data-action="contribute-goal"
                            data-id="${escapeHTML(goal.id)}"
                            aria-label="Add savings to ${escapeHTML(goal.name)}"
                            title="Add savings">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button type="button" class="table-action-btn"
                            data-action="edit-goal"
                            data-id="${escapeHTML(goal.id)}"
                            aria-label="Edit ${escapeHTML(goal.name)}"
                            title="Edit goal">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="table-action-btn danger"
                            data-action="delete-goal"
                            data-id="${escapeHTML(goal.id)}"
                            aria-label="Delete ${escapeHTML(goal.name)}"
                            title="Delete goal">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${width}%"></div>
                </div>
                <div class="savings-goal-footer">
                    <span>${percentage}% complete</span>
                    <span>${escapeHTML(money(Math.max(0, target - saved)))} to go</span>
                </div>
                ${goal.deadline
                    ? `<small>Target date: ${escapeHTML(formatDate(goal.deadline))}</small>`
                    : ""}
            </article>`;
    }).join("");

    if ($("#savings-goals-empty")) {
        $("#savings-goals-empty").hidden = state.goals.length > 0;
    }
}

function openContributionModal(goalId) {
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal) return;

    contributingGoalId = goalId;
    $("#contribute-goal-description").textContent =
        `Add money toward "${goal.name}".`;
    $("#contribution-amount").value = "";
    $("#contribution-date").value = todayString();

    updateCurrencySymbols();
    openModal("contribute-modal");
}

function handleContributionSubmit(event) {
    event.preventDefault();

    const amount = numberValue($("#contribution-amount").value);
    const date = $("#contribution-date").value;
    const goal = state.goals.find((item) => item.id === contributingGoalId);

    if (!goal || amount <= 0 || !isValidDate(date)) {
        showToast("Enter a valid contribution amount and date.", "error");
        return;
    }

    goal.saved = Math.min(numberValue(goal.target), numberValue(goal.saved) + amount);
    goal.contributions = Array.isArray(goal.contributions) ? goal.contributions : [];
    goal.contributions.push({ amount, date });

    saveState();
    closeModal("contribute-modal");
    renderAll();
    showToast("Savings contribution recorded.");
}

function deleteGoal(id) {
    const goal = state.goals.find((item) => item.id === id);
    if (!goal) return;

    showConfirmation(
        "Delete savings goal?",
        `Delete "${goal.name}" and its goal progress?`,
        () => {
            state.goals = state.goals.filter((item) => item.id !== id);
            saveState();
            renderAll();
            showToast("Savings goal deleted.");
        },
        "Delete"
    );
}


/* =========================================================
   EXPORT AND IMPORT BACKUPS
   ========================================================= */

function exportData() {
    const backup = {
        app: "PennyWise",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: state
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pennywise-backup-${todayString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Backup exported.");
}

function importDataFile(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            const imported = parsed.data || parsed;

            if (!imported || typeof imported !== "object" ||
                !Array.isArray(imported.transactions)) {
                throw new Error("This file does not look like a PennyWise backup.");
            }

            showConfirmation(
                "Import backup?",
                "Importing replaces the current data stored in this browser. Export your current data first if you want a backup.",
                () => {
                    const defaults = cloneDefaultState();
                    state = {
                        ...defaults,
                        ...imported,
                        profile: { ...defaults.profile, ...(imported.profile || {}) },
                        budget: { ...defaults.budget, ...(imported.budget || {}) },
                        settings: { ...defaults.settings, ...(imported.settings || {}) },
                        transactions: Array.isArray(imported.transactions) ? imported.transactions : [],
                        categoryBudgets: Array.isArray(imported.categoryBudgets) ? imported.categoryBudgets : [],
                        goals: Array.isArray(imported.goals) ? imported.goals : []
                    };

                    saveState();
                    renderAll();
                    showToast("Backup imported successfully.");
                },
                "Import"
            );
        } catch (error) {
            console.error(error);
            showToast("Could not import that JSON backup.", "error");
        }
    };

    reader.onerror = () => showToast("Could not read the selected file.", "error");
    reader.readAsText(file);
}

function resetData() {
    showConfirmation(
        "Reset PennyWise?",
        "This permanently removes the saved data from this browser. Export a backup first if you need it.",
        () => {
            state = cloneDefaultState();
            saveState();
            closeAllModals();
            renderAll();
            showToast("PennyWise data has been reset.");
        },
        "Reset"
    );
}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindEvents() {
    $("#account-setup-form")?.addEventListener("submit", handleSetupSubmit);
    $("#settings-form")?.addEventListener("submit", handleSettingsSubmit);
    $("#transaction-form")?.addEventListener("submit", handleTransactionSubmit);
    $("#budget-form")?.addEventListener("submit", handleBudgetSubmit);
    $("#category-budget-form")?.addEventListener("submit", handleCategoryBudgetSubmit);
    $("#savings-goal-form")?.addEventListener("submit", handleSavingsGoalSubmit);
    $("#contribute-form")?.addEventListener("submit", handleContributionSubmit);

    $$('input[name="account-type"]').forEach((radio) => {
        radio.addEventListener("change", updateAccountTypeUI);
    });

    $$('input[name="transaction-type"]').forEach((radio) => {
        radio.addEventListener("change", () => setTransactionType(radio.value));
    });

    $("#currency")?.addEventListener("change", () => {
        const symbol = CURRENCY_SYMBOLS[$("#currency").value] || "₹";
        if ($("#income-currency-symbol")) {
            $("#income-currency-symbol").textContent = symbol;
        }
    });

    $("#summary-period")?.addEventListener("change", () => {
        state.settings.summaryPeriod = getSummaryPeriod();
        saveState();
        renderSummary();
        renderSpendingChart();
    });

    $("#transaction-filter")?.addEventListener("change", renderRecentTransactions);
    $("#transaction-search")?.addEventListener("input", renderRecentTransactions);

    [
        "all-transaction-filter",
        "all-category-filter",
        "transaction-start-date",
        "transaction-end-date"
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener("change", renderAllTransactions);
    });

    $("#clear-transaction-filters")?.addEventListener("click", clearTransactionFilters);

    $("#quick-add-expense")?.addEventListener("click", () => openTransactionModal("expense"));
    $("#add-expense-action")?.addEventListener("click", () => openTransactionModal("expense"));
    $("#add-income-action")?.addEventListener("click", () => openTransactionModal("income"));
    $("#empty-add-transaction")?.addEventListener("click", () => openTransactionModal("expense"));
    $("#transactions-add-button")?.addEventListener("click", () => openTransactionModal("expense"));

    $("#set-budget-action")?.addEventListener("click", openBudgetModal);
    $("#edit-budget-button")?.addEventListener("click", openBudgetModal);
    $("#add-category-budget-button")?.addEventListener("click", () => openCategoryBudgetModal());

    $("#set-savings-action")?.addEventListener("click", () => openSavingsGoalModal());
    $("#add-savings-goal-button")?.addEventListener("click", () => openSavingsGoalModal());
    $("#empty-create-savings-goal")?.addEventListener("click", () => openSavingsGoalModal());

    $("#close-transaction-modal")?.addEventListener("click", () => closeModal("transaction-modal"));
    $("#cancel-transaction")?.addEventListener("click", () => closeModal("transaction-modal"));

    $("#close-budget-modal")?.addEventListener("click", () => closeModal("budget-modal"));
    $("#cancel-budget")?.addEventListener("click", () => closeModal("budget-modal"));

    $("#close-category-budget-modal")?.addEventListener("click", () => closeModal("category-budget-modal"));
    $("#cancel-category-budget")?.addEventListener("click", () => closeModal("category-budget-modal"));

    $("#close-savings-goal-modal")?.addEventListener("click", () => closeModal("savings-goal-modal"));
    $("#cancel-savings-goal")?.addEventListener("click", () => closeModal("savings-goal-modal"));

    $("#close-contribute-modal")?.addEventListener("click", () => closeModal("contribute-modal"));
    $("#cancel-contribution")?.addEventListener("click", () => closeModal("contribute-modal"));

    $("#close-edit-transaction-modal")?.addEventListener("click", () => closeModal("edit-transaction-modal"));
    $("#cancel-edit-transaction")?.addEventListener("click", () => closeModal("edit-transaction-modal"));

    $("#close-toast")?.addEventListener("click", () => {
        $("#toast-message").hidden = true;
    });

    $("#confirmation-cancel")?.addEventListener("click", () => {
        confirmationCallback = null;
        closeModal("confirmation-modal");
    });

    $("#confirmation-accept")?.addEventListener("click", () => {
        const callback = confirmationCallback;
        confirmationCallback = null;
        closeModal("confirmation-modal");
        if (typeof callback === "function") callback();
    });

    $("#mobile-menu-btn")?.addEventListener("click", toggleMobileMenu);

    $("#profile-button")?.addEventListener("click", () => {
        navigateTo("settings");
    });

    $("#export-data-button")?.addEventListener("click", exportData);
    $("#import-data-button")?.addEventListener("click", () => $("#import-data-file")?.click());
    $("#import-data-file")?.addEventListener("change", (event) => {
        importDataFile(event.target.files?.[0]);
        event.target.value = "";
    });

    $$(".nav-link[data-section]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            navigateTo(link.dataset.section);
        });
    });

    $$('a[href^="#"]').forEach((link) => {
        if (link.matches(".nav-link[data-section]")) return;

        link.addEventListener("click", (event) => {
            const target = link.getAttribute("href")?.slice(1);
            if (["dashboard", "transactions", "budgets", "savings", "settings"].includes(target)) {
                event.preventDefault();
                navigateTo(target);
            }
        });
    });

    // Delegate actions for dynamically rendered transaction, budget, and goal rows.
    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const id = button.dataset.id;
        switch (button.dataset.action) {
            case "edit-transaction":
                editTransaction(id);
                break;

            case "delete-transaction":
                deleteTransaction(id);
                break;

            case "edit-category-budget": {
                const budget = state.categoryBudgets.find((item) => item.id === id);
                if (budget) openCategoryBudgetModal(budget);
                break;
            }

            case "delete-category-budget":
                deleteCategoryBudget(id);
                break;

            case "edit-goal": {
                const goal = state.goals.find((item) => item.id === id);
                if (goal) openSavingsGoalModal(goal);
                break;
            }

            case "delete-goal":
                deleteGoal(id);
                break;

            case "contribute-goal":
                openContributionModal(id);
                break;
        }
    });

    // Close a modal when its backdrop is clicked.
    $$(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeModal(overlay.id);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAllModals();
            $("#sidebar")?.classList.remove("sidebar-open");
            $("#mobile-menu-btn")?.setAttribute("aria-expanded", "false");
        }
    });

    window.addEventListener("resize", () => {
        renderSpendingChart();
    });
}


/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {
    showSetup();
    renderProfile();
    updateAccountTypeUI();
    updateCurrencySymbols();

    if ($("#summary-period")) {
        $("#summary-period").value =
            state.settings.summaryPeriod || "this-month";
    }

    if ($("#income-amount") && !state.profile.setupComplete) {
        $("#income-amount").value = state.profile.incomeAmount || "";
    }

    renderSummary();
    renderRecentTransactions();
    renderAllTransactions();
    renderSpendingChart();
    renderCategoryBudgets();
    renderSavingsGoals();

    // Keep the setup form's selections consistent with saved settings.
    const accountRadio = $(
        `input[name="account-type"][value="${state.profile.accountType}"]`
    );
    if (accountRadio) accountRadio.checked = true;

    if ($("#currency")) $("#currency").value = state.profile.currency || "INR";
    if ($("#income-frequency")) {
        $("#income-frequency").value = state.profile.incomeFrequency || "monthly";
    }
    if ($("#budget-period")) {
        $("#budget-period").value = state.profile.budgetPeriod || "monthly";
    }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializePennyWise() {
    bindEvents();
    renderAll();

    const requestedSection = location.hash.replace("#", "");
    if (["dashboard", "transactions", "budgets", "savings", "settings"].includes(requestedSection)) {
        navigateTo(requestedSection);
    } else {
        navigateTo("dashboard");
    }

    // Update chart after layout has settled.
    requestAnimationFrame(renderSpendingChart);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePennyWise);
} else {
    initializePennyWise();
}

function renderSummary() {
    const period = getSummaryPeriod();
    const transactions = getTransactionsForPeriod(period);

    const income = sumTransactions(transactions, "income");
    const expenses = sumTransactions(transactions, "expense");

    // The setup amount is treated as opening money for the
    // current month and all-time view, not as a transaction.
    const openingMoney =
        period === "this-month" || period === "all-time"
            ? numberValue(state.profile.incomeAmount)
            : 0;

    const balance = openingMoney + income - expenses;

    if ($("#total-income")) {
        $("#total-income").textContent = money(income + openingMoney);
    }

    if ($("#total-expenses")) {
        $("#total-expenses").textContent = money(expenses);
    }

    if ($("#remaining-balance")) {
        $("#remaining-balance").textContent = money(balance);
    }

    if ($("#total-savings")) {
        $("#total-savings").textContent = money(balance);
    }

    const periodLabels = {
        "this-month": "This month",
        "last-month": "Last month",
        "all-time": "All time"
    };

    if ($("#income-summary-note")) {
        $("#income-summary-note").textContent =
            `${periodLabels[period]} income, including opening money when applicable`;
    }

    if ($("#expense-summary-note")) {
        $("#expense-summary-note").textContent =
            `${periodLabels[period]} expenses`;
    }

    if ($("#balance-summary-note")) {
        $("#balance-summary-note").textContent =
            balance < 0
                ? "Expenses exceed available money"
                : "Starting money + income − expenses";
    }

    if ($("#savings-summary-note")) {
        $("#savings-summary-note").textContent =
            "Available balance after recorded expenses";
    }

    renderBudgetOverview();
}
