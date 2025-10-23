/**
 * FRIDAY AI - Pure AI Image Generation
 * Uses Hugging Face FLUX API for AI-generated images only.
 * No web search - generates fresh images from prompts.
 */

/** @constant {string} Application ID */
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/** @constant {string} Google API key for Gemini (prompt enhancement) */
const apiKey = "AIzaSyCp5a4gbFYJm4l6_3XpDhsUVAL3CwJaV-8";
const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

/** @constant {string} Hugging Face API key */
const HUGGINGFACE_API_KEY = "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";

// DOM elements
let userPrompt;
let sendButton;
let micButton;
let stopButton;
let chatContainer;
let welcomeScreen;
let inputArea;
let newChatButton;
let themeToggleButton;
let homeButton;
let menuToggle;
let sidebar;
let globalSearch;
let newChatBtn;
let clearAllBtn;
let conversationsList;

// State variables
let chatHistory = [];
let isGenerating = false;
let stopTyping = false;
let isRecording = false;
let isDarkMode = localStorage.getItem('friday_image_theme') === 'dark';
let recognition = null;
let abortController = null;

// Conversation management
let conversations = JSON.parse(localStorage.getItem('friday_image_conversations')) || [];
let activeConversationId = localStorage.getItem('friday_image_active_conversation') || null;

/** @constant {object} SpeechRecognition API */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/** @constant {Array} Predefined response rules */
const responseRules = [
    {
        pattern: /\b(what'?s\s*(your|yr)\s*name|who\s*(are|r)\s*you|your\s*name)\b/i,
        response: "My name is FRIDAY AI, powered by the Gemini 2.5 API."
    },
    {
        pattern: /\b(who\s*(made|created|developed|built|trained|programmed)\s*(you|friday)|developers?|creators?|trainers?|google|built|trained)\b/i,
        response: "I was developed by Aditya and Vaidikdevsen, powered by the Gemini 2.5 API."
    },
    {
        pattern: /\b(is\s*(this|you|friday)\s*(a\s*company|company)|company\s*(behind|of)|employees)\b/i,
        response: "No, I'm not a company. I was created by Aditya and Vaidikdevsen, just the two of them, powered by the Gemini 2.5 API."
    }
];

/**
 * Initializes DOM elements and event listeners on page load.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    userPrompt = document.getElementById('user-prompt');
    sendButton = document.getElementById('send-button');
    micButton = document.getElementById('mic-button');
    stopButton = document.getElementById('stop-button');
    chatContainer = document.getElementById('chat-container');
    welcomeScreen = document.getElementById('welcome-screen');
    inputArea = document.getElementById('input-area');
    newChatButton = document.getElementById('newChat');
    themeToggleButton = document.getElementById('theme-toggle-button');
    homeButton = document.getElementById('home');
    menuToggle = document.getElementById('menu-toggle');
    sidebar = document.querySelector('.sidebar');
    globalSearch = document.getElementById('global-search');
    newChatBtn = document.getElementById('new-chat-btn');
    clearAllBtn = document.getElementById('clear-all-btn');
    conversationsList = document.getElementById('conversations-list');

    // Load or initialize chat history
    const savedHistory = localStorage.getItem('imageChatHistory');
    if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
        loadChatHistory();
    } else {
        chatHistory = [{
            role: 'model',
            parts: [{ text: "You are FRIDAY AI, a helpful AI assistant for generating images. Generate AI images based on user prompts." }]
        }];
        localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));
    }

    // Initialize conversations
    if (!activeConversationId && conversations.length === 0) {
        createConversation('New Chat');
    } else if (activeConversationId) {
        switchConversation(activeConversationId);
    }

    // Event listeners
    sendButton.addEventListener('click', () => sendMessage(userPrompt.value));
    userPrompt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(userPrompt.value);
        }
    });
    userPrompt.addEventListener('input', () => {
        adjustTextareaHeight();
        checkInput();
    });
    micButton.addEventListener('click', handleMicClick);
    stopButton.addEventListener('click', stopResponse);
    newChatButton.addEventListener('click', newChat);
    themeToggleButton.addEventListener('click', toggleTheme);

    // Home button - navigate to index.html
    if (homeButton) {
        homeButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Sidebar functionality
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            document.body.classList.toggle('sidebar-open');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (
                sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                !menuToggle.contains(e.target)
            ) {
                sidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }

    // Search functionality
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            renderConversations(e.target.value);
        });
    }

    // New chat button in sidebar
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => createConversation('New Image Chat'));
    }

    // Clear all button in sidebar
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => deleteAllConversations());
    }

    // Quick prompts
    initQuickPrompts();

    // Initialize UI
    checkInput();
    updateTheme();
    adjustTextareaHeight();
    renderConversations();
});

/**
 * Generates a unique conversation ID
 */
function generateId() {
    return 'img-convo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * Saves conversations to localStorage
 */
function saveConversations() {
    localStorage.setItem('friday_image_conversations', JSON.stringify(conversations));
    localStorage.setItem('friday_image_active_conversation', activeConversationId);
}

/**
 * Creates a new conversation
 */
function createConversation(title = 'New Image Chat') {
    const newConvo = {
        id: generateId(),
        title,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    conversations.unshift(newConvo);
    activeConversationId = newConvo.id;
    saveConversations();
    renderConversations();
}

/**
 * Deletes a conversation
 */
function deleteConversation(id) {
    conversations = conversations.filter(c => c.id !== id);
    if (activeConversationId === id) {
        activeConversationId = conversations[0]?.id || null;
    }
    saveConversations();
    renderConversations();
    if (activeConversationId) {
        switchConversation(activeConversationId);
    } else {
        newChat();
    }
}

/**
 * Creates a custom modal dialog
 */
function createModal(options) {
    const { title, message, type = 'confirm', defaultValue = '', onConfirm, onCancel } = options;
    
    // Remove any existing modals
    const existingModal = document.querySelector('.custom-modal-overlay');
    if (existingModal) existingModal.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
        <div class="custom-modal">
            <div class="custom-modal-header">
                <h3>${title}</h3>
            </div>
            <div class="custom-modal-body">
                <p>${message}</p>
                ${type === 'prompt' ? `<input type="text" class="custom-modal-input" value="${defaultValue}" placeholder="Enter text...">` : ''}
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn cancel-btn">Cancel</button>
                <button class="custom-modal-btn confirm-btn">${type === 'alert' ? 'OK' : 'Confirm'}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const modal = overlay.querySelector('.custom-modal');
    const input = overlay.querySelector('.custom-modal-input');
    const confirmBtn = overlay.querySelector('.confirm-btn');
    const cancelBtn = overlay.querySelector('.cancel-btn');
    
    // Focus input if prompt type
    if (input) {
        input.focus();
        input.select();
    }
    
    // Animate in
    setTimeout(() => {
        overlay.classList.add('active');
        modal.classList.add('active');
    }, 10);
    
    const closeModal = (confirmed = false) => {
        overlay.classList.remove('active');
        modal.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        
        if (confirmed && onConfirm) {
            if (type === 'prompt' && input) {
                onConfirm(input.value.trim());
            } else {
                onConfirm();
            }
        } else if (!confirmed && onCancel) {
            onCancel();
        }
    };
    
    confirmBtn.addEventListener('click', () => closeModal(true));
    cancelBtn.addEventListener('click', () => closeModal(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(false);
    });
    
    // Handle Enter key
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') closeModal(true);
            if (e.key === 'Escape') closeModal(false);
        });
    }
    
    // Handle Escape key
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal(false);
            document.removeEventListener('keydown', escHandler);
        }
    });
}

/**
 * Deletes all conversations
 */
function deleteAllConversations() {
    createModal({
        title: 'Delete All Conversations',
        message: 'Are you sure you want to delete all image generation conversations? This action cannot be undone.',
        type: 'confirm',
        onConfirm: () => {
            conversations = [];
            activeConversationId = null;
            saveConversations();
            renderConversations();
            newChat();
        }
    });
}

/**
 * Renames a conversation
 */
function renameConversation(id) {
    const convo = conversations.find(c => c.id === id);
    if (!convo) return;
    
    createModal({
        title: 'Rename Conversation',
        message: 'Enter a new name for this conversation:',
        type: 'prompt',
        defaultValue: convo.title,
        onConfirm: (newTitle) => {
            if (newTitle) {
                convo.title = newTitle;
                convo.updatedAt = Date.now();
                saveConversations();
                renderConversations();
            }
        }
    });
}

/**
 * Switches to a different conversation
 */
function switchConversation(id) {
    activeConversationId = id;
    saveConversations();
    renderConversations();
    const convo = conversations.find(c => c.id === id);
    if (convo) {
        chatHistory = convo.messages.length > 0
            ? convo.messages
            : [{
                role: 'model',
                parts: [{ text: "You are FRIDAY AI, a helpful AI assistant for generating images." }]
            }];
        localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));
        loadChatHistory();
    }
}

/**
 * Saves a message to the active conversation
 */
function saveMessageToConversation(role, text) {
    const convo = conversations.find(c => c.id === activeConversationId);
    if (!convo) return;
    convo.messages.push({ role, parts: [{ text }] });
    convo.updatedAt = Date.now();
    saveConversations();
}

/**
 * Renders the conversations list
 */
function renderConversations(filter = '') {
    if (!conversationsList) return;

    conversationsList.innerHTML = '';

    const filtered = filter
        ? conversations.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
        : conversations;

    filtered.forEach(convo => {
        const div = document.createElement('div');
        div.className = 'conversation-item' + (convo.id === activeConversationId ? ' active' : '');
        div.innerHTML = `
            <div class="conversation-title">
                <span>${convo.title}</span>
                <div class="conversation-actions" style="display: flex; gap: 0.25rem;">
                    <button class="icon-btn small" data-action="rename" title="Rename" style="width: 1.5rem; height: 1.5rem; font-size: 0.7rem;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn small" data-action="delete" title="Delete" style="width: 1.5rem; height: 1.5rem; font-size: 0.7rem;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="conversation-meta">
                ${convo.messages.length} messages
            </div>
        `;

        div.addEventListener('click', e => {
            if (e.target.closest('.conversation-actions')) return;
            switchConversation(convo.id);
        });

        const renameBtn = div.querySelector('[data-action="rename"]');
        const deleteBtn = div.querySelector('[data-action="delete"]');

        if (renameBtn) {
            renameBtn.addEventListener('click', e => {
                e.stopPropagation();
                renameConversation(convo.id);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', e => {
                e.stopPropagation();
                deleteConversation(convo.id);
            });
        }

        conversationsList.appendChild(div);
    });
}

/**
 * Initializes quick prompt buttons
 */
function initQuickPrompts() {
    const quickPromptButtons = document.querySelectorAll('.quick-prompt-btn');
    quickPromptButtons.forEach(btn => {
        const promptText = btn.dataset.prompt || btn.textContent.trim();
        btn.addEventListener('click', () => handleQuickPromptClick(promptText));
        btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleQuickPromptClick(promptText);
            }
        });
    });
}

/**
 * Handles quick prompt button clicks
 */
function handleQuickPromptClick(promptText) {
    if (!promptText) return;
    if (!activeConversationId) createConversation('New Image Chat');
    userPrompt.value = promptText + ': ';
    adjustTextareaHeight();
    userPrompt.focus();
}

/**
 * Sets a cookie.
 */
function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

/**
 * Sanitizes user input to prevent XSS.
 */
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

/**
 * Checks if the input field has content and enables/disables the send button.
 */
function checkInput() {
    const hasContent = userPrompt.value.trim().length > 0;
    sendButton.disabled = !hasContent || isGenerating;
    sendButton.classList.toggle('enabled', hasContent && !isGenerating);
}

/**
 * Adjusts the textarea height based on content.
 */
function adjustTextareaHeight() {
    userPrompt.style.height = 'auto';
    const newHeight = Math.min(userPrompt.scrollHeight, 200);
    userPrompt.style.height = `${newHeight}px`;
}

/**
 * Typing animation for AI responses.
 */
async function typeStream(contentDiv, text) {
    let index = 0;
    const speed = 5;

    while (index < text.length && !stopTyping) {
        contentDiv.textContent += text[index];
        index++;
        scrollToBottom();
        await new Promise(resolve => setTimeout(resolve, speed));
    }

    if (stopTyping) {
        contentDiv.textContent = text;
        stopTyping = false;
    }
    scrollToBottom();
}

/**
 * Scrolls the chat container to the bottom.
 */
function scrollToBottom() {
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    if (isNearBottom) {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

/**
 * Downloads an image with proper filename.
 */
/**
 * Downloads an image with proper filename.
 */
async function downloadImage(imageUrl, filename = 'friday-ai-image.jpg') {
    try {
        let blob;
        if (imageUrl.startsWith('data:')) {
            // Handle base64 URL
            const response = await fetch(imageUrl);
            blob = await response.blob();
        } else {
            // Handle regular URL (for backward compatibility or other cases)
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('Failed to fetch image');
            blob = await response.blob();
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.warn('Download failed:', error);
        // Fallback to opening the image in a new tab
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
    }
}
/**
 * Adds a message to the chat container.
 */
function addMessage(content, role, skipTyping = false) {
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
        welcomeScreen = null;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const messageBox = document.createElement('div');
    messageBox.className = 'message-box';

    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'You' : 'FRIDAY AI';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (skipTyping) {
        contentDiv.innerHTML = content;
    } else {
        contentDiv.textContent = '';
    }

    messageBox.appendChild(label);
    messageBox.appendChild(contentDiv);

    if (role === 'model') {
        const isImage = content.startsWith('<img') || content.includes('<img');
        
        // Copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-btn';
        copyButton.innerHTML = '<i class="fa-regular fa-copy"></i>';
        copyButton.title = isImage ? 'Copy Image URL' : 'Copy Response';
        copyButton.setAttribute('aria-label', isImage ? 'Copy image URL' : 'Copy AI response');
        copyButton.addEventListener('click', () => {
            const textToCopy = isImage ? contentDiv.querySelector('img').src : contentDiv.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.classList.add('copied');
                copyButton.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.innerHTML = '<i class="fa-regular fa-copy"></i>';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        });
        messageBox.appendChild(copyButton);

        // Download button for images
        if (isImage) {
            const downloadButton = document.createElement('button');
            downloadButton.className = 'download-btn';
            downloadButton.innerHTML = '<i class="fa-solid fa-download"></i>';
            downloadButton.title = 'Download Image';
            downloadButton.setAttribute('aria-label', 'Download image');
            downloadButton.addEventListener('click', async () => {
                const img = contentDiv.querySelector('img');
                if (img) {
                    downloadButton.classList.add('downloading');
                    downloadButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    
                    const success = await downloadImage(img.src);
                    
                    if (success) {
                        downloadButton.classList.remove('downloading');
                        downloadButton.classList.add('downloaded');
                        downloadButton.innerHTML = '<i class="fa-solid fa-check"></i>';
                        setTimeout(() => {
                            downloadButton.classList.remove('downloaded');
                            downloadButton.innerHTML = '<i class="fa-solid fa-download"></i>';
                        }, 2000);
                    } else {
                        downloadButton.classList.remove('downloading');
                        downloadButton.innerHTML = '<i class="fa-solid fa-download"></i>';
                    }
                }
            });
            messageBox.appendChild(downloadButton);
        }
    }

    messageDiv.appendChild(messageBox);
    chatContainer.appendChild(messageDiv);
    
    scrollToBottom();
    
    return { contentDiv, skipTyping };
}

/**
 * Adds a typing indicator to the chat container.
 */
function addTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message model typing-indicator-wrapper';
    messageDiv.setAttribute('aria-live', 'polite');
    messageDiv.setAttribute('aria-label', 'FRIDAY AI is generating');
    
    const messageBox = document.createElement('div');
    messageBox.className = 'message-box';
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'FRIDAY AI';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    messageBox.appendChild(label);
    messageBox.appendChild(indicator);
    messageDiv.appendChild(messageBox);
    chatContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

/**
 * Loads chat history from localStorage.
 */
function loadChatHistory() {
    chatContainer.innerHTML = '';
    if (chatHistory.length === 1 && chatHistory[0].role === 'model' && chatHistory[0].parts[0].text.includes("FRIDAY AI")) {
        if (welcomeScreen) {
            chatContainer.appendChild(welcomeScreen);
            welcomeScreen.style.display = 'flex';
        }
    } else {
        chatHistory.forEach(message => {
            if (message.role === 'user' || (message.role === 'model' && !message.parts[0].text.includes("You are FRIDAY AI"))) {
                addMessage(message.parts[0].text, message.role, true);
            }
        });
    }
    scrollToBottom();
}
/**
 * Generates AI image using Hugging Face FLUX API.
 */
/**
 * Generates AI image using Hugging Face FLUX API.
 */
async function generateAIImage(prompt, signal) {
    try {
        console.log('Generating AI image with FLUX for prompt:', prompt);
        
        const response = await fetch(
            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: prompt }),
                signal
            }
        );

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.status}`);
        }

        const blob = await response.blob();
        // Convert blob to base64
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
        
        console.log('✓ AI image generated successfully');
        
        return {
            url: base64, // Return base64 string instead of Blob URL
            source: 'FLUX.1 AI',
            generated: true
        };
    } catch (error) {
        console.error('Hugging Face FLUX error:', error);
        return null;
    }
}

/**
 * Refines prompt for AI image generation using Gemini.
 */
async function refineAIPrompt(userText, signal) {
    try {
        const systemPrompt = "Create a detailed, descriptive prompt for AI image generation. Include: subject details, style (e.g., photorealistic, artistic, cinematic), lighting (natural, studio, dramatic), composition, colors, mood, camera angle, and quality descriptors (high quality, detailed, sharp, 8k). Be specific and vivid. Return only the enhanced prompt, no extra text.";

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'model', parts: [{ text: systemPrompt }] },
                    { role: 'user', parts: [{ text: userText }] }
                ]
            }),
            signal
        });

        if (!response.ok) {
            throw new Error(`Gemini error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.warn('Prompt refinement failed, using original:', error);
        return userText;
    }
}

/**
 * Sends a message and generates an AI image.
 */
async function sendMessage(prompt) {
    const userText = prompt.trim();
    if (!userText) return;

    isGenerating = true;
    stopTyping = false;
    stopButton.disabled = false;
    stopButton.classList.add('enabled');

    addMessage(sanitizeInput(userText), 'user', true);
    saveMessageToConversation('user', userText);
    userPrompt.value = '';
    adjustTextareaHeight();
    checkInput();

    chatHistory.push({ role: 'user', parts: [{ text: userText }] });
    localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));

    const typingIndicator = addTypingIndicator();

    abortController = new AbortController();
    const signal = abortController.signal;

    try {
        // Check for predefined responses
        const matchedRule = responseRules.find(rule => rule.pattern.test(userText));
        if (matchedRule) {
            const aiResponse = matchedRule.response;
            chatHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));
            saveMessageToConversation('model', aiResponse);
            typingIndicator.remove();
            const { contentDiv } = addMessage('', 'model', false);
            await typeStream(contentDiv, aiResponse);
            return;
        }

        // Refine the prompt using Gemini
        console.log('→ Refining prompt with Gemini...');
        const enhancedPrompt = await refineAIPrompt(userText, signal);
        console.log('Enhanced prompt:', enhancedPrompt);

        // Generate AI image
        console.log('→ Generating AI image...');
        const imageData = await generateAIImage(enhancedPrompt, signal);

        // Display result
        if (imageData) {
    const aiResponse = `
        <img src="${imageData.url}" alt="${sanitizeInput(userText)}" style="max-width: 100%; border-radius: 8px;" loading="lazy">
        <p style="font-size: 0.8em; color: #888; margin-top: 8px;">Generated by ${imageData.source}</p>
    `;

    chatHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
    localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));
    saveMessageToConversation('model', aiResponse);
    typingIndicator.remove();
    addMessage(aiResponse, 'model', true);
} else {
            throw new Error('Failed to generate image. Please try again or rephrase your prompt.');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Request aborted');
            typingIndicator.remove();
            return;
        }
        console.error('Error generating image:', error);
        typingIndicator.remove();
        const errorMessage = `Sorry, I couldn't generate an image. ${error.message}`;
        addMessage(errorMessage, 'model', true);
        chatHistory.push({ role: 'model', parts: [{ text: errorMessage }] });
        localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));
        saveMessageToConversation('model', errorMessage);
    } finally {
        isGenerating = false;
        stopButton.disabled = true;
        stopButton.classList.remove('enabled');
        abortController = null;
    }
}

/**
 * Handles microphone click for speech recognition.
 */
function handleMicClick() {
    if (!SpeechRecognition) {
        alert('Speech recognition is not supported in this browser.');
        return;
    }

    if (!isRecording) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isRecording = true;
            micButton.classList.add('recording');
            micButton.setAttribute('aria-label', 'Stop speech recognition');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userPrompt.value = transcript;
            checkInput();
            sendMessage(transcript);
        };

        recognition.onend = () => {
            isRecording = false;
            micButton.classList.remove('recording');
            micButton.setAttribute('aria-label', 'Activate speech recognition');
            recognition = null;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            micButton.classList.remove('recording');
            micButton.setAttribute('aria-label', 'Activate speech recognition');
            alert(`Speech recognition error: ${event.error}`);
            recognition = null;
        };

        recognition.start();
    } else {
        if (recognition) {
            recognition.stop();
        }
    }
}

/**
 * Stops the ongoing response.
 */
function stopResponse() {
    stopTyping = true;
    isGenerating = false;
    stopButton.disabled = true;
    stopButton.classList.remove('enabled');
    if (abortController) {
        abortController.abort();
    }
    const typingIndicator = chatContainer.querySelector('.typing-indicator-wrapper');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

/**
 * Resets chat history.
 */
function newChat() {
    chatHistory = [{
        role: 'model',
        parts: [{ text: "You are FRIDAY AI, a helpful AI assistant for generating images." }]
    }];
    localStorage.setItem('imageChatHistory', JSON.stringify(chatHistory));
    createConversation('New Image Chat');
    loadChatHistory();
}

/**
 * Toggles theme.
 */
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('friday_image_theme', isDarkMode ? 'dark' : 'light');
    updateTheme();
}

/**
 * Updates the theme.
 */
function updateTheme() {
    document.body.classList.toggle('dark-mode', isDarkMode);
    const icon = themeToggleButton.querySelector('i');
    icon.className = isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    themeToggleButton.setAttribute('aria-label', isDarkMode ? 'Switch to light mode' : 'Switch to dark mode');
}
