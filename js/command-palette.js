/**
 * Command Palette (Spotlight Search)
 * Handles node creation and navigation via a centralized search interface.
 */
class CommandPalette {
    constructor() {
        this.isVisible = false;
        this.element = null;
        this.input = null;
        this.resultsContainer = null;
        this.selectedIndex = 0;
        this.results = [];
        this.nodeTypes = []; // Will be populated in init
        this.searchResults = []; // For multi-result navigation
        this.currentResultIndex = 0;
        this.navBar = null;

        this.init();
    }

    init() {
        // Populate node types with localized strings
        this.nodeTypes = [
            { type: 'default', label: getText('cpTextNode'), icon: 'fa-font', description: getText('cpTextNodeDesc') },
            { type: 'checklist', label: getText('cpChecklist'), icon: 'fa-list-ul', description: getText('cpChecklistDesc') },
            { type: 'timer', label: getText('cpTimer'), icon: 'fa-clock', description: getText('cpTimerDesc') },
        ];

        this.createUI();
        this.setupEvents();
    }

    createUI() {
        // Create container
        this.element = document.createElement('div');
        this.element.id = 'command-palette';
        this.element.className = 'command-palette';
        this.element.style.display = 'none';

        // Create input wrapper
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'cp-input-wrapper';

        // Search Icon
        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search cp-search-icon';
        inputWrapper.appendChild(searchIcon);

        // Input
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = getText('cpPlaceholder');
        this.input.className = 'cp-input';
        inputWrapper.appendChild(this.input);

        this.element.appendChild(inputWrapper);

        // Results container
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'cp-results';
        this.element.appendChild(this.resultsContainer);

        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'command-palette-overlay';
        this.overlay.className = 'command-palette-overlay';
        this.overlay.style.display = 'none';

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.element);
    }

    setupEvents() {
        // Close on overlay click
        this.overlay.addEventListener('click', () => this.hide());

        // Input handling
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Global shortcut (Shift+A)
        document.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key.toLowerCase() === 'a') {
                // Only if not typing in another input (unless it's the body)
                if (document.activeElement === document.body || document.activeElement === this.element) {
                    e.preventDefault();
                    this.toggle();
                }
            }
            // Close on Escape
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Global click to clear highlights and navigation
        document.addEventListener('click', (e) => {
            // Don't clear if clicking on command palette or navigation bar
            if (!e.target.closest('#command-palette') &&
                !e.target.closest('#search-nav-bar') &&
                !e.target.closest('.node.selected')) {
                this.clearAllHighlights();
                this.hideNavigationBar();
            }
        });
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        this.isVisible = true;
        this.element.style.display = 'block';
        this.overlay.style.display = 'block';
        this.input.value = '';
        this.input.focus();
        this.handleInput(); // Show default list
    }

    hide() {
        this.isVisible = false;
        this.element.style.display = 'none';
        this.overlay.style.display = 'none';
    }

    handleInput() {
        const query = this.input.value.toLowerCase().trim();
        this.results = [];

        // 1. Node Types (Always show if query matches or empty)
        this.nodeTypes.forEach(type => {
            if (query === '' || type.label.toLowerCase().includes(query)) {
                this.results.push({
                    category: getText('cpCreateNew'),
                    ...type,
                    action: () => this.createNode(type.type)
                });
            }
        });

        // 2. Existing Nodes (Search content) - case-insensitive
        if (query !== '') {
            const nodes = document.querySelectorAll('.node');
            nodes.forEach(node => {
                const content = node.innerText.toLowerCase(); // Already lowercase for case-insensitive
                if (content.includes(query)) {
                    // Try to get a meaningful snippet
                    const snippet = node.innerText.substring(0, 50) + '...';
                    this.results.push({
                        category: getText('cpGoToNode'),
                        label: snippet,
                        icon: 'fa-location-arrow',
                        description: getText('cpJumpToNode') || 'Jump to this node',
                        action: () => this.jumpToNode(node)
                    });
                }
            });

            // 3. Groups (Search group names) - NEW
            if (window.groups && window.groups.size > 0) {
                window.groups.forEach((group, groupId) => {
                    const groupName = group.name.toLowerCase();
                    if (groupName.includes(query)) {
                        this.results.push({
                            category: getText('cpGoToGroup') || 'Go to Group',
                            label: group.name,
                            icon: 'fa-object-group',
                            description: `${group.nodeIds.length} ${getText('cpNodes') || 'nodes'}`,
                            action: () => this.jumpToGroup(group)
                        });
                    }
                });
            }
        }

        this.renderResults();
    }

    renderResults() {
        this.resultsContainer.innerHTML = '';
        this.selectedIndex = 0;

        if (this.results.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'cp-no-results';
            noResults.textContent = getText('cpNoResults');
            this.resultsContainer.appendChild(noResults);
            return;
        }

        let currentCategory = null;

        this.results.forEach((result, index) => {
            // Category Header
            if (result.category !== currentCategory) {
                const header = document.createElement('div');
                header.className = 'cp-category-header';
                header.textContent = result.category;
                this.resultsContainer.appendChild(header);
                currentCategory = result.category;
            }

            // Result Item
            const item = document.createElement('div');
            item.className = 'cp-result-item';
            if (index === 0) item.classList.add('selected');

            item.innerHTML = `
                <div class="cp-item-icon"><i class="fas ${result.icon}"></i></div>
                <div class="cp-item-details">
                    <div class="cp-item-label">${result.label}</div>
                    <div class="cp-item-desc">${result.description}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                result.action();
                this.hide();
            });

            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.resultsContainer.appendChild(item);
        });
    }

    handleKeydown(e) {
        if (this.results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
            this.updateSelection();
            this.scrollToSelected();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
            this.updateSelection();
            this.scrollToSelected();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.results[this.selectedIndex].action();
            this.hide();
        }
    }

    updateSelection() {
        const items = this.resultsContainer.querySelectorAll('.cp-result-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    scrollToSelected() {
        const selected = this.resultsContainer.querySelector('.cp-result-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    createNode(type) {
        if (window.createNode) {
            // Create at center of viewport
            const center = this.getViewportCenter();
            const newNode = window.createNode(center.x, center.y, null, type);

            if (newNode) {
                // Select the new node
                if (window.clearSelectedNodes) window.clearSelectedNodes();
                if (window.selectNode) window.selectNode(newNode);

                // Pan to it smoothly
                if (window.viewportManager && window.viewportManager.panToNode) {
                    window.viewportManager.panToNode(newNode, true);
                }
            }
        }
    }

    jumpToNode(node) {
        console.log('[CommandPalette] jumpToNode called', { node, viewportManager: window.viewportManager });

        // Store the search query for highlighting
        const query = this.input.value.toLowerCase().trim();

        // Find all nodes that match this query
        if (query) {
            this.searchResults = [];
            const allNodes = document.querySelectorAll('.node');
            allNodes.forEach(n => {
                if (n.innerText.toLowerCase().includes(query)) {
                    this.searchResults.push(n);
                }
            });

            // Find the current node's index
            this.currentResultIndex = this.searchResults.indexOf(node);

            //Show navigation bar if multiple results
            if (this.searchResults.length > 1) {
                this.showNavigationBar(query);
            } else {
                this.hideNavigationBar();
            }
        }

        // Deselect others
        if (window.clearSelectedNodes) window.clearSelectedNodes();

        // Select this node
        if (window.selectNode) window.selectNode(node);

        // Highlight the search term in the node
        if (query) {
            this.highlightSearchTerm(node, query);
        }

        // Pan viewport to node
        if (window.viewportManager && window.viewportManager.panToNode) {
            console.log('[CommandPalette] Calling viewportManager.panToNode');
            window.viewportManager.panToNode(node, true);
        } else {
            // Fallback manual pan
            console.log('[CommandPalette] No viewportManager, using fallback', node);
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    highlightSearchTerm(node, query) {
        // Clear any existing highlights first
        this.clearHighlights(node);

        // Get all text nodes within the node
        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let currentNode;
        while (currentNode = walker.nextNode()) {
            textNodes.push(currentNode);
        }

        // Highlight matching text in each text node
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const lowerText = text.toLowerCase();
            const index = lowerText.indexOf(query);

            if (index !== -1) {
                const beforeText = text.substring(0, index);
                const matchText = text.substring(index, index + query.length);
                const afterText = text.substring(index + query.length);

                const fragment = document.createDocumentFragment();

                if (beforeText) fragment.appendChild(document.createTextNode(beforeText));

                const highlight = document.createElement('mark');
                highlight.className = 'search-highlight';
                highlight.style.backgroundColor = '#ffeb3b';
                highlight.style.color = '#000';
                highlight.style.padding = '2px 4px';
                highlight.style.borderRadius = '3px';
                highlight.textContent = matchText;
                fragment.appendChild(highlight);

                if (afterText) fragment.appendChild(document.createTextNode(afterText));

                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });

        // Store reference to clear later
        node.dataset.hasHighlight = 'true';
    }

    clearHighlights(node) {
        const highlights = node.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            const text = highlight.textContent;
            highlight.replaceWith(document.createTextNode(text));
        });
        delete node.dataset.hasHighlight;
    }

    jumpToGroup(group) {
        console.log('[CommandPalette] jumpToGroup called', { group, viewportManager: window.viewportManager });

        // Select the group
        if (window.selectGroup) window.selectGroup(group);

        // Pan to TOP-LEFT corner where the group label is, not center
        // Add a small offset to show the label nicely
        const labelX = group.bounds.x + 20; // Small padding from left edge
        const labelY = group.bounds.y + 20; // Small padding from top edge

        console.log('[CommandPalette] Group label position:', { labelX, labelY });

        // Pan viewport to group label position
        if (window.viewportManager && window.viewportManager.panToPosition) {
            console.log('[CommandPalette] Calling viewportManager.panToPosition');
            window.viewportManager.panToPosition(labelX, labelY, true);
        } else {
            console.log('[CommandPalette] No viewportManager.panToPosition, using fallback');
            // Fallback: manually update canvas transform
            const canvasWrapper = document.getElementById('canvas-wrapper');
            if (canvasWrapper) {
                const targetOffsetX = canvasWrapper.clientWidth / 2 - labelX * window.canvasScale;
                const targetOffsetY = canvasWrapper.clientHeight / 2 - labelY * window.canvasScale;

                window.canvasOffset.x = targetOffsetX;
                window.canvasOffset.y = targetOffsetY;
                if (window.updateCanvasTransform) {
                    window.updateCanvasTransform();
                }
            }
        }
    }

    getViewportCenter() {
        // Similar to ActionBar logic
        const canvas = document.getElementById('canvas');
        if (!canvas) return { x: 0, y: 0 };

        // Assuming window.canvasOffset and window.canvasScale are available
        const offsetX = window.canvasOffset ? window.canvasOffset.x : 0;
        const offsetY = window.canvasOffset ? window.canvasOffset.y : 0;
        const scale = window.canvasScale || 1;

        const centerX = (window.innerWidth / 2 - offsetX) / scale;
        const centerY = (window.innerHeight / 2 - offsetY) / scale;

        return { x: centerX, y: centerY };
    }

    showNavigationBar(query) {
        if (!this.navBar) {
            this.createNavigationBar();
        }

        const navCount = this.navBar.querySelector('.nav-count');
        if (navCount) {
            navCount.textContent = `${this.currentResultIndex + 1} / ${this.searchResults.length}`;
        }

        this.navBar.style.display = 'flex';
    }

    hideNavigationBar() {
        if (this.navBar) {
            this.navBar.style.display = 'none';
        }
    }

    createNavigationBar() {
        // Create navigation bar
        this.navBar = document.createElement('div');
        this.navBar.id = 'search-nav-bar';
        this.navBar.style.position = 'fixed';
        this.navBar.style.bottom = '80px';
        this.navBar.style.left = '50%';
        this.navBar.style.transform = 'translateX(-50%)';
        this.navBar.style.display = 'none';
        this.navBar.style.flexDirection = 'row';
        this.navBar.style.alignItems = 'center';
        this.navBar.style.gap = '10px';
        this.navBar.style.padding = '10px 20px';
        this.navBar.style.backgroundColor = 'var(--node-bg)';
        this.navBar.style.border = '1px solid var(--border-color)';
        this.navBar.style.borderRadius = '8px';
        this.navBar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        this.navBar.style.zIndex = '2000';

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        prevBtn.style.background = 'transparent';
        prevBtn.style.border = 'none';
        prevBtn.style.cursor = 'pointer';
        prevBtn.style.fontSize = '16px';
        prevBtn.style.color = 'var(--text-color)';
        prevBtn.style.padding = '5px 10px';
        prevBtn.addEventListener('click', () => this.navigateToPrevious());

        // Count display
        const countDisplay = document.createElement('span');
        countDisplay.className = 'nav-count';
        countDisplay.style.fontSize = '14px';
        countDisplay.style.color = 'var(--text-color)';
        countDisplay.style.minWidth = '60px';
        countDisplay.style.textAlign = 'center';
        countDisplay.textContent = '1 / 1';

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        nextBtn.style.background = 'transparent';
        nextBtn.style.border = 'none';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontSize = '16px';
        nextBtn.style.color = 'var(--text-color)';
        nextBtn.style.padding = '5px 10px';
        nextBtn.addEventListener('click', () => this.navigateToNext());

        this.navBar.appendChild(prevBtn);
        this.navBar.appendChild(countDisplay);
        this.navBar.appendChild(nextBtn);

        document.body.appendChild(this.navBar);
    }

    navigateToPrevious() {
        if (this.searchResults.length === 0) return;

        this.currentResultIndex = (this.currentResultIndex - 1 + this.searchResults.length) % this.searchResults.length;
        const node = this.searchResults[this.currentResultIndex];

        // Update count
        const navCount = this.navBar.querySelector('.nav-count');
        if (navCount) {
            navCount.textContent = `${this.currentResultIndex + 1} / ${this.searchResults.length}`;
        }

        // Jump to node (without re-searching)
        if (window.clearSelectedNodes) window.clearSelectedNodes();
        if (window.selectNode) window.selectNode(node);

        const query = this.input.value.toLowerCase().trim();
        if (query) {
            this.highlightSearchTerm(node, query);
        }

        if (window.viewportManager && window.viewportManager.panToNode) {
            window.viewportManager.panToNode(node, true);
        }
    }

    navigateToNext() {
        if (this.searchResults.length === 0) return;

        this.currentResultIndex = (this.currentResultIndex + 1) % this.searchResults.length;
        const node = this.searchResults[this.currentResultIndex];

        // Update count
        const navCount = this.navBar.querySelector('.nav-count');
        if (navCount) {
            navCount.textContent = `${this.currentResultIndex + 1} / ${this.searchResults.length}`;
        }

        // Jump to node (without re-searching)
        if (window.clearSelectedNodes) window.clearSelectedNodes();
        if (window.selectNode) window.selectNode(node);

        const query = this.input.value.toLowerCase().trim();
        if (query) {
            this.highlightSearchTerm(node, query);
        }

        if (window.viewportManager && window.viewportManager.panToNode) {
            window.viewportManager.panToNode(node, true);
        }
    }

    clearAllHighlights() {
        // Clear highlights from all nodes
        const allNodes = document.querySelectorAll('.node[data-has-highlight]');
        allNodes.forEach(node => {
            this.clearHighlights(node);
        });
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.commandPalette = new CommandPalette();
});
