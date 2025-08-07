# Inline Feedback Widget

A lightweight JavaScript widget for collecting contextual user feedback that can be embedded into any web application. Feedback is stored locally and can be exported as Obsidian-compatible markdown with actionable checklists.

## Features

- 🎯 **Element Selection**: Click any DOM element to associate feedback with specific UI components
- 💾 **Local Storage**: All feedback stored in browser localStorage, no server required
- 📝 **Obsidian Export**: Generate markdown files with actionable checkboxes for Obsidian
- 🎨 **No Dependencies**: Vanilla JavaScript with CSS-in-JS styling
- 🔧 **Admin Interface**: Built-in management panel for reviewing and exporting feedback
- 📱 **Responsive**: Works on desktop and mobile devices

## Quick Start

### 1. Include the Widget

**Option A: Use bundled file**
```html
<script src="dist/feedback-widget.min.js"></script>
```

**Option B: Use individual files (development)**
```html
<script src="src/storage.js"></script>
<script src="src/context.js"></script>
<script src="src/element-selector.js"></script>
<script src="src/export.js"></script>
<script src="src/ui.js"></script>
<script src="src/widget.js"></script>
```

### 2. The Widget Auto-Initializes

That's it! The widget will automatically:
- Add a floating feedback button (💬) in the bottom right
- Set up keyboard shortcuts (F12 for admin panel)
- Handle localStorage management

### 3. Configuration (Optional)

**Via script data attributes:**
```html
<script src="feedback-widget.min.js" 
        data-auto-init="true"
        data-session-gap-hours="24"></script>
```

**Via global config object:**
```html
<script>
window.FeedbackWidgetConfig = {
  autoInit: true,
  showFloatingButton: true,
  sessionGapHours: 24
};
</script>
<script src="feedback-widget.min.js"></script>
```

## Usage

### For End Users

1. **Open Menu**: Click the feedback button (💬⚙️) in bottom right
2. **Start Feedback**: Select "Select Element for Feedback" from the menu
3. **Select Element**: Click on any page element you want to give feedback about
4. **Fill Form**: Choose type, priority, and write your message about the selected element
5. **Submit**: Feedback is saved locally with element context

### For Administrators

1. **Access Admin Menu**: Click the feedback button to open the action menu
2. **Quick Actions**: Use menu options for instant export or admin panel access
3. **Admin Panel**: Select "Admin Panel" to review all collected feedback items
4. **Export**: Download as Obsidian-compatible markdown directly from menu
5. **Manage**: Delete individual items or clear all feedback

### JavaScript API

```javascript
// Show feedback modal (will show error - element selection required)
FeedbackWidget.show();

// Show admin panel  
FeedbackWidget.showAdmin();

// Add feedback programmatically
FeedbackWidget.addFeedback('bug-report', 'Button is not working', 'high', element);

// Get all feedback items
const items = FeedbackWidget.getFeedback();

// Export feedback
FeedbackWidget.exportFeedback('markdown'); // or 'json'

// Clear all feedback
FeedbackWidget.clearAllFeedback();

// Debug info
console.log(FeedbackWidget.debug());
```

## Feedback Types

- **Text Change**: Suggestions for copy/content modifications
- **Feature Request**: New functionality requests  
- **Bug Report**: Issues and problems
- **General**: Other feedback

## Priority Levels

- **High**: Urgent issues requiring immediate attention
- **Medium**: Important but not critical (default)
- **Low**: Nice to have improvements

## Export Format

The widget exports feedback as Obsidian-compatible markdown:

```markdown
# Feedback Export - 2025-08-07

**Summary**: 3 total items | 1 high priority | 2 bugs

## Text Changes
- [ ] Change "Submit" to "Save Changes" (Priority: High)
  <details>
  <summary>Context</summary>
  
  - URL: /admin/settings
  - Time: 2025-08-07 10:30:00
  - Page: Settings Page
  - Element: button#submit-btn "Submit"
  
  </details>

## Bug Reports
- [ ] Login button not responding on mobile (Priority: High)
  <details>
  <summary>Context</summary>
  
  - URL: /login
  - Time: 2025-08-07 10:25:00
  - Page: Login
  - Element: button.login-btn "Sign In"
  
  </details>
```

## Events

Listen for widget events:

```javascript
// Feedback added
FeedbackWidget.on('feedbackWidget:feedbackAdded', function(event) {
  console.log('New feedback:', event.detail);
});

// Feedback exported
FeedbackWidget.on('feedbackWidget:feedbackExported', function(event) {
  console.log('Exported:', event.detail.itemCount, 'items');
});

// Widget initialized
FeedbackWidget.on('feedbackWidget:initialized', function() {
  console.log('Widget ready');
});
```

## Browser Support

- Modern browsers with ES6+ support
- localStorage must be available
- Graceful degradation for older browsers

## Storage

- Uses browser localStorage (key: `feedback_widget_data`)
- ~4.5MB size limit with warnings before quota exceeded  
- Automatic session gap detection (24+ hours prompts for new session)
- Data persists across page reloads within same domain

## User Interface

### Feedback Button
- **Click**: Open action menu with options:
  - Select Element for Feedback
  - Admin Panel (with feedback count badge)
  - Export Feedback (if items exist)  
  - Clear All (if items exist)
- **Long Press** (mobile): Same as click (opens menu)

### Keyboard Shortcuts
- **Escape**: Close modal/cancel element selection

## File Structure

```
feedback-widget/
├── src/
│   ├── storage.js           # localStorage management
│   ├── context.js          # Page context and element info capture
│   ├── element-selector.js # DOM element selection functionality  
│   ├── export.js          # Markdown generation and download
│   ├── ui.js              # DOM manipulation and styling
│   └── widget.js          # Main orchestrator and API
├── dist/
│   ├── feedback-widget.js     # Bundled version
│   └── feedback-widget.min.js # Minified bundle
├── example/
│   └── demo.html          # Complete demo page
└── README.md
```

## Demo

Open `example/demo.html` in your browser to see the widget in action with various UI elements to test feedback collection on.

## License

Open source - feel free to modify and use in your projects.