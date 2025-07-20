// js/chatbot2.js - Chatbot Functionality (Full Webpage Version with Image Paste)

const N8N_WEBHOOK_BASE_CHATBOT = 'https://caseyp.app.n8n.cloud/webhook/'; // Replace with your actual N8N webhook base if different
const CHAT_ENDPOINT_CHATBOT = N8N_WEBHOOK_BASE_CHATBOT + 'nofrictionchatbot'; // Replace with your actual endpoint if different

// DOM Element References
const appWrapper_chatbot = document.getElementById('app-wrapper');
const newChatBtn_chatbot = document.getElementById('new-chat-btn');
const threadListEl_chatbot = document.getElementById('thread-list');
const modelSelector_chatbot = document.getElementById('model-selector');
const currentThreadModelEl_chatbot = document.getElementById('current-thread-model');
const currentChatTitleEl_chatbot = document.getElementById('current-chat-title');
const msgsContainer_chatbot = document.getElementById('messages');
const userInput_chatbot = document.getElementById('user-input');
const sendBtn_chatbot = document.getElementById('send-btn');
const fileInput_chatbot = document.getElementById('file-btn');
const speakBtn_chatbot = document.getElementById('speak-btn');
const audioChk_chatbot = document.getElementById('audio-enable');
const typingIndicator_chatbot = document.getElementById('typing-indicator');

// State Variables
let currentThreadId_chatbot = null;
let currentThreadMessages_chatbot = [];
let allThreadsMetadata_chatbot = [];
let currentSelectedModel_chatbot = modelSelector_chatbot ? modelSelector_chatbot.value : 'gemini'; // Default to first option

// JoyPixels Configuration
if (window.joypixels) {
    joypixels.emojiSize = '64'; // Or '32', '128'
    joypixels.imagePathPNG = 'https://cdn.jsdelivr.net/npm/emoji-toolkit@8.0.0/extras/png/64/';
    joypixels.sprites = false;
    joypixels.emojiVersion = "latest";
} else {
    console.warn("Chatbot: JoyPixels library not found. Emojis might not render correctly.");
}

// Marked.js Configuration
if (window.marked) {
    marked.use({
        breaks: true,    // Convert GFM line breaks to <br>
        gfm: true,       // Enable GFM tables, strikethrough, etc.
        // sanitize: false // IMPORTANT: Set to true if you are concerned about XSS from bot responses.
                         // If true, you might need a sanitizer library like DOMPurify.
                         // For now, assuming bot responses are trusted or will be sanitized by other means.
    });
} else {
    console.warn("Chatbot: Marked.js library not found. Markdown rendering will be basic.");
}


// --- Event Listeners ---
if (newChatBtn_chatbot) newChatBtn_chatbot.addEventListener('click', startNewThread_chatbot);
if (modelSelector_chatbot) modelSelector_chatbot.addEventListener('change', handleModelSelectionChange_chatbot);
if (sendBtn_chatbot) sendBtn_chatbot.addEventListener('click', () => sendMessage_chatbot());
if (userInput_chatbot) {
    userInput_chatbot.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage_chatbot();
        }
    });
    userInput_chatbot.addEventListener('paste', handlePaste_chatbot); // Listener for pasting images
}
if (fileInput_chatbot) fileInput_chatbot.addEventListener('change', handleFileUpload_chatbot);
if (audioChk_chatbot) {
    audioChk_chatbot.addEventListener('change', () => {
        if (speakBtn_chatbot) speakBtn_chatbot.disabled = !audioChk_chatbot.checked;
        if (!audioChk_chatbot.checked && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    });
}


// --- Core Functions ---
function initializeApp_chatbot() {
    console.log("Chatbot: Initializing app for full page...");
    if (appWrapper_chatbot) appWrapper_chatbot.style.display = 'flex';

    // Set initial model display based on selector, if available
    if (modelSelector_chatbot && currentThreadModelEl_chatbot) {
        currentSelectedModel_chatbot = modelSelector_chatbot.value; // Ensure this is set
        const selectedOption = modelSelector_chatbot.options[modelSelector_chatbot.selectedIndex];
        currentThreadModelEl_chatbot.textContent = `(${(selectedOption ? selectedOption.text : currentSelectedModel_chatbot)})`;
    } else if (currentThreadModelEl_chatbot) {
         currentThreadModelEl_chatbot.textContent = `(${currentSelectedModel_chatbot})`; // Fallback
    }


    loadAndDisplayThreads_chatbot();
    setupSpeechRecognition_chatbot();
    if (speakBtn_chatbot && audioChk_chatbot) {
        speakBtn_chatbot.disabled = !audioChk_chatbot.checked;
    }
}

function loadAndDisplayThreads_chatbot() {
    showTypingIndicatorCustomText_chatbot('Loading conversations...');
    allThreadsMetadata_chatbot = JSON.parse(localStorage.getItem('nofriction_threads') || '[]');
    allThreadsMetadata_chatbot.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    renderThreadList_chatbot();

    const lastActiveId = localStorage.getItem('nofriction_last_active_thread_id');
    let threadToLoad = null;

    if (lastActiveId && allThreadsMetadata_chatbot.some(t => t.id === lastActiveId)) {
        if (localStorage.getItem(`nofriction_msgs_${lastActiveId}`)) {
            threadToLoad = lastActiveId;
        } else {
            console.warn(`Chatbot: Messages for last active thread ID ${lastActiveId} not found. Trying next available.`);
            localStorage.removeItem('nofriction_last_active_thread_id');
        }
    }

    if (!threadToLoad && allThreadsMetadata_chatbot.length > 0) {
        threadToLoad = allThreadsMetadata_chatbot[0].id;
    }

    if (threadToLoad) {
        loadThread_chatbot(threadToLoad);
    } else {
        startNewThread_chatbot();
    }
    hideTypingIndicator_chatbot();
}

function renderThreadList_chatbot() {
    if (!threadListEl_chatbot) return;
    threadListEl_chatbot.innerHTML = '';
    if (allThreadsMetadata_chatbot.length === 0) {
        threadListEl_chatbot.innerHTML = '<li class="no-threads-message">No conversations yet.</li>';
        return;
    }
    allThreadsMetadata_chatbot.forEach(t => {
        const li = document.createElement('li');
        li.dataset.threadId = t.id;
        li.className = t.id === currentThreadId_chatbot ? 'active-thread' : '';

        const threadInfoContainer = document.createElement('div');
        threadInfoContainer.className = 'thread-info-container'; // For better styling control
        
        // Attempt to get the display name of the model
        let modelDisplayName = t.model || "Default";
        if (modelSelector_chatbot && t.model) {
            const optionElement = Array.from(modelSelector_chatbot.options).find(opt => opt.value === t.model);
            if (optionElement) {
                modelDisplayName = optionElement.text;
            }
        }

        threadInfoContainer.innerHTML = `
            <span class="thread-title">${t.title || "Chat"}</span>
            <span class="thread-details">${modelDisplayName} | ${new Date(t.lastUpdated).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        `;
        threadInfoContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            loadThread_chatbot(t.id);
        });
        li.appendChild(threadInfoContainer);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-thread-btn';
        deleteBtn.innerHTML = '&#x1F5D1;'; // Unicode Trash Can Icon
        deleteBtn.title = `Delete conversation: "${t.title || "Chat"}"`;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeleteThread_chatbot(t.id, t.title || "Chat");
        });
        li.appendChild(deleteBtn);
        threadListEl_chatbot.appendChild(li);
    });
}

function confirmDeleteThread_chatbot(threadId, threadTitle) {
    // Replace window.confirm with a custom modal if desired for better UI
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
        if (msgsContainer_chatbot) {
            const messageElements = msgsContainer_chatbot.querySelectorAll('.message:not(#typing-indicator)');
            messageElements.forEach(el => el.remove());
        }

        if (allThreadsMetadata_chatbot.length > 0) {
            loadThread_chatbot(allThreadsMetadata_chatbot[0].id);
        } else {
            startNewThread_chatbot();
        }
    } else {
        renderThreadList_chatbot();
    }
}

function startNewThread_chatbot() {
    console.log("Chatbot: Starting new thread.");
    currentThreadId_chatbot = 't_' + Date.now() + Math.random().toString(16).slice(2);
    currentThreadMessages_chatbot = [];
    currentSelectedModel_chatbot = modelSelector_chatbot ? modelSelector_chatbot.value : 'gemini';

    const newThreadMeta = {
        id: currentThreadId_chatbot,
        title: 'New Conversation',
        lastUpdated: new Date().toISOString(),
        model: currentSelectedModel_chatbot
    };
    allThreadsMetadata_chatbot.unshift(newThreadMeta);
    allThreadsMetadata_chatbot.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    saveAllThreadsMetadata_chatbot();
    localStorage.setItem('nofriction_last_active_thread_id', currentThreadId_chatbot);

    renderThreadList_chatbot();
    renderMessages_chatbot(); // Clears old messages
    addInitialBotGreetingIfNeeded_chatbot();

    if (userInput_chatbot) userInput_chatbot.focus();
    if (currentThreadModelEl_chatbot && modelSelector_chatbot) {
        const selectedOption = modelSelector_chatbot.options[modelSelector_chatbot.selectedIndex];
        currentThreadModelEl_chatbot.textContent = `(${(selectedOption ? selectedOption.text : currentSelectedModel_chatbot)})`;
    }
    if (currentChatTitleEl_chatbot) currentChatTitleEl_chatbot.textContent = 'New Conversation';
    saveCurrentThreadMessages_chatbot();
}

function loadThread_chatbot(id) {
    console.log("Chatbot: Loading thread:", id);
    currentThreadId_chatbot = id;
    currentThreadMessages_chatbot = JSON.parse(localStorage.getItem(`nofriction_msgs_${id}`) || '[]');
    const meta = allThreadsMetadata_chatbot.find(t => t.id === id);

    if (meta) {
        currentSelectedModel_chatbot = meta.model;
        if (modelSelector_chatbot) modelSelector_chatbot.value = meta.model;
        if (currentThreadModelEl_chatbot && modelSelector_chatbot) {
             const selectedOption = Array.from(modelSelector_chatbot.options).find(opt => opt.value === meta.model);
             currentThreadModelEl_chatbot.textContent = `(${(selectedOption ? selectedOption.text : meta.model)})`;
        }
        if (currentChatTitleEl_chatbot) currentChatTitleEl_chatbot.textContent = meta.title || "Chat";
        localStorage.setItem('nofriction_last_active_thread_id', currentThreadId_chatbot);
    } else {
        console.warn("Chatbot: Meta not found for thread:", id, ". Attempting to recover or start new.");
        if (localStorage.getItem('nofriction_last_active_thread_id') === id) {
            localStorage.removeItem('nofriction_last_active_thread_id');
        }
        loadAndDisplayThreads_chatbot(); // This will try to load another thread or start new
        return;
    }
    renderThreadList_chatbot();
    renderMessages_chatbot();
    addInitialBotGreetingIfNeeded_chatbot();
    scrollToBottom_chatbot();
    if (userInput_chatbot) userInput_chatbot.focus();
}

function handleModelSelectionChange_chatbot(e) {
    currentSelectedModel_chatbot = e.target.value;
    if (currentThreadId_chatbot) {
        const activeThreadMeta = allThreadsMetadata_chatbot.find(t => t.id === currentThreadId_chatbot);
        if (activeThreadMeta) {
            activeThreadMeta.model = currentSelectedModel_chatbot;
            activeThreadMeta.lastUpdated = new Date().toISOString();
            saveAllThreadsMetadata_chatbot();
            renderThreadList_chatbot(); // Re-render to update model in thread list details
        }
    }
    if (currentThreadModelEl_chatbot && modelSelector_chatbot) {
         const selectedOption = modelSelector_chatbot.options[modelSelector_chatbot.selectedIndex];
         currentThreadModelEl_chatbot.textContent = `(${(selectedOption ? selectedOption.text : currentSelectedModel_chatbot)})`;
    }
}

function updateThreadMetadataOnInteraction_chatbot(isNewMessage, firstUserMsgContent = null) {
    if (!currentThreadId_chatbot) {
        console.warn("Chatbot: updateThreadMetadataOnInteraction called with no currentThreadId");
        return;
    }
    const meta = allThreadsMetadata_chatbot.find(t => t.id === currentThreadId_chatbot);
    if (meta) {
        meta.lastUpdated = new Date().toISOString();
        meta.model = currentSelectedModel_chatbot; // Ensure model is current
        if (isNewMessage && firstUserMsgContent && (meta.title === 'New Conversation' || meta.title === 'Chat')) {
            const newTitle = firstUserMsgContent.substring(0, 35) + (firstUserMsgContent.length > 35 ? '...' : '');
            meta.title = newTitle;
            if (currentChatTitleEl_chatbot) currentChatTitleEl_chatbot.textContent = newTitle;
        }
        allThreadsMetadata_chatbot.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)); // Re-sort
        saveAllThreadsMetadata_chatbot();
        renderThreadList_chatbot(); // Re-render list for order and potentially updated details
    } else {
        console.warn("Chatbot: Meta not found in updateThreadMetadataOnInteraction for ID:", currentThreadId_chatbot);
    }
}

function renderMessages_chatbot() {
    if (!msgsContainer_chatbot) return;
    const messageElements = msgsContainer_chatbot.querySelectorAll('.message:not(#typing-indicator)');
    messageElements.forEach(el => el.remove());
    currentThreadMessages_chatbot.forEach(m => appendMessageToDOM_chatbot(m));
    scrollToBottom_chatbot();
}

function appendMessageToDOM_chatbot(message) {
    if (!msgsContainer_chatbot || !typingIndicator_chatbot) return;
    const div = document.createElement('div');
    div.className = 'message ' + message.role;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    let htmlContent = message.content || "";
    if (window.marked) {
        try {
            htmlContent = marked.parse(htmlContent); // Marked already handles breaks with `breaks: true`
        } catch (e) {
            console.error("Chatbot: Error parsing markdown:", e);
            // Fallback to simple text with line breaks for safety
            htmlContent = (message.content || "").replace(/\n/g, '<br>');
        }
    } else {
        htmlContent = (message.content || "").replace(/\n/g, '<br>'); // Basic line break handling if marked.js is missing
    }

    if (window.joypixels) {
        htmlContent = joypixels.toImage(htmlContent); // Convert emoji shortcodes/unicode to images
    }

    contentDiv.innerHTML = htmlContent;
    div.appendChild(contentDiv);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.appendChild(timeSpan);

    msgsContainer_chatbot.insertBefore(div, typingIndicator_chatbot);
    scrollToBottom_chatbot();

    if (message.role === 'bot' && audioChk_chatbot && audioChk_chatbot.checked && message.content) {
        let textToSpeak = contentDiv.textContent || contentDiv.innerText || ""; // Get text content after HTML parsing
        if (window.joypixels) {
            // Convert emoji images back to unicode for speech synthesis if possible, or use shortnames
            textToSpeak = joypixels.shortnameToUnicode(joypixels.imageToShortname(textToSpeak));
        }
        speak_chatbot(textToSpeak.trim());
    }
}

async function sendMessage_chatbot() {
    if (!userInput_chatbot || !userInput_chatbot.value.trim()) {
        console.log("Chatbot: No text, returning from sendMessage.");
        return;
    }
    const txt = userInput_chatbot.value.trim();
    console.log("Chatbot: sendMessage function started. Input text:", `"${txt}"`);

    const userMessage = { role: 'user', content: txt, timestamp: new Date().toISOString() };
    currentThreadMessages_chatbot.push(userMessage);
    appendMessageToDOM_chatbot(userMessage);
    updateThreadMetadataOnInteraction_chatbot(true, txt);
    saveCurrentThreadMessages_chatbot();
    userInput_chatbot.value = ''; // Clear input after sending
    showTypingIndicatorDots_chatbot();

    const modelForAPI = currentSelectedModel_chatbot;
    
    // REVERTED: Send messages in the original {role, content} format.
    // N8N workflow is responsible for any transformations needed by specific AI APIs.
    const messagesForPayload = currentThreadMessages_chatbot.slice().filter(msg => {
        // Ensure content is a string and not just whitespace,
        // but allow empty strings if they are intentional (though unlikely for user/bot messages).
        // The main goal is to filter out null/undefined content.
        return typeof msg.content === 'string'; 
    });
    
    if (messagesForPayload.length === 0 && txt) { 
        // This case should ideally not be hit if userMessage was just pushed and txt is valid.
        // However, if filtering somehow removed all messages, log it.
        // The user message itself (txt) is the primary new content.
        console.warn(`Chatbot: [${modelForAPI} Debug] messagesForPayload is empty after filtering, but user input was present. Sending only user input as a single message history for safety.`);
        // This might be too simplistic. Ideally, the filter shouldn't make the array empty if userMessage was valid.
        // For now, we'll proceed with what the original script would have done: send currentThreadMessages_chatbot.
        // The filter above is just a safety for null/undefined content.
    }


    // Debugging Log for all models
    console.log(`Chatbot: [${modelForAPI} Debug] Preparing to send. Original format messagesForPayload:`, JSON.stringify(messagesForPayload, null, 2));
    

    const requestBody = JSON.stringify({
        messages: messagesForPayload, // Send in {role, content} format
        threadId: currentThreadId_chatbot,
        model: modelForAPI // Send the original model name selected by the user
    });
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
    };

    let errorContentForDisplay = null; // This will be shown to the user in UI
    let errorOccurred = false;

    try {
        const response = await fetch(CHAT_ENDPOINT_CHATBOT, requestOptions);
        console.log("Chatbot: Text Msg - Fetch response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Chatbot: Text Msg - API Error. Status:", response.status, "Raw Response Text:", errorText);
            errorContentForDisplay = `API Error (${response.status}): ${(errorText.substring(0, 200) || response.statusText)}...`;
            errorOccurred = true;
        } else {
            let jsonResponse;
            let rawResponseText = '';
            try {
                rawResponseText = await response.text();
                if (!rawResponseText) {
                    console.warn("Chatbot: Text Msg - Received empty response from server.");
                    errorContentForDisplay = 'Error: Received an empty response from the server.';
                    errorOccurred = true;
                } else {
                    jsonResponse = JSON.parse(rawResponseText);
                    console.log("Chatbot: Text Msg - API JSON Response:", jsonResponse);

                    if (typeof jsonResponse.reply !== 'string' || jsonResponse.reply.trim() === "") {
                        console.error("Chatbot: Text Msg - Received invalid, empty, or blank reply content in JSON.", jsonResponse);
                        errorContentForDisplay = 'Error: Server returned an invalid, empty, or blank reply.';
                        errorOccurred = true;
                    } else {
                        // Valid reply
                        const botMessage = { role: 'bot', content: jsonResponse.reply, timestamp: new Date().toISOString(), modelUsed: jsonResponse.modelUsed || modelForAPI };
                        currentThreadMessages_chatbot.push(botMessage); // Add successful bot reply to history (original format)
                        appendMessageToDOM_chatbot(botMessage);
                        saveCurrentThreadMessages_chatbot();
                    }
                }
            } catch (e) {
                console.error("Chatbot: Text Msg - Error parsing JSON response. Raw text was:", rawResponseText, "Error:", e);
                errorContentForDisplay = `Error: Invalid server response. Expected JSON, received: ${rawResponseText.substring(0, 200)}...`;
                errorOccurred = true;
            }
        }
    } catch (e) {
        console.error("Chatbot: Error in sendMessage_chatbot (network or other):", e);
        errorContentForDisplay = `Network or processing error: ${e.message}`;
        errorOccurred = true;
    } finally {
        hideTypingIndicator_chatbot();
        if (userInput_chatbot) userInput_chatbot.focus();
    }

    if (errorOccurred && errorContentForDisplay) {
        // Display the detailed error to the user for this turn
        const detailedErrorMessageForDisplay = { role: 'bot', content: errorContentForDisplay, timestamp: new Date().toISOString(), modelUsed: modelForAPI };
        appendMessageToDOM_chatbot(detailedErrorMessageForDisplay);

        // Add a GENERIC, safe error message to the actual conversation history (original format)
        const genericErrorMessageForHistory = { 
            role: 'bot', 
            content: "System: A backend error occurred. The previous request may not have been processed correctly.", 
            timestamp: new Date().toISOString(), 
            modelUsed: 'SystemError' 
        };
        currentThreadMessages_chatbot.push(genericErrorMessageForHistory);
        saveCurrentThreadMessages_chatbot(); 
    }
}


// --- File Handling (Upload Button and Paste) ---
async function uploadFile_chatbot(file, sourceMessagePrefix = "Uploaded") {
    if (!file) {
        console.warn("Chatbot: uploadFile_chatbot called with no file.");
        return;
    }

    const userMessageText = `${sourceMessagePrefix}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    const userMessage = { role: 'user', content: userMessageText, timestamp: new Date().toISOString() };
    
    currentThreadMessages_chatbot.push(userMessage);
    appendMessageToDOM_chatbot(userMessage);
    updateThreadMetadataOnInteraction_chatbot(true, userMessageText);
    saveCurrentThreadMessages_chatbot();
    showTypingIndicatorDots_chatbot();

    const formData = new FormData();
    formData.append('file', file);
    // For file uploads, the N8N webhook might expect model and threadId differently.
    // If it expects them as form fields:
    // formData.append('model', currentSelectedModel_chatbot);
    // formData.append('threadId', currentThreadId_chatbot);

    console.log(`Chatbot: File processing for ${file.name} (via ${sourceMessagePrefix}). Model: ${currentSelectedModel_chatbot}`);
    let errorContentForDisplay = null;
    let errorOccurred = false;

    try {
        const response = await fetch(CHAT_ENDPOINT_CHATBOT, { method: 'POST', body: formData });
        console.log(`Chatbot: File Op [${file.name}] - Fetch response status:`, response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Chatbot: File Op [${file.name}] - API Error. Status:`, response.status, "Raw Response Text:", errorText);
            errorContentForDisplay = `File Upload Error (${response.status}): ${(errorText.substring(0, 200) || response.statusText)}...`;
            errorOccurred = true;
        } else {
            let jsonResponse;
            let rawResponseText = '';
            try {
                rawResponseText = await response.text();
                if (!rawResponseText) {
                    console.warn(`Chatbot: File Op [${file.name}] - Received empty response from server.`);
                    errorContentForDisplay = 'Error: File Upload - Received an empty response from the server.';
                    errorOccurred = true;
                } else {
                    jsonResponse = JSON.parse(rawResponseText);
                    console.log(`Chatbot: File Op [${file.name}] - API JSON Response:`, jsonResponse);

                    if (typeof jsonResponse.reply !== 'string' || jsonResponse.reply.trim() === "") {
                        console.error(`Chatbot: File Op [${file.name}] - Received invalid, empty, or blank reply content in JSON.`, jsonResponse);
                        errorContentForDisplay = 'Error: File Upload - Server returned an invalid, empty, or blank reply.';
                        errorOccurred = true;
                    } else {
                        const botMessage = { role: 'bot', content: jsonResponse.reply, timestamp: new Date().toISOString(), modelUsed: jsonResponse.modelUsed || currentSelectedModel_chatbot };
                        currentThreadMessages_chatbot.push(botMessage);
                        appendMessageToDOM_chatbot(botMessage);
                        saveCurrentThreadMessages_chatbot();
                    }
                }
            } catch (e) {
                console.error(`Chatbot: File Op [${file.name}] - Error parsing JSON response. Raw text was:`, rawResponseText, "Error:", e);
                errorContentForDisplay = `Error: File Upload - Invalid server response. Expected JSON, received: ${rawResponseText.substring(0, 200)}...`;
                errorOccurred = true;
            }
        }
    } catch (e) {
        console.error(`Chatbot: Error in uploadFile_chatbot [${file.name}] (network or other):`, e);
        errorContentForDisplay = `Network or processing error during file upload: ${e.message}`;
        errorOccurred = true;
    } finally {
        hideTypingIndicator_chatbot();
        if (userInput_chatbot) userInput_chatbot.focus();
    }

    if (errorOccurred && errorContentForDisplay) {
        const detailedErrorMessageForDisplay = { role: 'bot', content: errorContentForDisplay, timestamp: new Date().toISOString(), modelUsed: currentSelectedModel_chatbot };
        appendMessageToDOM_chatbot(detailedErrorMessageForDisplay);

        const genericErrorMessageForHistory = { 
            role: 'bot', 
            content: "System: A file processing error occurred. The previous file may not have been processed correctly.", 
            timestamp: new Date().toISOString(), 
            modelUsed: 'SystemError'
        };
        currentThreadMessages_chatbot.push(genericErrorMessageForHistory);
        saveCurrentThreadMessages_chatbot();
    }
}

async function handleFileUpload_chatbot(ev) { // For the "Attach File" button
    if (!ev.target.files || ev.target.files.length === 0) return;
    const file = ev.target.files[0];
    await uploadFile_chatbot(file, "Uploaded file");
    ev.target.value = ''; // Clear the file input
}

function handlePaste_chatbot(event) { // For pasting images into the textarea
    const clipboardItems = (event.clipboardData || window.clipboardData)?.items;
    if (!clipboardItems) {
        console.log("Chatbot: No clipboard items found on paste.");
        return;
    }
    let imageFile = null;
    for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            imageFile = item.getAsFile();
            if (imageFile) break;
        }
    }

    if (imageFile) {
        event.preventDefault();
        let fileName = imageFile.name || `pasted_image.${imageFile.type.split('/')[1] || 'png'}`;
        fileName = fileName.replace(/[^a-zA-Z0-9_.\-]/g, '_'); // Basic sanitize
        const fileToUpload = new File([imageFile], fileName, { type: imageFile.type });
        console.log("Chatbot: Image pasted, initiating upload for:", fileToUpload.name);
        uploadFile_chatbot(fileToUpload, "Pasted image");
    } else {
        console.log("Chatbot: No image file found in pasted items. Allowing default text paste.");
    }
}


// --- Utility and UI Functions ---
function saveCurrentThreadMessages_chatbot() {
    if (currentThreadId_chatbot) {
        localStorage.setItem(`nofriction_msgs_${currentThreadId_chatbot}`, JSON.stringify(currentThreadMessages_chatbot));
    }
}
function saveAllThreadsMetadata_chatbot() {
    localStorage.setItem('nofriction_threads', JSON.stringify(allThreadsMetadata_chatbot));
}
function addInitialBotGreetingIfNeeded_chatbot() {
    if (currentThreadId_chatbot && currentThreadMessages_chatbot.length === 0) {
        const greeting = {
            role: 'bot',
            content: 'Hello! How can I assist you today?',
            timestamp: new Date().toISOString(),
            modelUsed: currentSelectedModel_chatbot
        };
        currentThreadMessages_chatbot.push(greeting);
        appendMessageToDOM_chatbot(greeting);
        // Don't save here, let the natural flow save after user interaction or thread load.
    }
}
function showTypingIndicatorDots_chatbot() {
    if (typingIndicator_chatbot) {
        typingIndicator_chatbot.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        typingIndicator_chatbot.style.display = 'flex';
        scrollToBottom_chatbot();
    }
}
function showTypingIndicatorCustomText_chatbot(text) {
    if (typingIndicator_chatbot) {
        typingIndicator_chatbot.innerHTML = `<span class="typing-text">${text}</span>`;
        typingIndicator_chatbot.style.display = 'flex';
        scrollToBottom_chatbot();
    }
}
function hideTypingIndicator_chatbot() {
    if (typingIndicator_chatbot) typingIndicator_chatbot.style.display = 'none';
}
function scrollToBottom_chatbot() {
    if (msgsContainer_chatbot) {
        // Using a small timeout can help ensure rendering is complete before scrolling
        setTimeout(() => {
            msgsContainer_chatbot.scrollTop = msgsContainer_chatbot.scrollHeight;
        }, 50);
    }
}
function addSystemMessage_chatbot(text) { // For internal system messages/errors
    const systemMessage = {
        role: 'bot', // Displayed as a bot message for consistency
        content: `ℹ️ System: ${text}`,
        timestamp: new Date().toISOString(),
        modelUsed: 'System'
    };
    appendMessageToDOM_chatbot(systemMessage);
}


// --- Speech Synthesis and Recognition ---
function setupSpeechRecognition_chatbot() {
    if (!speakBtn_chatbot) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        speakBtn_chatbot.style.display = 'none';
        console.warn("Chatbot: Speech Recognition not supported in this browser.");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US'; // Or make configurable
    recognition.interimResults = false; // We only want final results

    recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        if (userInput_chatbot) {
            userInput_chatbot.value += (transcript + ' ');
            userInput_chatbot.focus();
        }
    };
    recognition.onerror = event => {
        console.error("Chatbot: Speech recognition error:", event.error);
        addSystemMessage_chatbot("Speech error: " + event.error);
        speakBtn_chatbot.textContent = '🎤';
        speakBtn_chatbot.classList.remove('speaking');
    };
    recognition.onend = () => {
        speakBtn_chatbot.textContent = '🎤';
        speakBtn_chatbot.classList.remove('speaking');
        if (recognition.isStarted) recognition.isStarted = false; // Custom flag
    };
    recognition.onstart = () => { // Custom flag to track state
        recognition.isStarted = true;
    };

    speakBtn_chatbot.addEventListener('click', () => {
        if (speakBtn_chatbot.disabled || (recognition && recognition.isStarted)) {
            if (recognition && recognition.isStarted) recognition.stop();
            return;
        }
        try {
            recognition.start();
            speakBtn_chatbot.textContent = '🎙️'; // Or use a class for styling
            speakBtn_chatbot.classList.add('speaking');
        } catch (err) {
            console.error("Chatbot: Could not start speech recognition:", err);
            addSystemMessage_chatbot("Could not start speech recognition: " + err.message);
            speakBtn_chatbot.textContent = '🎤';
            speakBtn_chatbot.classList.remove('speaking');
        }
    });
}

function speak_chatbot(text) {
    if (!audioChk_chatbot || !audioChk_chatbot.checked || !text || !window.speechSynthesis) {
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    // Optional: Configure voice, rate, pitch
    // const voices = window.speechSynthesis.getVoices();
    // utterance.voice = voices.find(v => v.lang === 'en-US'); // Example
    // utterance.rate = 1.0;
    // utterance.pitch = 1.0;
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    window.speechSynthesis.speak(utterance);
}


// --- DOMContentLoaded: Initialize the App ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if essential elements are present before initializing
    if (!appWrapper_chatbot || !newChatBtn_chatbot || !modelSelector_chatbot || !msgsContainer_chatbot || !userInput_chatbot) {
        console.error("Chatbot: One or more critical DOM elements are missing. Chatbot may not function correctly. Check IDs in HTML.");
        // Optionally display an error message to the user on the page itself
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.textContent = "Error: Chatbot UI elements not found. Please check the console.";
            errorDiv.style.color = "red";
            errorDiv.style.padding = "20px";
            errorDiv.style.textAlign = "center";
            errorDiv.style.fontWeight = "bold";
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
        return; // Halt initialization
    }
    initializeApp_chatbot();
});
