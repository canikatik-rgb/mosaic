/**
 * Viewport Manager
 * Handles performance optimization by culling off-screen nodes and managing image memory.
 */

class ViewportManager {
    constructor() {
        this.isVisible = true;
        this.updateScheduled = false;
        this.buffer = 500; // Pixel buffer around viewport to prevent pop-in
        this.lastTransform = { x: 0, y: 0, scale: 1 };
        
        // Bind methods
        this.update = this.update.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        
        // Performance metrics
        this.visibleNodeCount = 0;
        this.totalNodeCount = 0;
    }

    init() {
        console.log('ViewportManager initialized');
        // Initial update
        this.update();
    }

    /**
     * Schedule an update (throttled/debounced via requestAnimationFrame)
     */
    scheduleUpdate() {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(this.update);
        }
    }

    /**
     * Main update loop
     */
    update() {
        this.updateScheduled = false;
        
        // Get current canvas state
        const canvasOffset = window.canvasOffset || { x: 0, y: 0 };
        const canvasScale = window.canvasScale || 1;
        
        // Check if transform actually changed significantly to warrant a full update
        // We update if scale changed or if position changed by more than a small amount
        const transformChanged = 
            Math.abs(canvasScale - this.lastTransform.scale) > 0.001 ||
            Math.abs(canvasOffset.x - this.lastTransform.x) > 10 ||
            Math.abs(canvasOffset.y - this.lastTransform.y) > 10;
            
        // Always update if it's the first run or forced
        // But for now, let's just run it. Optimization of the optimizer can come later if needed.
        
        this.lastTransform = { ...canvasOffset, scale: canvasScale };
        
        // Calculate viewport bounds in CANVAS coordinates
        // We add a buffer to ensure nodes don't pop in visibly
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;
        
        const viewportWidth = wrapper.clientWidth;
        const viewportHeight = wrapper.clientHeight;
        
        // Convert viewport bounds to canvas coordinates
        // x = (screenX - offsetX) / scale
        const minX = (-canvasOffset.x - this.buffer) / canvasScale;
        const minY = (-canvasOffset.y - this.buffer) / canvasScale;
        const maxX = (viewportWidth - canvasOffset.x + this.buffer) / canvasScale;
        const maxY = (viewportHeight - canvasOffset.y + this.buffer) / canvasScale;
        
        // Get all nodes
        const nodes = document.getElementsByClassName('node');
        this.totalNodeCount = nodes.length;
        this.visibleNodeCount = 0;
        
        // Iterate and toggle visibility
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            // Skip if node is currently being dragged (always keep visible)
            if (node.classList.contains('dragging')) {
                this.setNodeVisibility(node, true);
                this.visibleNodeCount++;
                continue;
            }
            
            // Get node position
            // Using style.left/top is faster than getBoundingClientRect for many nodes
            // assuming standard positioning
            const x = parseFloat(node.style.left) || 0;
            const y = parseFloat(node.style.top) || 0;
            
            // Estimate node size if not cached (or use a safe default)
            // We could cache this, but for now let's assume a safe max size
            // Most nodes are < 500px width/height
            const width = node.offsetWidth || 300; 
            const height = node.offsetHeight || 200;
            
            // Check intersection
            const isVisible = (
                x + width >= minX &&
                x <= maxX &&
                y + height >= minY &&
                y <= maxY
            );
            
            this.setNodeVisibility(node, isVisible);
            
            if (isVisible) {
                this.visibleNodeCount++;
            }
        }
        
        // Update connections visibility based on node visibility
        this.updateConnectionsVisibility();
        
        // Debug info
        if (window.debugMode) {
            this.updateDebugInfo();
        }
    }

    /**
     * Toggle node visibility and handle image resources
     */
    setNodeVisibility(node, isVisible) {
        // We use a specific class for hiding to avoid interfering with other display states
        // or we can use direct style manipulation for performance
        
        const wasVisible = !node.classList.contains('viewport-hidden');
        
        if (isVisible && !wasVisible) {
            // Show node
            node.classList.remove('viewport-hidden');
            // Restore images
            this.toggleImages(node, true);
        } else if (!isVisible && wasVisible) {
            // Hide node
            node.classList.add('viewport-hidden');
            // Unload images
            this.toggleImages(node, false);
        }
    }

    /**
     * Manage image memory by swapping src with data-src
     */
    toggleImages(node, load) {
        const images = node.getElementsByTagName('img');
        for (let img of images) {
            if (load) {
                // Restore src from data-src if it exists
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                }
            } else {
                // Save src to data-src and clear src to free memory
                // Only do this for base64 images or large images to save memory
                // For now, we do it for all to be safe, but we could filter
                if (img.src && !img.dataset.src) {
                    img.dataset.src = img.src;
                    // Use a tiny transparent pixel or empty string
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                }
            }
        }
    }

    /**
     * Update connections visibility
     * A connection is visible only if BOTH start and end nodes are visible
     * OR if it's currently being created/dragged
     */
    updateConnectionsVisibility() {
        // This might be expensive to query all connections every frame
        // But we can optimize by only checking connections attached to toggled nodes
        // For now, let's iterate all connection paths
        
        const connections = document.querySelectorAll('.connection');
        
        for (let conn of connections) {
            const startNodeId = conn.dataset.startNode;
            const endNodeId = conn.dataset.endNode;
            
            const startNode = document.getElementById(startNodeId);
            const endNode = document.getElementById(endNodeId);
            
            if (!startNode || !endNode) continue;
            
            const startVisible = !startNode.classList.contains('viewport-hidden');
            const endVisible = !endNode.classList.contains('viewport-hidden');
            
            // If either node is hidden, hide the connection
            // Exception: If we want to show connections going off-screen, we'd check if *either* is visible
            // But for max performance, hiding if *either* is hidden is better (less SVG to draw)
            // However, UX-wise, seeing a line go off-screen is nice.
            // Let's stick to: Show if AT LEAST ONE node is visible.
            
            const isVisible = startVisible || endVisible;
            
            if (isVisible) {
                conn.style.display = '';
            } else {
                conn.style.display = 'none';
            }
        }
    }

    handleScroll() {
        this.scheduleUpdate();
    }
    
    updateDebugInfo() {
        let debugEl = document.getElementById('viewport-debug');
        if (!debugEl) {
            debugEl = document.createElement('div');
            debugEl.id = 'viewport-debug';
            debugEl.style.position = 'fixed';
            debugEl.style.top = '50px';
            debugEl.style.right = '10px';
            debugEl.style.background = 'rgba(0,0,0,0.7)';
            debugEl.style.color = '#0f0';
            debugEl.style.padding = '5px';
            debugEl.style.pointerEvents = 'none';
            debugEl.style.zIndex = '9999';
            document.body.appendChild(debugEl);
        }
        
        debugEl.innerHTML = `
            Nodes: ${this.visibleNodeCount} / ${this.totalNodeCount}<br>
            Culling: ${Math.round((1 - this.visibleNodeCount/this.totalNodeCount)*100)}%
        `;
    }
}

// Create global instance
window.viewportManager = new ViewportManager();
