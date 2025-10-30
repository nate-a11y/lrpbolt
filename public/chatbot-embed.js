/**
 * Lake Ride Pros Chatbot Widget - Standalone Embed Script
 * No dependencies, works on any website
 *
 * Usage:
 * <script>
 *   window.lrpChatbotConfig = { apiUrl: 'https://your-firebase-app.web.app' };
 * </script>
 * <script src="https://your-firebase-app.web.app/chatbot-embed.js"></script>
 */

(function() {
  'use strict';

  // Get configuration
  const config = window.lrpChatbotConfig || {};
  const apiUrl = config.apiUrl || window.location.origin;

  // State
  let chatbotSettings = null;
  let isOpen = false;
  let messages = [];
  let isLoading = false;

  // DOM elements (will be created)
  let widget = null;
  let chatWindow = null;
  let messagesContainer = null;
  let inputField = null;

  /**
   * Fetch chatbot configuration from API
   */
  async function fetchConfig() {
    try {
      const response = await fetch(`${apiUrl}/chatbotConfig`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chatbot config');
      }

      const data = await response.json();
      return data.config;
    } catch (error) {
      console.error('Chatbot config error:', error);
      return null;
    }
  }

  /**
   * Send message to chatbot API
   */
  async function sendMessage(message) {
    try {
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${apiUrl}/chatbotQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get chatbot response');
      }

      const data = await response.json();
      return data; // Return full response object
    } catch (error) {
      console.error('Chatbot query error:', error);
      throw error;
    }
  }

  /**
   * Show booking success banner with booking ID
   */
  function showBookingSuccess(bookingId) {
    const successBanner = document.createElement('div');
    successBanner.className = 'lrp-booking-success';
    successBanner.innerHTML = `
      <div class="lrp-success-icon">✅</div>
      <div class="lrp-success-content">
        <div class="lrp-success-title">Booking Request Sent!</div>
        <div class="lrp-success-subtitle">We'll text you within 24 hours</div>
        <div class="lrp-booking-ref">Reference: ${escapeHtml(bookingId)}</div>
      </div>
    `;

    messagesContainer.appendChild(successBanner);
    scrollToBottom();
  }

  /**
   * Show options after successful booking
   */
  function showPostBookingOptions() {
    const settings = chatbotSettings;
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'lrp-post-booking-options';
    optionsDiv.innerHTML = `
      <div class="lrp-options-title">Need anything else?</div>
      <div class="lrp-options-buttons">
        <button class="lrp-option-button lrp-option-primary" onclick="window.location.reload()">
          📅 Book Another Ride
        </button>
        <button class="lrp-option-button lrp-option-secondary" onclick="window.open('${settings.facebookPageUrl || 'https://m.me/lakeridepros'}', '_blank')">
          💬 Chat on Messenger
        </button>
      </div>
    `;

    messagesContainer.appendChild(optionsDiv);
    scrollToBottom();
  }

  /**
   * Show Messenger escalation prompt
   */
  function showMessengerEscalation(messengerUrl, reason, escalationId) {
    let reasonText = '';
    switch(reason) {
      case 'user_trigger':
        reasonText = 'Let me connect you with our team';
        break;
      case 'mentioned_price':
        reasonText = 'Our team can give you exact pricing';
        break;
      case 'claimed_availability':
        reasonText = 'Our team can check availability for you';
        break;
      case 'error':
        reasonText = 'Let me connect you with our team';
        break;
      default:
        reasonText = 'Our team can help you with this';
    }

    const escalationDiv = document.createElement('div');
    escalationDiv.className = 'lrp-escalation-prompt';
    escalationDiv.innerHTML = `
      <div class="lrp-escalation-content">
        <div class="lrp-escalation-icon">💬</div>
        <div class="lrp-escalation-text">
          <div class="lrp-escalation-title">${reasonText}</div>
          <div class="lrp-escalation-subtitle">Continue this conversation on Messenger</div>
          ${escalationId ? `<div class="lrp-escalation-ref">Ref: ${escapeHtml(escalationId)}</div>` : ''}
        </div>
      </div>
      <button class="lrp-escalation-button" onclick="window.open('${messengerUrl || 'https://m.me/lakeridepros'}', '_blank')">
        Open Messenger →
      </button>
    `;

    messagesContainer.appendChild(escalationDiv);
    scrollToBottom();
  }

  /**
   * Create and inject styles
   */
  function injectStyles() {
    const styles = `
      .lrp-chatbot-widget {
        position: fixed;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .lrp-chatbot-fab {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }

      .lrp-chatbot-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
      }

      .lrp-chatbot-fab svg {
        width: 24px;
        height: 24px;
        fill: white;
      }

      .lrp-chatbot-window {
        position: fixed;
        width: 380px;
        height: 600px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 100px);
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s ease;
        transform-origin: bottom right;
      }

      /* Mobile keyboard handling - iOS safe areas */
      @supports (padding: env(safe-area-inset-bottom)) {
        .lrp-chatbot-window {
          padding-bottom: env(safe-area-inset-bottom);
        }
      }

      .lrp-chatbot-window.hidden {
        opacity: 0;
        transform: scale(0);
        pointer-events: none;
      }

      .lrp-chatbot-header {
        padding: 16px;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .lrp-chatbot-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .lrp-chatbot-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .lrp-chatbot-avatar svg {
        width: 20px;
        height: 20px;
        fill: white;
      }

      .lrp-chatbot-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .lrp-chatbot-header p {
        margin: 0;
        font-size: 12px;
        opacity: 0.9;
      }

      .lrp-chatbot-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .lrp-chatbot-close svg {
        width: 20px;
        height: 20px;
        fill: white;
      }

      .lrp-chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f5f5f5;
      }

      .lrp-chatbot-message {
        margin-bottom: 16px;
        display: flex;
        gap: 8px;
      }

      .lrp-chatbot-message.user {
        flex-direction: row-reverse;
      }

      .lrp-chatbot-message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .lrp-chatbot-message-avatar svg {
        width: 16px;
        height: 16px;
      }

      .lrp-chatbot-message-content {
        max-width: 70%;
        padding: 12px;
        border-radius: 12px;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .lrp-chatbot-message.user .lrp-chatbot-message-content {
        color: white;
      }

      .lrp-chatbot-message.assistant .lrp-chatbot-message-content {
        background: white;
        color: #333;
      }

      .lrp-chatbot-quick-actions {
        padding: 0 16px 16px;
        background: #f5f5f5;
      }

      .lrp-chatbot-quick-actions p {
        margin: 0 0 8px;
        font-size: 12px;
        color: #666;
      }

      .lrp-chatbot-quick-action {
        width: 100%;
        padding: 10px;
        margin-bottom: 8px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }

      .lrp-chatbot-quick-action:hover {
        border-color: currentColor;
        background: rgba(0, 0, 0, 0.05);
      }

      .lrp-chatbot-quick-action svg {
        width: 16px;
        height: 16px;
      }

      .lrp-chatbot-input-area {
        padding: 16px;
        background: white;
        border-top: 1px solid #e0e0e0;
      }

      .lrp-chatbot-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .lrp-chatbot-action-btn {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
      }

      .lrp-chatbot-action-btn:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .lrp-chatbot-action-btn svg {
        width: 18px;
        height: 18px;
      }

      .lrp-chatbot-input-row {
        display: flex;
        gap: 8px;
      }

      .lrp-chatbot-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        resize: none;
        outline: none;
      }

      .lrp-chatbot-input:focus {
        border-color: currentColor;
      }

      .lrp-chatbot-send {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .lrp-chatbot-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .lrp-chatbot-send svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      .lrp-chatbot-loading {
        display: flex;
        gap: 4px;
        padding: 12px;
      }

      .lrp-chatbot-loading span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        animation: lrp-bounce 1.4s infinite ease-in-out both;
      }

      .lrp-chatbot-loading span:nth-child(1) { animation-delay: -0.32s; }
      .lrp-chatbot-loading span:nth-child(2) { animation-delay: -0.16s; }

      @keyframes lrp-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      /* Booking Success Banner */
      .lrp-booking-success {
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
        border: 2px solid #28a745;
        border-radius: 12px;
        padding: 16px;
        margin: 12px 0;
        animation: lrp-slideIn 0.3s ease-out;
      }

      .lrp-success-icon {
        font-size: 32px;
        animation: lrp-bounce-icon 0.6s ease-out;
      }

      .lrp-success-content {
        flex: 1;
      }

      .lrp-success-title {
        color: #155724;
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .lrp-success-subtitle {
        color: #155724;
        font-size: 14px;
        margin-bottom: 6px;
      }

      .lrp-booking-ref {
        font-size: 11px;
        color: #155724;
        opacity: 0.8;
        font-family: 'Courier New', monospace;
        background: rgba(255, 255, 255, 0.5);
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-block;
      }

      /* Post-Booking Options */
      .lrp-post-booking-options {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        text-align: center;
      }

      .lrp-options-title {
        font-size: 14px;
        color: #666;
        margin-bottom: 12px;
        font-weight: 500;
      }

      .lrp-options-buttons {
        display: flex;
        gap: 8px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .lrp-option-button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .lrp-option-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }

      .lrp-option-primary {
        background: #4CAF50;
        color: white;
      }

      .lrp-option-primary:hover {
        background: #45a049;
      }

      .lrp-option-secondary {
        background: #2196F3;
        color: white;
      }

      .lrp-option-secondary:hover {
        background: #1976D2;
      }

      /* Messenger Escalation */
      .lrp-escalation-prompt {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        border: 2px solid #2196F3;
        border-radius: 12px;
        padding: 16px;
        margin: 12px 0;
        animation: lrp-slideIn 0.3s ease-out;
      }

      .lrp-escalation-content {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .lrp-escalation-icon {
        font-size: 32px;
      }

      .lrp-escalation-text {
        flex: 1;
      }

      .lrp-escalation-title {
        color: #0d47a1;
        font-size: 15px;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .lrp-escalation-subtitle {
        color: #1565c0;
        font-size: 13px;
      }

      .lrp-escalation-ref {
        font-size: 10px;
        color: #1565c0;
        opacity: 0.7;
        font-family: 'Courier New', monospace;
        margin-top: 4px;
      }

      .lrp-escalation-button {
        width: 100%;
        padding: 12px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .lrp-escalation-button:hover {
        background: #1976D2;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(33, 150, 243, 0.3);
      }

      /* Animations */
      @keyframes lrp-slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes lrp-bounce-icon {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.1);
        }
      }

      @media (max-width: 640px) {
        .lrp-chatbot-window {
          width: calc(100vw - 32px);
          height: calc(100vh - 100px);
          /* Use dvh (dynamic viewport height) if supported - accounts for keyboard */
          height: calc(100dvh - 100px);
          max-height: calc(100dvh - 100px);
          bottom: 80px;
        }

        /* When keyboard is visible, adjust positioning */
        .lrp-chatbot-window.keyboard-visible {
          height: calc(50vh);
          max-height: calc(50vh);
          bottom: 10px;
        }

        .lrp-chatbot-messages {
          /* Ensure messages can scroll independently */
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .lrp-options-buttons {
          flex-direction: column;
        }

        .lrp-option-button {
          width: 100%;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  /**
   * Create widget HTML
   */
  function createWidget() {
    const settings = chatbotSettings;
    const primaryColor = settings.primaryColor || '#4CAF50';

    // Determine position
    let positionStyles = '';
    switch (settings.position) {
      case 'bottom-left':
        positionStyles = 'bottom: 24px; left: 24px;';
        break;
      case 'bottom-right':
        positionStyles = 'bottom: 24px; right: 24px;';
        break;
      case 'top-left':
        positionStyles = 'top: 24px; left: 24px;';
        break;
      case 'top-right':
        positionStyles = 'top: 24px; right: 24px;';
        break;
      default:
        positionStyles = 'bottom: 24px; right: 24px;';
    }

    widget = document.createElement('div');
    widget.className = 'lrp-chatbot-widget';
    widget.style.cssText = positionStyles;

    // Chat window
    chatWindow = document.createElement('div');
    chatWindow.className = 'lrp-chatbot-window hidden';
    chatWindow.innerHTML = `
      <div class="lrp-chatbot-header" style="background-color: ${primaryColor};">
        <div class="lrp-chatbot-header-info">
          <div class="lrp-chatbot-avatar">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          </div>
          <div>
            <h3>${settings.name || 'Johnny'}</h3>
            <p id="lrp-status">Online</p>
          </div>
        </div>
        <button class="lrp-chatbot-close" id="lrp-close">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
      <div class="lrp-chatbot-messages" id="lrp-messages"></div>
      <div class="lrp-chatbot-input-area">
        <div class="lrp-chatbot-actions">
          <button class="lrp-chatbot-action-btn" id="lrp-booking" style="color: ${primaryColor};" title="Book a ride online">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
          </button>
          <button class="lrp-chatbot-action-btn" id="lrp-messenger" style="color: ${primaryColor};" title="Chat on Messenger">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.14 2 11.25c0 2.92 1.45 5.53 3.71 7.24V22l3.38-1.85c.9.25 1.85.38 2.91.38 5.5 0 10-4.14 10-9.25S17.5 2 12 2zm1 12.5l-2.5-2.67L6 14.5l5.5-5.83L14 11.33 18.5 8.5 13 14.33z"/></svg>
          </button>
        </div>
        <div class="lrp-chatbot-input-row">
          <textarea
            class="lrp-chatbot-input"
            id="lrp-input"
            placeholder="${settings.placeholder || 'Type your question...'}"
            rows="1"
          ></textarea>
          <button class="lrp-chatbot-send" id="lrp-send" style="background-color: ${primaryColor};">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;

    // FAB button
    const fab = document.createElement('button');
    fab.className = 'lrp-chatbot-fab';
    fab.style.backgroundColor = primaryColor;
    fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
    fab.id = 'lrp-fab';

    widget.appendChild(chatWindow);
    widget.appendChild(fab);
    document.body.appendChild(widget);

    // Get references
    messagesContainer = document.getElementById('lrp-messages');
    inputField = document.getElementById('lrp-input');

    // Add event listeners
    document.getElementById('lrp-fab').addEventListener('click', toggleChat);
    document.getElementById('lrp-close').addEventListener('click', toggleChat);
    document.getElementById('lrp-send').addEventListener('click', handleSend);
    document.getElementById('lrp-booking').addEventListener('click', () => {
      window.open(settings.bookingUrl, '_blank');
    });
    document.getElementById('lrp-messenger').addEventListener('click', () => {
      window.open(settings.facebookPageUrl, '_blank');
    });

    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Add welcome message
    if (settings.welcomeMessage) {
      addMessage('assistant', settings.welcomeMessage, true);
    }
  }

  /**
   * Toggle chat window
   */
  function toggleChat() {
    isOpen = !isOpen;
    const fab = document.getElementById('lrp-fab');

    if (isOpen) {
      chatWindow.classList.remove('hidden');
      fab.style.display = 'none';
      inputField.focus();
    } else {
      chatWindow.classList.add('hidden');
      fab.style.display = 'flex';
    }
  }

  /**
   * Add message to chat
   */
  function addMessage(role, content, isWelcome = false) {
    const message = {
      id: isWelcome ? 'welcome' : `${role}-${Date.now()}`,
      role,
      content,
      timestamp: new Date().toISOString()
    };

    messages.push(message);
    renderMessage(message);
    scrollToBottom();
  }

  /**
   * Render a message in the chat
   */
  function renderMessage(message) {
    const settings = chatbotSettings;
    const primaryColor = settings.primaryColor || '#4CAF50';

    const messageEl = document.createElement('div');
    messageEl.className = `lrp-chatbot-message ${message.role}`;

    const avatarBg = message.role === 'user'
      ? primaryColor
      : `rgba(${hexToRgb(primaryColor)}, 0.15)`;

    const contentBg = message.role === 'user'
      ? primaryColor
      : 'white';

    const avatarIcon = message.role === 'user'
      ? '<svg viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
      : `<svg viewBox="0 0 24 24" fill="${primaryColor}"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

    messageEl.innerHTML = `
      <div class="lrp-chatbot-message-avatar" style="background-color: ${avatarBg};">
        ${avatarIcon}
      </div>
      <div class="lrp-chatbot-message-content" style="background-color: ${contentBg};">
        ${escapeHtml(message.content)}
      </div>
    `;

    messagesContainer.appendChild(messageEl);
  }

  /**
   * Show loading indicator
   */
  function showLoading() {
    const settings = chatbotSettings;
    const primaryColor = settings.primaryColor || '#4CAF50';

    const loadingEl = document.createElement('div');
    loadingEl.className = 'lrp-chatbot-message assistant';
    loadingEl.id = 'lrp-loading';
    loadingEl.innerHTML = `
      <div class="lrp-chatbot-message-avatar" style="background-color: rgba(${hexToRgb(primaryColor)}, 0.15);">
        <svg viewBox="0 0 24 24" fill="${primaryColor}"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      </div>
      <div class="lrp-chatbot-message-content" style="background-color: white;">
        <div class="lrp-chatbot-loading" style="color: ${primaryColor};">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(loadingEl);
    scrollToBottom();
  }

  /**
   * Hide loading indicator
   */
  function hideLoading() {
    const loadingEl = document.getElementById('lrp-loading');
    if (loadingEl) {
      loadingEl.remove();
    }
  }

  /**
   * Handle send message
   */
  async function handleSend() {
    const message = inputField.value.trim();
    if (!message || isLoading) return;

    // Add user message
    addMessage('user', message);
    inputField.value = '';

    // Update status and show loading
    isLoading = true;
    document.getElementById('lrp-status').textContent = 'Typing...';
    document.getElementById('lrp-send').disabled = true;
    showLoading();

    try {
      const data = await sendMessage(message);
      hideLoading();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add bot's text response
      if (data.reply) {
        addMessage('assistant', data.reply);
      }

      // Handle booking submission
      if (data.bookingSubmitted && data.bookingId) {
        showBookingSuccess(data.bookingId);
        showPostBookingOptions();

        // Optionally disable input after successful booking
        inputField.placeholder = 'Booking submitted! Reload to start another.';
        inputField.disabled = true;
        document.getElementById('lrp-send').disabled = true;
      }

      // Handle escalation to Messenger
      if (data.shouldEscalate) {
        showMessengerEscalation(data.messengerUrl, data.escalationReason, data.escalationId);
      }

    } catch (error) {
      hideLoading();
      addMessage('assistant', 'Sorry, something went wrong. Please try again or reach out on Messenger.');

      // Try to get messengerUrl from error response
      const messengerUrl = error.messengerUrl || chatbotSettings.facebookPageUrl || 'https://m.me/lakeridepros';
      const escalationId = error.escalationId || null;
      showMessengerEscalation(messengerUrl, 'error', escalationId);
    } finally {
      isLoading = false;
      document.getElementById('lrp-status').textContent = 'Online';
      if (!inputField.disabled) {
        document.getElementById('lrp-send').disabled = false;
        inputField.focus();
      }
    }
  }

  /**
   * Scroll to bottom of messages
   */
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Utility: Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility: Convert hex to RGB
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '76, 175, 80';
  }

  /**
   * Handle mobile keyboard visibility
   */
  function setupKeyboardHandling() {
    if (!chatWindow) return;

    let initialHeight = window.innerHeight;

    // Detect viewport resize (keyboard opening/closing)
    window.addEventListener('resize', () => {
      const currentHeight = window.innerHeight;
      const diff = initialHeight - currentHeight;

      // If viewport shrunk by more than 150px, keyboard is likely visible
      if (diff > 150) {
        chatWindow.classList.add('keyboard-visible');
      } else {
        chatWindow.classList.remove('keyboard-visible');
        initialHeight = currentHeight; // Reset reference
      }
    });

    // For iOS: detect focus on input
    if (inputField) {
      inputField.addEventListener('focus', () => {
        // Small delay to allow keyboard to appear
        setTimeout(() => {
          const viewportHeight = window.visualViewport?.height || window.innerHeight;
          const windowHeight = window.innerHeight;

          if (windowHeight - viewportHeight > 150) {
            chatWindow.classList.add('keyboard-visible');
          }
        }, 300);
      });

      inputField.addEventListener('blur', () => {
        setTimeout(() => {
          chatWindow.classList.remove('keyboard-visible');
        }, 100);
      });
    }
  }

  /**
   * Check and warn about viewport meta tag
   */
  function checkViewportMeta() {
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      console.warn(
        'No viewport meta tag found. For best mobile experience, add:\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
      );
    } else {
      const content = viewportMeta.getAttribute('content');
      if (!content.includes('viewport-fit=cover')) {
        console.info(
          'Consider adding viewport-fit=cover to your viewport meta tag for better iOS support:\n' +
          '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        );
      }
    }
  }

  /**
   * Initialize chatbot
   */
  async function init() {
    try {
      console.log('Chatbot widget initializing...', {
        apiUrl,
        origin: window.location.origin,
        timestamp: new Date().toISOString()
      });

      // Check viewport configuration
      checkViewportMeta();

      // Fetch configuration
      const settings = await fetchConfig();

      if (!settings || !settings.enabled) {
        console.log('Chatbot is disabled or not configured', { settings });
        return;
      }

      console.log('Chatbot config loaded successfully', {
        enabled: settings.enabled,
        name: settings.name
      });

      chatbotSettings = settings;

      // Inject styles
      injectStyles();
      console.log('Chatbot styles injected');

      // Create widget
      createWidget();
      console.log('Chatbot widget created');

      // Setup mobile keyboard handling
      setupKeyboardHandling();
      console.log('Keyboard handling configured');

      console.log('Lake Ride Pros chatbot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chatbot:', error, {
        message: error.message,
        stack: error.stack
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
