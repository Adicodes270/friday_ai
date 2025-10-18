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

// State variables
let chatHistory = [];
let isGenerating = false;
let stopTyping = false;
let isRecording = false;
let isDarkMode = document.cookie.includes('theme=dark');
let recognition = null;
let abortController = null;

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
    newChatButton = document.getElementById('new-chat-button');
    themeToggleButton = document.getElementById('theme-toggle-button');

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

    // Initialize UI
    checkInput();
    updateTheme();
    adjustTextareaHeight();
});

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
async function downloadImage(imageUrl, filename = 'friday-ai-image.jpg') {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
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
        const imageUrl = URL.createObjectURL(blob);
        
        console.log('✓ AI image generated successfully');
        
        return {
            url: imageUrl,
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
        return userText; // Fallback to original prompt
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
    loadChatHistory();
}

/**
 * Toggles theme.
 */
function toggleTheme() {
    isDarkMode = !isDarkMode;
    setCookie('theme', isDarkMode ? 'dark' : 'light');
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
