/**
 * Action Bar (Island) Management
 * Handles the floating action bar at the bottom of the screen
 */

class ActionBar {
    constructor() {
        this.element = document.getElementById('action-bar');
        this.selectedCount = 0;
        this.init();
    }

    init() {
        console.log('ActionBar: init called');
        if (!this.element) {
            console.error('ActionBar: #action-bar element not found!');
            return;
        }
        this.render();

        // Listen for selection changes
        // We'll need to trigger this from nodes.js
        window.addEventListener('selectionChanged', (e) => {
            this.selectedCount = e.detail.count;
            this.render();
        });
    }

    render() {
        if (!this.element) return;
        console.log('ActionBar: rendering state, selectedCount:', this.selectedCount);

        this.element.innerHTML = '';

        // 1. Context Actions (Left/Center) - Only if nodes selected
        if (this.selectedCount > 0) {
            this.renderContextActions();
            this.addSeparator();
        }

        // 2. Persistent Actions (Right) - Always visible
        this.renderPersistentActions();
    }

    renderContextActions() {
        // Color Picker
        const colorBtn = this.createButton('fa-palette', getText('actionBarColor'));
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            this.showColorPicker(colorBtn);
        };
        this.element.appendChild(colorBtn);

        // Visibility Toggle
        const visibilityBtn = this.createButton('fa-eye', getText('actionBarVisibility'));
        visibilityBtn.onclick = () => {
            if (window.selectedNodes) {
                window.selectedNodes.forEach(node => {
                    // Toggle content-only mode
                    node.classList.toggle('content-only-mode');

                    // Update the icon if it existed (legacy support or if we re-add it)
                    const toggleBtn = node.querySelector('.node-visibility-toggle');
                    if (toggleBtn && window.updateVisibilityToggleState) {
                        // This function might need the button element, but we can just toggle the icon class manually if needed
                        const icon = toggleBtn.querySelector('i');
                        if (icon) {
                            if (node.classList.contains('content-only-mode')) {
                                icon.classList.remove('fa-eye');
                                icon.classList.add('fa-eye-slash');
                            } else {
                                icon.classList.remove('fa-eye-slash');
                                icon.classList.add('fa-eye');
                            }
                        }
                    }
                });
                // Schedule auto-save
                if (window.scheduleAutoSave) window.scheduleAutoSave();
            }
        };
        this.element.appendChild(visibilityBtn);

        // Group/Ungroup Button
        const groupBtn = this.createButton('fa-object-group', getText('actionBarGroup'));
        groupBtn.onclick = () => {
            // Check if a group is selected (for ungrouping)
            if (window.selectedGroup) {
                const groupId = window.selectedGroup.id;
                if (confirm(`Ungroup "${window.selectedGroup.name}"? Nodes will not be deleted.`)) {
                    window.deleteGroup(groupId);
                }
            }
            // Otherwise, create a new group from selected nodes
            else if (window.selectedNodes && window.selectedNodes.size >= 2) {
                window.createGroup(window.selectedNodes);
            }
        };
        this.element.appendChild(groupBtn);

        // Delete Button
        const deleteBtn = this.createButton('fa-trash', getText('actionBarDelete'));
        deleteBtn.style.color = '#ff4444';
        deleteBtn.onclick = () => {
            if (window.deleteSelectedNodes) {
                window.deleteSelectedNodes();
            } else if (window.deleteNode && window.selectedNodes) {
                // Fallback
                const nodesToDelete = Array.from(window.selectedNodes);
                nodesToDelete.forEach(node => window.deleteNode(node));
                window.selectedNodes.clear();
            }
        };
        this.element.appendChild(deleteBtn);

        // Selection Count
        const countDisplay = document.createElement('div');
        countDisplay.className = 'selection-count';
        countDisplay.textContent = `${this.selectedCount} ${getText('actionBarSelected')}`;
        this.element.appendChild(countDisplay);
    }

    renderPersistentActions() {
        // Spotlight Button (Add + Search)
        const spotlightBtn = this.createButton('fa-search-plus', getText('actionBarSpotlight'), 'primary');
        spotlightBtn.onclick = () => {
            if (window.commandPalette) {
                window.commandPalette.toggle();
            }
        };
        this.element.appendChild(spotlightBtn);
    }

    showColorPicker(targetBtn) {
        // Remove existing color picker
        const existingPicker = document.querySelector('.action-bar-color-picker');
        if (existingPicker) {
            existingPicker.remove();
            return; // Toggle off
        }

        const picker = document.createElement('div');
        picker.className = 'action-bar-color-picker';
        picker.style.position = 'absolute';
        picker.style.bottom = '100%';
        picker.style.left = '50%';
        picker.style.transform = 'translateX(-50%)';
        picker.style.marginBottom = '12px';
        picker.style.background = 'rgba(255, 255, 255, 0.95)';
        picker.style.backdropFilter = 'blur(10px)';
        picker.style.padding = '8px';
        picker.style.borderRadius = '12px';
        picker.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
        picker.style.display = 'flex';
        picker.style.gap = '8px';
        picker.style.zIndex = '3001'; // Above action bar

        // Add dark mode support
        if (document.body.classList.contains('night-mode')) {
            picker.style.background = 'rgba(40, 40, 40, 0.95)';
            picker.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }

        const colors = window.stripColors || [
            '#c2f8cb', '#D9FF73', '#FFD166', '#EF767A', '#7D80DA',
            '#49DCB1', '#FB6480', '#F9C3FF', '#7FDEFF', '#FFB865'
        ];

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.width = '24px';
            swatch.style.height = '24px';
            swatch.style.borderRadius = '50%';
            swatch.style.backgroundColor = color;
            swatch.style.cursor = 'pointer';
            swatch.style.border = '2px solid transparent';
            swatch.style.transition = 'transform 0.2s';

            swatch.onmouseover = () => swatch.style.transform = 'scale(1.2)';
            swatch.onmouseout = () => swatch.style.transform = 'scale(1)';

            swatch.onclick = (e) => {
                e.stopPropagation();
                this.applyColorToSelection(color);
                picker.remove();
            };

            picker.appendChild(swatch);
        });

        // Append to the button itself to position relative to it
        targetBtn.appendChild(picker);

        // Close on click outside
        const closeHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== targetBtn && !targetBtn.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    applyColorToSelection(color) {
        if (window.selectedNodes) {
            window.selectedNodes.forEach(node => {
                const strip = node.querySelector('.strip');
                if (strip && window.setStripColor) {
                    window.setStripColor(strip, color);
                }
            });
        }
    }

    createButton(iconClass, tooltip, extraClass = '') {
        const btn = document.createElement('div');
        btn.className = `action-bar-item ${extraClass}`;
        btn.dataset.tooltip = tooltip;
        btn.innerHTML = `<i class="fas ${iconClass}"></i>`;
        return btn;
    }

    addSeparator() {
        const sep = document.createElement('div');
        sep.className = 'action-bar-separator';
        this.element.appendChild(sep);
    }

    getViewportCenter() {
        // Calculate center based on canvas offset and scale
        // This logic might need to be adjusted based on canvas.js implementation
        const canvas = document.getElementById('canvas');
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const centerX = (window.innerWidth / 2 - window.canvasOffset.x) / window.canvasScale;
        const centerY = (window.innerHeight / 2 - window.canvasOffset.y) / window.canvasScale;

        return { x: centerX, y: centerY };
    }

    // Method to manually update state (can be called from nodes.js)
    update(count) {
        this.selectedCount = count;
        this.render();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('ActionBar: DOM fully loaded, initializing ActionBar.');
    window.actionBar = new ActionBar();
});
