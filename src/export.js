const FeedbackExport = {
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
}