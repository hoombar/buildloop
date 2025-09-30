const FeedbackUI = {
  container: null,
  modal: null,
  sessionGapModal: null,
  feedbackPopup: null,
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
      <div class="feedback-menu-item" data-action="view">
        <span class="feedback-menu-icon">👁️</span>
        <span class="feedback-menu-text">View Feedback</span>
      </div>
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
      case 'view':
        this.showFeedbackPopup();
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

  showFeedbackPopup() {
    if (this.feedbackPopup) {
      this.closeFeedbackPopup();
    }

    const items = FeedbackStorage.getFeedbackItems();
    if (items.length === 0) {
      this.showError('No feedback items to display');
      return;
    }

    this.feedbackPopup = this.createFeedbackPopup(items);
    this.container.appendChild(this.feedbackPopup);

    // Focus the copy button
    setTimeout(() => {
      const copyBtn = this.feedbackPopup.querySelector('.feedback-popup-copy-btn');
      if (copyBtn) copyBtn.focus();
    }, 100);
  },

  createFeedbackPopup(items) {
    const popup = document.createElement('div');
    popup.className = 'feedback-widget-modal-overlay feedback-popup-overlay';

    const markdown = FeedbackExport.generateMarkdown(items);
    const previewText = this.escapeHtml(markdown);

    popup.innerHTML = `
      <div class="feedback-widget-modal feedback-popup-modal">
        <div class="feedback-widget-header">
          <h3>Feedback (${items.length} items)</h3>
          <button class="feedback-widget-close-btn feedback-popup-close" type="button">&times;</button>
        </div>

        <div class="feedback-popup-content">
          <div class="feedback-popup-actions">
            <button type="button" class="feedback-popup-copy-btn">
              <span class="copy-icon">📋</span>
              Copy to Clipboard
            </button>
            <button type="button" class="feedback-popup-export-btn">
              <span class="export-icon">📥</span>
              Download File
            </button>
          </div>

          <div class="feedback-popup-preview">
            <pre class="feedback-popup-text">${previewText}</pre>
          </div>
        </div>
      </div>
    `;

    this.bindFeedbackPopupEvents(popup, markdown);
    return popup;
  },

  bindFeedbackPopupEvents(popup, markdown) {
    const closeBtn = popup.querySelector('.feedback-popup-close');
    const copyBtn = popup.querySelector('.feedback-popup-copy-btn');
    const exportBtn = popup.querySelector('.feedback-popup-export-btn');

    // Close popup events
    closeBtn.addEventListener('click', () => this.closeFeedbackPopup());
    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.closeFeedbackPopup();
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', () => {
      this.copyToClipboard(markdown, copyBtn);
    });

    // Export file
    exportBtn.addEventListener('click', () => {
      this.handleExport();
      this.closeFeedbackPopup();
    });

    // Escape key to close
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.closeFeedbackPopup();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  },

  async copyToClipboard(text, button) {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        this.showCopySuccess(button);
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

      this.showCopySuccess(button);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showError('Failed to copy to clipboard. Please try manual selection.');
    }
  },

  showCopySuccess(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="copy-icon">✅</span> Copied!';
    button.style.background = '#28a745';

    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = '';
    }, 2000);

    this.showSuccess('Feedback copied to clipboard!');
  },

  closeFeedbackPopup() {
    if (this.feedbackPopup) {
      this.feedbackPopup.remove();
      this.feedbackPopup = null;
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
        <button class="feedback-widget-view-btn" ${items.length === 0 ? 'disabled' : ''}>View All</button>
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
    const viewBtn = panel.querySelector('.feedback-widget-view-btn');
    const exportBtn = panel.querySelector('.feedback-widget-export-btn');
    const clearBtn = panel.querySelector('.feedback-widget-clear-btn');
    const deleteButtons = panel.querySelectorAll('.feedback-widget-delete-item-btn');

    closeBtn.addEventListener('click', () => this.closeAdminPanel());
    viewBtn.addEventListener('click', () => this.showFeedbackPopup());
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
        overflow: hidden;
        overscroll-behavior: contain;
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
      
      .feedback-widget-view-btn {
        background: #6c757d !important;
        color: white !important;
        border-color: #6c757d !important;
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
      
      /* Feedback Popup Styles */
      .feedback-popup-modal {
        max-width: 700px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .feedback-popup-content {
        padding: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .feedback-popup-actions {
        padding: 20px 20px 16px;
        border-bottom: 1px solid #eee;
        display: flex;
        gap: 12px;
        flex-shrink: 0;
      }

      .feedback-popup-copy-btn,
      .feedback-popup-export-btn {
        padding: 10px 16px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }

      .feedback-popup-copy-btn:hover,
      .feedback-popup-export-btn:hover {
        background: #f8f9fa;
        border-color: #007bff;
      }

      .feedback-popup-copy-btn {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }

      .feedback-popup-copy-btn:hover {
        background: #0056b3;
        color: white;
      }

      .feedback-popup-export-btn .export-icon,
      .feedback-popup-copy-btn .copy-icon {
        font-size: 16px;
      }

      .feedback-popup-preview {
        flex: 1;
        overflow: hidden;
        padding: 0 20px 20px;
      }

      .feedback-popup-text {
        width: 100%;
        height: 100%;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 16px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 13px;
        line-height: 1.5;
        background: #f8f9fa;
        color: #333;
        overflow: auto;
        overscroll-behavior: contain;
        white-space: pre-wrap;
        word-wrap: break-word;
        margin: 0;
        box-sizing: border-box;
        resize: none;
        max-height: 400px;
        min-height: 200px;
      }

      .feedback-popup-text:focus {
        outline: 2px solid #007bff;
        outline-offset: -1px;
      }

      /* Mobile responsiveness for popup */
      @media (max-width: 768px) {
        .feedback-popup-modal {
          max-width: calc(100vw - 20px);
          margin: 10px;
          max-height: 85vh;
        }

        .feedback-popup-actions {
          flex-direction: column;
          gap: 8px;
        }

        .feedback-popup-copy-btn,
        .feedback-popup-export-btn {
          justify-content: center;
        }

        .feedback-popup-text {
          font-size: 12px;
        }
      }

      /* Element Selector Status Box - Fixed to bottom of screen */
      .feedback-widget-status-box {
        /* Fixed positioning at bottom of viewport */
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        
        /* Larger size for better content display (16vh = ~1/6th of screen) */
        width: 100% !important;
        height: 16vh !important;
        
        /* Visual styling */
        background: white !important;
        border: 2px solid #007bff !important;
        border-radius: 8px 8px 0 0 !important; /* Only top corners rounded */
        box-shadow: 0 -4px 12px rgba(0, 123, 255, 0.3) !important; /* Shadow points upward */
        
        /* Content styling - Optimized for 6 lines within 12.5vh */
        padding: 12px 20px 16px 20px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.3 !important; /* Compact line spacing for more content */
        
        /* Layer and interaction */
        z-index: 999999 !important; /* Above all other elements */
        pointer-events: none !important; /* Don't interfere with element selection */
        opacity: 0.95 !important;
        box-sizing: border-box !important;
        
        /* Scrolling for overflow content */
        overflow-y: auto !important;
        
        /* No transitions to prevent movement when cursor intersects */
        transition: none !important;
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
    this.closeFeedbackPopup();
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
}