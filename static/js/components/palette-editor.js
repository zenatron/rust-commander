import { DOMUtils } from '../utils/dom-utils.js';
import { modalManager } from '../utils/modal-manager.js';
import { eventManager, APP_EVENTS } from '../utils/event-manager.js';
import { Validators } from '../utils/validators.js';

// Dedicated palette editor component
export class PaletteEditor {
  constructor(messageManager) {
    this.messageManager = messageManager;
    this.editingPaletteData = null;
    this.unsavedChanges = false;
    this.currentPaletteName = '';
    
    this.modal = null;
    this.tabsContainer = null;
    this.contentContainer = null;
  }

  /**
   * Show palette editor modal
   */
  showEditor(paletteData, paletteName) {
    this.currentPaletteName = paletteName;
    
    // Parse the palette data if it's a string
    try {
      this.editingPaletteData = typeof paletteData === 'string' ? JSON.parse(paletteData) : paletteData;
    } catch (e) {
      console.error("Invalid palette data:", e);
      this.messageManager.showResponse("Error: Invalid palette data format.", true, "error");
      return;
    }

    // Reset unsaved flag
    this.unsavedChanges = false;

    const content = this.createEditorContent();
    
    this.modal = modalManager.createModal('palette-editor-modal', {
      title: `Edit Palette: ${paletteName}`,
      content: content,
      className: 'palette-editor-modal',
      closeOnOutsideClick: false // Prevent accidental close
    });

    // Create the tabbed interface
    this.tabsContainer = this.modal.dialog.querySelector('#paletteEditorTabs');
    this.contentContainer = this.modal.dialog.querySelector('#paletteEditorContent');
    
    this.createPaletteEditorTabs();
    this.attachEventHandlers();
  }

  /**
   * Create editor content HTML
   */
  createEditorContent() {
    return `
      <div class="palette-editor-container">
        <div class="palette-editor-tabs" id="paletteEditorTabs">
          <!-- Tabs will be dynamically generated here -->
        </div>
        <div class="palette-editor-content" id="paletteEditorContent">
          <!-- Tab content will be dynamically generated here -->
        </div>
      </div>
      <div class="palette-editor-actions">
        <div class="primary-actions">
          <button type="button" id="savePaletteChangesButton">Save Changes</button>
          <button type="button" id="cancelEditPaletteButton">Cancel</button>
        </div>
        <button type="button" id="addCategoryButton" class="btn-secondary">+ Add Category</button>
      </div>
    `;
  }

  /**
   * Create tabbed interface for categories
   */
  createPaletteEditorTabs() {
    if (!this.tabsContainer || !this.contentContainer) return;

    // Clear existing content
    this.tabsContainer.innerHTML = "";
    this.contentContainer.innerHTML = "";

    const categories = Object.keys(this.editingPaletteData);
    let firstTab = true;

    categories.forEach((categoryName, index) => {
      this.createCategoryTab(categoryName, index, firstTab);
      firstTab = false;
    });
  }

  /**
   * Create a single category tab
   */
  createCategoryTab(categoryName, index, isActive = false) {
    // Create tab button
    const tab = DOMUtils.createElement('div', {
      class: `palette-editor-tab ${isActive ? 'active' : ''}`,
      'data-category': categoryName
    });
    
    const tabLabel = DOMUtils.createElement('span', {}, categoryName);
    tab.appendChild(tabLabel);

    // Add delete button for category (except if it's the only one)
    const categories = Object.keys(this.editingPaletteData);
    if (categories.length > 1) {
      const deleteBtn = DOMUtils.createElement('button', {
        class: 'delete-category-btn',
        title: `Delete "${categoryName}" category`
      }, '×');
      
      DOMUtils.addEventListener(deleteBtn, 'click', (e) => {
        e.stopPropagation();
        this.deleteCategory(categoryName);
      });
      
      tab.appendChild(deleteBtn);
    }

    DOMUtils.addEventListener(tab, 'click', () => this.activateTab(categoryName));
    this.tabsContainer.appendChild(tab);

    // Create tab content
    const tabContent = this.createTabContent(categoryName, index, isActive);
    this.contentContainer.appendChild(tabContent);
  }

  /**
   * Create tab content for a category
   */
  createTabContent(categoryName, index, isActive = false) {
    const tabContent = DOMUtils.createElement('div', {
      class: `palette-editor-tab-content ${isActive ? 'active' : ''}`,
      'data-category': categoryName
    });

    // Category controls
    const controls = DOMUtils.createElement('div', {
      class: 'palette-editor-category-controls'
    });
    
    const controlsHTML = `
      <label>Category Name:</label>
      <input type="text" id="categoryName_${index}" value="${DOMUtils.escapeHtml(categoryName)}" placeholder="Category name">
      <button type="button" class="btn-secondary" data-rename-category="${categoryName}" data-input-id="categoryName_${index}">Rename</button>
    `;
    
    DOMUtils.setContent(controls, controlsHTML, true);
    tabContent.appendChild(controls);

    // Mark unsaved changes when category name edited
    const nameInput = controls.querySelector(`#categoryName_${index}`);
    DOMUtils.addEventListener(nameInput, 'input', () => {
      this.unsavedChanges = true;
    });

    // JSON editor for this category
    const textarea = DOMUtils.createElement('textarea', {
      class: 'palette-editor-textarea',
      'data-category': categoryName,
      placeholder: 'Enter JSON commands for this category...'
    });
    
    textarea.value = JSON.stringify(this.editingPaletteData[categoryName] || {}, null, 2);
    
    DOMUtils.addEventListener(textarea, 'input', () => {
      this.unsavedChanges = true;
    });
    
    tabContent.appendChild(textarea);

    return tabContent;
  }

  /**
   * Activate a tab
   */
  activateTab(categoryName) {
    // Remove active class from all tabs and contents
    DOMUtils.querySelectorAll('.palette-editor-tab').forEach(tab => 
      DOMUtils.toggleClass(tab, 'active', false));
    DOMUtils.querySelectorAll('.palette-editor-tab-content').forEach(content => 
      DOMUtils.toggleClass(content, 'active', false));

    // Add active class to selected tab and content
    const activeTab = DOMUtils.querySelector(`[data-category="${categoryName}"]`);
    const activeContent = DOMUtils.querySelector(`.palette-editor-tab-content[data-category="${categoryName}"]`);
    
    if (activeTab) DOMUtils.toggleClass(activeTab, 'active', true);
    if (activeContent) DOMUtils.toggleClass(activeContent, 'active', true);
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryName) {
    const confirmed = await modalManager.showConfirmDialog(
      `Are you sure you want to delete the "${categoryName}" category and all its commands?`,
      {
        title: 'Delete Category',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );

    if (!confirmed) return;

    // Remove from editing data
    if (this.editingPaletteData && this.editingPaletteData[categoryName]) {
      delete this.editingPaletteData[categoryName];
    }

    // Recreate the interface
    this.createPaletteEditorTabs();

    this.messageManager.showResponse(`Category "${categoryName}" deleted.`, false, "info");
    this.unsavedChanges = true;
  }

  /**
   * Rename a category
   */
  async renameCategory(oldName, newName) {
    // Validate new name
    const validation = Validators.isValidCategoryName(newName);
    if (!validation.isValid) {
      this.messageManager.showResponse(validation.message, false, "warn");
      return;
    }

    if (newName === oldName) {
      return; // No change
    }

    if (this.editingPaletteData && this.editingPaletteData[newName]) {
      this.messageManager.showResponse("A category with this name already exists.", false, "warn");
      return;
    }

    if (!this.editingPaletteData) return;

    // Move the data to the new key
    this.editingPaletteData[newName] = this.editingPaletteData[oldName];
    delete this.editingPaletteData[oldName];

    // Recreate the interface
    this.createPaletteEditorTabs();
    
    // Activate the renamed tab
    this.activateTab(newName);

    this.messageManager.showResponse(`Category renamed from "${oldName}" to "${newName}".`, false, "info");
    this.unsavedChanges = true;
  }

  /**
   * Add a new category
   */
  async addNewCategory() {
    const categoryName = await modalManager.showInputDialog(
      "Enter name for the new category:",
      {
        title: 'Add Category',
        placeholder: 'Category name'
      }
    );

    if (!categoryName) return;

    // Validate category name
    const validation = Validators.isValidCategoryName(categoryName);
    if (!validation.isValid) {
      this.messageManager.showResponse(validation.message, false, "warn");
      return;
    }

    if (this.editingPaletteData && this.editingPaletteData[categoryName]) {
      this.messageManager.showResponse("A category with this name already exists.", false, "warn");
      return;
    }

    // Add new empty category
    if (!this.editingPaletteData) this.editingPaletteData = {};
    this.editingPaletteData[categoryName] = {};

    // Recreate the interface
    this.createPaletteEditorTabs();
    
    // Activate the new tab
    this.activateTab(categoryName);

    this.messageManager.showResponse(`Category "${categoryName}" added.`, false, "info");
    this.unsavedChanges = true;
  }

  /**
   * Get edited palette content
   */
  getPaletteEditorContent() {
    if (!this.editingPaletteData) {
      return null;
    }

    // Collect data from all textareas
    const result = {};
    const textareas = DOMUtils.querySelectorAll('.palette-editor-textarea');
    
    for (const textarea of textareas) {
      const categoryName = textarea.dataset.category;
      try {
        const categoryData = JSON.parse(textarea.value.trim() || '{}');
        result[categoryName] = categoryData;
      } catch (e) {
        this.messageManager.showResponse(
          `Invalid JSON in category "${categoryName}". Please check the syntax.`, 
          false, 
          "error"
        );
        return null;
      }
    }

    return JSON.stringify(result);
  }

  /**
   * Save changes
   */
  async saveChanges() {
    const content = this.getPaletteEditorContent();
    if (content === null) return false;

    let commands;
    try {
      commands = JSON.parse(content);
    } catch (e) {
      this.messageManager.showResponse("Invalid JSON format in editor.", true, "error");
      return false;
    }

    // Check if the resulting command object is empty
    if (Object.keys(commands).length === 0) {
      this.messageManager.showResponse("Palette content cannot be empty.", true, "warn");
      return false;
    }

    // Emit save event
    eventManager.emit(APP_EVENTS.PALETTE_UPDATED, {
      name: this.currentPaletteName,
      commands: commands,
      content: content
    });

    this.unsavedChanges = false;
    return true;
  }

  /**
   * Close editor
   */
  async closeEditor() {
    if (this.unsavedChanges) {
      const shouldDiscard = await modalManager.showConfirmDialog(
        'You have unsaved changes. Are you sure you want to close without saving?',
        {
          title: 'Unsaved Changes',
          confirmText: 'Discard Changes',
          cancelText: 'Keep Editing'
        }
      );

      if (!shouldDiscard) return false;
    }

    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
    }

    this.cleanup();
    return true;
  }

  /**
   * Attach event handlers
   */
  attachEventHandlers() {
    if (!this.modal) return;

    const dialog = this.modal.dialog;

    // Save button
    const saveBtn = dialog.querySelector('#savePaletteChangesButton');
    if (saveBtn) {
      DOMUtils.addEventListener(saveBtn, 'click', async () => {
        const success = await this.saveChanges();
        if (success) {
          this.closeEditor();
        }
      });
    }

    // Cancel button
    const cancelBtn = dialog.querySelector('#cancelEditPaletteButton');
    if (cancelBtn) {
      DOMUtils.addEventListener(cancelBtn, 'click', () => {
        this.closeEditor();
      });
    }

    // Add category button
    const addCategoryBtn = dialog.querySelector('#addCategoryButton');
    if (addCategoryBtn) {
      DOMUtils.addEventListener(addCategoryBtn, 'click', () => {
        this.addNewCategory();
      });
    }

    // Rename category buttons (delegated)
    eventManager.delegate(dialog, 'click', '[data-rename-category]', (event) => {
      const button = event.target;
      const oldName = button.dataset.renameCategory;
      const inputId = button.dataset.inputId;
      const input = dialog.querySelector(`#${inputId}`);
      
      if (input) {
        const newName = input.value.trim();
        this.renameCategory(oldName, newName);
      }
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.editingPaletteData = null;
    this.unsavedChanges = false;
    this.currentPaletteName = '';
    this.tabsContainer = null;
    this.contentContainer = null;
  }
} 