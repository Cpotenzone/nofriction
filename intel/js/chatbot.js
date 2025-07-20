// js/chatbot.js - Chatbot Functionality

const N8N_WEBHOOK_BASE_CHATBOT = 'https://caseyp.app.n8n.cloud/webhook/';
const CHAT_ENDPOINT_CHATBOT = N8N_WEBHOOK_BASE_CHATBOT + 'nofrictionchatbot';

const appWrapper_chatbot = document.getElementById('app-wrapper');
const chatToggleBtn_chatbot = document.getElementById('chat-toggle');
const resizeHandleTL_chatbot = document.getElementById('resize-handle-tl');
const newChatBtn_chatbot = document.getElementById('new-chat-btn');
const threadListEl_chatbot = document.getElementById('thread-list');
const modelSelector_chatbot = document.getElementById('model-selector');
const currentThreadModelEl_chatbot = document.getElementById('current-thread-model');
const msgsContainer_chatbot = document.getElementById('messages');
const userInput_chatbot = document.getElementById('user-input');
const sendBtn_chatbot = document.getElementById('send-btn');
const fileInput_chatbot = document.getElementById('file-btn');
const speakBtn_chatbot = document.getElementById('speak-btn');
const audioChk_chatbot = document.getElementById('audio-enable');
const typingIndicator_chatbot = document.getElementById('typing-indicator');

let currentThreadId_chatbot = null;
let currentThreadMessages_chatbot = [];
let allThreadsMetadata_chatbot = [];
let currentSelectedModel_chatbot = modelSelector_chatbot.value;
let isResizingTL_chatbot = false;
let initialMouseX_chatbot, initialMouseY_chatbot, initialWrapperLeft_chatbot, initialWrapperTop_chatbot, initialWrapperWidth_chatbot, initialWrapperHeight_chatbot;
let appInitialized_chatbot = false;

if (window.joypixels) {
  joypixels.emojiSize = '64';
  joypixels.imagePathPNG = 'https://cdn.jsdelivr.net/npm/emoji-toolkit@8.0.0/extras/png/64/';
  joypixels.sprites = false; // Using individual PNGs for broader compatibility
  joypixels.emojiVersion = "latest";
}

chatToggleBtn_chatbot.addEventListener('click', toggleChatApp_chatbot);
newChatBtn_chatbot.addEventListener('click', startNewThread_chatbot);
modelSelector_chatbot.addEventListener('change', handleModelSelectionChange_chatbot);

sendBtn_chatbot.addEventListener('click', () => {
    console.log("Chatbot: Send button clicked.");
    sendMessage_chatbot();
});
userInput_chatbot.addEventListener('keypress', e => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        console.log("Chatbot: Enter key pressed.");
        sendMessage_chatbot(); 
    } 
});

fileInput_chatbot.addEventListener('change', handleFileUpload_chatbot);
audioChk_chatbot.addEventListener('change', () => {
    speakBtn_chatbot.disabled = !audioChk_chatbot.checked;
    if (!audioChk_chatbot.checked && window.speechSynthesis) window.speechSynthesis.cancel();
});
resizeHandleTL_chatbot.addEventListener('mousedown', startResizeTL_chatbot);

function toggleChatApp_chatbot() {
    const isOpen = appWrapper_chatbot.style.display === 'flex';
    if (isOpen) { appWrapper_chatbot.style.display = 'none'; chatToggleBtn_chatbot.textContent = '💬'; }
    else {
        appWrapper_chatbot.style.display = 'flex'; chatToggleBtn_chatbot.textContent = '✕';
        loadPersistedWindowPosition_chatbot();
        if (!appInitialized_chatbot) { initializeApp_chatbot(); appInitialized_chatbot = true; }
        else if (currentThreadId_chatbot) scrollToBottom_chatbot();
    }
}
function initializeApp_chatbot(){
    console.log("Chatbot: Initializing app...");
    loadAndDisplayThreads_chatbot(); 
    setupSpeechRecognition_chatbot();
    speakBtn_chatbot.disabled = !audioChk_chatbot.checked;
}
function loadPersistedWindowPosition_chatbot() {
    const savedPosition = localStorage.getItem('nofriction_chat_window_pos_apple');
    if (savedPosition) {
        try {
            const pos = JSON.parse(savedPosition);
            appWrapper_chatbot.style.top = pos.top; appWrapper_chatbot.style.left = pos.left;
            appWrapper_chatbot.style.width = pos.width; appWrapper_chatbot.style.height = pos.height;
            appWrapper_chatbot.style.transform = 'none'; 
        } catch(e) { setDefaultWindowPosition_chatbot(); }
    } else setDefaultWindowPosition_chatbot();
}
function setDefaultWindowPosition_chatbot() {
    appWrapper_chatbot.style.top = '50%'; appWrapper_chatbot.style.left = '50%';
    appWrapper_chatbot.style.width = '850px'; appWrapper_chatbot.style.height = '75vh';
    appWrapper_chatbot.style.transform = 'translate(-50%, -50%)';
}
function startResizeTL_chatbot(e){
    e.preventDefault(); isResizingTL_chatbot = true;
    initialMouseX_chatbot = e.clientX; initialMouseY_chatbot = e.clientY;
    const rect = appWrapper_chatbot.getBoundingClientRect();
    initialWrapperLeft_chatbot = rect.left; initialWrapperTop_chatbot = rect.top;
    initialWrapperWidth_chatbot = rect.width; initialWrapperHeight_chatbot = rect.height;
    document.addEventListener('mousemove', doResizeTL_chatbot);
    document.addEventListener('mouseup', stopResizeTL_chatbot);
}
function doResizeTL_chatbot(e){
    if(!isResizingTL_chatbot) return;
    const deltaX = e.clientX - initialMouseX_chatbot; const deltaY = e.clientY - initialMouseY_chatbot;
    let newWidth = initialWrapperWidth_chatbot - deltaX; let newHeight = initialWrapperHeight_chatbot - deltaY;
    let newLeft = initialWrapperLeft_chatbot + deltaX; let newTop = initialWrapperTop_chatbot + deltaY;
    const minWidth = parseInt(getComputedStyle(appWrapper_chatbot).minWidth, 10) || 600;
    const minHeight = parseInt(getComputedStyle(appWrapper_chatbot).minHeight, 10) || 400;
    if(newWidth < minWidth){ newWidth = minWidth; newLeft = initialWrapperLeft_chatbot + (initialWrapperWidth_chatbot - minWidth); }
    if(newHeight < minHeight){ newHeight = minHeight; newTop = initialWrapperTop_chatbot + (initialWrapperHeight_chatbot - minHeight); }
    appWrapper_chatbot.style.width = `${newWidth}px`; appWrapper_chatbot.style.height = `${newHeight}px`;
    appWrapper_chatbot.style.left = `${newLeft}px`; appWrapper_chatbot.style.top = `${newTop}px`;
}
function stopResizeTL_chatbot(){
    isResizingTL_chatbot = false;
    document.removeEventListener('mousemove', doResizeTL_chatbot);
    document.removeEventListener('mouseup', stopResizeTL_chatbot);
    localStorage.setItem('nofriction_chat_window_pos_apple', JSON.stringify({
        top: appWrapper_chatbot.style.top, left: appWrapper_chatbot.style.left,
        width: appWrapper_chatbot.style.width, height: appWrapper_chatbot.style.height
    }));
}

function loadAndDisplayThreads_chatbot(){
    showTypingIndicatorCustomText_chatbot('Loading conversations...');
    allThreadsMetadata_chatbot = JSON.parse(localStorage.getItem('nofriction_threads') || '[]');
    allThreadsMetadata_chatbot.sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    renderThreadList_chatbot();
    const lastActiveId = localStorage.getItem('nofriction_last_active_thread_id');
    
    let threadToLoad = null;
    if (lastActiveId && allThreadsMetadata_chatbot.some(t => t.id === lastActiveId)) {
        // Check if messages for last active thread exist
        if (localStorage.getItem(`nofriction_msgs_${lastActiveId}`)) {
            threadToLoad = lastActiveId;
        } else {
            // Messages for last active ID don't exist, maybe it was deleted externally or an error occurred
            console.warn(`Chatbot: Messages for last active thread ID ${lastActiveId} not found. Trying next available.`);
            localStorage.removeItem('nofriction_last_active_thread_id'); // Clear invalid last active ID
        }
    }

    if (!threadToLoad && allThreadsMetadata_chatbot.length > 0) {
        threadToLoad = allThreadsMetadata_chatbot[0].id; // Fallback to the most recent thread
    }

    if (threadToLoad) {
        loadThread_chatbot(threadToLoad);
    } else {
        startNewThread_chatbot();
    }
    hideTypingIndicator_chatbot();
}

function renderThreadList_chatbot(){
    threadListEl_chatbot.innerHTML = '';
    if (allThreadsMetadata_chatbot.length === 0) {
        threadListEl_chatbot.innerHTML = '<li style="color: var(--chatbot-text-secondary); text-align: center; padding: 20px 0; font-size: 0.9em;">No conversations yet.</li>'; return;
    }
    allThreadsMetadata_chatbot.forEach(t => {
        const li = document.createElement('li'); 
        li.dataset.threadId = t.id;
        li.className = t.id === currentThreadId_chatbot ? 'active-thread' : '';
        
        const threadInfoContainer = document.createElement('div');
        threadInfoContainer.style.cursor = 'pointer'; 
        threadInfoContainer.innerHTML = `<span class="thread-title">${t.title || "Chat"}</span><span class="thread-details">${t.model || "Default"} | ${new Date(t.lastUpdated).toLocaleDateString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>`;
        // Attach event listener to the container, not the li itself for loading
        threadInfoContainer.addEventListener('click', (e) => {
             e.stopPropagation(); // Prevent event bubbling if needed
             loadThread_chatbot(t.id);
        });
        li.appendChild(threadInfoContainer);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-thread-btn';
        deleteBtn.innerHTML = '&#x1F5D1;'; // Unicode Trash Can Icon
        deleteBtn.title = `Delete conversation: "${t.title || "Chat"}"`;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent li click (loadThread)
            confirmDeleteThread_chatbot(t.id, t.title || "Chat");
        });
        li.appendChild(deleteBtn);
        threadListEl_chatbot.appendChild(li);
    });
}

function confirmDeleteThread_chatbot(threadId, threadTitle) {
    if (window.confirm(`Are you sure you want to delete the conversation: "${threadTitle}"?\nThis action cannot be undone.`)) {
        deleteThread_chatbot(threadId);
    }
}

function deleteThread_chatbot(threadIdToDelete) {
    console.log("Chatbot: Deleting thread:", threadIdToDelete);
    allThreadsMetadata_chatbot = allThreadsMetadata_chatbot.filter(thread => thread.id !== threadIdToDelete);
    saveAllThreadsMetadata_chatbot();
    localStorage.removeItem(`nofriction_msgs_${threadIdToDelete}`);

    if (localStorage.getItem('nofriction_last_active_thread_id') === threadIdToDelete) {
        localStorage.removeItem('nofriction_last_active_thread_id');
    }

    if (currentThreadId_chatbot === threadIdToDelete) {
        currentThreadId_chatbot = null;
        currentThreadMessages_chatbot = [];
        // Clear visual messages, keeping the typing indicator structure if needed
        const messageElements = msgsContainer_chatbot.querySelectorAll('.message:not(#typing-indicator)');
        messageElements.forEach(el => el.remove());
        
        if (allThreadsMetadata_chatbot.length > 0) {
            // Load the newest available thread (already sorted)
            loadThread_chatbot(allThreadsMetadata_chatbot[0].id);
        } else {
            startNewThread_chatbot(); // No threads left, start a fresh one
        }
    } else {
        renderThreadList_chatbot(); // Just update the list if a non-active thread was deleted
    }
}

function startNewThread_chatbot(){
    console.log("Chatbot: Starting new thread.");
    currentThreadId_chatbot = 't_' + Date.now() + Math.random().toString(16).slice(2);
    currentThreadMessages_chatbot = []; currentSelectedModel_chatbot = modelSelector_chatbot.value;
    const newThreadMeta = {id: currentThreadId_chatbot, title: 'New Conversation', lastUpdated: new Date().toISOString(), model: currentSelectedModel_chatbot};
    allThreadsMetadata_chatbot.unshift(newThreadMeta); // Add to the beginning (top)
    allThreadsMetadata_chatbot.sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)); // Ensure sorted
    saveAllThreadsMetadata_chatbot(); 
    localStorage.setItem('nofriction_last_active_thread_id', currentThreadId_chatbot);
    renderThreadList_chatbot(); 
    renderMessages_chatbot(); // This will clear old messages
    addInitialBotGreetingIfNeeded_chatbot();
    userInput_chatbot.focus(); 
    currentThreadModelEl_chatbot.textContent = `(${currentSelectedModel_chatbot})`;
    saveCurrentThreadMessages_chatbot(); // Save the (empty or greeting-only) new thread state
}
function loadThread_chatbot(id){
    console.log("Chatbot: Loading thread:", id);
    currentThreadId_chatbot = id;
    currentThreadMessages_chatbot = JSON.parse(localStorage.getItem(`nofriction_msgs_${id}`) || '[]');
    const meta = allThreadsMetadata_chatbot.find(t => t.id === id);
    if(meta){
        currentSelectedModel_chatbot = meta.model; modelSelector_chatbot.value = meta.model;
        currentThreadModelEl_chatbot.textContent = `(${meta.model})`;
        localStorage.setItem('nofriction_last_active_thread_id', currentThreadId_chatbot);
    } else { 
        console.warn("Chatbot: Meta not found for thread:", id, ". Attempting to recover or start new.");
        // If meta is gone, remove from last active and try to load next or new
        if(localStorage.getItem('nofriction_last_active_thread_id') === id) {
            localStorage.removeItem('nofriction_last_active_thread_id');
        }
        loadAndDisplayThreads_chatbot(); // This will try to load another thread or start new
        return; 
    }
    renderThreadList_chatbot(); 
    renderMessages_chatbot(); 
    addInitialBotGreetingIfNeeded_chatbot(); 
    scrollToBottom_chatbot();
}
function handleModelSelectionChange_chatbot(e) {
  currentSelectedModel_chatbot = e.target.value;
  if (currentThreadId_chatbot) {
    const activeThreadMeta = allThreadsMetadata_chatbot.find(t => t.id === currentThreadId_chatbot);
    if (activeThreadMeta) {
        activeThreadMeta.model = currentSelectedModel_chatbot; activeThreadMeta.lastUpdated = new Date().toISOString();
        saveAllThreadsMetadata_chatbot(); renderThreadList_chatbot();
    }
    currentThreadModelEl_chatbot.textContent = `(${currentSelectedModel_chatbot})`;
  }
}
function updateThreadMetadataOnInteraction_chatbot(isNewMessage, firstUserMsgContent = null) {
    if (!currentThreadId_chatbot) { console.warn("Chatbot: updateThreadMetadataOnInteraction called with no currentThreadId"); return; }
    const meta = allThreadsMetadata_chatbot.find(t => t.id === currentThreadId_chatbot);
    if (meta) {
        meta.lastUpdated = new Date().toISOString(); meta.model = currentSelectedModel_chatbot;
        if (isNewMessage && firstUserMsgContent && (meta.title === 'New Conversation' || meta.title === 'Chat')) {
            meta.title = firstUserMsgContent.substring(0, 30) + (firstUserMsgContent.length > 30 ? '...' : '');
        }
        allThreadsMetadata_chatbot.sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        saveAllThreadsMetadata_chatbot(); renderThreadList_chatbot();
        currentThreadModelEl_chatbot.textContent = `(${currentSelectedModel_chatbot})`;
    } else { console.warn("Chatbot: Meta not found in updateThreadMetadataOnInteraction for ID:", currentThreadId_chatbot); }
}
function renderMessages_chatbot(){
    const messageElements = msgsContainer_chatbot.querySelectorAll('.message:not(#typing-indicator)');
    messageElements.forEach(el => el.remove());
    currentThreadMessages_chatbot.forEach(m => appendMessageToDOM_chatbot(m));
    scrollToBottom_chatbot();
}
function appendMessageToDOM_chatbot(message){
    const div = document.createElement('div'); div.className = 'message ' + message.role;
    const contentDiv = document.createElement('div'); contentDiv.className = 'message-content';
    let htmlContent = message.content || "";
    if (window.marked) { try { marked.use({ breaks: true, gfm: true }); htmlContent = marked.parse(htmlContent, { sanitize: false }); } catch (e) { htmlContent = message.content.replace(/\n/g, '<br>'); } }
    if (window.joypixels) htmlContent = joypixels.toImage(htmlContent);
    contentDiv.innerHTML = htmlContent; div.appendChild(contentDiv);
    const timeSpan = document.createElement('span'); timeSpan.className = 'timestamp'; timeSpan.textContent = new Date(message.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); div.appendChild(timeSpan);
    msgsContainer_chatbot.insertBefore(div, typingIndicator_chatbot); scrollToBottom_chatbot();
    if(message.role === 'bot' && audioChk_chatbot.checked && message.content) { let textToSpeak = contentDiv.textContent || contentDiv.innerText || ""; if (window.joypixels) textToSpeak = joypixels.shortnameToUnicode(joypixels.imageToShortname(textToSpeak)); speak_chatbot(textToSpeak); }
}
async function sendMessage_chatbot(){
    console.log("Chatbot: sendMessage function started."); const txt = userInput_chatbot.value.trim(); console.log("Chatbot: Input text:", `"${txt}"`); if(!txt) { console.log("Chatbot: No text, returning from sendMessage."); return; }
    const userMessage = {role:'user', content:txt, timestamp: new Date().toISOString()}; currentThreadMessages_chatbot.push(userMessage); appendMessageToDOM_chatbot(userMessage); updateThreadMetadataOnInteraction_chatbot(true, txt); saveCurrentThreadMessages_chatbot(); userInput_chatbot.value = ''; showTypingIndicatorDots_chatbot();
    const modelForAPI = currentSelectedModel_chatbot; let endpointToUse = CHAT_ENDPOINT_CHATBOT; let requestBody; let requestOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' } }; const messagesForBackend = currentThreadMessages_chatbot; 
    if (modelForAPI.toLowerCase() === 'gemini') { console.log("Chatbot: Preparing to fetch for Gemini..."); requestBody = JSON.stringify({ messages: messagesForBackend, threadId: currentThreadId_chatbot, model: modelForAPI }); }
    else { console.warn(`Chatbot: Preparing for conceptual fetch for ${modelForAPI}. This requires backend changes.`); requestBody = JSON.stringify({ messages: messagesForBackend, threadId: currentThreadId_chatbot, model: modelForAPI }); }
    requestOptions.body = requestBody; console.log("Chatbot: Request body:", requestBody);
    try {
        const response = await fetch(endpointToUse, requestOptions); console.log("Chatbot: Fetch response status:", response.status); if(!response.ok){ const errorText = await response.text(); console.error("Chatbot: API Error Text:", errorText); throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`); }
        const jsonResponse = await response.json(); console.log("Chatbot: API JSON Response:", jsonResponse); if (!jsonResponse.reply && typeof jsonResponse.reply !== 'string') throw new Error("Received invalid or empty reply from bot.");
        const botMessage = {role:'bot', content:jsonResponse.reply, timestamp:new Date().toISOString(), modelUsed: jsonResponse.modelUsed || modelForAPI}; currentThreadMessages_chatbot.push(botMessage); appendMessageToDOM_chatbot(botMessage); updateThreadMetadataOnInteraction_chatbot(false); saveCurrentThreadMessages_chatbot();
    } catch(e){ console.error("Chatbot: Error in sendMessage fetch/processing:", e); const errorMessage = {role:'bot', content:'Error: ' + e.message, timestamp:new Date().toISOString(), modelUsed: modelForAPI}; currentThreadMessages_chatbot.push(errorMessage); appendMessageToDOM_chatbot(errorMessage); saveCurrentThreadMessages_chatbot();
    } finally { hideTypingIndicator_chatbot(); }
}
async function handleFileUpload_chatbot(ev){
    const file = ev.target.files[0]; if(!file) return; const userMessageText = `Uploaded: ${file.name} (${(file.size/1024).toFixed(1)} KB)`; const userMessage = {role:'user', content:userMessageText, timestamp:new Date().toISOString()}; currentThreadMessages_chatbot.push(userMessage); appendMessageToDOM_chatbot(userMessage); updateThreadMetadataOnInteraction_chatbot(true, userMessageText); saveCurrentThreadMessages_chatbot(); showTypingIndicatorDots_chatbot();
    const formData = new FormData(); formData.append('file', file); let endpointToUse = CHAT_ENDPOINT_CHATBOT; console.log(`Chatbot: File upload for model: ${currentSelectedModel_chatbot}`);
    try {
        const response = await fetch(endpointToUse, {method:'POST', body:formData}); if(!response.ok){ const errorText = await response.text(); throw new Error(`Upload error (${response.status}): ${errorText || response.statusText}`); }
        const jsonResponse = await response.json(); if (!jsonResponse.reply && typeof jsonResponse.reply !== 'string') throw new Error("Received invalid or empty reply for file upload.");
        const botMessage = {role:'bot', content:jsonResponse.reply, timestamp:new Date().toISOString(), modelUsed: jsonResponse.modelUsed || currentSelectedModel_chatbot}; currentThreadMessages_chatbot.push(botMessage); appendMessageToDOM_chatbot(botMessage); updateThreadMetadataOnInteraction_chatbot(false); saveCurrentThreadMessages_chatbot();
    } catch(e){ console.error("Chatbot: Error in handleFileUpload fetch/processing:", e); const errorMessage = {role:'bot', content:'Upload error: ' + e.message, timestamp:new Date().toISOString(), modelUsed: currentSelectedModel_chatbot}; currentThreadMessages_chatbot.push(errorMessage); appendMessageToDOM_chatbot(errorMessage); saveCurrentThreadMessages_chatbot();
    } finally { hideTypingIndicator_chatbot(); ev.target.value = ''; }
}
function saveCurrentThreadMessages_chatbot(){ if(currentThreadId_chatbot) localStorage.setItem(`nofriction_msgs_${currentThreadId_chatbot}`, JSON.stringify(currentThreadMessages_chatbot)); }
function saveAllThreadsMetadata_chatbot(){ localStorage.setItem('nofriction_threads', JSON.stringify(allThreadsMetadata_chatbot)); }
function addInitialBotGreetingIfNeeded_chatbot() { if (currentThreadId_chatbot && currentThreadMessages_chatbot.length === 0) { const greeting = { role: 'bot', content: 'Hello! How can I assist you today?', timestamp: new Date().toISOString(), modelUsed: currentSelectedModel_chatbot }; currentThreadMessages_chatbot.push(greeting); appendMessageToDOM_chatbot(greeting); } }
function showTypingIndicatorDots_chatbot(){ typingIndicator_chatbot.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; typingIndicator_chatbot.style.display = 'flex'; scrollToBottom_chatbot(); }
function showTypingIndicatorCustomText_chatbot(text) { typingIndicator_chatbot.innerHTML = `<span style="font-size:0.9em; color:var(--chatbot-text-secondary); padding: 5px 0;">${text}</span>`; typingIndicator_chatbot.style.display = 'flex'; scrollToBottom_chatbot(); }
function hideTypingIndicator_chatbot(){ typingIndicator_chatbot.style.display = 'none'; }
function scrollToBottom_chatbot(){ setTimeout(() => { if(msgsContainer_chatbot) msgsContainer_chatbot.scrollTop = msgsContainer_chatbot.scrollHeight; }, 50); }
function addSystemMessage_chatbot(text) { const systemMessage = { role: 'bot', content: `ℹ️ System: ${text}`, timestamp: new Date().toISOString(), modelUsed: 'System' }; appendMessageToDOM_chatbot(systemMessage); }
function setupSpeechRecognition_chatbot(){ const Rec = window.SpeechRecognition || window.webkitSpeechRecognition; if(!Rec){ speakBtn_chatbot.style.display = 'none'; console.warn("Chatbot: Speech Recognition not supported."); return; } const recognition = new Rec(); recognition.continuous = false; recognition.lang = 'en-US'; recognition.interimResults = false; recognition.onresult = e => { userInput_chatbot.value += (e.results[0][0].transcript + ' '); }; recognition.onerror = e => { console.error("Chatbot: Speech recognition error:", e.error); addSystemMessage_chatbot("Speech error: " + e.error); speakBtn_chatbot.textContent = '🎤'; speakBtn_chatbot.style.backgroundColor = ''; }; recognition.onend = () => { speakBtn_chatbot.textContent = '🎤'; speakBtn_chatbot.style.backgroundColor = ''; if(recognition.isStarted) recognition.isStarted = false; }; recognition.onstart = () => { recognition.isStarted = true; }; speakBtn_chatbot.addEventListener('click', () => { if (speakBtn_chatbot.disabled || (recognition && recognition.isStarted)) return; try { recognition.start(); speakBtn_chatbot.textContent = '🎙️'; speakBtn_chatbot.style.backgroundColor = 'var(--chatbot-system-green-dark)'; } catch(err) { console.error("Chatbot: Could not start recognition:", err); speakBtn_chatbot.textContent = '🎤'; speakBtn_chatbot.style.backgroundColor = ''; } }); }
function speak_chatbot(txt){ if(!audioChk_chatbot.checked || !txt || !window.speechSynthesis) return; const utterance = new SpeechSynthesisUtterance(txt); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); }
</script>
</body>
</html>