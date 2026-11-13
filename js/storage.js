/**
 * Centralized Data Storage Module (LocalStorage Persistence)
 * ---------------------------------------------------------------------------
 * All persistence operations are isolated here behind clean CRUD methods so
 * that migrating to a Node.js + Express + SQL REST API only requires
 * replacing the storage adapter inside this module.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

/**
 * Generates a collision-resistant unique identifier for transactions.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalizes a raw transaction payload to guarantee consistent schema.
 * @param {object} raw
 * @returns {object}
 */
function normalizeTransaction(raw) {
  const type = raw.type === 'income' ? 'income' : 'expense';
  const amount = Math.round((Number(raw.amount) || 0) * 100) / 100;
  return {
    id: String(raw.id || generateId()),
    title: String(raw.title || '').trim(),
    amount,
    category: String(raw.category || 'Other').trim(),
    type,
    date: String(raw.date || '').slice(0, 10),
    description: String(raw.description || '').trim(),
  };
}

/**
 * Retrieves all stored transactions from LocalStorage.
 * @returns {Array<object>}
 */
export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction);
  } catch (err) {
    console.error('Failed to read transactions from LocalStorage:', err);
    return [];
  }
}

/**
 * Persists the complete transactions array to LocalStorage.
 * @param {Array<object>} transactions
 * @returns {Array<object>}
 */
export function saveTransactions(transactions) {
  const normalized = Array.isArray(transactions)
    ? transactions.map(normalizeTransaction)
    : [];
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (err) {
    console.error('Failed to save transactions to LocalStorage:', err);
  }
  return normalized;
}

/**
 * Creates and persists a new transaction record.
 * @param {object} transactionInput
 * @returns {object} The created transaction
 */
export function addTransaction(transactionInput) {
  const existing = getTransactions();
  const created = normalizeTransaction({
    ...transactionInput,
    id: generateId(),
  });
  saveTransactions([created, ...existing]);
  return created;
}

/**
 * Updates an existing transaction by ID.
 * @param {string} id
 * @param {object} updatedFields
 * @returns {object|null} Updated transaction or null if not found
 */
export function updateTransaction(id, updatedFields) {
  const existing = getTransactions();
  let updatedRecord = null;
  const next = existing.map((item) => {
    if (item.id === id) {
      updatedRecord = normalizeTransaction({
        ...item,
        ...updatedFields,
        id: item.id,
      });
      return updatedRecord;
    }
    return item;
  });

  if (updatedRecord) {
    saveTransactions(next);
  }
  return updatedRecord;
}

/**
 * Deletes a transaction by ID.
 * @param {string} id
 * @returns {boolean} True if a record was removed
 */
export function deleteTransaction(id) {
  const existing = getTransactions();
  const next = existing.filter((item) => item.id !== id);
  if (next.length === existing.length) {
    return false;
  }
  saveTransactions(next);
  return true;
}

/**
 * Retrieves budget configuration from LocalStorage.
 * @returns {{ monthlyLimit: number, updatedAt: string|null }}
 */
export function getBudget() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      return { monthlyLimit: 0, updatedAt: null };
    }
    const parsed = JSON.parse(raw);
    const limit = Number(parsed?.monthlyLimit);
    return {
      monthlyLimit: Number.isFinite(limit) && limit >= 0 ? Math.round(limit * 100) / 100 : 0,
      updatedAt: parsed?.updatedAt || null,
    };
  } catch (err) {
    console.error('Failed to read budget from LocalStorage:', err);
    return { monthlyLimit: 0, updatedAt: null };
  }
}

/**
 * Saves monthly budget information to LocalStorage.
 * @param {number|{ monthlyLimit: number }} budgetInput
 * @returns {{ monthlyLimit: number, updatedAt: string }}
 */
export function saveBudget(budgetInput) {
  const rawLimit =
    typeof budgetInput === 'object' && budgetInput !== null
      ? budgetInput.monthlyLimit
      : budgetInput;
  const parsed = Number(rawLimit);
  const monthlyLimit =
    Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;

  const payload = {
    monthlyLimit,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(payload));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (err) {
    console.error('Failed to save budget to LocalStorage:', err);
  }

  return payload;
}

/**
 * Builds an ISO YYYY-MM-DD string offset by months and day of month.
 * Ensures sample data aligns dynamically with the user's current month.
 * @param {number} monthOffset
 * @param {number} day
 * @returns {string}
 */
function buildRelativeDate(monthOffset, day) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, day), maxDay);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(safeDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates realistic multi-month sample transactions for initial demonstration.
 * @returns {Array<object>}
 */
function createSampleTransactions() {
  const todayDay = new Date().getDate();
  const d = (offset, preferredDay) =>
    buildRelativeDate(offset, offset === 0 ? Math.min(preferredDay, todayDay) : preferredDay);

  return [
    // Current month
    {
      id: generateId(),
      title: 'Monthly Payroll Deposit',
      amount: 4650,
      category: 'Salary',
      type: 'income',
      date: d(0, 1),
      description: 'Primary engineering salary net deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Lease',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: d(0, 2),
      description: 'Monthly apartment rent and building fee',
    },
    {
      id: generateId(),
      title: 'Whole Foods Groceries',
      amount: 214.8,
      category: 'Food',
      type: 'expense',
      date: d(0, 4),
      description: 'Weekly groceries and household staples',
    },
    {
      id: generateId(),
      title: 'City Electric & Fiber',
      amount: 142.5,
      category: 'Utilities',
      type: 'expense',
      date: d(0, 6),
      description: 'Monthly electricity and internet service',
    },
    {
      id: generateId(),
      title: 'UI Consulting Retainer',
      amount: 780,
      category: 'Freelance',
      type: 'income',
      date: d(0, 8),
      description: 'Design system audit for client portal',
    },
    {
      id: generateId(),
      title: 'Transit & Fuel Pass',
      amount: 96,
      category: 'Transport',
      type: 'expense',
      date: d(0, 9),
      description: 'Monthly commuter rail pass and fuel top-up',
    },
    {
      id: generateId(),
      title: 'Dental Checkup',
      amount: 135,
      category: 'Healthcare',
      type: 'expense',
      date: d(0, 10),
      description: 'Routine preventive dental cleaning copay',
    },
    {
      id: generateId(),
      title: 'Trader Joes Market',
      amount: 118.4,
      category: 'Food',
      type: 'expense',
      date: d(0, 12),
      description: 'Mid-week produce and coffee beans',
    },
    {
      id: generateId(),
      title: 'Running Shoes',
      amount: 148,
      category: 'Shopping',
      type: 'expense',
      date: d(0, 13),
      description: 'Replacement daily training footwear',
    },

    // -1 Month
    {
      id: generateId(),
      title: 'Monthly Payroll Deposit',
      amount: 4650,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-1, 1),
      description: 'Primary engineering salary net deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Lease',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-1, 2),
      description: 'Monthly apartment rent',
    },
    {
      id: generateId(),
      title: 'Groceries & Meal Prep',
      amount: 392.15,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-1, 9),
      description: 'Supermarket runs and farmers market',
    },
    {
      id: generateId(),
      title: 'Electric & Gas Utility',
      amount: 138.9,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(-1, 14),
      description: 'Monthly utilities',
    },
    {
      id: generateId(),
      title: 'Concert & Dinner',
      amount: 164,
      category: 'Entertainment',
      type: 'expense',
      date: buildRelativeDate(-1, 19),
      description: 'Weekend symphony tickets and dinner',
    },
    {
      id: generateId(),
      title: 'Quarterly Dividend',
      amount: 310,
      category: 'Investments',
      type: 'income',
      date: buildRelativeDate(-1, 22),
      description: 'Index fund quarterly payout',
    },
    {
      id: generateId(),
      title: 'Technical Books',
      amount: 74.5,
      category: 'Education',
      type: 'expense',
      date: buildRelativeDate(-1, 25),
      description: 'Distributed systems architecture reference',
    },

    // -2 Months
    {
      id: generateId(),
      title: 'Monthly Payroll Deposit',
      amount: 4500,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-2, 1),
      description: 'Monthly salary deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Lease',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-2, 2),
      description: 'Monthly rent',
    },
    {
      id: generateId(),
      title: 'Household Groceries',
      amount: 410,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-2, 11),
      description: 'Monthly supermarket spending',
    },
    {
      id: generateId(),
      title: 'Car Maintenance & Fuel',
      amount: 245,
      category: 'Transport',
      type: 'expense',
      date: buildRelativeDate(-2, 16),
      description: 'Tire rotation, oil service, and fuel',
    },
    {
      id: generateId(),
      title: 'Home Office Desk Lamp',
      amount: 129,
      category: 'Shopping',
      type: 'expense',
      date: buildRelativeDate(-2, 21),
      description: 'Workspace lighting upgrade',
    },

    // -3 Months
    {
      id: generateId(),
      title: 'Monthly Payroll Deposit',
      amount: 4500,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-3, 1),
      description: 'Monthly salary deposit',
    },
    {
      id: generateId(),
      title: 'Web Prototype Sprint',
      amount: 620,
      category: 'Freelance',
      type: 'income',
      date: buildRelativeDate(-3, 15),
      description: 'Fixed-scope frontend advisory',
    },
    {
      id: generateId(),
      title: 'Apartment Lease',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-3, 2),
      description: 'Monthly rent',
    },
    {
      id: generateId(),
      title: 'Groceries & Dining',
      amount: 365,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-3, 12),
      description: 'Groceries and neighborhood dining',
    },
    {
      id: generateId(),
      title: 'Utilities & Mobile',
      amount: 152,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(-3, 18),
      description: 'Power, fiber, and mobile plan',
    },

    // -4 Months
    {
      id: generateId(),
      title: 'Monthly Payroll Deposit',
      amount: 4500,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-4, 1),
      description: 'Monthly salary deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Lease',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-4, 2),
      description: 'Monthly rent',
    },
    {
      id: generateId(),
      title: 'Groceries',
      amount: 348,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-4, 10),
      description: 'Weekly food and pantry essentials',
    },
    {
      id: generateId(),
      title: 'Streaming & Cinema',
      amount: 68,
      category: 'Entertainment',
      type: 'expense',
      date: buildRelativeDate(-4, 20),
      description: 'Subscriptions and movie tickets',
    },

    // -5 Months
    {
      id: generateId(),
      title: 'Monthly Payroll Deposit',
      amount: 4500,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-5, 1),
      description: 'Monthly salary deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Lease',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-5, 2),
      description: 'Monthly rent',
    },
    {
      id: generateId(),
      title: 'Groceries & Produce',
      amount: 380,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-5, 14),
      description: 'Monthly groceries',
    },
    {
      id: generateId(),
      title: 'Pharmacy & Wellness',
      amount: 94,
      category: 'Healthcare',
      type: 'expense',
      date: buildRelativeDate(-5, 19),
      description: 'Prescription and vitamins',
    },
  ];
}

/**
 * Seeds sample transactions and a default budget on the very first visit.
 * Never overwrites user data on subsequent visits.
 */
export function seedInitialDataIfNeeded() {
  const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (initialized === 'true') {
    return;
  }
  saveTransactions(createSampleTransactions());
  saveBudget({ monthlyLimit: 3200 });
}

/**
 * Resets LocalStorage to the curated sample dataset.
 */
export function resetDemoData() {
  saveTransactions(createSampleTransactions());
  saveBudget({ monthlyLimit: 3200 });
}

/**
 * Clears all transactions and resets budget to 0.
 */
export function clearAllData() {
  saveTransactions([]);
  saveBudget({ monthlyLimit: 0 });
}
