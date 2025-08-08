const FeedbackWidget = {
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