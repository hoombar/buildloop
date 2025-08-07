const ElementSelector = {
  isActive: false,
  selectedElement: null,
  statusBox: null,
  onElementSelected: null,
  originalCursor: null,
  
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
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('contextmenu', this.preventDefault);
    document.removeEventListener('selectstart', this.preventDefault);
  },

  createStatusBox() {
    if (this.statusBox) return;
    
    this.statusBox = document.createElement('div');
    this.statusBox.className = 'feedback-widget-status-box';
    this.statusBox.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      max-width: 600px;
      margin: 0 auto;
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
    `;
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
        <div style="margin-bottom: 2px;"><strong>Selector:</strong> ${this.escapeHtml(elementInfo.selector)}</div>
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
        <div style="margin-bottom: 2px;"><strong>Selector:</strong> ${this.escapeHtml(elementInfo.selector)}</div>
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
    
    const selectorSpan = document.createElement('div');
    selectorSpan.style.cssText = `
      font-family: monospace;
      color: #495057;
      margin-bottom: 4px;
      word-break: break-all;
      font-weight: 600;
    `;
    selectorSpan.innerHTML = '<strong>Selector:</strong> ' + this.escapeHtml(elementInfo.selector);
    
    const textSpan = document.createElement('div');
    textSpan.style.cssText = `
      color: #6c757d;
      font-style: italic;
    `;
    textSpan.innerHTML = '<strong>Content:</strong> ' + (elementInfo.text ? '"' + this.escapeHtml(elementInfo.text) + '"' : '(no text content)');
    
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
}