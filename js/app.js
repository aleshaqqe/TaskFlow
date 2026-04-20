import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");
const userLevel = document.getElementById("userLevel");
const userXp = document.getElementById("userXp");
const userStreak = document.getElementById("userStreak");
const userRank = document.getElementById("userRank");
const sectionList = document.getElementById("sectionList");
const taskList = document.getElementById("taskList");
const plannedTaskList = document.getElementById("plannedTaskList");
const historyList = document.getElementById("historyList");
const activeSectionTitle = document.getElementById("activeSectionTitle");
const logoutBtn = document.getElementById("logoutBtn");
const openSectionForm = document.getElementById("openSectionForm");
const openTaskForm = document.getElementById("openTaskForm");
const sectionModal = document.getElementById("sectionModal");
const taskModal = document.getElementById("taskModal");
const closeSectionModal = document.getElementById("closeSectionModal");
const closeTaskModal = document.getElementById("closeTaskModal");
const saveSectionBtn = document.getElementById("saveSectionBtn");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const sectionName = document.getElementById("sectionName");
const taskTitle = document.getElementById("taskTitle");
const taskNote = document.getElementById("taskNote");
const taskDueDate = document.getElementById("taskDueDate");
const taskSection = document.getElementById("taskSection");
const tasksTab = document.getElementById("tasksTab");
const plannedTab = document.getElementById("plannedTab");
const historyTab = document.getElementById("historyTab");
const tasksView = document.getElementById("tasksView");
const plannedView = document.getElementById("plannedView");
const historyView = document.getElementById("historyView");

const defaultSections = ["Учёба", "По дому", "Список покупок", "Хочу прочитать"];

let currentUser = null;
let currentUserData = null;
let activeSection = "all";
let sectionsCache = [];
let tasksCache = [];
let historyUnsubscribe = null;

const rankMap = [
  { level: 1, name: "🥉 Bronze" },
  { level: 5, name: "🥈 Silver" },
  { level: 10, name: "🥇 Gold" },
  { level: 15, name: "💠 Platinum" },
  { level: 20, name: "💎 Diamond" },
  { level: 30, name: "🔥 Master" },
  { level: 50, name: "👑 Legend" }
];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  await ensureUserData(user);
  await loadDashboard();
  bindEvents();
});

async function ensureUserData(user) {
  const profileRef = doc(db, "users", user.uid, "profile", "data");
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      username: user.displayName || "User",
      email: user.email || "",
      avatarUrl: "",
      level: 1,
      xp: 0,
      streak: 0,
      lastCompletedDate: null,
      createdAt: serverTimestamp()
    });
  }

  for (const name of defaultSections) {
    const sectionRef = doc(db, "users", user.uid, "sections", name);
    const snap = await getDoc(sectionRef);
    if (!snap.exists()) {
      await setDoc(sectionRef, {
        name,
        isDefault: true,
        createdAt: serverTimestamp()
      });
    }
  }
}

async function loadDashboard() {
  await loadProfile();
  await loadSections();
  await loadTasks();
  loadHistory();
  renderSections();
  renderTasks();
  renderPlannedTasks();
  fillTaskSectionSelect();
}

async function loadProfile() {
  const profileSnap = await getDoc(doc(db, "users", currentUser.uid, "profile", "data"));
  currentUserData = profileSnap.data() || {};

  const username = currentUserData.username || currentUser.displayName || "User";
  userName.textContent = username;
  userEmail.textContent = currentUser.email || "";
  userAvatar.textContent = username.charAt(0).toUpperCase();
  userLevel.textContent = currentUserData.level || 1;
  userXp.textContent = currentUserData.xp || 0;
  userStreak.textContent = currentUserData.streak || 0;
  userRank.textContent = getRank(currentUserData.level || 1);
}

async function loadSections() {
  const snap = await getDocs(collection(db, "users", currentUser.uid, "sections"));
  sectionsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadTasks() {
  const snap = await getDocs(collection(db, "users", currentUser.uid, "tasks"));
  tasksCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function loadHistory() {
  if (historyUnsubscribe) historyUnsubscribe();

  historyUnsubscribe = onSnapshot(collection(db, "users", currentUser.uid, "history"), (snap) => {
    const historyDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistory(historyDocs);
  });
}

function renderHistory(historyDocs) {
  historyList.innerHTML = "";

  if (!historyDocs.length) {
    historyList.innerHTML = `<div class="history-day">Пока нет выполненных задач.</div>`;
    return;
  }

  const sorted = historyDocs.sort((a, b) => b.id.localeCompare(a.id));

  sorted.forEach(day => {
    const tasksHtml = (day.tasks || []).map(task => `
      <li>
        <strong>✅ ${escapeHtml(task.title)}</strong>
        <small>📂 ${escapeHtml(task.section || "Без категории")} · 🕒 ${escapeHtml(task.completedAt || "")}</small>
      </li>
    `).join("");

    const dayEl = document.createElement("div");
    dayEl.className = "history-day";
    dayEl.innerHTML = `
      <h4>📅 ${escapeHtml(day.date || day.id)}</h4>
      <ul>${tasksHtml || "<li>Нет задач</li>"}</ul>
    `;
    historyList.appendChild(dayEl);
  });
}

function isFutureDate(dateStr) {
  if (!dateStr) return false;
  const due = new Date(dateStr + "T00:00:00").getTime();
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return due > now.getTime();
}

function isReadyDate(dateStr) {
  if (!dateStr) return true;
  return !isFutureDate(dateStr);
}

function renderSections() {
  sectionList.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `section-item ${activeSection === "all" ? "active-section" : ""}`;
  allBtn.textContent = "Все задачи";
  allBtn.onclick = () => {
    activeSection = "all";
    activeSectionTitle.textContent = "📝 Все задачи";
    renderSections();
    renderTasks();
    renderPlannedTasks();
  };
  sectionList.appendChild(allBtn);

  sectionsCache.forEach(section => {
    const item = document.createElement("button");
    item.className = `section-item ${activeSection === section.name ? "active-section" : ""}`;
    item.textContent = section.name;
    item.onclick = () => {
      activeSection = section.name;
      activeSectionTitle.textContent = `📝 ${section.name}`;
      renderSections();
      renderTasks();
      renderPlannedTasks();
    };
    sectionList.appendChild(item);
  });
}

function renderTasks() {
  taskList.innerHTML = "";

  const filtered = tasksCache.filter(task => {
    const inSection = activeSection === "all" || task.section === activeSection;
    return inSection && isReadyDate(task.dueDate);
  });

  if (!filtered.length) {
    taskList.innerHTML = `<div class="task-item">Пока здесь нет задач.</div>`;
    return;
  }

  filtered.forEach(task => {
    const item = document.createElement("div");
    item.className = "task-item";
    item.innerHTML = `
      <div class="task-top">
        <h4>${escapeHtml(task.title)}</h4>
        <span>${escapeHtml(task.section || "Без категории")}</span>
      </div>
      <p>${escapeHtml(task.note || "")}</p>
      ${task.dueDate ? `<small>📅 ${escapeHtml(task.dueDate)}</small>` : ""}
      <div class="task-actions">
        <button data-done="${task.id}" class="btn-mini">${task.done ? "↩ Снять" : "✅ Выполнить"}</button>
        <button data-del="${task.id}" class="btn-secondary">🗑 Удалить</button>
      </div>
    `;
    taskList.appendChild(item);
  });

  taskList.querySelectorAll("[data-done]").forEach(btn => {
    btn.addEventListener("click", () => toggleTaskDone(btn.dataset.done));
  });

  taskList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.del));
  });
}

function renderPlannedTasks() {
  plannedTaskList.innerHTML = "";

  const filtered = tasksCache.filter(task => {
    const inSection = activeSection === "all" || task.section === activeSection;
    return inSection && isFutureDate(task.dueDate);
  });

  if (!filtered.length) {
    plannedTaskList.innerHTML = `<div class="task-item">Нет запланированных задач.</div>`;
    return;
  }

  filtered.forEach(task => {
    const item = document.createElement("div");
    item.className = "task-item";
    item.innerHTML = `
      <div class="task-top">
        <h4>${escapeHtml(task.title)}</h4>
        <span>${escapeHtml(task.section || "Без категории")}</span>
      </div>
      <p>${escapeHtml(task.note || "")}</p>
      <small>📅 ${escapeHtml(task.dueDate)}</small>
      <div class="task-actions">
        <button data-done="${task.id}" class="btn-mini">✅ Выполнить</button>
        <button data-del="${task.id}" class="btn-secondary">🗑 Удалить</button>
      </div>
    `;
    plannedTaskList.appendChild(item);
  });

  plannedTaskList.querySelectorAll("[data-done]").forEach(btn => {
    btn.addEventListener("click", () => toggleTaskDone(btn.dataset.done));
  });

  plannedTaskList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.del));
  });
}

function fillTaskSectionSelect() {
  taskSection.innerHTML = `<option value="">Без категории</option>`;
  sectionsCache.forEach(section => {
    const opt = document.createElement("option");
    opt.value = section.name;
    opt.textContent = section.name;
    taskSection.appendChild(opt);
  });
}

function bindEvents() {
  logoutBtn.onclick = async () => {
    if (historyUnsubscribe) historyUnsubscribe();
    await signOut(auth);
    window.location.href = "index.html";
  };

  tasksTab.onclick = () => {
    tasksTab.classList.add("active");
    plannedTab.classList.remove("active");
    historyTab.classList.remove("active");
    tasksView.classList.remove("hidden");
    plannedView.classList.add("hidden");
    historyView.classList.add("hidden");
  };

  plannedTab.onclick = () => {
    plannedTab.classList.add("active");
    tasksTab.classList.remove("active");
    historyTab.classList.remove("active");
    tasksView.classList.add("hidden");
    plannedView.classList.remove("hidden");
    historyView.classList.add("hidden");
  };

  historyTab.onclick = () => {
    historyTab.classList.add("active");
    tasksTab.classList.remove("active");
    plannedTab.classList.remove("active");
    tasksView.classList.add("hidden");
    plannedView.classList.add("hidden");
    historyView.classList.remove("hidden");
  };

  openSectionForm.onclick = () => sectionModal.classList.remove("hidden");

  openTaskForm.onclick = () => {
    fillTaskSectionSelect();

    if (activeSection === "all") {
      taskSection.disabled = false;
      taskSection.required = false;
      taskSection.value = "";
    } else {
      taskSection.disabled = true;
      taskSection.required = false;
      taskSection.value = activeSection;
    }

    taskDueDate.value = "";
    taskModal.classList.remove("hidden");
  };

  closeSectionModal.onclick = () => sectionModal.classList.add("hidden");
  closeTaskModal.onclick = () => taskModal.classList.add("hidden");

  saveSectionBtn.onclick = createSection;
  saveTaskBtn.onclick = createTask;

  sectionModal.addEventListener("click", (e) => {
    if (e.target === sectionModal) sectionModal.classList.add("hidden");
  });

  taskModal.addEventListener("click", (e) => {
    if (e.target === taskModal) taskModal.classList.add("hidden");
  });
}

async function createSection() {
  const name = sectionName.value.trim();
  if (!name) return;

  const ref = doc(db, "users", currentUser.uid, "sections", name);
  await setDoc(ref, {
    name,
    isDefault: false,
    createdAt: serverTimestamp()
  });

  sectionName.value = "";
  sectionModal.classList.add("hidden");
  await loadSections();
  renderSections();
  fillTaskSectionSelect();
}

async function createTask() {
  const title = taskTitle.value.trim();
  if (!title) return;

  let selectedSection = "";

  if (activeSection === "all") {
    selectedSection = taskSection.value.trim();
  } else {
    selectedSection = activeSection;
  }

  const ref = doc(collection(db, "users", currentUser.uid, "tasks"));
  await setDoc(ref, {
    title,
    note: taskNote.value.trim(),
    section: selectedSection,
    dueDate: taskDueDate.value || "",
    done: false,
    rewarded: false,
    completedAt: null,
    createdAt: serverTimestamp()
  });

  taskTitle.value = "";
  taskNote.value = "";
  taskSection.value = "";
  taskDueDate.value = "";
  taskModal.classList.add("hidden");
  await loadTasks();
  renderTasks();
  renderPlannedTasks();
}

async function toggleTaskDone(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  if (!task) return;

  if (task.done) {
    await updateTask(taskId, {
      done: false,
      completedAt: null
    });

    await removeTaskFromHistory(taskId);
    await loadTasks();
    renderTasks();
    renderPlannedTasks();
    return;
  }

  const completedAt = getCurrentTime();

  await updateTask(taskId, {
    done: true,
    completedAt
  });

  if (!task.rewarded) {
    await addXp(10);
    await markTaskRewarded(taskId);
    await updateStreak();
  }

  await saveTaskToHistory({
    taskId,
    title: task.title,
    section: task.section,
    completedAt
  });

  await loadProfile();
  await loadTasks();
  renderTasks();
  renderPlannedTasks();
}

async function deleteTask(taskId) {
    await deleteDoc(doc(db, "users", currentUser.uid, "tasks", taskId));
    await loadTasks();
    renderTasks();
    renderPlannedTasks();
  }

async function updateTask(taskId, data) {
  await updateDoc(doc(db, "users", currentUser.uid, "tasks", taskId), data);
}

async function markTaskRewarded(taskId) {
  await updateDoc(doc(db, "users", currentUser.uid, "tasks", taskId), {
    rewarded: true
  });
}

async function addXp(amount) {
  const newXp = (currentUserData.xp || 0) + amount;
  let newLevel = currentUserData.level || 1;
  let xpNeeded = newLevel * 100;

  while (newXp >= xpNeeded) {
    newLevel += 1;
    xpNeeded = newLevel * 100;
  }

  await updateDoc(doc(db, "users", currentUser.uid, "profile", "data"), {
    xp: newXp,
    level: newLevel
  });
}

async function updateStreak() {
  const today = getTodayDate();
  const last = currentUserData.lastCompletedDate;

  let newStreak = currentUserData.streak || 0;
  if (last === today) return;

  if (isYesterday(last, today)) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  await updateDoc(doc(db, "users", currentUser.uid, "profile", "data"), {
    streak: newStreak,
    lastCompletedDate: today
  });
}

async function saveTaskToHistory(task) {
  const today = getTodayDate();
  const historyRef = doc(db, "users", currentUser.uid, "history", today);

  await setDoc(historyRef, {
    date: today,
    tasks: arrayUnion({
      taskId: task.taskId,
      title: task.title,
      section: task.section || "Без категории",
      completedAt: task.completedAt || getCurrentTime()
    })
  }, { merge: true });
}

async function removeTaskFromHistory(taskId) {
  const today = getTodayDate();
  const historyRef = doc(db, "users", currentUser.uid, "history", today);
  const snap = await getDoc(historyRef);

  if (!snap.exists()) return;

  const data = snap.data();
  const tasks = (data.tasks || []).filter(task => task.taskId !== taskId);

  await setDoc(historyRef, {
    date: today,
    tasks
  }, { merge: true });
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function isYesterday(lastDate, today) {
  if (!lastDate) return false;
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  return lastDate === d.toISOString().split("T")[0];
}

function getRank(level) {
  let rank = "🥉 Bronze";
  for (const item of rankMap) {
    if (level >= item.level) rank = item.name;
  }
  return rank;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}