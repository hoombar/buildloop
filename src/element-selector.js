const ElementSelector = {
  isActive: false,
  selectedElement: null,
  statusBox: null,
  onElementSelected: null,
  originalCursor: null,
  originalBodyPadding: null,
  lastMousePosition: { x: 0, y: 0 },
  positionUpdateTimeout: null,
  
  activate(onElementSelectedCallback) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.onElementSelected = onElementSelectedCallback;
    this.originalCursor = document.body.style.cursor;
    this.originalBodyPadding = document.body.style.paddingBottom || '';
    
    // Change cursor to crosshair
    document.body.style.cursor = 'crosshair';
    
    // Push content up by adding padding to body (matches box height)
    document.body.style.paddingBottom = '16vh';
    
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
    
    // Restore body padding
    document.body.style.paddingBottom = this.originalBodyPadding || '';
    
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
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 16vh;
      background: white;
      border: 2px solid #007bff;
      border-radius: 8px 8px 0 0;
      box-shadow: 0 -4px 12px rgba(0, 123, 255, 0.3);
      padding: 12px 20px 16px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.3;
      z-index: 999999;
      pointer-events: none;
      opacity: 0.95;
      box-sizing: border-box;
      overflow-y: auto;
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
        
        // Add DOM path for element location (truncated)
        if (context.domPath) {
          const truncatedPath = this.truncateDomPath(context.domPath, 70);
          contextParts.push(`<span style="color: #28a745; font-size: 10px; font-family: monospace;">Path: ${this.escapeHtml(truncatedPath)}</span>`);
        }
        
        if (contextParts.length > 0) {
          contextHtml = `
            <div style="margin-bottom: 4px; padding: 3px 6px; background: #f8f9fa; border-radius: 3px; font-size: 11px; line-height: 1.3;">
              <div style="color: #666; margin-bottom: 1px; font-weight: 600;">Context:</div>
              <div style="font-family: monospace;">
                ${contextParts.join('<br>')}
              </div>
            </div>
          `;
        }
      }
      
      statusContent.innerHTML = `
        ${contextHtml}
        <div style="margin-top: 2px;"><strong>Content:</strong> ${elementInfo.text ? '"' + this.escapeHtml(this.truncateText(elementInfo.text, 120)) + '"' : '(no text content)'}</div>
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
    // Status box is now fixed to bottom of screen - no positioning needed
    return;
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

  truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  truncateDomPath(domPath, maxLength = 80) {
    if (!domPath || domPath.length <= maxLength) return domPath;
    // Try to keep the most specific part (end) of the path
    const parts = domPath.split(' > ');
    if (parts.length > 1) {
      let result = parts[parts.length - 1]; // Start with the most specific
      for (let i = parts.length - 2; i >= 0; i--) {
        const candidate = parts[i] + ' > ' + result;
        if (candidate.length > maxLength) {
          return '...' + result;
        }
        result = candidate;
      }
      return result;
    }
    return domPath.substring(0, maxLength) + '...';
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
    
    // Status box is now fixed - no positioning updates needed
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
        
        // Add DOM path for element location (truncated)
        if (context.domPath) {
          const truncatedPath = this.truncateDomPath(context.domPath, 70);
          contextParts.push(`<span style="color: #155724; font-size: 10px; font-family: monospace;">Path: ${this.escapeHtml(truncatedPath)}</span>`);
        }
        
        if (contextParts.length > 0) {
          contextHtml = `
            <div style="margin-bottom: 4px; padding: 3px 6px; background: #d4edda; border-radius: 3px; font-size: 11px; line-height: 1.3;">
              <div style="color: #155724; margin-bottom: 1px; font-weight: 600;">Selected Context:</div>
              <div style="font-family: monospace;">
                ${contextParts.join('<br>')}
              </div>
            </div>
          `;
        }
      }
      
      statusContent.innerHTML = `
        <div style="color: #28a745; font-weight: 600; margin-bottom: 2px;">✅ Element Selected!</div>
        ${contextHtml}
        <div style="margin-top: 2px;"><strong>Content:</strong> ${elementInfo.text ? '"' + this.escapeHtml(this.truncateText(elementInfo.text, 120)) + '"' : '(no text content)'}</div>
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
}