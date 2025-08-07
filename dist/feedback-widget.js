const FeedbackStorage = {
  STORAGE_KEY: 'feedback_widget_data',
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
    return hoursSinceActivity >= 24;
  },

  getStorageInfo() {
    return {
      available: this.isStorageAvailable(),
      currentSize: this.getCurrentStorageSize(),
      totalSize: this.getTotalStorageSize(),
      maxSize: this.MAX_STORAGE_SIZE,
      itemCount: this.getFeedbackCount()
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

  getElementInfo(element) {
    if (!element) return null;
    
    return {
      selector: this.generateCSSSelector(element),
      text: this.getElementText(element)
    };
  },

  getElementText(element) {
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
    
    // Truncate to 20 words if longer
    const words = text.split(' ');
    if (words.length > 20) {
      text = words.slice(0, 20).join(' ') + '...';
    }
    
    return text;
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
  highlightOverlay: null,
  onElementSelected: null,
  originalCursor: null,
  
  activate(onElementSelectedCallback) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.onElementSelected = onElementSelectedCallback;
    this.originalCursor = document.body.style.cursor;
    
    // Change cursor to crosshair
    document.body.style.cursor = 'crosshair';
    
    // Create highlight overlay
    this.createHighlightOverlay();
    
    // Add event listeners
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('mouseout', this.handleMouseOut);
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
    
    // Remove highlight overlay
    this.removeHighlightOverlay();
    
    // Remove event listeners
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('contextmenu', this.preventDefault);
    document.removeEventListener('selectstart', this.preventDefault);
  },

  createHighlightOverlay() {
    if (this.highlightOverlay) return;
    
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.className = 'feedback-widget-element-highlight';
    this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #007bff;
      background-color: rgba(0, 123, 255, 0.1);
      z-index: 999999;
      display: none;
      box-sizing: border-box;
    `;
    document.body.appendChild(this.highlightOverlay);
  },

  removeHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  },

  updateHighlight(element) {
    if (!this.highlightOverlay || !element) {
      this.hideHighlight();
      return;
    }
    
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.left = rect.left + scrollX + 'px';
    this.highlightOverlay.style.top = rect.top + scrollY + 'px';
    this.highlightOverlay.style.width = rect.width + 'px';
    this.highlightOverlay.style.height = rect.height + 'px';
  },

  hideHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
  },

  handleMouseOver: function(e) {
    if (!ElementSelector.isActive) return;
    
    const element = e.target;
    if (!FeedbackContext.isValidElement(element)) {
      ElementSelector.hideHighlight();
      return;
    }
    
    ElementSelector.updateHighlight(element);
  }.bind(this),

  handleMouseOut: function(e) {
    if (!ElementSelector.isActive) return;
    ElementSelector.hideHighlight();
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
    
    // Show selection feedback
    ElementSelector.showSelectionFeedback(element);
    
    // Call callback with selected element
    if (ElementSelector.onElementSelected) {
      ElementSelector.onElementSelected(element);
    }
    
    // Deactivate selector
    ElementSelector.deactivate();
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
    // Temporarily change highlight to show selection
    if (this.highlightOverlay) {
      this.highlightOverlay.style.borderColor = '#28a745';
      this.highlightOverlay.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
      
      // Reset after a short delay
      setTimeout(() => {
        if (this.highlightOverlay) {
          this.highlightOverlay.style.borderColor = '#007bff';
          this.highlightOverlay.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
        }
      }, 200);
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

  // Method to highlight element without selecting (for preview)
  previewElement(element) {
    if (!this.canSelectElement(element)) {
      this.hideHighlight();
      return false;
    }
    
    this.updateHighlight(element);
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
      padding: 8px;
      font-size: 12px;
      margin: 8px 0;
    `;
    
    const selectorSpan = document.createElement('div');
    selectorSpan.style.cssText = `
      font-family: monospace;
      color: #495057;
      margin-bottom: 4px;
      word-break: break-all;
    `;
    selectorSpan.textContent = elementInfo.selector;
    
    const textSpan = document.createElement('div');
    textSpan.style.cssText = `
      color: #6c757d;
      font-style: italic;
    `;
    textSpan.textContent = elementInfo.text ? `"${elementInfo.text}"` : '(no text content)';
    
    preview.appendChild(selectorSpan);
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
      contextText += `  - Element: ${this.escapeMarkdown(element.selector)}`;
      
      if (element.text && element.text.trim()) {
        contextText += ` "${this.escapeMarkdown(element.text)}"`;
      }
      contextText += '\n';
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
  floatingButton: null,
  adminPanel: null,
  floatingMenu: null,
  isInitialized: false,
  isAdminPanelOpen: false,
  isContextMenuOpen: false,
  
  init() {
    if (this.isInitialized) return;
    
    this.createContainer();
    this.createFloatingButton();
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
    if (!this.floatingButton) return;
    
    const count = FeedbackStorage.getFeedbackCount();
    const counter = this.floatingButton.querySelector('.feedback-btn-counter');
    if (counter) {
      counter.textContent = count.toString();
      counter.style.display = count > 0 ? 'inline-block' : 'none';
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
    
    menu.innerHTML = `
      <div class="feedback-menu-item" data-action="select-element">
        <span class="feedback-menu-icon">🎯</span>
        <span class="feedback-menu-text">Select Element for Feedback</span>
      </div>
      <div class="feedback-menu-item" data-action="admin">
        <span class="feedback-menu-icon">⚙️</span>
        <span class="feedback-menu-text">Admin Panel</span>
        <span class="feedback-menu-badge">${count}</span>
      </div>
      ${count > 0 ? `
      <div class="feedback-menu-item" data-action="export">
        <span class="feedback-menu-icon">📥</span>
        <span class="feedback-menu-text">Export Feedback</span>
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
            <button type="submit" class="feedback-widget-submit-btn">Submit Feedback</button>
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
      this.showSuccess('Feedback submitted successfully!');
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
    
    panel.innerHTML = `
      <div class="feedback-widget-admin-header">
        <h3>Feedback Management (${items.length} items)</h3>
        <button class="feedback-widget-admin-close-btn" type="button">&times;</button>
      </div>
      
      <div class="feedback-widget-admin-actions">
        <button class="feedback-widget-export-btn" ${items.length === 0 ? 'disabled' : ''}>Export All</button>
        <button class="feedback-widget-clear-btn" ${items.length === 0 ? 'disabled' : ''}>Clear All</button>
      </div>
      
      <div class="feedback-widget-storage-info">
        <small>Storage: ${Math.round(storageInfo.currentSize / 1024)}KB used</small>
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
    
    return items.map(item => `
      <div class="feedback-widget-admin-item" data-id="${item.id}">
        <div class="feedback-widget-item-header">
          <span class="feedback-widget-item-type feedback-widget-type-${item.type}">${item.type}</span>
          <span class="feedback-widget-item-priority feedback-widget-priority-${item.priority}">${item.priority}</span>
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
    `).join('');
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
      
      // Ask if user wants to clear data after export
      setTimeout(() => {
        if (confirm('Export complete. Clear all feedback to start a new session?')) {
          FeedbackStorage.clearAllFeedback();
          this.updateFeedbackCounter();
          this.refreshAdminPanel();
        }
      }, 1000);
      
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
      
      .feedback-widget-empty {
        padding: 40px 20px;
        text-align: center;
        color: #666;
        font-style: italic;
      }
      
      @media (max-width: 480px) {
        .feedback-widget-modal {
          margin: 10px;
        }
        
        .feedback-widget-admin-panel {
          width: calc(100vw - 40px);
          right: 20px;
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
    sessionGapHours: 24
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
      // Check for session gap and prompt if needed
      this.checkSessionGap();
      
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
      const shouldClear = confirm(
        'Start new feedback session? Previous session will be cleared.\n\n' +
        'Click OK to clear old feedback, or Cancel to continue with existing feedback.'
      );
      
      if (shouldClear) {
        FeedbackStorage.clearAllFeedback();
        console.log('Previous feedback session cleared');
      }
    }
  },


  setupUnloadWarning() {
    window.addEventListener('beforeunload', (e) => {
      const count = FeedbackStorage.getFeedbackCount();
      if (count > 0) {
        const message = `You have ${count} unsaved feedback item(s). Consider exporting them before leaving.`;
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
        this.emit('feedbackWidget:feedbackExported', { format, itemCount: items.length });
        return true;
      } else if (format === 'json') {
        this.exportAsJSON(items);
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