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
}