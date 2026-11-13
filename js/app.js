/**
 * Main Application Controller (app.js)
 * ---------------------------------------------------------------------------
 * Coordinates navigation, global UI state, modals, form validation,
 * event delegation, and rendering across all five application features.
 */

import { renderAnalyticsView } from './analytics.js';
import {
  renderBudgetView,
  updateSidebarBudgetWidget,
  validateBudgetLimit,
} from './budget.js';
import { renderDashboardView } from './dashboard.js';
import {
  addTransaction,
  deleteTransaction,
  getBudget,
  getTransactions,
  resetDemoData,
  saveBudget,
  seedInitialDataIfNeeded,
  updateTransaction,
} from './storage.js';
import {
  escapeHtml,
  exportTransactionsToCsv,
  formatMonthLabel,
  getAvailableMonthKeys,
  getCategoriesByType,
  getCurrentMonthKey,
  getTodayIsoDate,
  renderTransactionsView,
  validateTransactionInput,
} from './transactions.js';

const VIEW_META = {
  dashboard: {
    title: 'Dashboard',
    getSubtitle: (monthKey) => `Financial overview for ${formatMonthLabel(monthKey)}`,
  },
  transactions: {
    title: 'Transactions',
    getSubtitle: () => 'Search, filter, edit, and manage all recorded entries',
  },
  analytics: {
    title: 'Expense Analytics',
    getSubtitle: () => 'Category breakdowns, cash flow trends, and savings metrics',
  },
  budget: {
    title: 'Budget Management',
    getSubtitle: (monthKey) => `Monthly spending limit and alerts for ${formatMonthLabel(monthKey)}`,
  },
};

const state = {
  activeView: 'dashboard',
  activeMonth: getCurrentMonthKey(),
  overviewMode: 'monthly',
  transactions: [],
  budget: { monthlyLimit: 0, updatedAt: null },
  filters: {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  },
  confirmCallback: null,
};

/* ==========================================================================
   Icon & Toast Helpers
   ========================================================================== */

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Displays a concise non-blocking toast notification.
 * @param {string} message
 * @param {'success'|'error'} variant
 */
function showToast(message, variant = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : ''}`;
  const iconName = variant === 'error' ? 'alert-circle' : 'check-circle-2';
  toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

/* ==========================================================================
   State Sync & Rendering
   ========================================================================== */

function loadDataFromStorage() {
  state.transactions = getTransactions();
  state.budget = getBudget();
}

function syncMonthSelector() {
  const select = document.getElementById('active-month-select');
  if (!select) return;

  const monthKeys = getAvailableMonthKeys(state.transactions);
  if (!monthKeys.includes(state.activeMonth)) {
    monthKeys.unshift(state.activeMonth);
  }

  select.innerHTML = monthKeys
    .map(
      (key) =>
        `<option value="${escapeHtml(key)}" ${
          key === state.activeMonth ? 'selected' : ''
        }>${escapeHtml(formatMonthLabel(key))}</option>`
    )
    .join('');
}

function renderActiveView() {
  const viewKey = state.activeView;
  const meta = VIEW_META[viewKey] || VIEW_META.dashboard;

  const titleEl = document.getElementById('topbar-title');
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subtitleEl) subtitleEl.textContent = meta.getSubtitle(state.activeMonth);

  // Toggle visible view section
  document.querySelectorAll('.app-view').forEach((section) => {
    const isMatch = section.id === `view-${viewKey}`;
    section.hidden = !isMatch;
    section.classList.toggle('is-active', isMatch);
  });

  // Update sidebar active nav state
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((btn) => {
    const isMatch = btn.getAttribute('data-nav') === viewKey;
    btn.classList.toggle('is-active', isMatch);
    if (isMatch) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  // Keep month selector & sidebar budget widget always synced
  syncMonthSelector();
  updateSidebarBudgetWidget(state.transactions, state.budget, state.activeMonth);

  // Render active view module
  if (viewKey === 'dashboard') {
    renderDashboardView({
      transactions: state.transactions,
      budget: state.budget,
      activeMonth: state.activeMonth,
      overviewMode: state.overviewMode,
    });
  } else if (viewKey === 'transactions') {
    renderTransactionsView(state.transactions, state.filters);
  } else if (viewKey === 'analytics') {
    renderAnalyticsView({
      transactions: state.transactions,
      activeMonth: state.activeMonth,
    });
  } else if (viewKey === 'budget') {
    renderBudgetView({
      transactions: state.transactions,
      budget: state.budget,
      activeMonth: state.activeMonth,
    });
  }

  refreshIcons();
}

function reloadAndRender() {
  loadDataFromStorage();
  renderActiveView();
}

function navigateTo(viewName) {
  if (!VIEW_META[viewName]) return;
  state.activeView = viewName;
  if (window.location.hash !== `#${viewName}`) {
    history.replaceState(null, '', `#${viewName}`);
  }
  closeMobileSidebar();
  renderActiveView();
}

/* ==========================================================================
   Mobile Sidebar Drawer
   ========================================================================== */

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('is-open');
  document.getElementById('sidebar-backdrop')?.classList.add('is-open');
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-open');
}

/* ==========================================================================
   Add / Edit Transaction Modal (Feature 2)
   ========================================================================== */

function populateModalCategories(type, selectedCategory = '') {
  const select = document.getElementById('tx-category-input');
  if (!select) return;

  const categories = getCategoriesByType(type);
  const effectiveSelection = categories.includes(selectedCategory)
    ? selectedCategory
    : categories[0];

  select.innerHTML = categories
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${
          cat === effectiveSelection ? 'selected' : ''
        }>${escapeHtml(cat)}</option>`
    )
    .join('');
}

function setModalType(type) {
  const normalizedType = type === 'income' ? 'income' : 'expense';
  const hiddenInput = document.getElementById('tx-type-input');
  if (hiddenInput) hiddenInput.value = normalizedType;

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-form-type') === normalizedType;
    btn.classList.toggle('is-active', isMatch);
    btn.setAttribute('aria-pressed', String(isMatch));
  });

  const currentCat = document.getElementById('tx-category-input')?.value || '';
  populateModalCategories(normalizedType, currentCat);
}

function clearTransactionFormErrors() {
  const fields = ['title', 'amount', 'category', 'date', 'description'];
  fields.forEach((field) => {
    const input = document.getElementById(`tx-${field}-input`);
    const errorEl = document.getElementById(`tx-${field}-error`);
    input?.classList.remove('is-invalid');
    input?.removeAttribute('aria-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  });
}

function showTransactionFormErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.getElementById(`tx-${field}-input`);
    const errorEl = document.getElementById(`tx-${field}-error`);
    input?.classList.add('is-invalid');
    input?.setAttribute('aria-invalid', 'true');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  });
}

function openTransactionModal(transactionToEdit = null) {
  const modal = document.getElementById('transaction-modal');
  if (!modal) return;

  clearTransactionFormErrors();

  const modalTitle = document.getElementById('transaction-modal-title');
  const submitBtn = document.getElementById('modal-submit-btn');
  const idInput = document.getElementById('tx-id-input');
  const titleInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');

  if (transactionToEdit) {
    if (modalTitle) modalTitle.textContent = 'Edit Transaction';
    if (submitBtn) submitBtn.textContent = 'Update Transaction';
    if (idInput) idInput.value = transactionToEdit.id;
    setModalType(transactionToEdit.type);
    populateModalCategories(transactionToEdit.type, transactionToEdit.category);
    if (titleInput) titleInput.value = transactionToEdit.title;
    if (amountInput) amountInput.value = String(transactionToEdit.amount);
    if (dateInput) dateInput.value = transactionToEdit.date;
    if (descInput) descInput.value = transactionToEdit.description || '';
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Transaction';
    if (submitBtn) submitBtn.textContent = 'Save Transaction';
    if (idInput) idInput.value = '';
    setModalType('expense');
    populateModalCategories('expense', 'Food');
    if (titleInput) titleInput.value = '';
    if (amountInput) amountInput.value = '';
    if (dateInput) dateInput.value = getTodayIsoDate();
    if (descInput) descInput.value = '';
  }

  modal.hidden = false;
  refreshIcons();
  titleInput?.focus();
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.hidden = true;
}

function handleTransactionFormSubmit(event) {
  event.preventDefault();
  clearTransactionFormErrors();

  const id = document.getElementById('tx-id-input')?.value.trim() || '';
  const payload = {
    type: document.getElementById('tx-type-input')?.value || 'expense',
    title: document.getElementById('tx-title-input')?.value.trim() || '',
    amount: document.getElementById('tx-amount-input')?.value || '',
    category: document.getElementById('tx-category-input')?.value || '',
    date: document.getElementById('tx-date-input')?.value || '',
    description: document.getElementById('tx-description-input')?.value.trim() || '',
  };

  const validation = validateTransactionInput(payload);
  if (!validation.valid) {
    showTransactionFormErrors(validation.errors);
    return;
  }

  const normalizedPayload = {
    ...payload,
    amount: Number(payload.amount),
  };

  if (id) {
    updateTransaction(id, normalizedPayload);
    showToast('Transaction updated.');
  } else {
    addTransaction(normalizedPayload);
    showToast(
      normalizedPayload.type === 'income' ? 'Income added.' : 'Expense added.'
    );
  }

  // Switch active month if user added an entry in a new month? Keep user context, or sync selector.
  closeTransactionModal();
  reloadAndRender();
}

/* ==========================================================================
   Custom Confirmation Modal
   ========================================================================== */

function openConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;

  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-message');
  const acceptBtn = document.getElementById('confirm-accept-btn');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (acceptBtn) acceptBtn.textContent = confirmLabel;

  state.confirmCallback = onConfirm;
  modal.hidden = false;
  refreshIcons();
  acceptBtn?.focus();
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.hidden = true;
  state.confirmCallback = null;
}

/* ==========================================================================
   Event Binding
   ========================================================================== */

function bindEvents() {
  // Navigation clicks (sidebar, brand mark, dashboard alert/recent links)
  document.addEventListener('click', (event) => {
    const navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      event.preventDefault();
      const view = navTarget.getAttribute('data-nav');
      if (view) navigateTo(view);
      return;
    }

    // Edit transaction button in any table
    const editBtn = event.target.closest('[data-action="edit-tx"]');
    if (editBtn) {
      const txId = editBtn.getAttribute('data-tx-id');
      const tx = state.transactions.find((item) => item.id === txId);
      if (tx) openTransactionModal(tx);
      return;
    }

    // Delete transaction button in any table
    const deleteBtn = event.target.closest('[data-action="delete-tx"]');
    if (deleteBtn) {
      const txId = deleteBtn.getAttribute('data-tx-id');
      const tx = state.transactions.find((item) => item.id === txId);
      if (!tx) return;

      openConfirmModal({
        title: 'Delete Transaction',
        message: `Are you sure you want to delete "${tx.title}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          deleteTransaction(tx.id);
          reloadAndRender();
          showToast('Transaction deleted.');
        },
      });
      return;
    }

    // Dashboard overview chart mode toggle
    const overviewBtn = event.target.closest('[data-overview-mode]');
    if (overviewBtn) {
      const mode = overviewBtn.getAttribute('data-overview-mode');
      if (mode === 'monthly' || mode === 'daily') {
        state.overviewMode = mode;
        renderActiveView();
      }
      return;
    }

    // Transaction type segmented filter
    const typeFilterBtn = event.target.closest('[data-tx-type]');
    if (typeFilterBtn) {
      const type = typeFilterBtn.getAttribute('data-tx-type');
      if (type) {
        state.filters.type = type;
        renderActiveView();
      }
      return;
    }

    // Modal type toggle
    const formTypeBtn = event.target.closest('[data-form-type]');
    if (formTypeBtn) {
      const type = formTypeBtn.getAttribute('data-form-type');
      if (type) setModalType(type);
      return;
    }

    // Budget quick preset buttons
    const presetBtn = event.target.closest('[data-budget-preset]');
    if (presetBtn) {
      const presetVal = presetBtn.getAttribute('data-budget-preset');
      const input = document.getElementById('budget-limit-input');
      const errorEl = document.getElementById('budget-limit-error');
      if (input && presetVal) {
        input.value = presetVal;
        input.classList.remove('is-invalid');
      }
      if (errorEl) errorEl.hidden = true;
      return;
    }

    // Empty state actions inside Transaction History / Dashboard
    if (event.target.closest('#empty-clear-filters-btn')) {
      state.filters = { search: '', type: 'all', category: 'all', sortBy: 'date-desc' };
      renderActiveView();
      return;
    }

    if (
      event.target.closest('#empty-add-tx-btn') ||
      event.target.closest('#dashboard-empty-add-btn')
    ) {
      openTransactionModal(null);
    }
  });

  // Mobile sidebar controls
  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Active month selector
  document.getElementById('active-month-select')?.addEventListener('change', (event) => {
    state.activeMonth = event.target.value;
    renderActiveView();
  });

  // Top bar Add Transaction CTA
  document.getElementById('btn-open-add-modal')?.addEventListener('click', () => {
    openTransactionModal(null);
  });

  // Modal close / cancel
  document.getElementById('modal-close-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'transaction-modal') closeTransactionModal();
  });

  // Transaction form submission & live error clearing
  document
    .getElementById('transaction-form')
    ?.addEventListener('submit', handleTransactionFormSubmit);

  ['title', 'amount', 'category', 'date', 'description'].forEach((field) => {
    document.getElementById(`tx-${field}-input`)?.addEventListener('input', () => {
      const input = document.getElementById(`tx-${field}-input`);
      const errorEl = document.getElementById(`tx-${field}-error`);
      input?.classList.remove('is-invalid');
      input?.removeAttribute('aria-invalid');
      if (errorEl) errorEl.hidden = true;
    });
  });

  // Confirm modal controls
  document.getElementById('confirm-close-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'confirm-modal') closeConfirmModal();
  });
  document.getElementById('confirm-accept-btn')?.addEventListener('click', () => {
    const cb = state.confirmCallback;
    closeConfirmModal();
    if (typeof cb === 'function') cb();
  });

  // Escape key closes modals / drawer
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTransactionModal();
      closeConfirmModal();
      closeMobileSidebar();
    }
  });

  // Transaction History search, category filter, sort, clear
  document.getElementById('tx-search-input')?.addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderActiveView();
  });

  document.getElementById('tx-category-filter')?.addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    renderActiveView();
  });

  document.getElementById('tx-sort-select')?.addEventListener('change', (event) => {
    state.filters.sortBy = event.target.value;
    renderActiveView();
  });

  document.getElementById('tx-clear-filters-btn')?.addEventListener('click', () => {
    state.filters = { search: '', type: 'all', category: 'all', sortBy: 'date-desc' };
    renderActiveView();
  });

  // Budget form submit
  document.getElementById('budget-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('budget-limit-input');
    const errorEl = document.getElementById('budget-limit-error');
    const validation = validateBudgetLimit(input?.value);

    if (!validation.valid) {
      input?.classList.add('is-invalid');
      input?.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = validation.error;
        errorEl.hidden = false;
      }
      return;
    }

    input?.classList.remove('is-invalid');
    input?.removeAttribute('aria-invalid');
    if (errorEl) errorEl.hidden = true;

    saveBudget({ monthlyLimit: validation.value });
    reloadAndRender();
    showToast('Monthly budget saved.');
  });

  document.getElementById('budget-limit-input')?.addEventListener('input', () => {
    const input = document.getElementById('budget-limit-input');
    const errorEl = document.getElementById('budget-limit-error');
    input?.classList.remove('is-invalid');
    input?.removeAttribute('aria-invalid');
    if (errorEl) errorEl.hidden = true;
  });

  // Sidebar Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (!state.transactions.length) {
      showToast('No transactions to export.', 'error');
      return;
    }
    exportTransactionsToCsv(state.transactions);
    showToast('Transactions exported to CSV.');
  });

  // Sidebar Reset Demo Data
  document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Reset Sample Data',
      message:
        'This will replace your current transactions and budget with the default sample dataset.',
      confirmLabel: 'Reset Data',
      onConfirm: () => {
        resetDemoData();
        state.activeMonth = getCurrentMonthKey();
        reloadAndRender();
        showToast('Sample dataset restored.');
      },
    });
  });
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */

function init() {
  seedInitialDataIfNeeded();
  loadDataFromStorage();

  const hashView = window.location.hash.replace('#', '').trim();
  if (VIEW_META[hashView]) {
    state.activeView = hashView;
  }

  bindEvents();
  renderActiveView();
}

document.addEventListener('DOMContentLoaded', init);
