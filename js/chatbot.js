// js/chatbot.js - Chatbot Functionality (Now with Image Pasting)

// --- CONSTANTS AND DOM ELEMENTS (Global Scope) ---
const chatbot_N8N_WEBHOOK_BASE = 'https://caseyp.app.n8n.cloud/webhook/';
const chatbot_CHAT_ENDPOINT = chatbot_N8N_WEBHOOK_BASE + 'nofrictionchatbot';

const chatbot_appWrapper = document.getElementById('app-wrapper');
const chatbot_toggleBtn = document.getElementById('chat-toggle');
const chatbot_resizeHandleTL = document.getElementById('resize-handle-tl');
const chatbot_newChatBtn = document.getElementById('new-chat-btn');
const chatbot_threadListEl = document.getElementById('thread-list');
const chatbot_modelSelector = document.getElementById('model-selector');
const chatbot_currentThreadModelEl = document.getElementById('current-thread-model');
const chatbot_msgsContainer = document.getElementById('messages');
const chatbot_controls = document.getElementById('controls');
const chatbot_sendBtn = document.getElementById('send-btn');
const chatbot_fileInput = document.getElementById('file-btn');
const chatbot_speakBtn = document.getElementById('speak-btn');
const chatbot_audioChk = document.getElementById('audio-enable');
const chatbot_typingIndicator = document.getElementById('typing-indicator');

// --- STATE VARIABLES (Global Scope) ---
let chatbot_userInput; // This will be assigned after the DOM is manipulated
let chatbot_currentThreadId = null;
let chatbot_currentThreadMessages = [];
let chatbot_allThreadsMetadata = [];
let chatbot_currentSelectedModel = chatbot_modelSelector.value;
let chatbot_appInitialized = false;
let chatbot_stagedImageData = null; // For holding pasted/uploaded image data

// --- INITIALIZATION ---
if (window.joypixels) {
  joypixels.emojiSize = '64';
  joypixels.imagePathPNG = 'https://cdn.jsdelivr.net/npm/emoji-toolkit@8.0.0/extras/png/64/';
}

// Main entry point
document.addEventListener('DOMContentLoaded', () => {
    chatbot_toggleBtn.addEventListener('click', chatbot_toggleChatApp);
});


function chatbot_toggleChatApp() {
    const isOpen = chatbot_appWrapper.style.display === 'flex';
    if (isOpen) {
        chatbot_appWrapper.style.display = 'none';
        chatbot_toggleBtn.textContent = '💬';
    } else {
        chatbot_appWrapper.style.display = 'flex';
        chatbot_toggleBtn.textContent = '✕';
        if (!chatbot_appInitialized) { 
            chatbot_initializeApp(); 
            chatbot_appInitialized = true; 
        }
    }
}

function chatbot_initializeApp(){
    console.log("Chatbot: Initializing app...");
    chatbot_setupEnhancedInput(); // Create the new input area
    chatbot_addEventListeners(); // Add all event listeners
    chatbot_loadAndDisplayThreads(); 
    chatbot_setupSpeechRecognition();
    chatbot_speakBtn.disabled = !chatbot_audioChk.checked;
}

// Creates the dynamic input area and correctly assigns the global chatbot_userInput
function chatbot_setupEnhancedInput() {
    const originalInput = document.getElementById('user-input');
    if (!originalInput) {
        console.error('Chatbot Error: Could not find element with id="user-input"');
        return;
    }

    const inputWrapper = document.createElement('div');
    inputWrapper.id = 'input-wrapper';

    const imagePreviewContainer = document.createElement('div');
    imagePreviewContainer.id = 'image-preview-container';
    
    // Assign the found element to our global variable
    chatbot_userInput = originalInput;
    chatbot_userInput.style.display = 'block';

    inputWrapper.appendChild(imagePreviewContainer);
    inputWrapper.appendChild(chatbot_userInput.parentElement.removeChild(chatbot_userInput));
    
    // The original input is now inside the wrapper, which we insert into the controls
    chatbot_controls.insertBefore(inputWrapper, chatbot_sendBtn);
}

// Centralized event listener setup
function chatbot_addEventListeners() {
    chatbot_newChatBtn.addEventListener('click', chatbot_startNewThread);
    chatbot_modelSelector.addEventListener('change', chatbot_handleModelSelectionChange);
    
    // Add submission listeners
    chatbot_sendBtn.addEventListener('click', (e) => { e.preventDefault(); chatbot_sendMessage(); });
    chatbot_userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatbot_sendMessage(); } });
    
    // Add image handling listeners
    chatbot_userInput.addEventListener('paste', chatbot_handlePaste);
    chatbot_fileInput.addEventListener('change', chatbot_handleFileUpload);
    
    // Other UI listeners
    chatbot_audioChk.addEventListener('change', () => { chatbot_speakBtn.disabled = !chatbot_audioChk.checked; if (!chatbot_audioChk.checked && window.speechSynthesis) window.speechSynthesis.cancel(); });
}

// --- CORE CHATBOT LOGIC (SENDING MESSAGES) ---

async function chatbot_sendMessage() {
    const text = chatbot_userInput.value.trim();
    if (!text && !chatbot_stagedImageData) return;

    const userMessageContent = text || `Image Uploaded`;
    const userMessage = { role: 'user', content: userMessageContent, timestamp: new Date().toISOString(), image: chatbot_stagedImageData };
    
    chatbot_currentThreadMessages.push(userMessage);
    chatbot_appendMessageToDOM(userMessage);
    chatbot_updateThreadMetadataOnInteraction(true, userMessageContent);
    chatbot_saveCurrentThreadMessages();

    // Store data and clear inputs before sending
    const submittedImageData = chatbot_stagedImageData;
    const modelForAPI = chatbot_currentSelectedModel;
    const messagesForBackend = chatbot_currentThreadMessages;
    chatbot_userInput.value = '';
    chatbot_clearStagedImage();

    chatbot_showTypingIndicatorDots();

    const formData = new FormData();
    if (text) formData.append('text', text);
    if (submittedImageData) {
        const imageBlob = await fetch(submittedImageData).then(res => res.blob());
        formData.append('image', imageBlob, 'pasted-image.png');
    }
    formData.append('threadId', chatbot_currentThreadId);
    formData.append('model', modelForAPI);
    formData.append('messages', JSON.stringify(messagesForBackend));

    try {
        const response = await fetch(chatbot_CHAT_ENDPOINT, { method: 'POST', body: formData });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
        }
        const jsonResponse = await response.json();
        if (!jsonResponse.reply && typeof jsonResponse.reply !== 'string') {
            throw new Error("Received invalid or empty reply from bot.");
        }
        const botMessage = { role: 'bot', content: jsonResponse.reply, timestamp: new Date().toISOString(), modelUsed: jsonResponse.modelUsed || modelForAPI };
        chatbot_currentThreadMessages.push(botMessage);
        chatbot_appendMessageToDOM(botMessage);
        chatbot_updateThreadMetadataOnInteraction(false);
        chatbot_saveCurrentThreadMessages();
    } catch (e) {
        console.error("Chatbot: Error in sendMessage:", e);
        const errorMessage = { role: 'bot', content: 'Error: ' + e.message, timestamp: new Date().toISOString() };
        chatbot_appendMessageToDOM(errorMessage);
    } finally {
        chatbot_hideTypingIndicator();
    }
}


// --- IMAGE HANDLING LOGIC ---

function chatbot_handlePaste(event) {
    const items = (event.clipboardData || window.clipboardData).items;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            event.preventDefault();
            const blob = item.getAsFile();
            if (blob) chatbot_stageImageFile(blob);
            return;
        }
    }
}

function chatbot_handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        chatbot_stageImageFile(file);
    }
    event.target.value = '';
}

function chatbot_stageImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        chatbot_stagedImageData = e.target.result;
        chatbot_renderImagePreview();
    };
    reader.readAsDataURL(file);
}

function chatbot_renderImagePreview() {
    const imagePreviewContainer = document.getElementById('image-preview-container');
    imagePreviewContainer.innerHTML = '';
    if (chatbot_stagedImageData) {
        const img = document.createElement('img');
        img.src = chatbot_stagedImageData;
        
        const removeBtn = document.createElement('button');
        removeBtn.id = 'remove-image-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove Image';
        removeBtn.onclick = chatbot_clearStagedImage;

        imagePreviewContainer.appendChild(img);
        imagePreviewContainer.appendChild(removeBtn);
        imagePreviewContainer.classList.add('visible');
    }
}

function chatbot_clearStagedImage() {
    chatbot_stagedImageData = null;
    const imagePreviewContainer = document.getElementById('image-preview-container');
    imagePreviewContainer.innerHTML = '';
    imagePreviewContainer.classList.remove('visible');
}

// --- DOM AND MESSAGE RENDERING ---

function chatbot_appendMessageToDOM(message) {
    const div = document.createElement('div');
    div.className = 'message ' + message.role;
    
    if (message.image && message.role === 'user') {
        const img = document.createElement('img');
        img.src = message.image;
        img.style.cssText = "max-width: 250px; border-radius: 12px; margin-bottom: 8px; display: block;";
        div.appendChild(img);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    let htmlContent = message.content || "";

    if (window.marked) {
        try {
            marked.use({ breaks: true, gfm: true });
            htmlContent = marked.parse(htmlContent, { sanitize: false });
        } catch (e) {
            htmlContent = message.content.replace(/\n/g, '<br>');
        }
    }

    if (window.joypixels) htmlContent = joypixels.toImage(htmlContent);

    contentDiv.innerHTML = htmlContent;
    div.appendChild(contentDiv);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.appendChild(timeSpan);
    
    chatbot_msgsContainer.insertBefore(div, chatbot_typingIndicator);
    chatbot_scrollToBottom();

    if (message.role === 'bot' && chatbot_audioChk.checked && message.content) {
        let textToSpeak = contentDiv.textContent || contentDiv.innerText || "";
        if (window.joypixels) textToSpeak = joypixels.shortnameToUnicode(joypixels.imageToShortname(textToSpeak));
        chatbot_speak(textToSpeak);
    }
}

function chatbot_renderMessages() {
    const messageElements = chatbot_msgsContainer.querySelectorAll('.message:not(#typing-indicator)');
    messageElements.forEach(el => el.remove());
    chatbot_currentThreadMessages.forEach(m => chatbot_appendMessageToDOM(m));
    chatbot_scrollToBottom();
}

// --- THREAD MANAGEMENT AND OTHER UTILITIES (UNCHANGED FROM YOUR ORIGINAL FILE) ---
function chatbot_loadAndDisplayThreads(){ chatbot_showTypingIndicatorCustomText('Loading conversations...'); chatbot_allThreadsMetadata = JSON.parse(localStorage.getItem('nofriction_threads') || '[]'); chatbot_allThreadsMetadata.sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)); chatbot_renderThreadList(); const lastActiveId = localStorage.getItem('nofriction_last_active_thread_id'); let threadToLoad = null; if (lastActiveId && chatbot_allThreadsMetadata.some(t => t.id === lastActiveId)) { if (localStorage.getItem(`nofriction_msgs_${lastActiveId}`)) { threadToLoad = lastActiveId; } else { localStorage.removeItem('nofriction_last_active_thread_id'); } } if (!threadToLoad && chatbot_allThreadsMetadata.length > 0) { threadToLoad = chatbot_allThreadsMetadata[0].id; } if (threadToLoad) { chatbot_loadThread(threadToLoad); } else { chatbot_startNewThread(); } chatbot_hideTypingIndicator(); }
function chatbot_renderThreadList(){ chatbot_threadListEl.innerHTML = ''; if (chatbot_allThreadsMetadata.length === 0) { chatbot_threadListEl.innerHTML = '<li style="color: var(--chatbot-text-secondary); text-align: center; padding: 20px 0; font-size: 0.9em;">No conversations yet.</li>'; return; } chatbot_allThreadsMetadata.forEach(t => { const li = document.createElement('li'); li.dataset.threadId = t.id; li.className = t.id === chatbot_currentThreadId ? 'active-thread' : ''; const threadInfoContainer = document.createElement('div'); threadInfoContainer.innerHTML = `<span class="thread-title">${t.title || "Chat"}</span><span class="thread-details">${t.model || "Default"} | ${new Date(t.lastUpdated).toLocaleDateString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>`; threadInfoContainer.addEventListener('click', (e) => { e.stopPropagation(); chatbot_loadThread(t.id); }); li.appendChild(threadInfoContainer); const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-thread-btn'; deleteBtn.innerHTML = '&#x1F5D1;'; deleteBtn.title = `Delete conversation: "${t.title || "Chat"}"`; deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); chatbot_confirmDeleteThread(t.id, t.title || "Chat"); }); li.appendChild(deleteBtn); chatbot_threadListEl.appendChild(li); }); }
function chatbot_confirmDeleteThread(threadId, threadTitle) { if (window.confirm(`Are you sure you want to delete the conversation: "${threadTitle}"?\nThis action cannot be undone.`)) { chatbot_deleteThread(threadId); } }
function chatbot_deleteThread(threadIdToDelete) { console.log("Chatbot: Deleting thread:", threadIdToDelete); chatbot_allThreadsMetadata = chatbot_allThreadsMetadata.filter(thread => thread.id !== threadIdToDelete); chatbot_saveAllThreadsMetadata(); localStorage.removeItem(`nofriction_msgs_${threadIdToDelete}`); if (localStorage.getItem('nofriction_last_active_thread_id') === threadIdToDelete) { localStorage.removeItem('nofriction_last_active_thread_id'); } if (chatbot_currentThreadId === threadIdToDelete) { chatbot_currentThreadId = null; chatbot_currentThreadMessages = []; const msgElements = chatbot_msgsContainer.querySelectorAll('.message:not(#typing-indicator)'); msgElements.forEach(el => el.remove()); if (chatbot_allThreadsMetadata.length > 0) { chatbot_loadThread(chatbot_allThreadsMetadata[0].id); } else { chatbot_startNewThread(); } } else { chatbot_renderThreadList(); } }
function chatbot_startNewThread(){ console.log("Chatbot: Starting new thread."); chatbot_currentThreadId = 't_' + Date.now() + Math.random().toString(16).slice(2); chatbot_currentThreadMessages = []; chatbot_currentSelectedModel = chatbot_modelSelector.value; const newThreadMeta = {id: chatbot_currentThreadId, title: 'New Conversation', lastUpdated: new Date().toISOString(), model: chatbot_currentSelectedModel}; chatbot_allThreadsMetadata.unshift(newThreadMeta); chatbot_allThreadsMetadata.sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)); chatbot_saveAllThreadsMetadata(); localStorage.setItem('nofriction_last_active_thread_id', chatbot_currentThreadId); chatbot_renderThreadList(); chatbot_renderMessages(); chatbot_addInitialBotGreetingIfNeeded(); chatbot_userInput.focus(); chatbot_currentThreadModelEl.textContent = `(${chatbot_currentSelectedModel})`; chatbot_saveCurrentThreadMessages(); }
function chatbot_loadThread(id){ console.log("Chatbot: Loading thread:", id); chatbot_currentThreadId = id; chatbot_currentThreadMessages = JSON.parse(localStorage.getItem(`nofriction_msgs_${id}`) || '[]'); const meta = chatbot_allThreadsMetadata.find(t => t.id === id); if(meta){ chatbot_currentSelectedModel = meta.model; chatbot_modelSelector.value = meta.model; chatbot_currentThreadModelEl.textContent = `(${meta.model})`; localStorage.setItem('nofriction_last_active_thread_id', chatbot_currentThreadId); } else { console.warn("Chatbot: Meta not found for thread:", id); chatbot_loadAndDisplayThreads(); return; } chatbot_renderThreadList(); chatbot_renderMessages(); chatbot_addInitialBotGreetingIfNeeded(); chatbot_scrollToBottom(); }
function chatbot_handleModelSelectionChange(e) { chatbot_currentSelectedModel = e.target.value; if (chatbot_currentThreadId) { const activeThreadMeta = chatbot_allThreadsMetadata.find(t => t.id === chatbot_currentThreadId); if (activeThreadMeta) { activeThreadMeta.model = chatbot_currentSelectedModel; activeThreadMeta.lastUpdated = new Date().toISOString(); chatbot_saveAllThreadsMetadata(); chatbot_renderThreadList(); } chatbot_currentThreadModelEl.textContent = `(${chatbot_currentSelectedModel})`; } }
function chatbot_updateThreadMetadataOnInteraction(isNewMessage, firstUserMsgContent = null) { if (!chatbot_currentThreadId) return; const meta = chatbot_allThreadsMetadata.find(t => t.id === chatbot_currentThreadId); if (meta) { meta.lastUpdated = new Date().toISOString(); meta.model = chatbot_currentSelectedModel; if (isNewMessage && firstUserMsgContent && (meta.title === 'New Conversation' || meta.title === 'Chat')) { meta.title = firstUserMsgContent.substring(0, 30) + (firstUserMsgContent.length > 30 ? '...' : ''); } chatbot_allThreadsMetadata.sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)); chatbot_saveAllThreadsMetadata(); chatbot_renderThreadList(); chatbot_currentThreadModelEl.textContent = `(${chatbot_currentSelectedModel})`; } }
function chatbot_saveCurrentThreadMessages(){ if(chatbot_currentThreadId) localStorage.setItem(`nofriction_msgs_${chatbot_currentThreadId}`, JSON.stringify(chatbot_currentThreadMessages)); }
function chatbot_saveAllThreadsMetadata(){ localStorage.setItem('nofriction_threads', JSON.stringify(chatbot_allThreadsMetadata)); }
function chatbot_addInitialBotGreetingIfNeeded() { if (chatbot_currentThreadId && chatbot_currentThreadMessages.length === 0) { const greeting = { role: 'bot', content: 'Hello! How can I assist you today?', timestamp: new Date().toISOString(), modelUsed: chatbot_currentSelectedModel }; chatbot_currentThreadMessages.push(greeting); chatbot_appendMessageToDOM(greeting); } }
function chatbot_showTypingIndicatorDots(){ chatbot_typingIndicator.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; chatbot_typingIndicator.style.display = 'flex'; chatbot_scrollToBottom(); }
function chatbot_showTypingIndicatorCustomText(text) { chatbot_typingIndicator.innerHTML = `<span style="font-size:0.9em; color:var(--chatbot-text-secondary); padding: 5px 0;">${text}</span>`; chatbot_typingIndicator.style.display = 'flex'; chatbot_scrollToBottom(); }
function chatbot_hideTypingIndicator(){ chatbot_typingIndicator.style.display = 'none'; }
function chatbot_scrollToBottom(){ setTimeout(() => { if(chatbot_msgsContainer) chatbot_msgsContainer.scrollTop = chatbot_msgsContainer.scrollHeight; }, 50); }
function chatbot_setupSpeechRecognition(){ const Rec = window.SpeechRecognition || window.webkitSpeechRecognition; if(!Rec){ chatbot_speakBtn.style.display = 'none'; console.warn("Chatbot: Speech Recognition not supported."); return; } const recognition = new Rec(); recognition.continuous = false; recognition.lang = 'en-US'; recognition.interimResults = false; recognition.onresult = e => { chatbot_userInput.value += (e.results[0][0].transcript + ' '); }; recognition.onerror = e => { console.error("Chatbot: Speech recognition error:", e.error); chatbot_addSystemMessage("Speech error: " + e.error); chatbot_speakBtn.textContent = '🎤'; chatbot_speakBtn.style.backgroundColor = ''; }; recognition.onend = () => { chatbot_speakBtn.textContent = '🎤'; chatbot_speakBtn.style.backgroundColor = ''; if(recognition.isStarted) recognition.isStarted = false; }; recognition.onstart = () => { recognition.isStarted = true; }; chatbot_speakBtn.addEventListener('click', () => { if (chatbot_speakBtn.disabled || (recognition && recognition.isStarted)) return; try { recognition.start(); chatbot_speakBtn.textContent = '🎙️'; chatbot_speakBtn.style.backgroundColor = 'var(--chatbot-system-green-dark)'; } catch(err) { console.error("Chatbot: Could not start recognition:", err); chatbot_speakBtn.textContent = '🎤'; chatbot_speakBtn.style.backgroundColor = ''; } }); }
function chatbot_speak(txt){ if(!chatbot_audioChk.checked || !txt || !window.speechSynthesis) return; const utterance = new SpeechSynthesisUtterance(txt); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); }