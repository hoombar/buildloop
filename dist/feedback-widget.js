const FeedbackStorage = {
  STORAGE_KEY: 'feedback_widget_data',
  EXPORT_STATUS_KEY: 'feedback_widget_export_status',
  MAX_STORAGE_SIZE: 4.5 * 1024 * 1024, // 4.5MB to leave room for other data
  
  isStorageAvailable() {
    try {
      const test = '__feedback_storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  getCurrentStorageSize() {
    if (!this.isStorageAvailable()) return 0;
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? new Blob([data]).size : 0;
    } catch (e) {
      return 0;
    }
  },

  getTotalStorageSize() {
    if (!this.isStorageAvailable()) return 0;
    let total = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
    } catch (e) {
      return 0;
    }
    return total;
  },

  canStore(newDataSize) {
    const totalSize = this.getTotalStorageSize();
    return totalSize + newDataSize < this.MAX_STORAGE_SIZE;
  },

  getFeedbackItems() {
    if (!this.isStorageAvailable()) return [];
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to parse feedback data from localStorage:', e);
      return [];
    }
  },

  saveFeedbackItems(items) {
    if (!this.isStorageAvailable()) {
      throw new Error('localStorage is not available');
    }
    
    try {
      const dataString = JSON.stringify(items);
      const dataSize = new Blob([dataString]).size;
      
      if (!this.canStore(dataSize)) {
        throw new Error('Storage quota exceeded. Please export existing feedback to free up space.');
      }
      
      localStorage.setItem(this.STORAGE_KEY, dataString);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        throw new Error('Storage quota exceeded. Please export existing feedback to free up space.');
      }
      throw e;
    }
  },

  addFeedbackItem(item) {
    const items = this.getFeedbackItems();
    
    // Generate unique ID if not provided
    if (!item.id) {
      item.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    items.push(item);
    this.saveFeedbackItems(items);
    return item.id;
  },

  removeFeedbackItem(id) {
    const items = this.getFeedbackItems();
    const filteredItems = items.filter(item => item.id !== id);
    this.saveFeedbackItems(filteredItems);
    return items.length !== filteredItems.length;
  },

  updateFeedbackItem(id, updates) {
    const items = this.getFeedbackItems();
    const itemIndex = items.findIndex(item => item.id === id);
    
    if (itemIndex === -1) {
      return false;
    }
    
    items[itemIndex] = { ...items[itemIndex], ...updates };
    this.saveFeedbackItems(items);
    return true;
  },

  clearAllFeedback() {
    if (!this.isStorageAvailable()) return false;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.clearExportStatus(); // Also clear export tracking
      return true;
    } catch (e) {
      console.warn('Failed to clear feedback data:', e);
      return false;
    }
  },

  getFeedbackCount() {
    return this.getFeedbackItems().length;
  },

  getLastActivity() {
    const items = this.getFeedbackItems();
    if (items.length === 0) return null;
    
    const timestamps = items.map(item => new Date(item.context.timestamp));
    return new Date(Math.max(...timestamps));
  },

  shouldPromptNewSession() {
    const lastActivity = this.getLastActivity();
    if (!lastActivity) return false;
    
    const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
    return hoursSinceActivity >= 12;
  },

  getExportStatus() {
    if (!this.isStorageAvailable()) return { lastExportTimestamp: null, exportedItemIds: [] };
    try {
      const data = localStorage.getItem(this.EXPORT_STATUS_KEY);
      return data ? JSON.parse(data) : { lastExportTimestamp: null, exportedItemIds: [] };
    } catch (e) {
      console.warn('Failed to parse export status from localStorage:', e);
      return { lastExportTimestamp: null, exportedItemIds: [] };
    }
  },

  saveExportStatus(exportStatus) {
    if (!this.isStorageAvailable()) return false;
    try {
      localStorage.setItem(this.EXPORT_STATUS_KEY, JSON.stringify(exportStatus));
      return true;
    } catch (e) {
      console.warn('Failed to save export status:', e);
      return false;
    }
  },

  markAsExported(itemIds = null) {
    const items = this.getFeedbackItems();
    const exportStatus = this.getExportStatus();
    
    // If no specific items provided, mark all current items as exported
    const idsToMark = itemIds || items.map(item => item.id);
    
    // Update export status
    exportStatus.lastExportTimestamp = Date.now();
    exportStatus.exportedItemIds = [...new Set([...exportStatus.exportedItemIds, ...idsToMark])];
    
    return this.saveExportStatus(exportStatus);
  },

  hasUnexportedFeedback() {
    const items = this.getFeedbackItems();
    if (items.length === 0) return false;
    
    const exportStatus = this.getExportStatus();
    return items.some(item => !exportStatus.exportedItemIds.includes(item.id));
  },

  getUnexportedItems() {
    const items = this.getFeedbackItems();
    const exportStatus = this.getExportStatus();
    return items.filter(item => !exportStatus.exportedItemIds.includes(item.id));
  },

  getUnexportedCount() {
    return this.getUnexportedItems().length;
  },

  clearExportStatus() {
    if (!this.isStorageAvailable()) return false;
    try {
      localStorage.removeItem(this.EXPORT_STATUS_KEY);
      return true;
    } catch (e) {
      console.warn('Failed to clear export status:', e);
      return false;
    }
  },

  getStorageInfo() {
    const exportStatus = this.getExportStatus();
    return {
      available: this.isStorageAvailable(),
      currentSize: this.getCurrentStorageSize(),
      totalSize: this.getTotalStorageSize(),
      maxSize: this.MAX_STORAGE_SIZE,
      itemCount: this.getFeedbackCount(),
      unexportedCount: this.getUnexportedCount(),
      lastExportTimestamp: exportStatus.lastExportTimestamp
    };
  }
};

// For environments without module system
if (typeof window !== 'undefined') {
  window.FeedbackStorage = FeedbackStorage;
}

// For module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackStorage;
}const FeedbackContext = {
  getCurrentPageContext() {
    return {
      url: window.location.href,
      pageTitle: document.title,
      timestamp: new Date().toISOString()
    };
  },

  getElementInfo(element, includeContext = true) {
    if (!element) return null;
    
    const info = {
      selector: this.generateCSSSelector(element),
      text: this.getElementText(element)
    };
    
    if (includeContext) {
      info.siblingContext = this.getSiblingContext(element);
    }
    
    return info;
  },

  getElementText(element, maxWords = 20) {
    if (!element) return '';
    
    let text = '';
    
    // Try different ways to get meaningful text from the element
    if (element.value && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      text = element.value;
    } else if (element.textContent) {
      text = element.textContent.trim();
    } else if (element.innerHTML) {
      // Create a temporary element to strip HTML tags
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = element.innerHTML;
      text = tempDiv.textContent || tempDiv.innerText || '';
    } else if (element.alt) {
      text = element.alt;
    } else if (element.title) {
      text = element.title;
    } else if (element.placeholder) {
      text = element.placeholder;
    }
    
    // Clean up the text
    text = text.replace(/\s+/g, ' ').trim();
    
    // Truncate to specified words if longer
    const words = text.split(' ');
    if (words.length > maxWords) {
      text = words.slice(0, maxWords).join(' ') + '...';
    }
    
    return text;
  },

  getSiblingContext(element) {
    if (!element || !element.parentNode) return null;
    
    const getSiblingText = (sibling) => {
      if (!sibling) return '';
      
      // Handle text nodes
      if (sibling.nodeType === Node.TEXT_NODE) {
        return sibling.textContent.replace(/\s+/g, ' ').trim();
      }
      
      // Handle element nodes
      if (sibling.nodeType === Node.ELEMENT_NODE) {
        return this.getElementText(sibling, 8); // Shorter text for siblings
      }
      
      return '';
    };
    
    const context = {
      prevSibling: null,
      nextSibling: null,
      label: null,
      parentContext: null,
      domPath: null
    };
    
    // Check for associated label
    const label = this.findElementLabel(element);
    if (label) {
      context.label = this.getElementText(label, 8);
    }
    
    // Find meaningful previous sibling
    let prevSibling = element.previousSibling;
    while (prevSibling) {
      const text = getSiblingText(prevSibling);
      if (text && text.length > 0) {
        context.prevSibling = text;
        break;
      }
      prevSibling = prevSibling.previousSibling;
    }
    
    // Find meaningful next sibling
    let nextSibling = element.nextSibling;
    while (nextSibling) {
      const text = getSiblingText(nextSibling);
      if (text && text.length > 0) {
        context.nextSibling = text;
        break;
      }
      nextSibling = nextSibling.nextSibling;
    }
    
    // If no direct siblings found, try parent's context
    if (!context.prevSibling && !context.nextSibling && !context.label) {
      const parent = element.parentNode;
      if (parent && parent !== document.body && parent.nodeType === Node.ELEMENT_NODE) {
        const parentText = this.getElementText(parent, 12);
        const elementText = this.getElementText(element, 8);
        
        // Only use parent context if parent has more text than just the element
        if (parentText && parentText.length > elementText.length) {
          context.parentContext = parentText;
        }
      }
    }
    
    // Add DOM path for better element identification
    context.domPath = this.getDOMPath(element);
    
    return context;
  },

  findElementLabel(element) {
    if (!element) return null;
    
    // Check for explicit label association
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label;
    }
    
    // Check if element is inside a label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel;
    
    // Check for aria-labelledby
    if (element.getAttribute('aria-labelledby')) {
      const labelId = element.getAttribute('aria-labelledby');
      const labelElement = document.getElementById(labelId);
      if (labelElement) return labelElement;
    }
    
    // Check for previous sibling that might be a label-like element
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === 'LABEL') {
        return sibling;
      }
      // Check if previous element looks like a label (common patterns)
      const siblingText = this.getElementText(sibling, 4);
      if (siblingText && siblingText.endsWith(':') || 
          sibling.className.toLowerCase().includes('label') ||
          sibling.tagName === 'STRONG' || sibling.tagName === 'B') {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    
    return null;
  },

  getDOMPath(element) {
    if (!element) return null;
    
    const pathParts = [];
    let current = element;
    let depth = 0;
    const maxDepth = 5; // Limit depth to keep path readable
    
    while (current && current.nodeType === Node.ELEMENT_NODE && depth < maxDepth) {
      let part = current.tagName.toLowerCase();
      
      // Add meaningful identifiers
      if (current.id) {
        part += `#${current.id}`;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(cls => cls).slice(0, 2);
        if (classes.length > 0) {
          part += `.${classes.join('.')}`;
        }
      }
      
      // Add text hint for meaningful elements
      const text = this.getElementText(current, 3);
      if (text && text.length > 0 && text.length < 20) {
        part += `("${text}")`;
      }
      
      pathParts.unshift(part);
      current = current.parentElement;
      depth++;
      
      // Stop at meaningful container elements
      if (current === document.body || 
          (current && (current.tagName === 'MAIN' || 
                      current.tagName === 'SECTION' || 
                      current.tagName === 'ARTICLE' ||
                      current.tagName === 'NAV' ||
                      current.className && current.className.includes('container')))) {
        if (current !== document.body) {
          let containerPart = current.tagName.toLowerCase();
          if (current.id) {
            containerPart += `#${current.id}`;
          } else if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(cls => cls).slice(0, 1);
            if (classes.length > 0) {
              containerPart += `.${classes[0]}`;
            }
          }
          pathParts.unshift(containerPart);
        }
        break;
      }
    }
    
    return pathParts.join(' > ');
  },

  generateCSSSelector(element) {
    if (!element) return '';
    
    // If element has an ID, use it
    if (element.id) {
      return '#' + element.id;
    }
    
    // Build selector path from element to root
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      // Add class names if present
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(cls => cls);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }
      
      // Add nth-child if there are siblings with same tag name
      if (current.parentNode) {
        const siblings = Array.from(current.parentNode.children).filter(
          sibling => sibling.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentNode;
      
      // Stop at body or after reasonable depth
      if (current === document.body || path.length > 10) {
        break;
      }
    }
    
    return path.join(' > ');
  },

  findElementBySelector(selector) {
    try {
      return document.querySelector(selector);
    } catch (e) {
      console.warn('Invalid CSS selector:', selector, e);
      return null;
    }
  },

  isValidElement(element) {
    return element && 
           element.nodeType === Node.ELEMENT_NODE && 
           element !== document.body && 
           element !== document.documentElement &&
           !this.isPartOfWidget(element);
  },

  isPartOfWidget(element) {
    // Check if element is part of the feedback widget
    return element && (
      element.classList.contains('feedback-widget') ||
      element.closest('.feedback-widget') ||
      element.id === 'feedback-widget-container'
    );
  },

  getElementDimensions(element) {
    if (!element) return null;
    
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right
    };
  },

  getElementStyles(element, properties = []) {
    if (!element) return {};
    
    const computedStyle = window.getComputedStyle(element);
    const styles = {};
    
    properties.forEach(prop => {
      styles[prop] = computedStyle.getPropertyValue(prop);
    });
    
    return styles;
  },

  isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           computedStyle.visibility !== 'hidden' && 
           computedStyle.display !== 'none' &&
           computedStyle.opacity !== '0';
  },

  createFeedbackItem(type, message, priority, selectedElement = null) {
    const context = this.getCurrentPageContext();
    
    if (selectedElement) {
      context.selectedElement = this.getElementInfo(selectedElement);
    } else {
      context.selectedElement = null;
    }
    
    return {
      id: null, // Will be generated by storage
      type,
      message: message.trim(),
      priority,
      context
    };
  },

  validateFeedbackItem(item) {
    const errors = [];
    
    if (!item.type || !['text-change', 'feature-request', 'bug-report', 'general'].includes(item.type)) {
      errors.push('Invalid or missing feedback type');
    }
    
    if (!item.message || item.message.trim().length === 0) {
      errors.push('Message is required');
    }
    
    if (!item.priority || !['low', 'medium', 'high'].includes(item.priority)) {
      errors.push('Invalid or missing priority level');
    }
    
    if (!item.context || !item.context.url || !item.context.timestamp) {
      errors.push('Missing context information');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// For environments without module system
if (typeof window !== 'undefined') {
  window.FeedbackContext = FeedbackContext;
}

// For module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackContext;
}const ElementSelector = {
  isActive: false,
  selectedElement: null,
  statusBox: null,
  onElementSelected: null,
  originalCursor: null,
  lastMousePosition: { x: 0, y: 0 },
  positionUpdateTimeout: null,
  
  activate(onElementSelectedCallback) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.onElementSelected = onElementSelectedCallback;
    this.originalCursor = document.body.style.cursor;
    
    // Change cursor to crosshair
    document.body.style.cursor = 'crosshair';
    
    // Create status box
    this.createStatusBox();
    
    // Add event listeners
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('mouseout', this.handleMouseOut);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Prevent default behaviors during selection
    document.addEventListener('contextmenu', this.preventDefault);
    document.addEventListener('selectstart', this.preventDefault);
  },

  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.selectedElement = null;
    this.onElementSelected = null;
    
    // Restore cursor
    document.body.style.cursor = this.originalCursor || '';
    
    // Remove status box
    this.removeStatusBox();
    
    // Remove event listeners
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('contextmenu', this.preventDefault);
    document.removeEventListener('selectstart', this.preventDefault);
    
    // Clear any pending position updates
    if (this.positionUpdateTimeout) {
      clearTimeout(this.positionUpdateTimeout);
      this.positionUpdateTimeout = null;
    }
  },

  createStatusBox() {
    if (this.statusBox) return;
    
    this.statusBox = document.createElement('div');
    this.statusBox.className = 'feedback-widget-status-box';
    this.statusBox.style.cssText = `
      position: fixed;
      width: 100%;
      max-width: 600px;
      background: white;
      border: 2px solid #007bff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      pointer-events: none;
      opacity: 0.95;
      box-sizing: border-box;
      transition: all 0.3s ease;
    `;
    
    // Set initial position
    this.positionStatusBox({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    this.statusBox.innerHTML = `
      <div style="font-weight: 600; color: #007bff; margin-bottom: 4px;">
        🎯 Element Selection Mode - Hover over elements to preview
      </div>
      <div class="status-content" style="color: #666; font-family: monospace; font-size: 12px;">
        Move your mouse over elements to see their details...
      </div>
    `;
    document.body.appendChild(this.statusBox);
  },

  removeStatusBox() {
    if (this.statusBox) {
      this.statusBox.remove();
      this.statusBox = null;
    }
  },

  updateStatus(element) {
    if (!this.statusBox || !element) {
      this.hideStatus();
      return;
    }
    
    const elementInfo = FeedbackContext.getElementInfo(element);
    if (!elementInfo) {
      this.hideStatus();
      return;
    }
    
    const statusContent = this.statusBox.querySelector('.status-content');
    if (statusContent) {
      let contextHtml = '';
      
      // Build context display if any context exists
      if (elementInfo.siblingContext) {
        const context = elementInfo.siblingContext;
        const targetText = elementInfo.text ? this.escapeHtml(elementInfo.text) : '(element)';
        let contextParts = [];
        
        // Add label context
        if (context.label) {
          contextParts.push(`<span style="color: #6f42c1; font-weight: 500;">${this.escapeHtml(context.label)}</span>`);
        }
        
        // Add sibling context
        if (context.prevSibling || context.nextSibling) {
          let siblingDisplay = '';
          if (context.prevSibling) {
            siblingDisplay += `<span style="color: #888;">${this.escapeHtml(context.prevSibling)}</span> → `;
          }
          siblingDisplay += `<span style="background: #007bff; color: white; padding: 1px 4px; border-radius: 2px; font-weight: 600;">${targetText}</span>`;
          if (context.nextSibling) {
            siblingDisplay += ` → <span style="color: #888;">${this.escapeHtml(context.nextSibling)}</span>`;
          }
          contextParts.push(siblingDisplay);
        }
        
        // Add parent context if no siblings
        if (!context.prevSibling && !context.nextSibling && !context.label && context.parentContext) {
          contextParts.push(`<span style="color: #6c757d; font-style: italic;">In: ${this.escapeHtml(context.parentContext)}</span>`);
        }
        
        // Add DOM path for element location
        if (context.domPath) {
          contextParts.push(`<span style="color: #28a745; font-size: 10px; font-family: monospace;">Path: ${this.escapeHtml(context.domPath)}</span>`);
        }
        
        if (contextParts.length > 0) {
          contextHtml = `
            <div style="margin-bottom: 6px; padding: 4px; background: #f8f9fa; border-radius: 3px; font-size: 11px; line-height: 1.4;">
              <div style="color: #666; margin-bottom: 2px;"><strong>Context:</strong></div>
              <div style="font-family: monospace;">
                ${contextParts.join('<br>')}
              </div>
            </div>
          `;
        }
      }
      
      statusContent.innerHTML = `
        ${contextHtml}
        <div><strong>Content:</strong> ${elementInfo.text ? '"' + this.escapeHtml(elementInfo.text) + '"' : '(no text content)'}</div>
      `;
    }
    
    this.statusBox.style.display = 'block';
  },

  hideStatus() {
    if (this.statusBox) {
      const statusContent = this.statusBox.querySelector('.status-content');
      if (statusContent) {
        statusContent.textContent = 'Move your mouse over elements to see their details...';
      }
    }
  },

  positionStatusBox(mousePos) {
    if (!this.statusBox) return;
    
    const boxRect = this.statusBox.getBoundingClientRect();
    const boxWidth = Math.min(600, window.innerWidth - 40); // Account for margins
    const boxHeight = boxRect.height || 120; // Estimate if not rendered yet
    
    const margin = 20;
    const cursorBuffer = 100; // Keep box at least 100px away from cursor
    
    // Calculate available areas
    const areas = [
      // Bottom center (preferred)
      {
        x: Math.max(margin, Math.min(window.innerWidth - boxWidth - margin, (window.innerWidth - boxWidth) / 2)),
        y: window.innerHeight - boxHeight - margin,
        priority: this.getDistanceFromCursor(mousePos, 
          (window.innerWidth - boxWidth) / 2, 
          window.innerHeight - boxHeight - margin, 
          boxWidth, boxHeight),
        position: 'bottom'
      },
      // Top center
      {
        x: Math.max(margin, Math.min(window.innerWidth - boxWidth - margin, (window.innerWidth - boxWidth) / 2)),
        y: margin,
        priority: this.getDistanceFromCursor(mousePos, 
          (window.innerWidth - boxWidth) / 2, 
          margin, 
          boxWidth, boxHeight),
        position: 'top'
      },
      // Bottom left
      {
        x: margin,
        y: window.innerHeight - boxHeight - margin,
        priority: this.getDistanceFromCursor(mousePos, 
          margin, 
          window.innerHeight - boxHeight - margin, 
          boxWidth, boxHeight),
        position: 'bottom-left'
      },
      // Bottom right
      {
        x: window.innerWidth - boxWidth - margin,
        y: window.innerHeight - boxHeight - margin,
        priority: this.getDistanceFromCursor(mousePos, 
          window.innerWidth - boxWidth - margin, 
          window.innerHeight - boxHeight - margin, 
          boxWidth, boxHeight),
        position: 'bottom-right'
      },
      // Top left
      {
        x: margin,
        y: margin,
        priority: this.getDistanceFromCursor(mousePos, 
          margin, 
          margin, 
          boxWidth, boxHeight),
        position: 'top-left'
      },
      // Top right
      {
        x: window.innerWidth - boxWidth - margin,
        y: margin,
        priority: this.getDistanceFromCursor(mousePos, 
          window.innerWidth - boxWidth - margin, 
          margin, 
          boxWidth, boxHeight),
        position: 'top-right'
      }
    ];
    
    // Sort by distance from cursor (furthest first) and prefer bottom positions
    areas.sort((a, b) => {
      // Prefer bottom positions when distances are similar
      if (Math.abs(a.priority - b.priority) < cursorBuffer) {
        if (a.position.includes('bottom') && !b.position.includes('bottom')) return -1;
        if (!a.position.includes('bottom') && b.position.includes('bottom')) return 1;
      }
      return b.priority - a.priority;
    });
    
    // Use the best position that keeps the box far enough from cursor
    const bestPosition = areas.find(area => area.priority >= cursorBuffer) || areas[0];
    
    // Apply the position
    this.statusBox.style.left = `${bestPosition.x}px`;
    this.statusBox.style.top = `${bestPosition.y}px`;
    this.statusBox.style.right = 'auto';
    this.statusBox.style.bottom = 'auto';
    this.statusBox.style.width = `${boxWidth}px`;
  },

  getDistanceFromCursor(mousePos, boxX, boxY, boxWidth, boxHeight) {
    // Calculate the minimum distance from cursor to the box rectangle
    const centerX = mousePos.x;
    const centerY = mousePos.y;
    
    // Find the closest point on the box to the cursor
    const closestX = Math.max(boxX, Math.min(centerX, boxX + boxWidth));
    const closestY = Math.max(boxY, Math.min(centerY, boxY + boxHeight));
    
    // Calculate distance
    const dx = centerX - closestX;
    const dy = centerY - closestY;
    
    return Math.sqrt(dx * dx + dy * dy);
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  handleMouseOver: function(e) {
    if (!ElementSelector.isActive) return;
    
    const element = e.target;
    if (!FeedbackContext.isValidElement(element)) {
      ElementSelector.hideStatus();
      return;
    }
    
    ElementSelector.updateStatus(element);
  }.bind(this),

  handleMouseOut: function(e) {
    if (!ElementSelector.isActive) return;
    ElementSelector.hideStatus();
  }.bind(this),

  handleMouseMove: function(e) {
    if (!ElementSelector.isActive) return;
    
    ElementSelector.lastMousePosition = { x: e.clientX, y: e.clientY };
    
    // Throttle position updates to avoid excessive calculations
    if (ElementSelector.positionUpdateTimeout) {
      clearTimeout(ElementSelector.positionUpdateTimeout);
    }
    
    ElementSelector.positionUpdateTimeout = setTimeout(() => {
      ElementSelector.positionStatusBox(ElementSelector.lastMousePosition);
    }, 50); // Update every 50ms when moving
  }.bind(this),

  handleClick: function(e) {
    if (!ElementSelector.isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.target;
    if (!FeedbackContext.isValidElement(element)) {
      return;
    }
    
    ElementSelector.selectedElement = element;
    
    // Show selection feedback in status box
    ElementSelector.showSelectionFeedback(element);
    
    // Call callback with selected element after a brief delay
    setTimeout(() => {
      if (ElementSelector.onElementSelected) {
        ElementSelector.onElementSelected(element);
      }
      
      // Deactivate selector
      ElementSelector.deactivate();
    }, 800);
  }.bind(this),

  handleKeyDown: function(e) {
    if (!ElementSelector.isActive) return;
    
    // Escape key cancels selection
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      ElementSelector.deactivate();
    }
  }.bind(this),

  preventDefault: function(e) {
    if (ElementSelector.isActive) {
      e.preventDefault();
    }
  }.bind(this),

  showSelectionFeedback(element) {
    if (!this.statusBox || !element) return;
    
    const elementInfo = FeedbackContext.getElementInfo(element);
    if (!elementInfo) return;
    
    // Update status box to show selection confirmation
    this.statusBox.style.borderColor = '#28a745';
    this.statusBox.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
    
    const statusContent = this.statusBox.querySelector('.status-content');
    if (statusContent) {
      let contextHtml = '';
      
      // Build context display if any context exists
      if (elementInfo.siblingContext) {
        const context = elementInfo.siblingContext;
        const targetText = elementInfo.text ? this.escapeHtml(elementInfo.text) : '(element)';
        let contextParts = [];
        
        // Add label context
        if (context.label) {
          contextParts.push(`<span style="color: #6f42c1; font-weight: 500;">${this.escapeHtml(context.label)}</span>`);
        }
        
        // Add sibling context
        if (context.prevSibling || context.nextSibling) {
          let siblingDisplay = '';
          if (context.prevSibling) {
            siblingDisplay += `<span style="color: #6c757d;">${this.escapeHtml(context.prevSibling)}</span> → `;
          }
          siblingDisplay += `<span style="background: #28a745; color: white; padding: 1px 4px; border-radius: 2px; font-weight: 600;">${targetText}</span>`;
          if (context.nextSibling) {
            siblingDisplay += ` → <span style="color: #6c757d;">${this.escapeHtml(context.nextSibling)}</span>`;
          }
          contextParts.push(siblingDisplay);
        }
        
        // Add parent context if no siblings
        if (!context.prevSibling && !context.nextSibling && !context.label && context.parentContext) {
          contextParts.push(`<span style="color: #6c757d; font-style: italic;">In: ${this.escapeHtml(context.parentContext)}</span>`);
        }
        
        // Add DOM path for element location
        if (context.domPath) {
          contextParts.push(`<span style="color: #155724; font-size: 10px; font-family: monospace;">Path: ${this.escapeHtml(context.domPath)}</span>`);
        }
        
        if (contextParts.length > 0) {
          contextHtml = `
            <div style="margin-bottom: 6px; padding: 4px; background: #d4edda; border-radius: 3px; font-size: 11px; line-height: 1.4;">
              <div style="color: #155724; margin-bottom: 2px;"><strong>Selected Context:</strong></div>
              <div style="font-family: monospace;">
                ${contextParts.join('<br>')}
              </div>
            </div>
          `;
        }
      }
      
      statusContent.innerHTML = `
        <div style="color: #28a745; font-weight: 600; margin-bottom: 4px;">✅ Element Selected!</div>
        ${contextHtml}
        <div><strong>Content:</strong> ${elementInfo.text ? '"' + this.escapeHtml(elementInfo.text) + '"' : '(no text content)'}</div>
      `;
    }
    
    // Update header to show selection
    const header = this.statusBox.querySelector('div');
    if (header) {
      header.innerHTML = '✅ Element Selected - Opening feedback form...';
      header.style.color = '#28a745';
    }
  },

  getSelectedElement() {
    return this.selectedElement;
  },

  clearSelectedElement() {
    this.selectedElement = null;
  },

  // Utility method to test if an element can be selected
  canSelectElement(element) {
    return FeedbackContext.isValidElement(element) && 
           FeedbackContext.isElementVisible(element);
  },

  // Method to programmatically select an element (for testing or admin features)
  selectElement(element) {
    if (!this.canSelectElement(element)) {
      return false;
    }
    
    this.selectedElement = element;
    this.showSelectionFeedback(element);
    return true;
  },

  // Method to show element status without selecting (for preview)
  previewElement(element) {
    if (!this.canSelectElement(element)) {
      this.hideStatus();
      return false;
    }
    
    this.updateStatus(element);
    return true;
  },

  // Create visual indicator for selected element (for form display)
  createElementPreview(element) {
    if (!element) return null;
    
    const elementInfo = FeedbackContext.getElementInfo(element);
    if (!elementInfo) return null;
    
    const preview = document.createElement('div');
    preview.className = 'feedback-widget-element-preview';
    preview.style.cssText = `
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 12px;
      font-size: 12px;
      margin: 8px 0;
      line-height: 1.4;
    `;
    
    // Add context information if available
    if (elementInfo.siblingContext) {
      const context = elementInfo.siblingContext;
      let contextParts = [];
      
      // Add label context
      if (context.label) {
        contextParts.push(`Label: "${this.escapeHtml(context.label)}"`);
      }
      
      // Add sibling context
      if (context.prevSibling || context.nextSibling) {
        let siblingText = '';
        if (context.prevSibling) {
          siblingText += this.escapeHtml(context.prevSibling) + ' → ';
        }
        siblingText += '[THIS ELEMENT]';
        if (context.nextSibling) {
          siblingText += ' → ' + this.escapeHtml(context.nextSibling);
        }
        contextParts.push(`Context: ${siblingText}`);
      }
      
      // Add parent context if no siblings
      if (!context.prevSibling && !context.nextSibling && !context.label && context.parentContext) {
        contextParts.push(`In: "${this.escapeHtml(context.parentContext)}"`);
      }
      
      // Add DOM path for element location
      if (context.domPath) {
        contextParts.push(`DOM Path: ${this.escapeHtml(context.domPath)}`);
      }
      
      if (contextParts.length > 0) {
        const contextDiv = document.createElement('div');
        contextDiv.style.cssText = `
          background: #e3f2fd;
          border-left: 3px solid #1976d2;
          padding: 6px 8px;
          margin-bottom: 8px;
          border-radius: 2px;
          font-size: 11px;
        `;
        contextDiv.innerHTML = '<strong>Context:</strong><br>' + contextParts.map(part => '• ' + part).join('<br>');
        preview.appendChild(contextDiv);
      }
    }
    
    const textSpan = document.createElement('div');
    textSpan.style.cssText = `
      color: #495057;
      font-weight: 600;
    `;
    textSpan.innerHTML = '<strong>Content:</strong> ' + (elementInfo.text ? '"' + this.escapeHtml(elementInfo.text) + '"' : '(no text content)');
    
    preview.appendChild(textSpan);
    
    return preview;
  }
};

// For environments without module system
if (typeof window !== 'undefined') {
  window.ElementSelector = ElementSelector;
}

// For module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElementSelector;
}const FeedbackExport = {
  generateMarkdown(feedbackItems) {
    if (!feedbackItems || feedbackItems.length === 0) {
      return '# Feedback Export\n\nNo feedback items to export.';
    }
    
    const exportDate = new Date().toLocaleDateString();
    const summary = this.generateSummary(feedbackItems);
    const groupedItems = this.groupByType(feedbackItems);
    
    let markdown = `# Feedback Export - ${exportDate}\n\n`;
    markdown += `**Summary**: ${summary.total} total items | ${summary.high} high priority | ${summary.bugs} bugs\n\n`;
    
    // Generate sections for each type
    const typeOrder = ['text-change', 'feature-request', 'bug-report', 'general'];
    const typeTitles = {
      'text-change': 'Text Changes',
      'feature-request': 'Feature Requests',
      'bug-report': 'Bug Reports',
      'general': 'General Feedback'
    };
    
    typeOrder.forEach(type => {
      if (groupedItems[type] && groupedItems[type].length > 0) {
        markdown += `## ${typeTitles[type]}\n\n`;
        groupedItems[type].forEach(item => {
          markdown += this.formatFeedbackItem(item);
        });
        markdown += '\n';
      }
    });
    
    return markdown;
  },

  generateSummary(items) {
    const summary = {
      total: items.length,
      high: 0,
      medium: 0,
      low: 0,
      bugs: 0,
      features: 0,
      textChanges: 0,
      general: 0
    };
    
    items.forEach(item => {
      // Count priorities
      if (item.priority === 'high') summary.high++;
      else if (item.priority === 'medium') summary.medium++;
      else if (item.priority === 'low') summary.low++;
      
      // Count types
      switch (item.type) {
        case 'bug-report':
          summary.bugs++;
          break;
        case 'feature-request':
          summary.features++;
          break;
        case 'text-change':
          summary.textChanges++;
          break;
        case 'general':
          summary.general++;
          break;
      }
    });
    
    return summary;
  },

  groupByType(items) {
    const grouped = {
      'text-change': [],
      'feature-request': [],
      'bug-report': [],
      'general': []
    };
    
    items.forEach(item => {
      if (grouped[item.type]) {
        grouped[item.type].push(item);
      } else {
        grouped.general.push(item);
      }
    });
    
    // Sort each group by priority (high first) then by timestamp (newest first)
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        return new Date(b.context.timestamp) - new Date(a.context.timestamp);
      });
    });
    
    return grouped;
  },

  formatFeedbackItem(item) {
    const priority = this.capitalizeFirst(item.priority);
    const message = this.escapeMarkdown(item.message);
    const context = this.formatContext(item.context);
    
    let markdown = `- [ ] ${message} (Priority: ${priority})\n`;
    markdown += `  <details>\n`;
    markdown += `  <summary>Context</summary>\n\n`;
    markdown += context;
    markdown += `  </details>\n\n`;
    
    return markdown;
  },

  formatContext(context) {
    let contextText = '';
    
    // Add basic context info
    contextText += `  - URL: ${context.url}\n`;
    contextText += `  - Time: ${this.formatTimestamp(context.timestamp)}\n`;
    contextText += `  - Page: ${this.escapeMarkdown(context.pageTitle)}\n`;
    
    // Add element info if available
    if (context.selectedElement) {
      const element = context.selectedElement;
      
      if (element.text && element.text.trim()) {
        contextText += `  - Element Content: "${this.escapeMarkdown(element.text)}"\n`;
      }
      
      // Add sibling context if available
      if (element.siblingContext) {
        const siblingContext = element.siblingContext;
        const contextParts = [];
        
        // Add label context
        if (siblingContext.label) {
          contextParts.push(`Label: "${this.escapeMarkdown(siblingContext.label)}"`);
        }
        
        // Add sibling context
        if (siblingContext.prevSibling || siblingContext.nextSibling) {
          let siblingText = '';
          if (siblingContext.prevSibling) {
            siblingText += this.escapeMarkdown(siblingContext.prevSibling) + ' → ';
          }
          siblingText += '[TARGET]';
          if (siblingContext.nextSibling) {
            siblingText += ' → ' + this.escapeMarkdown(siblingContext.nextSibling);
          }
          contextParts.push(`Context: ${siblingText}`);
        }
        
        // Add parent context if no siblings
        if (!siblingContext.prevSibling && !siblingContext.nextSibling && !siblingContext.label && siblingContext.parentContext) {
          contextParts.push(`In: "${this.escapeMarkdown(siblingContext.parentContext)}"`);
        }
        
        // Add DOM path for element location
        if (siblingContext.domPath) {
          contextParts.push(`DOM Path: ${this.escapeMarkdown(siblingContext.domPath)}`);
        }
        
        if (contextParts.length > 0) {
          contextText += `  - **Element Context:**\n`;
          contextParts.forEach(part => {
            contextText += `    - ${part}\n`;
          });
        }
      }
    }
    
    contextText += '\n';
    
    return contextText;
  },

  formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  },

  escapeMarkdown(text) {
    if (!text) return '';
    
    // Escape markdown special characters
    return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
  },

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  downloadMarkdown(markdown, filename = null) {
    if (!filename) {
      const date = new Date().toISOString().split('T')[0];
      filename = `feedback-export-${date}.md`;
    }
    
    try {
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to download markdown file:', error);
      
      // Fallback: try to copy to clipboard
      this.fallbackCopyToClipboard(markdown);
      throw new Error('Failed to download file. Content copied to clipboard instead.');
    }
  },

  fallbackCopyToClipboard(text) {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
        return;
      }
      
      // Fallback to older method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
    }
  },

  // Utility method to validate export data
  validateExportData(items) {
    if (!Array.isArray(items)) {
      return { valid: false, error: 'Items must be an array' };
    }
    
    if (items.length === 0) {
      return { valid: false, error: 'No items to export' };
    }
    
    // Check if items have required structure
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.type || !item.message || !item.priority || !item.context) {
        return { 
          valid: false, 
          error: `Item ${i + 1} is missing required fields` 
        };
      }
      
      if (!item.context.url || !item.context.timestamp) {
        return { 
          valid: false, 
          error: `Item ${i + 1} context is missing required fields` 
        };
      }
    }
    
    return { valid: true };
  },

  // Method to generate a preview of the markdown (first few items)
  generatePreview(items, maxItems = 3) {
    if (!items || items.length === 0) {
      return 'No items to preview.';
    }
    
    const previewItems = items.slice(0, maxItems);
    const hasMore = items.length > maxItems;
    
    let markdown = this.generateMarkdown(previewItems);
    
    if (hasMore) {
      markdown += `\n*... and ${items.length - maxItems} more items*\n`;
    }
    
    return markdown;
  },

  // Method to export specific types of feedback
  exportByType(items, type) {
    const filteredItems = items.filter(item => item.type === type);
    return this.generateMarkdown(filteredItems);
  },

  // Method to export by priority
  exportByPriority(items, priority) {
    const filteredItems = items.filter(item => item.priority === priority);
    return this.generateMarkdown(filteredItems);
  },

  // Method to export items from a date range
  exportByDateRange(items, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredItems = items.filter(item => {
      const itemDate = new Date(item.context.timestamp);
      return itemDate >= start && itemDate <= end;
    });
    
    return this.generateMarkdown(filteredItems);
  }
};

// For environments without module system
if (typeof window !== 'undefined') {
  window.FeedbackExport = FeedbackExport;
}

// For module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackExport;
}const FeedbackUI = {
  container: null,
  modal: null,
  sessionGapModal: null,
  floatingButton: null,
  adminPanel: null,
  floatingMenu: null,
  isInitialized: false,
  isAdminPanelOpen: false,
  isContextMenuOpen: false,
  
  init() {
    if (this.isInitialized) return;
    
    this.createContainer();
    if (FeedbackWidget.config.showFloatingButton) {
      this.createFloatingButton();
    }
    this.injectStyles();
    this.updateFeedbackCounter();
    
    this.isInitialized = true;
  },

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'feedback-widget-container';
    this.container.className = 'feedback-widget';
    document.body.appendChild(this.container);
  },

  createFloatingButton() {
    // Remove existing button if present
    if (this.floatingButton && this.floatingButton.parentNode) {
      this.floatingButton.remove();
    }
    
    this.floatingButton = document.createElement('button');
    this.floatingButton.className = 'feedback-widget-floating-btn';
    this.floatingButton.innerHTML = `
      <span class="feedback-btn-icon">💬</span>
      <span class="feedback-btn-counter">0</span>
      <span class="feedback-btn-menu-indicator">⚙️</span>
    `;
    this.floatingButton.title = 'Feedback Actions';
    
    // Regular click - show menu
    this.floatingButton.addEventListener('click', (e) => {
      if (!this.isContextMenuOpen) {
        this.showFloatingMenu(e);
      }
    });
    
    // Prevent context menu (right-click)
    this.floatingButton.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    // Long press for mobile - show context menu
    let pressTimer = null;
    this.floatingButton.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        e.preventDefault();
        this.showFloatingMenu(e);
      }, 500); // 500ms long press
    });
    
    this.floatingButton.addEventListener('touchend', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });
    
    this.floatingButton.addEventListener('touchmove', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });
    
    this.container.appendChild(this.floatingButton);
  },

  updateFeedbackCounter() {
    // Ensure floating button exists if it should
    if (!this.floatingButton && FeedbackWidget.config.showFloatingButton) {
      this.createFloatingButton();
    }
    
    if (!this.floatingButton) return;
    
    const totalCount = FeedbackStorage.getFeedbackCount();
    const unexportedCount = FeedbackStorage.getUnexportedCount();
    const counter = this.floatingButton.querySelector('.feedback-btn-counter');
    
    if (counter) {
      // Show unexported count, or total if all are unexported
      const displayCount = unexportedCount > 0 ? unexportedCount : totalCount;
      counter.textContent = displayCount.toString();
      counter.style.display = totalCount > 0 ? 'inline-block' : 'none';
      
      // Change color based on export status
      if (unexportedCount > 0) {
        counter.style.background = '#dc3545'; // Red for unexported
      } else if (totalCount > 0) {
        counter.style.background = '#28a745'; // Green for all exported
      }
    }
  },

  showFloatingMenu(e) {
    if (this.floatingMenu) {
      this.closeFloatingMenu();
    }
    
    this.isContextMenuOpen = true;
    this.floatingMenu = this.createFloatingMenu();
    
    // Position menu near the floating button
    const rect = this.floatingButton.getBoundingClientRect();
    const menu = this.floatingMenu;
    
    // Position above the button with some spacing
    menu.style.position = 'fixed';
    menu.style.right = '20px';
    menu.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    menu.style.zIndex = '1000000';
    
    this.container.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideMenuClick);
    }, 0);
  },

  createFloatingMenu() {
    const menu = document.createElement('div');
    menu.className = 'feedback-widget-floating-menu';
    
    const items = FeedbackStorage.getFeedbackItems();
    const count = items.length;
    const unexportedCount = FeedbackStorage.getUnexportedCount();
    
    menu.innerHTML = `
      <div class="feedback-menu-item" data-action="select-element">
        <span class="feedback-menu-icon">🎯</span>
        <span class="feedback-menu-text">Select Element for Feedback</span>
      </div>
      <div class="feedback-menu-item" data-action="admin">
        <span class="feedback-menu-icon">⚙️</span>
        <span class="feedback-menu-text">Admin Panel</span>
        <span class="feedback-menu-badge" style="${unexportedCount > 0 ? 'background: #dc3545;' : (count > 0 ? 'background: #28a745;' : '')}">${count}</span>
      </div>
      ${count > 0 ? `
      <div class="feedback-menu-item" data-action="export">
        <span class="feedback-menu-icon">📥</span>
        <span class="feedback-menu-text">Export Feedback</span>
        ${unexportedCount > 0 ? `<span class="feedback-menu-badge" style="background: #dc3545; font-size: 10px;">${unexportedCount}</span>` : ''}
      </div>
      <div class="feedback-menu-item" data-action="clear">
        <span class="feedback-menu-icon">🗑️</span>
        <span class="feedback-menu-text">Clear All</span>
      </div>
      ` : ''}
    `;
    
    // Add event listeners for menu items
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.feedback-menu-item');
      if (!item) return;
      
      const action = item.dataset.action;
      this.handleMenuAction(action);
      this.closeFloatingMenu();
    });
    
    return menu;
  },

  handleMenuAction(action) {
    switch (action) {
      case 'select-element':
        this.startElementSelectionForFeedback();
        break;
      case 'admin':
        this.showAdminPanel();
        break;
      case 'export':
        this.handleExport();
        break;
      case 'clear':
        this.handleClearAll();
        break;
    }
  },

  startElementSelectionForFeedback() {
    // Check for session gap before starting feedback process
    if (FeedbackStorage.shouldPromptNewSession()) {
      FeedbackWidget.handleSessionGapPrompt(() => {
        // After session gap is handled, continue with element selection
        this.proceedWithElementSelection();
      });
      return;
    }
    
    // No session gap, proceed directly
    this.proceedWithElementSelection();
  },

  proceedWithElementSelection() {
    ElementSelector.activate((selectedElement) => {
      this.showFeedbackModalWithElement(selectedElement);
    });
    this.showNotification('Click on any element to give feedback about it', 'info');
  },

  showFeedbackModalWithElement(element) {
    if (this.modal) {
      this.closeFeedbackModal();
    }
    
    this.modal = this.createFeedbackModal();
    this.container.appendChild(this.modal);
    
    // Pre-populate with selected element
    if (element) {
      this.updateSelectedElementDisplay(element, this.modal);
    }
    
    // Focus first input
    setTimeout(() => {
      const firstInput = this.modal.querySelector('select, textarea, input');
      if (firstInput) firstInput.focus();
    }, 100);
  },

  showSessionGapModal(onDecision) {
    if (this.sessionGapModal) {
      this.closeSessionGapModal();
    }

    const items = FeedbackStorage.getFeedbackItems();
    const unexportedCount = FeedbackStorage.getUnexportedCount();
    const hasUnexported = unexportedCount > 0;

    this.sessionGapModal = this.createSessionGapModal(items, unexportedCount, hasUnexported, onDecision);
    this.container.appendChild(this.sessionGapModal);
    
    // Focus first button
    setTimeout(() => {
      const firstButton = this.sessionGapModal.querySelector('.session-gap-action-btn');
      if (firstButton) firstButton.focus();
    }, 100);
  },

  createSessionGapModal(items, unexportedCount, hasUnexported, onDecision) {
    const modal = document.createElement('div');
    modal.className = 'feedback-widget-modal-overlay session-gap-modal';
    
    const lastActivity = FeedbackStorage.getLastActivity();
    const hoursSince = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60));
    
    modal.innerHTML = `
      <div class="feedback-widget-modal session-gap-modal-content">
        <div class="feedback-widget-header">
          <h3>⏰ New Feedback Session</h3>
          <button class="feedback-widget-close-btn session-gap-close" type="button">&times;</button>
        </div>
        
        <div class="session-gap-content">
          <div class="session-gap-info">
            <p>It's been <strong>${hoursSince} hours</strong> since your last feedback activity.</p>
            ${items.length > 0 ? `
              <div class="session-gap-stats">
                <div class="session-gap-stat">
                  <span class="stat-number">${items.length}</span>
                  <span class="stat-label">Total Items</span>
                </div>
                ${hasUnexported ? `
                <div class="session-gap-stat unexported">
                  <span class="stat-number">${unexportedCount}</span>
                  <span class="stat-label">Unexported</span>
                </div>
                ` : `
                <div class="session-gap-stat exported">
                  <span class="stat-number">${items.length}</span>
                  <span class="stat-label">All Exported</span>
                </div>
                `}
              </div>
            ` : '<p class="session-gap-empty">No existing feedback found.</p>'}
          </div>
          
          ${hasUnexported && items.length > 0 ? `
          <div class="session-gap-warning">
            <p>⚠️ <strong>Warning:</strong> You have ${unexportedCount} unexported feedback item(s). 
            Starting a new session will permanently delete this data.</p>
          </div>
          ` : ''}
          
          <div class="session-gap-question">
            <p>How would you like to proceed?</p>
          </div>
        </div>
        
        <div class="session-gap-actions">
          ${items.length > 0 ? `
          <button type="button" class="session-gap-action-btn session-gap-new-btn" data-action="new">
            <span class="btn-icon">🆕</span>
            <div class="btn-content">
              <div class="btn-title">Start New Session</div>
              <div class="btn-subtitle">Clear old data & start fresh</div>
            </div>
          </button>
          ` : ''}
          
          <button type="button" class="session-gap-action-btn session-gap-continue-btn" data-action="continue">
            <span class="btn-icon">➕</span>
            <div class="btn-content">
              <div class="btn-title">${items.length > 0 ? 'Continue Existing Session' : 'Start Feedback Session'}</div>
              <div class="btn-subtitle">${items.length > 0 ? 'Add to current feedback' : 'Begin adding feedback'}</div>
            </div>
          </button>
        </div>
      </div>
    `;
    
    // Bind events
    this.bindSessionGapModalEvents(modal, onDecision);
    
    return modal;
  },

  bindSessionGapModalEvents(modal, onDecision) {
    const closeBtn = modal.querySelector('.session-gap-close');
    const actionButtons = modal.querySelectorAll('.session-gap-action-btn');
    
    // Close modal events
    closeBtn.addEventListener('click', () => {
      this.closeSessionGapModal();
      if (onDecision) onDecision('cancel');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeSessionGapModal();
        if (onDecision) onDecision('cancel');
      }
    });
    
    // Action button events
    actionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.getAttribute('data-action');
        this.closeSessionGapModal();
        if (onDecision) onDecision(action);
      });
    });
    
    // Escape key to close
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.closeSessionGapModal();
        if (onDecision) onDecision('cancel');
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  },

  closeSessionGapModal() {
    if (this.sessionGapModal) {
      this.sessionGapModal.remove();
      this.sessionGapModal = null;
    }
  },

  closeFloatingMenu() {
    if (this.floatingMenu) {
      this.floatingMenu.remove();
      this.floatingMenu = null;
    }
    this.isContextMenuOpen = false;
    document.removeEventListener('click', this.handleOutsideMenuClick);
  },

  handleOutsideMenuClick: function(e) {
    if (!e.target.closest('.feedback-widget-floating-menu') && 
        !e.target.closest('.feedback-widget-floating-btn')) {
      FeedbackUI.closeFloatingMenu();
    }
  }.bind(this),

  // This method now shows an error - elements must be selected first
  showFeedbackModal() {
    this.showError('Please select an element first. Click "Select Element for Feedback" from the menu.');
  },

  createFeedbackModal() {
    const modal = document.createElement('div');
    modal.className = 'feedback-widget-modal-overlay';
    
    modal.innerHTML = `
      <div class="feedback-widget-modal">
        <div class="feedback-widget-header">
          <h3>Give Feedback</h3>
          <button class="feedback-widget-close-btn" type="button">&times;</button>
        </div>
        
        <form class="feedback-widget-form">
          <div class="feedback-widget-field">
            <label for="feedback-type">Feedback Type:</label>
            <select id="feedback-type" name="type" required>
              <option value="">Select type...</option>
              <option value="text-change">Text Change</option>
              <option value="feature-request">Feature Request</option>
              <option value="bug-report">Bug Report</option>
              <option value="general">General</option>
            </select>
          </div>
          
          <div class="feedback-widget-field">
            <label for="feedback-priority">Priority:</label>
            <select id="feedback-priority" name="priority" required>
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div class="feedback-widget-field">
            <label for="feedback-message">Message:</label>
            <textarea id="feedback-message" name="message" rows="4" placeholder="Describe your feedback..." required></textarea>
          </div>
          
          <div class="feedback-widget-element-section">
            <div class="feedback-widget-element-label">
              <label>Selected Element:</label>
            </div>
            <div class="feedback-widget-selected-element">
              <p class="feedback-widget-no-element">No element selected. Please close this modal and select an element first.</p>
            </div>
          </div>
          
          <div class="feedback-widget-actions">
            <button type="button" class="feedback-widget-cancel-btn">Cancel</button>
            <button type="submit" class="feedback-widget-submit-btn">Queue Feedback</button>
          </div>
        </form>
      </div>
    `;
    
    this.bindModalEvents(modal);
    return modal;
  },

  bindModalEvents(modal) {
    const form = modal.querySelector('.feedback-widget-form');
    const closeBtn = modal.querySelector('.feedback-widget-close-btn');
    const cancelBtn = modal.querySelector('.feedback-widget-cancel-btn');
    
    // Close modal events
    closeBtn.addEventListener('click', () => this.closeFeedbackModal());
    cancelBtn.addEventListener('click', () => this.closeFeedbackModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeFeedbackModal();
    });
    
    // Form submission
    form.addEventListener('submit', (e) => this.handleFeedbackSubmit(e));
    
    // Escape key to close
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !ElementSelector.isActive) {
        this.closeFeedbackModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  },

  startElementSelection(modal) {
    this.closeFeedbackModal(false); // Close modal but keep data
    
    ElementSelector.activate((selectedElement) => {
      this.handleElementSelected(selectedElement, modal);
    });
  },

  handleElementSelected(element, modal) {
    this.showFeedbackModal(); // Reopen modal
    this.updateSelectedElementDisplay(element, this.modal);
  },

  updateSelectedElementDisplay(element, modal) {
    const elementSection = modal.querySelector('.feedback-widget-selected-element');
    
    if (element) {
      const preview = ElementSelector.createElementPreview(element);
      elementSection.innerHTML = '';
      elementSection.appendChild(preview);
      elementSection.style.display = 'block';
      
      // Store element reference
      modal._selectedElement = element;
    } else {
      // Show the "no element" message
      elementSection.innerHTML = '<p class="feedback-widget-no-element">No element selected. Please close this modal and select an element first.</p>';
      elementSection.style.display = 'block';
      modal._selectedElement = null;
    }
  },

  clearElementSelection(modal) {
    this.updateSelectedElementDisplay(null, modal);
    ElementSelector.clearSelectedElement();
  },

  handleFeedbackSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const selectedElement = this.modal._selectedElement || null;
    
    // Require element selection
    if (!selectedElement) {
      this.showError('Please select an element first. Close this modal and click "Select Element for Feedback" from the menu.');
      return;
    }
    
    try {
      const feedbackItem = FeedbackContext.createFeedbackItem(
        formData.get('type'),
        formData.get('message'),
        formData.get('priority'),
        selectedElement
      );
      
      const validation = FeedbackContext.validateFeedbackItem(feedbackItem);
      if (!validation.isValid) {
        this.showError('Please fill in all required fields: ' + validation.errors.join(', '));
        return;
      }
      
      FeedbackStorage.addFeedbackItem(feedbackItem);
      this.showSuccess('Feedback queued successfully! Don\'t forget to export your feedback when ready.');
      this.updateFeedbackCounter();
      
      setTimeout(() => {
        this.closeFeedbackModal();
      }, 1000);
      
    } catch (error) {
      this.showError('Failed to save feedback: ' + error.message);
    }
  },

  closeFeedbackModal(clearData = true) {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    
    if (clearData) {
      ElementSelector.clearSelectedElement();
    }
    
    // Deactivate element selector if active
    if (ElementSelector.isActive) {
      ElementSelector.deactivate();
    }
  },

  showSuccess(message) {
    this.showNotification(message, 'success');
  },

  showError(message) {
    this.showNotification(message, 'error');
  },

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `feedback-widget-notification feedback-widget-${type}`;
    notification.textContent = message;
    
    this.container.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('feedback-widget-show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('feedback-widget-show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  },

  toggleAdminPanel() {
    if (this.isAdminPanelOpen) {
      this.closeAdminPanel();
    } else {
      this.showAdminPanel();
    }
  },

  showAdminPanel() {
    if (this.adminPanel) {
      this.closeAdminPanel();
    }
    
    this.adminPanel = this.createAdminPanel();
    this.container.appendChild(this.adminPanel);
    this.isAdminPanelOpen = true;
  },

  createAdminPanel() {
    const panel = document.createElement('div');
    panel.className = 'feedback-widget-admin-panel';
    
    const items = FeedbackStorage.getFeedbackItems();
    const storageInfo = FeedbackStorage.getStorageInfo();
    const unexportedCount = storageInfo.unexportedCount;
    
    panel.innerHTML = `
      <div class="feedback-widget-admin-header">
        <h3>Feedback Management (${items.length} items)</h3>
        <button class="feedback-widget-admin-close-btn" type="button">&times;</button>
      </div>
      
      <div class="feedback-widget-admin-actions">
        <button class="feedback-widget-export-btn" ${items.length === 0 ? 'disabled' : ''}>
          Export All ${unexportedCount > 0 ? `(${unexportedCount} new)` : ''}
        </button>
        <button class="feedback-widget-clear-btn" ${items.length === 0 ? 'disabled' : ''}>Clear All</button>
      </div>
      
      <div class="feedback-widget-storage-info">
        <small>
          Storage: ${Math.round(storageInfo.currentSize / 1024)}KB used
          ${unexportedCount > 0 ? `• <span style="color: #dc3545;">${unexportedCount} unexported</span>` : ''}
          ${storageInfo.lastExportTimestamp ? `• Last export: ${new Date(storageInfo.lastExportTimestamp).toLocaleString()}` : ''}
        </small>
      </div>
      
      <div class="feedback-widget-admin-list">
        ${this.renderFeedbackList(items)}
      </div>
    `;
    
    this.bindAdminEvents(panel);
    return panel;
  },

  renderFeedbackList(items) {
    if (items.length === 0) {
      return '<p class="feedback-widget-empty">No feedback items yet.</p>';
    }
    
    const exportStatus = FeedbackStorage.getExportStatus();
    
    return items.map(item => {
      const isExported = exportStatus.exportedItemIds.includes(item.id);
      
      return `
        <div class="feedback-widget-admin-item" data-id="${item.id}">
          <div class="feedback-widget-item-header">
            <span class="feedback-widget-item-type feedback-widget-type-${item.type}">${item.type}</span>
            <span class="feedback-widget-item-priority feedback-widget-priority-${item.priority}">${item.priority}</span>
            <span class="feedback-widget-export-status ${isExported ? 'exported' : 'unexported'}">
              ${isExported ? '✓ Exported' : '⚠️ New'}
            </span>
            <button class="feedback-widget-delete-item-btn" data-id="${item.id}">Delete</button>
          </div>
          <div class="feedback-widget-item-message">${this.escapeHtml(item.message)}</div>
          <div class="feedback-widget-item-context">
            <small>
              ${new Date(item.context.timestamp).toLocaleString()} | 
              ${this.escapeHtml(item.context.pageTitle)}
              ${item.context.selectedElement ? ' | Element: ' + this.escapeHtml(item.context.selectedElement.selector) : ''}
            </small>
          </div>
        </div>
      `;
    }).join('');
  },

  bindAdminEvents(panel) {
    const closeBtn = panel.querySelector('.feedback-widget-admin-close-btn');
    const exportBtn = panel.querySelector('.feedback-widget-export-btn');
    const clearBtn = panel.querySelector('.feedback-widget-clear-btn');
    const deleteButtons = panel.querySelectorAll('.feedback-widget-delete-item-btn');
    
    closeBtn.addEventListener('click', () => this.closeAdminPanel());
    exportBtn.addEventListener('click', () => this.handleExport());
    clearBtn.addEventListener('click', () => this.handleClearAll());
    
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        this.handleDeleteItem(id);
      });
    });
  },

  handleDeleteItem(id) {
    if (confirm('Delete this feedback item?')) {
      FeedbackStorage.removeFeedbackItem(id);
      this.updateFeedbackCounter();
      this.refreshAdminPanel();
    }
  },

  handleClearAll() {
    if (confirm('Delete all feedback items? This cannot be undone.')) {
      FeedbackStorage.clearAllFeedback();
      this.updateFeedbackCounter();
      this.refreshAdminPanel();
    }
  },

  handleExport() {
    try {
      const items = FeedbackStorage.getFeedbackItems();
      if (items.length === 0) {
        this.showError('No feedback items to export');
        return;
      }
      
      // Import and use the export functionality
      const markdown = FeedbackExport.generateMarkdown(items);
      FeedbackExport.downloadMarkdown(markdown);
      
      // Mark items as exported
      FeedbackStorage.markAsExported();
      this.updateFeedbackCounter();
      this.refreshAdminPanel();
      
      this.showSuccess(`Exported ${items.length} feedback items successfully!`);
      
    } catch (error) {
      this.showError('Export failed: ' + error.message);
    }
  },

  refreshAdminPanel() {
    if (this.adminPanel && this.isAdminPanelOpen) {
      this.closeAdminPanel();
      this.showAdminPanel();
    }
  },

  closeAdminPanel() {
    if (this.adminPanel) {
      this.adminPanel.remove();
      this.adminPanel = null;
    }
    this.isAdminPanelOpen = false;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  injectStyles() {
    if (document.querySelector('#feedback-widget-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'feedback-widget-styles';
    style.textContent = `
      .feedback-widget * {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .feedback-widget-floating-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #007bff;
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        z-index: 999998;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
      }
      
      .feedback-widget-floating-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
      }
      
      .feedback-btn-icon {
        font-size: 24px;
        line-height: 1;
      }
      
      .feedback-btn-counter {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #dc3545;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        font-size: 12px;
        font-weight: bold;
        display: none;
        align-items: center;
        justify-content: center;
      }
      
      .feedback-btn-menu-indicator {
        position: absolute;
        top: -2px;
        left: -2px;
        font-size: 12px;
        opacity: 0.7;
      }
      
      .feedback-widget-floating-menu {
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        border: 1px solid #e9ecef;
        min-width: 180px;
        overflow: hidden;
        animation: feedback-menu-fade-in 0.2s ease-out;
      }
      
      @keyframes feedback-menu-fade-in {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .feedback-menu-item {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: background 0.2s ease;
        border-bottom: 1px solid #f8f9fa;
      }
      
      .feedback-menu-item:last-child {
        border-bottom: none;
      }
      
      .feedback-menu-item:hover {
        background: #f8f9fa;
      }
      
      .feedback-menu-icon {
        font-size: 16px;
        width: 20px;
        text-align: center;
      }
      
      .feedback-menu-text {
        flex: 1;
        font-size: 14px;
        color: #333;
        font-weight: 500;
      }
      
      .feedback-menu-badge {
        background: #007bff;
        color: white;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 12px;
        font-weight: bold;
        min-width: 18px;
        text-align: center;
      }
      
      .feedback-widget-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      
      .feedback-widget-modal {
        background: white;
        border-radius: 8px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      }
      
      .feedback-widget-header {
        padding: 20px 20px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .feedback-widget-header h3 {
        margin: 0;
        color: #333;
      }
      
      .feedback-widget-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .feedback-widget-form {
        padding: 20px;
      }
      
      .feedback-widget-field {
        margin-bottom: 16px;
      }
      
      .feedback-widget-field label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        color: #333;
      }
      
      .feedback-widget-field select,
      .feedback-widget-field textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .feedback-widget-field textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .feedback-widget-element-section {
        margin: 16px 0;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 4px;
      }
      
      .feedback-widget-element-label label {
        font-weight: 500;
        color: #333;
        margin-bottom: 8px;
        display: block;
      }
      
      .feedback-widget-no-element {
        color: #dc3545;
        font-style: italic;
        margin: 0;
        font-size: 14px;
      }
      
      .feedback-widget-element-controls button {
        padding: 6px 12px;
        margin-right: 8px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .feedback-widget-element-controls button:hover {
        background: #f8f9fa;
      }
      
      .feedback-widget-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 20px;
      }
      
      .feedback-widget-actions button {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .feedback-widget-cancel-btn {
        background: #6c757d;
        color: white;
      }
      
      .feedback-widget-submit-btn {
        background: #007bff;
        color: white;
      }
      
      .feedback-widget-actions button:hover {
        opacity: 0.9;
      }
      
      .feedback-widget-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 4px;
        color: white;
        z-index: 1000000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      
      .feedback-widget-notification.feedback-widget-show {
        transform: translateX(0);
      }
      
      .feedback-widget-success {
        background: #28a745;
      }
      
      .feedback-widget-error {
        background: #dc3545;
      }
      
      .feedback-widget-admin-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 600px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 999999;
        overflow-y: auto;
      }
      
      .feedback-widget-admin-header {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .feedback-widget-admin-header h3 {
        margin: 0;
        font-size: 16px;
      }
      
      .feedback-widget-admin-actions {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        gap: 10px;
      }
      
      .feedback-widget-admin-actions button {
        padding: 6px 12px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .feedback-widget-admin-actions button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .feedback-widget-export-btn {
        background: #007bff !important;
        color: white !important;
        border-color: #007bff !important;
      }
      
      .feedback-widget-clear-btn {
        background: #dc3545 !important;
        color: white !important;
        border-color: #dc3545 !important;
      }
      
      .feedback-widget-storage-info {
        padding: 0 20px 10px;
        color: #666;
      }
      
      .feedback-widget-admin-list {
        max-height: 400px;
        overflow-y: auto;
      }
      
      .feedback-widget-admin-item {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
      }
      
      .feedback-widget-item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .feedback-widget-item-type,
      .feedback-widget-item-priority {
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
      }
      
      .feedback-widget-type-bug-report { background: #dc3545; color: white; }
      .feedback-widget-type-feature-request { background: #007bff; color: white; }
      .feedback-widget-type-text-change { background: #ffc107; color: black; }
      .feedback-widget-type-general { background: #6c757d; color: white; }
      
      .feedback-widget-priority-high { background: #dc3545; color: white; }
      .feedback-widget-priority-medium { background: #ffc107; color: black; }
      .feedback-widget-priority-low { background: #28a745; color: white; }
      
      .feedback-widget-delete-item-btn {
        margin-left: auto;
        padding: 2px 8px;
        font-size: 11px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .feedback-widget-item-message {
        margin-bottom: 8px;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .feedback-widget-item-context {
        color: #666;
        font-size: 12px;
      }
      
      .feedback-widget-export-status {
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 500;
        margin-left: auto;
        margin-right: 8px;
      }
      
      .feedback-widget-export-status.exported {
        background: #d4edda;
        color: #155724;
      }
      
      .feedback-widget-export-status.unexported {
        background: #f8d7da;
        color: #721c24;
      }
      
      .feedback-widget-empty {
        padding: 40px 20px;
        text-align: center;
        color: #666;
        font-style: italic;
      }
      
      /* Session Gap Modal Styles */
      .session-gap-modal-content {
        max-width: 480px;
      }
      
      .session-gap-content {
        padding: 20px;
      }
      
      .session-gap-info {
        margin-bottom: 20px;
      }
      
      .session-gap-info p {
        margin: 0 0 16px 0;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
      }
      
      .session-gap-stats {
        display: flex;
        gap: 20px;
        justify-content: center;
        margin: 16px 0;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      
      .session-gap-stat {
        text-align: center;
      }
      
      .session-gap-stat .stat-number {
        display: block;
        font-size: 24px;
        font-weight: bold;
        color: #333;
      }
      
      .session-gap-stat .stat-label {
        display: block;
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
      }
      
      .session-gap-stat.unexported .stat-number {
        color: #dc3545;
      }
      
      .session-gap-stat.exported .stat-number {
        color: #28a745;
      }
      
      .session-gap-empty {
        text-align: center;
        color: #666;
        font-style: italic;
        margin: 16px 0;
      }
      
      .session-gap-warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 16px;
        margin: 16px 0;
      }
      
      .session-gap-warning p {
        margin: 0;
        color: #856404;
        font-size: 14px;
      }
      
      .session-gap-question {
        margin: 20px 0 0 0;
      }
      
      .session-gap-question p {
        margin: 0;
        font-weight: 500;
        color: #333;
        text-align: center;
      }
      
      .session-gap-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 0 20px 20px;
      }
      
      .session-gap-action-btn {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 20px;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
      }
      
      .session-gap-action-btn:hover {
        border-color: #007bff;
        box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
        transform: translateY(-1px);
      }
      
      .session-gap-action-btn:active {
        transform: translateY(0);
      }
      
      .session-gap-action-btn .btn-icon {
        font-size: 24px;
        width: 32px;
        text-align: center;
        flex-shrink: 0;
      }
      
      .session-gap-action-btn .btn-content {
        flex: 1;
      }
      
      .session-gap-action-btn .btn-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
      }
      
      .session-gap-action-btn .btn-subtitle {
        font-size: 13px;
        color: #666;
        line-height: 1.3;
      }
      
      .session-gap-new-btn:hover {
        border-color: #dc3545;
        box-shadow: 0 2px 8px rgba(220, 53, 69, 0.15);
      }
      
      .session-gap-new-btn .btn-icon {
        color: #dc3545;
      }
      
      .session-gap-continue-btn:hover {
        border-color: #28a745;
        box-shadow: 0 2px 8px rgba(40, 167, 69, 0.15);
      }
      
      .session-gap-continue-btn .btn-icon {
        color: #28a745;
      }
      
      @media (max-width: 480px) {
        .feedback-widget-modal {
          margin: 10px;
        }
        
        .feedback-widget-admin-panel {
          width: calc(100vw - 40px);
          right: 20px;
        }
        
        .session-gap-modal-content {
          margin: 10px;
          max-width: calc(100vw - 20px);
        }
        
        .session-gap-stats {
          gap: 16px;
        }
        
        .session-gap-action-btn {
          gap: 12px;
          padding: 14px 16px;
        }
        
        .session-gap-action-btn .btn-icon {
          font-size: 20px;
          width: 24px;
        }
        
        .session-gap-action-btn .btn-title {
          font-size: 15px;
        }
      }
    `;
    
    document.head.appendChild(style);
  },

  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    const styles = document.querySelector('#feedback-widget-styles');
    if (styles) {
      styles.remove();
    }
    
    ElementSelector.deactivate();
    this.closeFloatingMenu();
    this.closeSessionGapModal();
    this.isInitialized = false;
    this.isAdminPanelOpen = false;
    this.isContextMenuOpen = false;
  }
};

// For environments without module system
if (typeof window !== 'undefined') {
  window.FeedbackUI = FeedbackUI;
}

// For module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackUI;
}const FeedbackWidget = {
  config: {
    autoInit: true,
    showFloatingButton: true,
    sessionGapHours: 12
  },
  
  isInitialized: false,
  
  init(customConfig = {}) {
    if (this.isInitialized) {
      console.warn('Feedback widget is already initialized');
      return;
    }
    
    // Merge custom config
    this.config = { ...this.config, ...customConfig };
    
    try {
      // Initialize UI
      FeedbackUI.init();
      
      // Set up window beforeunload handler for unsaved feedback warning
      this.setupUnloadWarning();
      
      this.isInitialized = true;
      
      console.log('Feedback widget initialized successfully');
      
      // Emit custom event for integration
      this.emit('feedbackWidget:initialized');
      
    } catch (error) {
      console.error('Failed to initialize feedback widget:', error);
      this.showError('Failed to initialize feedback widget: ' + error.message);
    }
  },

  checkSessionGap() {
    if (FeedbackStorage.shouldPromptNewSession()) {
      this.handleSessionGapPrompt();
    }
  },

  handleSessionGapPrompt(onComplete) {
    FeedbackUI.showSessionGapModal((decision) => {
      this.handleSessionGapDecision(decision, onComplete);
    });
  },

  handleSessionGapDecision(decision, onComplete) {
    const items = FeedbackStorage.getFeedbackItems();
    const hasUnexported = FeedbackStorage.hasUnexportedFeedback();
    
    switch (decision) {
      case 'new':
        this.startNewSession(items, hasUnexported);
        // After clearing/exporting, continue with the original action
        if (onComplete) onComplete();
        break;
      case 'continue':
        this.continueExistingSession();
        // Continue with the original action (element selection)
        if (onComplete) onComplete();
        break;
      case 'cancel':
        // User canceled, don't call onComplete
        break;
    }
  },

  startNewSession(items, hasUnexported) {
    if (items.length === 0) {
      // No existing items, nothing to clear
      this.showSuccess('Starting new feedback session.');
      return;
    }

    if (hasUnexported) {
      // Export first, then clear
      try {
        const markdown = FeedbackExport.generateMarkdown(items);
        FeedbackExport.downloadMarkdown(markdown);
        FeedbackStorage.markAsExported();
        
        // Clear after export
        FeedbackStorage.clearAllFeedback();
        FeedbackUI.updateFeedbackCounter();
        
        this.showSuccess('Previous feedback exported and cleared. Starting new session.');
      } catch (error) {
        this.showError('Failed to export feedback: ' + error.message);
        console.error('Export failed during session gap handling:', error);
        return;
      }
    } else {
      // All exported, just clear
      FeedbackStorage.clearAllFeedback();
      FeedbackUI.updateFeedbackCounter();
      this.showSuccess('Previous session cleared. Starting new session.');
    }
  },

  continueExistingSession() {
    this.showSuccess('Continuing with existing feedback session.');
  },

  checkSessionGapOnAdd() {
    // Check for session gap when adding new feedback (not just on init)
    if (FeedbackStorage.shouldPromptNewSession()) {
      this.handleSessionGapPrompt();
    }
  },


  setupUnloadWarning() {
    window.addEventListener('beforeunload', (e) => {
      const hasUnexported = FeedbackStorage.hasUnexportedFeedback();
      if (hasUnexported) {
        const count = FeedbackStorage.getUnexportedCount();
        const message = `You have ${count} unexported feedback item(s). Consider exporting them before leaving.`;
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    });
  },

  // Public API methods
  show() {
    if (!this.isInitialized) {
      this.init();
    }
    FeedbackUI.showFeedbackModal();
  },

  hide() {
    FeedbackUI.closeFeedbackModal();
  },

  toggleAdmin() {
    if (!this.isInitialized) {
      this.init();
    }
    FeedbackUI.toggleAdminPanel();
  },

  showAdmin() {
    if (!this.isInitialized) {
      this.init();
    }
    FeedbackUI.showAdminPanel();
  },

  hideAdmin() {
    FeedbackUI.closeAdminPanel();
  },

  // Data methods
  getFeedback() {
    return FeedbackStorage.getFeedbackItems();
  },

  addFeedback(type, message, priority, element = null) {
    try {
      const feedbackItem = FeedbackContext.createFeedbackItem(type, message, priority, element);
      const validation = FeedbackContext.validateFeedbackItem(feedbackItem);
      
      if (!validation.isValid) {
        throw new Error('Invalid feedback data: ' + validation.errors.join(', '));
      }
      
      const id = FeedbackStorage.addFeedbackItem(feedbackItem);
      FeedbackUI.updateFeedbackCounter();
      
      this.emit('feedbackWidget:feedbackAdded', { id, item: feedbackItem });
      
      return id;
    } catch (error) {
      console.error('Failed to add feedback:', error);
      this.showError('Failed to add feedback: ' + error.message);
      throw error;
    }
  },

  removeFeedback(id) {
    try {
      const removed = FeedbackStorage.removeFeedbackItem(id);
      if (removed) {
        FeedbackUI.updateFeedbackCounter();
        this.emit('feedbackWidget:feedbackRemoved', { id });
      }
      return removed;
    } catch (error) {
      console.error('Failed to remove feedback:', error);
      this.showError('Failed to remove feedback: ' + error.message);
      return false;
    }
  },

  clearAllFeedback() {
    try {
      const cleared = FeedbackStorage.clearAllFeedback();
      if (cleared) {
        FeedbackUI.updateFeedbackCounter();
        this.emit('feedbackWidget:feedbackCleared');
      }
      return cleared;
    } catch (error) {
      console.error('Failed to clear feedback:', error);
      this.showError('Failed to clear feedback: ' + error.message);
      return false;
    }
  },

  exportFeedback(format = 'markdown') {
    try {
      const items = this.getFeedback();
      
      if (items.length === 0) {
        this.showError('No feedback items to export');
        return false;
      }
      
      if (format === 'markdown') {
        const markdown = FeedbackExport.generateMarkdown(items);
        FeedbackExport.downloadMarkdown(markdown);
        FeedbackStorage.markAsExported(); // Mark items as exported
        this.emit('feedbackWidget:feedbackExported', { format, itemCount: items.length });
        return true;
      } else if (format === 'json') {
        this.exportAsJSON(items);
        FeedbackStorage.markAsExported(); // Mark items as exported
        this.emit('feedbackWidget:feedbackExported', { format, itemCount: items.length });
        return true;
      } else {
        throw new Error('Unsupported export format: ' + format);
      }
    } catch (error) {
      console.error('Failed to export feedback:', error);
      this.showError('Failed to export feedback: ' + error.message);
      return false;
    }
  },

  exportAsJSON(items) {
    const jsonData = JSON.stringify(items, null, 2);
    const date = new Date().toISOString().split('T')[0];
    const filename = `feedback-export-${date}.json`;
    
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  },

  // Element selection methods
  startElementSelection(callback) {
    ElementSelector.activate(callback);
  },

  stopElementSelection() {
    ElementSelector.deactivate();
  },

  selectElement(selector) {
    const element = document.querySelector(selector);
    if (element && ElementSelector.canSelectElement(element)) {
      return ElementSelector.selectElement(element);
    }
    return false;
  },

  // Utility methods
  getStorageInfo() {
    return FeedbackStorage.getStorageInfo();
  },

  getConfig() {
    return { ...this.config };
  },

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('feedbackWidget:configUpdated', { config: this.config });
  },

  // Event system
  emit(eventName, data = {}) {
    const event = new CustomEvent(eventName, {
      detail: data,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  },

  on(eventName, callback) {
    document.addEventListener(eventName, callback);
  },

  off(eventName, callback) {
    document.removeEventListener(eventName, callback);
  },

  // UI methods
  showSuccess(message) {
    FeedbackUI.showSuccess(message);
  },

  showError(message) {
    FeedbackUI.showError(message);
  },

  showNotification(message, type = 'info') {
    FeedbackUI.showNotification(message, type);
  },

  // Destroy and cleanup
  destroy() {
    try {
      FeedbackUI.destroy();
      ElementSelector.deactivate();
      
      // Remove event listeners
      window.removeEventListener('beforeunload', this.setupUnloadWarning);
      
      this.isInitialized = false;
      
      this.emit('feedbackWidget:destroyed');
      
      console.log('Feedback widget destroyed');
    } catch (error) {
      console.error('Error during widget destruction:', error);
    }
  },

  // Development and debugging methods
  debug() {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      feedbackCount: FeedbackStorage.getFeedbackCount(),
      storageInfo: FeedbackStorage.getStorageInfo(),
      lastActivity: FeedbackStorage.getLastActivity(),
      shouldPromptNewSession: FeedbackStorage.shouldPromptNewSession()
    };
  },

  // Test helper method - adds sample feedback from yesterday
  addTestData() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 30, 0, 0); // 10:30 AM yesterday
    
    const testFeedback = [
      {
        id: 'test_' + Date.now() + '_1',
        type: 'bug-report',
        message: 'The login button is not working properly on mobile devices',
        priority: 'high',
        context: {
          url: window.location.href,
          pageTitle: document.title,
          userAgent: navigator.userAgent,
          timestamp: yesterday.toISOString(),
          selectedElement: {
            selector: 'button.login-btn',
            text: 'Login',
            tagName: 'BUTTON'
          }
        }
      },
      {
        id: 'test_' + Date.now() + '_2',
        type: 'text-change',
        message: 'Change "Sign Up" to "Create Account" for clarity',
        priority: 'medium',
        context: {
          url: window.location.href,
          pageTitle: document.title,
          userAgent: navigator.userAgent,
          timestamp: new Date(yesterday.getTime() + 60000).toISOString(), // 1 minute later
          selectedElement: {
            selector: 'a.signup-link',
            text: 'Sign Up',
            tagName: 'A'
          }
        }
      },
      {
        id: 'test_' + Date.now() + '_3',
        type: 'feature-request',
        message: 'Add dark mode toggle to the settings page',
        priority: 'low',
        context: {
          url: window.location.href,
          pageTitle: document.title,
          userAgent: navigator.userAgent,
          timestamp: new Date(yesterday.getTime() + 120000).toISOString(), // 2 minutes later
          selectedElement: null
        }
      }
    ];

    try {
      const existingItems = FeedbackStorage.getFeedbackItems();
      const allItems = [...existingItems, ...testFeedback];
      FeedbackStorage.saveFeedbackItems(allItems);
      
      FeedbackUI.updateFeedbackCounter();
      if (FeedbackUI.isAdminPanelOpen) {
        FeedbackUI.refreshAdminPanel();
      }
      
      this.showSuccess(`Added ${testFeedback.length} test feedback items from yesterday`);
      
      console.log('Test data added:', {
        items: testFeedback,
        shouldPromptNewSession: FeedbackStorage.shouldPromptNewSession(),
        lastActivity: FeedbackStorage.getLastActivity(),
        hoursSinceLastActivity: (Date.now() - FeedbackStorage.getLastActivity().getTime()) / (1000 * 60 * 60)
      });
      
      return testFeedback;
    } catch (error) {
      this.showError('Failed to add test data: ' + error.message);
      console.error('Test data error:', error);
      return false;
    }
  },

  // Clear test data
  clearTestData() {
    try {
      const items = FeedbackStorage.getFeedbackItems();
      const nonTestItems = items.filter(item => !item.id.startsWith('test_'));
      
      FeedbackStorage.saveFeedbackItems(nonTestItems);
      FeedbackUI.updateFeedbackCounter();
      
      const removedCount = items.length - nonTestItems.length;
      this.showSuccess(`Removed ${removedCount} test items`);
      
      return true;
    } catch (error) {
      this.showError('Failed to clear test data: ' + error.message);
      return false;
    }
  },

  // Version information
  version: '1.0.0'
};

// Auto-initialize if enabled and DOM is ready
if (FeedbackWidget.config.autoInit) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      FeedbackWidget.init();
    });
  } else {
    // DOM is already ready
    setTimeout(() => {
      FeedbackWidget.init();
    }, 0);
  }
}

// Global configuration from data attributes or global object
(function() {
  // Check for global config
  if (typeof window.FeedbackWidgetConfig !== 'undefined') {
    FeedbackWidget.updateConfig(window.FeedbackWidgetConfig);
  }
  
  // Check for config in script tag data attributes
  const scripts = document.querySelectorAll('script[src*="feedback-widget"]');
  if (scripts.length > 0) {
    const script = scripts[scripts.length - 1]; // Get the last one
    const configData = {};
    
    if (script.dataset.autoInit !== undefined) {
      configData.autoInit = script.dataset.autoInit === 'true';
    }
    if (script.dataset.showFloatingButton !== undefined) {
      configData.showFloatingButton = script.dataset.showFloatingButton === 'true';
    }
    if (script.dataset.sessionGapHours) {
      configData.sessionGapHours = parseInt(script.dataset.sessionGapHours, 10);
    }
    
    if (Object.keys(configData).length > 0) {
      FeedbackWidget.updateConfig(configData);
    }
  }
})();

// Export for different environments
if (typeof window !== 'undefined') {
  window.FeedbackWidget = FeedbackWidget;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackWidget;
}