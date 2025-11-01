/* Mobile Console Overlay - Shows console errors on screen for mobile debugging */
(function() {
  const overlay = document.createElement('div');
  overlay.id = 'mobile-console';
  overlay.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 40vh;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.95);
    color: #0f0;
    font-family: monospace;
    font-size: 11px;
    padding: 10px;
    z-index: 999999;
    border-top: 2px solid #0f0;
    display: none;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    position: sticky;
    top: 0;
    background: #000;
    padding: 5px 0;
    margin-bottom: 10px;
    border-bottom: 1px solid #0f0;
    display: flex;
    justify-content: space-between;
  `;
  header.innerHTML = `
    <span style="color: #0f0; font-weight: bold;">📱 MOBILE CONSOLE</span>
    <button id="clear-console" style="background: #f00; color: #fff; border: none; padding: 2px 8px; font-size: 10px;">CLEAR</button>
  `;

  const content = document.createElement('div');
  content.id = 'console-content';

  overlay.appendChild(header);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  let errorCount = 0;

  function addLog(type, args) {
    errorCount++;
    overlay.style.display = 'block';

    const entry = document.createElement('div');
    entry.style.cssText = `
      margin-bottom: 8px;
      padding: 5px;
      border-left: 3px solid ${type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0'};
      background: rgba(255, 255, 255, 0.05);
      word-wrap: break-word;
    `;

    const timestamp = new Date().toLocaleTimeString();
    const typeLabel = type.toUpperCase();
    const color = type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0';

    let message = '';
    try {
      message = Array.from(args).map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        }
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
    } catch (e) {
      message = String(args);
    }

    entry.innerHTML = `
      <div style="color: ${color}; font-weight: bold;">[${timestamp}] ${typeLabel} (#${errorCount})</div>
      <div style="color: #fff; margin-top: 3px; white-space: pre-wrap;">${message}</div>
    `;

    content.insertBefore(entry, content.firstChild);

    // Keep only last 50 entries
    while (content.children.length > 50) {
      content.removeChild(content.lastChild);
    }

    // Scroll to top (newest entry)
    overlay.scrollTop = 0;
  }

  // Capture console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = function(...args) {
    addLog('error', args);
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    addLog('warn', args);
    originalWarn.apply(console, args);
  };

  console.log = function(...args) {
    addLog('log', args);
    originalLog.apply(console, args);
  };

  // Capture unhandled errors
  window.addEventListener('error', function(event) {
    addLog('error', [`Unhandled Error: ${event.message}`, `File: ${event.filename}:${event.lineno}:${event.colno}`, event.error]);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    addLog('error', [`Unhandled Promise Rejection:`, event.reason]);
  });

  // Clear button
  document.getElementById('clear-console').addEventListener('click', function() {
    content.innerHTML = '';
    errorCount = 0;
    overlay.style.display = 'none';
  });

  // Add initial message
  addLog('log', ['Mobile console initialized. Errors will appear here.']);
})();
