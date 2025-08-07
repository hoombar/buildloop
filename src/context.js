const FeedbackContext = {
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
      parentContext: null
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
}