const ElementSelector = {
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
}