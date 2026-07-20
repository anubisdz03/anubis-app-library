/* ============================================================
   ANUBIS ADMIN — auth.js
   Handles: auth guard, logout, dashboard stats, search,
   add/edit/delete apps (Supabase), tabs, toasts, loading states.

   Uses ONLY real "apps" table columns:
   id, name, slug, icon, download_url, category, badge, color,
   background, version, size, developer, is_active, is_featured,
   downloads, created_at, updated_at, description, username,
   password, code, player_required, player_code, info_title,
   info_message, status, featured, sort_order, published_at,
   screenshots, youtube_url, telegram_url, website_url,
   changelog, tags, views, admin_notes
============================================================ */

const { createClient } = window.supabase;

const SUPABASE_URL = "https://ypszdzznqaizopfulioa.supabase.co";
const SUPABASE_KEY = "sb_publishable_EKEuf19RbGaaQ_xjN9VmhA_mkOY9t2q";

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ------------------------------------------------------------
   Field definitions for the Add/Edit form.
   Each entry maps a real column name to its input type, so the
   form can be read/filled generically instead of by hand.
------------------------------------------------------------ */
const TEXT_FIELDS = [
  "name", "slug", "category", "badge",
  "icon", "background", "color",
  "download_url", "youtube_url", "telegram_url", "website_url",
  "version", "size", "developer",
  "username", "password", "code", "player_code",
  "status", "published_at",
  "info_title"
];

const TEXTAREA_FIELDS = ["description", "changelog", "admin_notes", "info_message"];

/* Stored as Postgres array columns — edited as comma/newline
   separated text and converted to an array on save. */
const LIST_FIELDS = ["screenshots", "tags"];

const CHECKBOX_FIELDS = ["is_active", "is_featured", "featured", "player_required"];

const NUMBER_FIELDS = ["sort_order"];

/* Displayed, never submitted. */
const READONLY_FIELDS = ["downloads", "views", "created_at", "updated_at"];

const ALL_EDITABLE_FIELDS = [
  ...TEXT_FIELDS, ...TEXTAREA_FIELDS, ...LIST_FIELDS,
  ...CHECKBOX_FIELDS, ...NUMBER_FIELDS
];

/* In-memory cache of the last successful fetch, used for
   instant client-side search without re-querying Supabase. */
let APPS = [];

/* Id of the app currently open in the delete-confirmation modal. */
let pendingDeleteId = null;

/* Guards against duplicate in-flight requests. */
let isSavingApp = false;
let isDeletingApp = false;

/* ------------------------------------------------------------
   DOM references (resolved once the DOM is ready)
------------------------------------------------------------ */
let el = {};

function cacheDomRefs() {
  el = {
    logoutBtn: document.getElementById("logout-btn"),

    statTotal: document.getElementById("stat-total-apps-value"),
    statActive: document.getElementById("stat-active-apps-value"),
    statFeatured: document.getElementById("stat-featured-apps-value"),
    statComingSoon: document.getElementById("stat-coming-soon-value"),
    statCategories: document.getElementById("stat-categories-value"),
    statDownloads: document.getElementById("stat-downloads-value"),
    statViews: document.getElementById("stat-views-value"),

    searchForm: document.getElementById("apps-search-form"),
    searchInput: document.getElementById("apps-search-input"),

    addAppBtn: document.getElementById("add-app-btn"),
    tableBody: document.getElementById("apps-table-body"),

    appModal: document.getElementById("app-modal"),
    appModalTitle: document.getElementById("app-modal-title"),
    appModalCloseBtn: document.getElementById("app-modal-close-btn"),
    appModalCancelBtn: document.getElementById("app-modal-cancel-btn"),
    appModalError: document.getElementById("app-modal-error"),
    appModalTabs: document.getElementById("app-modal-tabs"),
    appForm: document.getElementById("app-form"),
    appIdField: document.getElementById("app-id"),
    appFormSubmitBtn: document.getElementById("app-form-submit-btn"),
    appFormSubmitLabel: document.getElementById("app-form-submit-label"),

    confirmModal: document.getElementById("confirm-modal"),
    confirmCancelBtn: document.getElementById("confirm-cancel-btn"),
    confirmDeleteBtn: document.getElementById("confirm-delete-btn"),
    confirmDeleteLabel: document.getElementById("confirm-delete-label"),

    toastContainer: document.getElementById("toast-container")
  };
}

/* ------------------------------------------------------------
   Auth
------------------------------------------------------------ */
async function requireSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showToast("Could not verify your session. Please log in again.", "error");
    window.location.href = "login.html";
    return null;
  }

  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }

  return data.session;
}

function wireLogout() {
  if (!el.logoutBtn) return;

  el.logoutBtn.addEventListener("click", async () => {
    setBtnLoading(el.logoutBtn, true);
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      setBtnLoading(el.logoutBtn, false);
      showToast("Logout failed. Please try again.", "error");
      return;
    }

    window.location.href = "login.html";
  });
}

/* ------------------------------------------------------------
   Data loading
------------------------------------------------------------ */
async function fetchApps() {
  const { data, error } = await supabaseClient
    .from("apps")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function refreshApps() {
  try {
    APPS = await fetchApps();
    renderStats(APPS);
    renderTable(getFilteredApps());
  } catch (error) {
    showToast(readableError(error, "Could not load apps."), "error");
    renderTableStatus("Could not load apps. Please refresh the page.");
  }
}

/* ------------------------------------------------------------
   Stats
------------------------------------------------------------ */
function isComingSoon(app) {
  return !app.download_url || app.download_url === "#";
}

function sumField(apps, field) {
  return apps.reduce((total, app) => total + (Number(app[field]) || 0), 0);
}

function renderStats(apps) {
  const total = apps.length;
  const active = apps.filter(a => a.is_active === true).length;
  const featured = apps.filter(a => a.is_featured === true).length;
  const comingSoon = apps.filter(isComingSoon).length;
  const categories = new Set(
    apps.map(a => (a.category || "").trim()).filter(Boolean)
  ).size;
  const downloads = sumField(apps, "downloads");
  const views = sumField(apps, "views");

  if (el.statTotal) el.statTotal.textContent = total;
  if (el.statActive) el.statActive.textContent = active;
  if (el.statFeatured) el.statFeatured.textContent = featured;
  if (el.statComingSoon) el.statComingSoon.textContent = comingSoon;
  if (el.statCategories) el.statCategories.textContent = categories;
  if (el.statDownloads) el.statDownloads.textContent = downloads.toLocaleString();
  if (el.statViews) el.statViews.textContent = views.toLocaleString();
}

/* ------------------------------------------------------------
   Table rendering
------------------------------------------------------------ */
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value === null || value === undefined ? "" : String(value);
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function renderTableStatus(message) {
  el.tableBody.innerHTML = "";
  const row = document.createElement("tr");
  row.className = "apps-table__status-row";
  row.innerHTML = `<td colspan="6">${escapeHtml(message)}</td>`;
  el.tableBody.appendChild(row);
}

function buildRow(app) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${escapeHtml(app.name)}</td>
    <td>${escapeHtml(app.category)}</td>
    <td>${escapeHtml(app.version)}</td>
    <td>${app.badge ? `<span class="badge-chip">${escapeHtml(app.badge)}</span>` : ""}</td>
    <td>${escapeHtml(formatDate(app.updated_at))}</td>
    <td>
      <div class="row-actions">
        <button type="button" class="row-action-btn row-action-btn--edit" data-action="edit" data-id="${escapeHtml(app.id)}">Edit</button>
        <button type="button" class="row-action-btn row-action-btn--danger" data-action="delete" data-id="${escapeHtml(app.id)}">Delete</button>
      </div>
    </td>
  `;

  return row;
}

function renderTable(list) {
  el.tableBody.innerHTML = "";

  if (!list || list.length === 0) {
    renderTableStatus("No apps found.");
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach(app => fragment.appendChild(buildRow(app)));
  el.tableBody.appendChild(fragment);
}

/* Row button clicks are delegated to the table body so newly
   rendered rows never need their own listeners re-attached. */
function wireTableDelegation() {
  el.tableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const app = APPS.find(a => String(a.id) === String(id));
    if (!app) return;

    if (btn.dataset.action === "edit") {
      openAppModal("edit", app);
    } else if (btn.dataset.action === "delete") {
      openConfirmModal(app);
    }
  });
}

/* ------------------------------------------------------------
   Search (instant, client-side, no page refresh)
------------------------------------------------------------ */
function getFilteredApps() {
  const query = (el.searchInput.value || "").trim().toLowerCase();
  if (!query) return APPS;

  return APPS.filter(app => {
    return (
      (app.name || "").toLowerCase().includes(query) ||
      (app.slug || "").toLowerCase().includes(query) ||
      (app.category || "").toLowerCase().includes(query) ||
      (app.badge || "").toLowerCase().includes(query) ||
      (app.developer || "").toLowerCase().includes(query) ||
      (app.description || "").toLowerCase().includes(query)
    );
  });
}

function wireSearch() {
  el.searchForm.addEventListener("submit", (e) => e.preventDefault());
  el.searchInput.addEventListener("input", () => {
    renderTable(getFilteredApps());
  });
}

/* ------------------------------------------------------------
   Modal tabs
------------------------------------------------------------ */
function wireModalTabs() {
  el.appModalTabs.addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".modal-tab");
    if (!tabBtn) return;
    activateTab(tabBtn.dataset.tab);
  });
}

function activateTab(tabName) {
  el.appModalTabs.querySelectorAll(".modal-tab").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.tab === tabName);
  });

  el.appForm.querySelectorAll(".modal-tab-panel").forEach(panel => {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
  });
}

function resetTabsToFirst() {
  const firstTabBtn = el.appModalTabs.querySelector(".modal-tab");
  if (firstTabBtn) activateTab(firstTabBtn.dataset.tab);
}

/* ------------------------------------------------------------
   Field <-> input helpers
------------------------------------------------------------ */
function fieldInputId(field) {
  return `app-${field}`;
}

function parseListInput(rawValue) {
  if (!rawValue) return [];
  return rawValue
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatListForInput(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

/* ------------------------------------------------------------
   Add / Edit modal
------------------------------------------------------------ */
function openAppModal(mode, app) {
  el.appForm.reset();
  hideModalError();
  resetTabsToFirst();

  if (mode === "edit" && app) {
    el.appModalTitle.textContent = "Edit App";
    el.appIdField.value = app.id;

    TEXT_FIELDS.forEach(field => {
      const input = document.getElementById(fieldInputId(field));
      if (input) input.value = app[field] ?? "";
    });

    TEXTAREA_FIELDS.forEach(field => {
      const input = document.getElementById(fieldInputId(field));
      if (input) input.value = app[field] ?? "";
    });

    LIST_FIELDS.forEach(field => {
      const input = document.getElementById(fieldInputId(field));
      if (input) input.value = formatListForInput(app[field]);
    });

    CHECKBOX_FIELDS.forEach(field => {
      const input = document.getElementById(fieldInputId(field));
      if (input) input.checked = Boolean(app[field]);
    });

    NUMBER_FIELDS.forEach(field => {
      const input = document.getElementById(fieldInputId(field));
      if (input) input.value = app[field] ?? "";
    });

    setReadonlyDisplay("downloads", app.downloads ?? 0);
    setReadonlyDisplay("views", app.views ?? 0);
    setReadonlyDisplay("created_at", formatDateTime(app.created_at));
    setReadonlyDisplay("updated_at", formatDateTime(app.updated_at));
  } else {
    el.appModalTitle.textContent = "Add App";
    el.appIdField.value = "";

    setReadonlyDisplay("downloads", "—");
    setReadonlyDisplay("views", "—");
    setReadonlyDisplay("created_at", "—");
    setReadonlyDisplay("updated_at", "—");
  }

  el.appModal.hidden = false;
  const firstField = document.getElementById("app-name");
  if (firstField) firstField.focus();
}

function setReadonlyDisplay(field, value) {
  const target = document.getElementById(`app-readonly-${field}`);
  if (target) target.textContent = value;
}

function closeAppModal() {
  el.appModal.hidden = true;
  el.appForm.reset();
  hideModalError();
}

function showModalError(message) {
  el.appModalError.textContent = message;
  el.appModalError.classList.add("is-visible");
}

function hideModalError() {
  el.appModalError.textContent = "";
  el.appModalError.classList.remove("is-visible");
}

function readFormValues() {
  const values = { id: el.appIdField.value || null };

  TEXT_FIELDS.forEach(field => {
  const input = document.getElementById(fieldInputId(field));
  let value = input ? input.value.trim() : "";

  // Fix timestamp fields
  if (field === "published_at" && value === "") {
    value = null;
  }

  values[field] = value;
});

  TEXTAREA_FIELDS.forEach(field => {
    const input = document.getElementById(fieldInputId(field));
    values[field] = input ? input.value.trim() : "";
  });

  LIST_FIELDS.forEach(field => {
    const input = document.getElementById(fieldInputId(field));
    values[field] = input ? parseListInput(input.value) : [];
  });

  CHECKBOX_FIELDS.forEach(field => {
    const input = document.getElementById(fieldInputId(field));
    values[field] = input ? input.checked : false;
  });

  NUMBER_FIELDS.forEach(field => {
    const input = document.getElementById(fieldInputId(field));
    const raw = input ? input.value.trim() : "";
    values[field] = raw === "" ? null : Number(raw);
  });

  return values;
}

function validateAppValues(values) {
  if (!values.name) return "App name is required.";
  if (!values.category) return "Category is required.";

  for (const field of NUMBER_FIELDS) {
    if (values[field] !== null && Number.isNaN(values[field])) {
      return `${field.replace(/_/g, " ")} must be a number.`;
    }
  }

  return null;
}

function wireAppModal() {
  el.addAppBtn.addEventListener("click", () => openAppModal("add"));
  el.appModalCloseBtn.addEventListener("click", closeAppModal);
  el.appModalCancelBtn.addEventListener("click", closeAppModal);

  el.appModal.addEventListener("click", (e) => {
    if (e.target === el.appModal) closeAppModal();
  });

  el.appForm.addEventListener("submit", handleAppFormSubmit);
}

async function handleAppFormSubmit(e) {
  e.preventDefault();

  if (isSavingApp) return;

  hideModalError();
  const values = readFormValues();

  const validationError = validateAppValues(values);
  if (validationError) {
    showModalError(validationError);
    return;
  }

  const { id, ...fields } = values;
  isSavingApp = true;
  setBtnLoading(el.appFormSubmitBtn, true, el.appFormSubmitLabel, "Saving…");

  try {
    let error;

    if (id) {
      ({ error } = await supabaseClient.from("apps").update(fields).eq("id", id));
    } else {
      ({ error } = await supabaseClient.from("apps").insert(fields));
    }

    if (error) throw error;

    closeAppModal();
    await refreshApps();
    showToast(id ? "App updated successfully." : "App added successfully.", "success");
  } catch (error) {
    showModalError(readableError(error, "Operation failed."));
  } finally {
    isSavingApp = false;
    setBtnLoading(el.appFormSubmitBtn, false, el.appFormSubmitLabel, "Save App");
  }
}

/* ------------------------------------------------------------
   Delete confirmation modal
------------------------------------------------------------ */
function openConfirmModal(app) {
  pendingDeleteId = app.id;
  el.confirmModal.hidden = false;
}

function closeConfirmModal() {
  pendingDeleteId = null;
  el.confirmModal.hidden = true;
}

function wireConfirmModal() {
  el.confirmCancelBtn.addEventListener("click", closeConfirmModal);

  el.confirmModal.addEventListener("click", (e) => {
    if (e.target === el.confirmModal) closeConfirmModal();
  });

  el.confirmDeleteBtn.addEventListener("click", handleConfirmDelete);
}

async function handleConfirmDelete() {
  if (isDeletingApp || !pendingDeleteId) return;

  isDeletingApp = true;
  setBtnLoading(el.confirmDeleteBtn, true, el.confirmDeleteLabel, "Deleting…");

  try {
    const { error } = await supabaseClient
      .from("apps")
      .delete()
      .eq("id", pendingDeleteId);

    if (error) throw error;

    closeConfirmModal();
    await refreshApps();
    showToast("App deleted successfully.", "success");
  } catch (error) {
    showToast(readableError(error, "Operation failed."), "error");
  } finally {
    isDeletingApp = false;
    setBtnLoading(el.confirmDeleteBtn, false, el.confirmDeleteLabel, "Delete");
  }
}

/* ------------------------------------------------------------
   Shared UI helpers
------------------------------------------------------------ */
function setBtnLoading(btn, isLoading, labelEl, loadingText) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);

  if (labelEl && loadingText) {
    if (isLoading) {
      labelEl.dataset.originalText = labelEl.dataset.originalText || labelEl.textContent;
      labelEl.textContent = loadingText;
    } else if (labelEl.dataset.originalText) {
      labelEl.textContent = labelEl.dataset.originalText;
    }
  }
}

function showToast(message, type) {
  if (!el.toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type === "error" ? "error" : "success"}`;
  toast.textContent = message;

  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

function readableError(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  return fallback;
}

/* ------------------------------------------------------------
   Bootstrap
------------------------------------------------------------ */
async function init() {
  cacheDomRefs();

  const session = await requireSession();
  if (!session) return;

  wireLogout();
  wireSearch();
  wireTableDelegation();
  wireModalTabs();
  wireAppModal();
  wireConfirmModal();

  renderTableStatus("Loading apps…");
  await refreshApps();
}

document.addEventListener("DOMContentLoaded", init);
