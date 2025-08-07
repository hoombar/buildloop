const FeedbackWidget = {
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