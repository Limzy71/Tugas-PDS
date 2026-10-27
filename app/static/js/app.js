/* ==========================================================================
   Sanz AI - Enterprise Front-End Controller
   ========================================================================== */

const MAX_TEXTAREA_HEIGHT = 180;
const API_CHAT_URL = '/api/chat';
const API_MODELS_URL = '/models';
const API_STATUS_URL = '/api/status';
const STORAGE_KEY = 'sanz_ai_sessions_v1';
const ACTIVE_SESSION_KEY = 'sanz_ai_active_session_id';

/* --- DOM References --- */
const dom = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
  menuToggle: document.getElementById('menuToggle'),
  newChatBtn: document.getElementById('newChatBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
  historyList: document.getElementById('historyList'),
  ollamaStatusBadge: document.getElementById('ollamaStatusBadge'),
  statusText: document.getElementById('statusText'),
  mainContent: document.getElementById('mainContent'),
  messagesContainer: document.getElementById('messagesContainer'),
  messagesWrapper: document.getElementById('messagesWrapper'),
  welcomeHero: document.getElementById('welcomeHero'),
  suggestionsGrid: document.getElementById('suggestionsGrid'),
  quickTopicsBar: document.getElementById('quickTopicsBar'),
  chatForm: document.getElementById('chatForm'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  charCount: document.getElementById('charCount'),
  modelDropdownWrapper: document.getElementById('modelDropdownWrapper'),
  modelSelectorBtn: document.getElementById('modelSelectorBtn'),
  activeModelTag: document.getElementById('activeModelTag'),
  modelList: document.getElementById('modelList'),
  toastContainer: document.getElementById('toastContainer'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
};

/* --- State --- */
let isProcessing = false;
let abortController = null;
let currentTimerInterval = null;
let selectedModel = 'llama3.2:3b';
let sessions = [];
let currentSessionId = null;

/* ==========================================================================
   Utility Helpers
   ========================================================================== */
function createElement(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) el.textContent = content;
  return el;
}

function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;

  // Cegah spam: jika notifikasi yang sama sudah tampil, jangan duplikasi
  for (const child of dom.toastContainer.children) {
    if (child.textContent.includes(message)) {
      return;
    }
  }

  // Batasi maksimal 3 toast bersamaan
  while (dom.toastContainer.children.length >= 3) {
    dom.toastContainer.firstElementChild.remove();
  }

  const toast = createElement('div', `toast toast-${type}`);
  const iconClass = type === 'success' ? 'fa-solid fa-check' : 'fa-solid fa-circle-info';
  toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

function scrollToBottom() {
  if (dom.messagesContainer) {
    dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
  }
}

function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ==========================================================================
   Session Storage Management (Multi-Chat)
   ========================================================================== */
function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    sessions = raw ? JSON.parse(raw) : [];
  } catch {
    sessions = [];
  }

  currentSessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!sessions.length || !sessions.find(s => s.id === currentSessionId)) {
    createNewSession(false);
  } else {
    renderHistorySidebar();
    renderActiveSessionMessages();
  }
}

function saveSessionsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    if (currentSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, currentSessionId);
    }
  } catch (err) {
    console.warn('Gagal menyimpan sesi ke localStorage:', err);
  }
}

function getCurrentSession() {
  return sessions.find(s => s.id === currentSessionId);
}

function createNewSession(switchImmediately = true) {
  const newSession = {
    id: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title: 'Obrolan Baru',
    createdAt: Date.now(),
    messages: [],
  };
  sessions.unshift(newSession);
  currentSessionId = newSession.id;
  saveSessionsToStorage();
  renderHistorySidebar();
  if (switchImmediately) {
    renderActiveSessionMessages();
    dom.promptInput.focus();
  }
}

function switchSession(sessionId) {
  if (isProcessing) return;
  if (sessionId === currentSessionId) return;
  currentSessionId = sessionId;
  saveSessionsToStorage();
  renderHistorySidebar();
  renderActiveSessionMessages();
  closeMobileSidebar();
}

function deleteSession(sessionId, event) {
  if (event) event.stopPropagation();
  if (isProcessing) return;

  sessions = sessions.filter(s => s.id !== sessionId);
  if (!sessions.length) {
    createNewSession(false);
  } else if (currentSessionId === sessionId) {
    currentSessionId = sessions[0].id;
  }
  saveSessionsToStorage();
  renderHistorySidebar();
  renderActiveSessionMessages();
  showToast('Sesi obrolan dihapus.', 'info');
}

function clearAllSessions() {
  if (isProcessing) return;
  if (!confirm('Hapus semua riwayat percakapan?')) return;
  sessions = [];
  createNewSession(true);
  showToast('Semua riwayat percakapan dibersihkan.', 'success');
}

function updateSessionTitleFromPrompt(session, promptText) {
  if (session && session.title === 'Obrolan Baru') {
    const clean = promptText.trim().replace(/[\r\n]+/g, ' ');
    session.title = clean.length > 32 ? clean.slice(0, 32) + '...' : clean;
    saveSessionsToStorage();
    renderHistorySidebar();
  }
}

/* ==========================================================================
   History Sidebar Rendering
   ========================================================================== */
function renderHistorySidebar() {
  if (!dom.historyList) return;
  dom.historyList.replaceChildren();

  if (!sessions.length) {
    const empty = createElement('div', 'history-empty-hint', 'Belum ada riwayat percakapan.');
    dom.historyList.appendChild(empty);
    return;
  }

  sessions.forEach(session => {
    const item = createElement('div', `history-item ${session.id === currentSessionId ? 'active' : ''}`);
    item.setAttribute('data-id', session.id);

    const content = createElement('div', 'history-item-content');
    content.innerHTML = `<i class="fa-regular fa-message icon" aria-hidden="true"></i><span>${escapeHtml(session.title)}</span>`;

    const delBtn = createElement('button', 'history-delete-btn');
    delBtn.title = 'Hapus sesi ini';
    delBtn.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i>';
    delBtn.addEventListener('click', (e) => deleteSession(session.id, e));

    item.append(content, delBtn);
    item.addEventListener('click', () => switchSession(session.id));
    dom.historyList.appendChild(item);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

/* ==========================================================================
   Conversation State & Rendering
   ========================================================================== */
function renderActiveSessionMessages() {
  const session = getCurrentSession();
  if (!session || !session.messages.length) {
    // Empty state
    dom.mainContent.classList.remove('chat-active');
    dom.mainContent.classList.add('chat-empty');
    if (dom.welcomeHero) dom.welcomeHero.style.display = '';
    if (dom.suggestionsGrid) dom.suggestionsGrid.style.display = '';
    if (dom.quickTopicsBar) dom.quickTopicsBar.style.display = '';
    dom.messagesWrapper.replaceChildren(dom.welcomeHero);
  } else {
    // Active state with messages
    dom.mainContent.classList.remove('chat-empty');
    dom.mainContent.classList.add('chat-active');
    if (dom.welcomeHero) dom.welcomeHero.style.display = 'none';
    if (dom.suggestionsGrid) dom.suggestionsGrid.style.display = 'none';
    if (dom.quickTopicsBar) dom.quickTopicsBar.style.display = 'none';
    dom.messagesWrapper.replaceChildren();

    session.messages.forEach(msg => {
      if (msg.role === 'user') {
        renderUserMessageRow(msg.content, false);
      } else {
        renderAssistantMessageRow(msg.content, msg.model || selectedModel, msg.timestamp, false);
      }
    });
  }
  clearInput();
  scrollToBottom();
}

function renderUserMessageRow(text, isNew = true) {
  const row = createElement('div', 'message-row user');
  const bubble = createElement('div', 'message-bubble', text);
  row.appendChild(bubble);
  dom.messagesWrapper.appendChild(row);
  if (isNew) scrollToBottom();
}

function renderAssistantMessageRow(markdown, modelName = selectedModel, timestamp = formatTimestamp(), isNew = true) {
  const row = createElement('div', 'message-row assistant');

  const avatar = createElement('div', 'message-avatar');
  avatar.innerHTML = '<img src="/static/images/sanz-logo.svg" alt="Sanz AI Logo">';

  const wrapper = createElement('div', 'message-content-wrapper');

  const metaHeader = createElement('div', 'message-meta-header');
  metaHeader.innerHTML = `
    <span class="message-sender-name">Sanz AI</span>
    <span class="message-model-badge">${escapeHtml(modelName)}</span>
    <span class="message-timestamp">${escapeHtml(timestamp)}</span>
  `;

  const bubble = createElement('div', 'message-bubble');
  bubble.innerHTML = marked.parse(markdown);

  // Beautify and enhance pre/code blocks with copy header
  bubble.querySelectorAll('pre code').forEach((codeBlock) => {
    hljs.highlightElement(codeBlock);

    const pre = codeBlock.parentElement;
    const lang = (codeBlock.className.match(/language-([a-z0-9_-]+)/i) || [])[1] || 'code';

    const wrapperDiv = createElement('div', 'code-block-wrapper');
    const headerDiv = createElement('div', 'code-block-header');
    headerDiv.innerHTML = `
      <span>${lang.toUpperCase()}</span>
      <button type="button" class="code-copy-btn">
        <i class="fa-regular fa-copy"></i>
        <span>Salin Kode</span>
      </button>
    `;

    const copyBtn = headerDiv.querySelector('.code-copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codeBlock.innerText);
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Tersalin!</span>';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i><span>Salin Kode</span>';
        }, 2000);
      } catch {
        showToast('Gagal menyalin kode.', 'info');
      }
    });

    pre.parentNode.insertBefore(wrapperDiv, pre);
    wrapperDiv.appendChild(headerDiv);
    wrapperDiv.appendChild(pre);
  });

  // Action Footer (Copy response & Regenerate)
  const actionsBar = createElement('div', 'message-actions-bar');
  actionsBar.innerHTML = `
    <button class="msg-action-btn copy-msg-btn" title="Salin seluruh jawaban">
      <i class="fa-regular fa-copy"></i> Salin
    </button>
    <button class="msg-action-btn regen-msg-btn" title="Kirim ulang prompt terakhir">
      <i class="fa-solid fa-rotate-right"></i> Coba Lagi
    </button>
  `;

  actionsBar.querySelector('.copy-msg-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(markdown);
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-regular fa-copy"></i> Salin';
      }, 2000);
      showToast('Respons tersalin ke clipboard!', 'success');
    } catch {
      showToast('Gagal menyalin.', 'info');
    }
  });

  actionsBar.querySelector('.regen-msg-btn').addEventListener('click', () => {
    const session = getCurrentSession();
    if (!session || !session.messages.length) return;
    const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  });

  wrapper.append(metaHeader, bubble, actionsBar);
  row.append(avatar, wrapper);
  dom.messagesWrapper.appendChild(row);
  if (isNew) scrollToBottom();
}

function showThinkingIndicator() {
  const row = createElement('div', 'message-row assistant thinking-row');

  const avatar = createElement('div', 'message-avatar');
  avatar.innerHTML = '<img src="/static/images/sanz-logo.svg" alt="Sanz AI Logo">';

  const wrapper = createElement('div', 'message-content-wrapper');
  const container = createElement('div', 'thinking-container');
  container.innerHTML = `
    <div class="thinking-pulse-dot"></div>
    <div class="thinking-text">
      <span>Sanz AI sedang berpikir...</span>
      <span class="thinking-timer" id="thinkingTimer">0.0s</span>
    </div>
  `;

  wrapper.appendChild(container);
  row.append(avatar, wrapper);
  dom.messagesWrapper.appendChild(row);
  scrollToBottom();

  const startTime = Date.now();
  currentTimerInterval = setInterval(() => {
    const timerEl = document.getElementById('thinkingTimer');
    if (timerEl) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      timerEl.textContent = `${elapsed}s`;
    }
  }, 100);

  return row;
}

function stopThinkingIndicator(thinkingRow) {
  if (currentTimerInterval) {
    clearInterval(currentTimerInterval);
    currentTimerInterval = null;
  }
  if (thinkingRow) thinkingRow.remove();
}

/* ==========================================================================
   Input Handling & Character Counter
   ========================================================================== */
function updateSendButtonState() {
  const hasText = dom.promptInput.value.trim().length > 0;
  dom.sendBtn.disabled = isProcessing || !hasText;
  if (dom.charCount) {
    const count = dom.promptInput.value.length;
    dom.charCount.textContent = `${count} karakter`;
  }
}

function resizeTextarea() {
  dom.promptInput.style.height = 'auto';
  dom.promptInput.style.height = `${Math.min(dom.promptInput.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
}

function clearInput() {
  dom.promptInput.value = '';
  resizeTextarea();
  updateSendButtonState();
}

function setProcessingState(processing) {
  isProcessing = processing;
  updateSendButtonState();
  if (dom.sendBtn && dom.stopBtn) {
    if (processing) {
      dom.sendBtn.style.display = 'none';
      dom.stopBtn.style.display = 'flex';
    } else {
      dom.sendBtn.style.display = 'flex';
      dom.stopBtn.style.display = 'none';
    }
  }
}

/* ==========================================================================
   API Communication & Sending Messages
   ========================================================================== */
async function requestReply(prompt, model) {
  abortController = new AbortController();
  const response = await fetch(API_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
    signal: abortController.signal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Server returned ${response.status}`);
  }

  const data = await response.json();
  return {
    reply: data.reply || 'Tidak ada balasan dari model.',
    model: data.model || model || selectedModel,
  };
}

async function sendMessage(text) {
  if (!text || isProcessing) return;

  const currentSession = getCurrentSession();
  if (!currentSession) return;

  // Transition UI to active state
  dom.mainContent.classList.remove('chat-empty');
  dom.mainContent.classList.add('chat-active');
  if (dom.welcomeHero) dom.welcomeHero.style.display = 'none';
  if (dom.suggestionsGrid) dom.suggestionsGrid.style.display = 'none';
  if (dom.quickTopicsBar) dom.quickTopicsBar.style.display = 'none';

  // Record user message
  const userMsgObj = {
    role: 'user',
    content: text,
    timestamp: formatTimestamp(),
  };
  currentSession.messages.push(userMsgObj);
  updateSessionTitleFromPrompt(currentSession, text);
  saveSessionsToStorage();

  renderUserMessageRow(text, true);
  clearInput();
  setProcessingState(true);

  const thinkingRow = showThinkingIndicator();

  try {
    const result = await requestReply(text, selectedModel);
    stopThinkingIndicator(thinkingRow);

    const timeStr = formatTimestamp();
    const assistantMsgObj = {
      role: 'assistant',
      content: result.reply,
      model: result.model,
      timestamp: timeStr,
    };
    currentSession.messages.push(assistantMsgObj);
    saveSessionsToStorage();

    renderAssistantMessageRow(result.reply, result.model, timeStr, true);
  } catch (error) {
    stopThinkingIndicator(thinkingRow);
    if (error.name === 'AbortError') {
      showToast('Pemrosesan dibatalkan.', 'info');
      renderAssistantMessageRow(
        '*[Pemrosesan jawaban dihentikan oleh pengguna]*',
        selectedModel,
        formatTimestamp(),
        true
      );
    } else {
      renderAssistantMessageRow(
        `**Terjadi Kesalahan:** ${error.message}\n\n*Pastikan kontainer Ollama berjalan dan model \`${selectedModel}\` telah di-pull.*`,
        selectedModel,
        formatTimestamp(),
        true
      );
    }
  } finally {
    setProcessingState(false);
    abortController = null;
    dom.promptInput.focus();
  }
}

function stopGeneration() {
  if (abortController) {
    abortController.abort();
  }
}

/* ==========================================================================
   Model Selector & Dynamic Loading
   ========================================================================== */
async function loadAvailableModels() {
  try {
    const res = await fetch(API_MODELS_URL);
    if (!res.ok) return;
    const data = await res.json();
    const modelArray = data.models || [];

    if (modelArray.length > 0 && dom.modelList) {
      dom.modelList.replaceChildren();
      modelArray.forEach((m, idx) => {
        const mName = typeof m === 'string' ? m : (m.name || m.model);
        if (!mName) return;

        const opt = createElement('button', `model-option ${mName === selectedModel ? 'active' : ''}`);
        opt.setAttribute('data-model', mName);
        opt.innerHTML = `
          <div class="model-opt-info">
            <span class="model-opt-title">${escapeHtml(mName)}</span>
            <span class="model-opt-desc">Ollama Local Model</span>
          </div>
          <i class="fa-solid fa-check check-icon" aria-hidden="true"></i>
        `;
        opt.addEventListener('click', () => selectModel(mName));
        dom.modelList.appendChild(opt);

        if (idx === 0 && !selectedModel) {
          selectModel(mName);
        }
      });
    }
  } catch (err) {
    console.debug('Menggunakan konfigurasi model default:', err);
  }
}

function selectModel(modelName) {
  selectedModel = modelName;
  if (dom.activeModelTag) {
    dom.activeModelTag.textContent = modelName;
  }
  document.querySelectorAll('.model-option').forEach(el => {
    el.classList.toggle('active', el.dataset.model === modelName);
  });
  if (dom.modelDropdownWrapper) {
    dom.modelDropdownWrapper.classList.remove('open');
  }
  showToast(`Model aktif diubah ke: ${modelName}`, 'success');
}

/* ==========================================================================
   Ollama Connection Health Status
   ========================================================================== */
async function checkOllamaStatus() {
  try {
    const res = await fetch(API_STATUS_URL);
    if (res.ok) {
      const data = await res.json();
      if (dom.ollamaStatusBadge) {
        dom.ollamaStatusBadge.classList.remove('offline');
      }
      if (dom.statusText) {
        dom.statusText.textContent = 'Ollama Online';
      }
      return;
    }
  } catch {
    // handled below
  }

  if (dom.ollamaStatusBadge) {
    dom.ollamaStatusBadge.classList.add('offline');
  }
  if (dom.statusText) {
    dom.statusText.textContent = 'Ollama Offline';
  }
}

/* ==========================================================================
   Export Chat to Markdown
   ========================================================================== */
async function exportCurrentChat() {
  const session = getCurrentSession();
  if (!session || !session.messages.length) {
    showToast('Belum ada pesan untuk diekspor.', 'info');
    return;
  }

  let md = `# ${session.title}\n*Tanggal: ${new Date(session.createdAt).toLocaleString()}*\n\n---\n\n`;
  session.messages.forEach(m => {
    if (m.role === 'user') {
      md += `### 👤 Anda (${m.timestamp || ''})\n${m.content}\n\n`;
    } else {
      md += `### 🤖 Sanz AI (${m.model || selectedModel})\n${m.content}\n\n`;
    }
    md += `---\n\n`;
  });

  try {
    await navigator.clipboard.writeText(md);
    showToast('Seluruh obrolan disalin ke clipboard dalam format Markdown!', 'success');
  } catch {
    showToast('Gagal menyalin obrolan.', 'info');
  }
}

/* ==========================================================================
   Sidebar Management (Desktop Collapsible & Mobile Drawer)
   ========================================================================== */
const SIDEBAR_STORAGE_KEY = 'sanz_sidebar_collapsed';

function isMobileView() {
  return window.innerWidth <= 768;
}

function initSidebar() {
  document.documentElement.classList.remove('sidebar-collapsed-init');
  if (!isMobileView()) {
    const isCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  }
}

function toggleSidebar() {
  if (isMobileView()) {
    const isOpen = dom.sidebar.classList.toggle('open');
    if (dom.sidebarBackdrop) {
      dom.sidebarBackdrop.classList.toggle('open', isOpen);
    }
  } else {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_STORAGE_KEY, isCollapsed ? 'true' : 'false');
  }
}

function closeSidebar() {
  if (isMobileView()) {
    dom.sidebar.classList.remove('open');
    if (dom.sidebarBackdrop) {
      dom.sidebarBackdrop.classList.remove('open');
    }
  } else {
    document.body.classList.add('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
  }
}

/* ==========================================================================
   Event Listeners & Bootstrapping
   ========================================================================== */
dom.promptInput.addEventListener('input', () => {
  resizeTextarea();
  updateSendButtonState();
});

dom.promptInput.addEventListener('keydown', (event) => {
  const isPlainEnter = event.key === 'Enter' && !event.shiftKey;
  if (isPlainEnter) {
    event.preventDefault();
    sendMessage(dom.promptInput.value.trim());
  }
});

dom.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(dom.promptInput.value.trim());
});

if (dom.stopBtn) {
  dom.stopBtn.addEventListener('click', stopGeneration);
}

// Suggestion card clicks
document.querySelectorAll('.suggestion-card').forEach((card) => {
  card.addEventListener('click', () => {
    const prompt = card.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

// Topic chip clicks
document.querySelectorAll('.topic-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

// Sidebar & Session buttons
dom.newChatBtn.addEventListener('click', () => createNewSession(true));
dom.clearChatBtn.addEventListener('click', () => {
  const session = getCurrentSession();
  if (session && session.messages.length) {
    if (confirm('Bersihkan isi obrolan saat ini?')) {
      session.messages = [];
      saveSessionsToStorage();
      renderActiveSessionMessages();
      showToast('Obrolan dibersihkan.', 'info');
    }
  }
});

if (dom.clearAllHistoryBtn) {
  dom.clearAllHistoryBtn.addEventListener('click', clearAllSessions);
}

if (dom.exportChatBtn) {
  dom.exportChatBtn.addEventListener('click', exportCurrentChat);
}

// Model dropdown toggle
if (dom.modelSelectorBtn && dom.modelDropdownWrapper) {
  dom.modelSelectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.modelDropdownWrapper.classList.toggle('open');
  });

  window.addEventListener('click', (e) => {
    if (!dom.modelDropdownWrapper.contains(e.target)) {
      dom.modelDropdownWrapper.classList.remove('open');
    }
  });
}

// Sidebar open/close triggers
dom.menuToggle.addEventListener('click', toggleSidebar);
if (dom.sidebarCloseBtn) dom.sidebarCloseBtn.addEventListener('click', closeSidebar);
if (dom.sidebarBackdrop) dom.sidebarBackdrop.addEventListener('click', () => {
  if (isMobileView()) closeSidebar();
});

// Global keyboard shortcuts (Ctrl+K = New Chat, Ctrl+B = Toggle Sidebar)
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;

  if (isCtrlOrCmd && key === 'k') {
    event.preventDefault();
    createNewSession(true);
  } else if (isCtrlOrCmd && key === 'b') {
    event.preventDefault();
    toggleSidebar();
  }
});

/* ==========================================================================
   Theme Management (Light / Dark / Follow Laptop System)
   ========================================================================== */
const THEME_STORAGE_KEY = 'sanz_theme';

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function updateThemeUI(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = dom.themeIcon || document.getElementById('themeIcon');
  if (icon) {
    if (theme === 'dark') {
      icon.className = 'fa-solid fa-sun icon';
      if (dom.themeToggleBtn) dom.themeToggleBtn.title = 'Beralih ke tema terang';
    } else {
      icon.className = 'fa-solid fa-moon icon';
      if (dom.themeToggleBtn) dom.themeToggleBtn.title = 'Beralih ke tema gelap';
    }
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const activeTheme = saved || getSystemTheme();
  updateThemeUI(activeTheme);

  // Otomatis mengikuti perubahan tema laptop secara dinamis jika belum dikunci manual
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        updateThemeUI(e.matches ? 'dark' : 'light');
      }
    });
  }

  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || getSystemTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, next);
  updateThemeUI(next);
  // Pergantian tema instan tanpa notifikasi toast spam
}

/* ==========================================================================
   Initialization
   ========================================================================== */
function initApp() {
  initTheme();
  initSidebar();
  loadSessionsFromStorage();
  loadAvailableModels();
  checkOllamaStatus();
  setInterval(checkOllamaStatus, 15000);
}

document.addEventListener('DOMContentLoaded', initApp);
