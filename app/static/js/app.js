/* Sanz AI - chat front-end logic */

const MAX_TEXTAREA_HEIGHT = 180;
const API_CHAT_URL = '/api/chat';

/* --- DOM references --- */
const dom = {
  sidebar: document.getElementById('sidebar'),
  menuToggle: document.getElementById('menuToggle'),
  newChatBtn: document.getElementById('newChatBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  mainContent: document.getElementById('mainContent'),
  messagesContainer: document.getElementById('messagesContainer'),
  messagesWrapper: document.getElementById('messagesWrapper'),
  welcomeHero: document.getElementById('welcomeHero'),
  suggestionsGrid: document.getElementById('suggestionsGrid'),
  chatForm: document.getElementById('chatForm'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
};

let isProcessing = false;

/* --- Helpers --- */
function createElement(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function scrollToBottom() {
  dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
}

function updateSendButtonState() {
  dom.sendBtn.disabled = isProcessing || dom.promptInput.value.trim() === '';
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

/* --- Message rendering --- */
function createAssistantAvatar() {
  return createElement('div', 'message-avatar', 'S');
}

function appendUserMessage(text) {
  const row = createElement('div', 'message-row user');
  row.appendChild(createElement('div', 'message-bubble', text));
  dom.messagesWrapper.appendChild(row);
  scrollToBottom();
}

function appendAssistantMessage(markdown) {
  const bubble = createElement('div', 'message-bubble');
  bubble.innerHTML = marked.parse(markdown);
  bubble.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));

  const row = createElement('div', 'message-row assistant');
  row.append(createAssistantAvatar(), bubble);
  dom.messagesWrapper.appendChild(row);
  scrollToBottom();
}

function showThinkingIndicator() {
  const dots = createElement('div', 'thinking-dots');
  dots.append(
    createElement('span', null, 'Sanz AI sedang berpikir'),
    createElement('span', 'dot'),
    createElement('span', 'dot'),
    createElement('span', 'dot'),
  );

  const bubble = createElement('div', 'message-bubble');
  bubble.appendChild(dots);

  const row = createElement('div', 'message-row assistant');
  row.append(createAssistantAvatar(), bubble);
  dom.messagesWrapper.appendChild(row);
  scrollToBottom();
  return row;
}

/* --- API --- */
async function requestReply(prompt) {
  const response = await fetch(API_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  const data = await response.json();
  return data.reply || 'Tidak ada balasan dari model.';
}

/* --- Chat actions --- */
async function sendMessage(text) {
  if (!text || isProcessing) return;

  if (dom.mainContent) {
    dom.mainContent.classList.remove('chat-empty');
    dom.mainContent.classList.add('chat-active');
  }
  if (dom.welcomeHero) dom.welcomeHero.style.display = 'none';
  if (dom.suggestionsGrid) dom.suggestionsGrid.style.display = 'none';

  appendUserMessage(text);
  isProcessing = true;
  clearInput();

  const thinkingRow = showThinkingIndicator();

  try {
    replaceThinkingWithMessage(thinkingRow, await requestReply(text));
  } catch (error) {
    replaceThinkingWithMessage(
      thinkingRow,
      `**Terjadi Kesalahan:** ${error.message}. Pastikan kontainer Ollama aktif.`,
    );
  } finally {
    isProcessing = false;
    updateSendButtonState();
    dom.promptInput.focus();
  }
}

function replaceThinkingWithMessage(thinkingRow, markdown) {
  thinkingRow.remove();
  appendAssistantMessage(markdown);
}

function resetChat() {
  if (isProcessing) return;

  if (dom.mainContent) {
    dom.mainContent.classList.remove('chat-active');
    dom.mainContent.classList.add('chat-empty');
  }
  if (dom.welcomeHero) dom.welcomeHero.style.display = '';
  if (dom.suggestionsGrid) dom.suggestionsGrid.style.display = '';

  dom.messagesWrapper.replaceChildren(dom.welcomeHero);
  clearInput();
  dom.promptInput.focus();
}

/* --- Event listeners --- */
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

document.querySelectorAll('.suggestion-card').forEach((card) => {
  card.addEventListener('click', () => sendMessage(card.dataset.prompt));
});

dom.newChatBtn.addEventListener('click', resetChat);
dom.clearChatBtn.addEventListener('click', resetChat);
dom.menuToggle.addEventListener('click', () => dom.sidebar.classList.toggle('open'));

window.addEventListener('keydown', (event) => {
  const isShortcut = (event.ctrlKey || event.metaKey) && event.key === 'k';
  if (isShortcut) {
    event.preventDefault();
    resetChat();
  }
});
