/**
 * Canvas Management
 * Handles the infinite canvas with zooming, panning, and grid background
 */

// Global canvas variables
let canvasOffset = { x: 0, y: 0 };
let canvasScale = 1.0;
let isPanning = false;
let startPoint = { x: 0, y: 0 };

// Canvas dimensions - much larger for infinite feel
const canvasWidth = 100000;
const canvasHeight = 100000;

// Initialize canvas behavior
function initCanvas() {
    const canvasWrapper = document.getElementById('canvas-wrapper');

    // Create a structure similar to the old version with separate elements
    createCanvasStructure();

    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');
    const canvasBackground = document.getElementById('canvas-background');

    // Set up dimensions
    canvasContent.style.width = canvasWidth + 'px';
    canvasContent.style.height = canvasHeight + 'px';

    // Set initial canvas position (center of the viewport)
    centerCanvas();

    // Make variables globally accessible
    window.canvasScale = canvasScale;
    window.canvasOffset = canvasOffset;

    // Add debug center marker if in debug mode
    if (window.debugMode) {
        const centerMarker = document.createElement('div');
        centerMarker.id = 'canvas-center-marker';
        centerMarker.style.position = 'absolute';
        centerMarker.style.width = '10px';
        centerMarker.style.height = '10px';
        centerMarker.style.backgroundColor = 'blue';
        centerMarker.style.borderRadius = '50%';
        centerMarker.style.left = '0px';
        centerMarker.style.top = '0px';
        centerMarker.style.transform = 'translate(-5px, -5px)';
        centerMarker.style.zIndex = '999';
        centerMarker.style.pointerEvents = 'none';
        canvasContent.appendChild(centerMarker);
    }

    // Handle mousedown for panning - use all canvas elements as targets
    canvas.addEventListener('mousedown', function (e) {
        if (e.target === canvas || e.target === canvasBackground || e.target === canvasContent) {
            // Only start panning if Alt key is NOT pressed, shift key is NOT pressed, and not in connection removal mode
            if (!window.isRemovingConnections && !e.altKey && !e.shiftKey && !(window.shiftKeyDown === true)) {
                isPanning = true;
                startPoint = { x: e.clientX, y: e.clientY };
                document.body.classList.add('panning');
            }
        }
    });

    // Handle mouse move for panning
    document.addEventListener('mousemove', function (e) {
        if (isPanning) {
            const dx = e.clientX - startPoint.x;
            const dy = e.clientY - startPoint.y;

            canvasOffset.x += dx;
            canvasOffset.y += dy;

            startPoint = { x: e.clientX, y: e.clientY };

            updateCanvasTransform();
        }
    });

    // Handle mouse up to stop panning
    document.addEventListener('mouseup', function () {
        isPanning = false;
        document.body.classList.remove('panning');
    });

    // Handle mouse wheel for zooming - smoother zoom like old version
    canvas.addEventListener('wheel', handleZoom);

    // Double click on canvas to create a new node
    canvas.addEventListener('dblclick', function (e) {
        if (e.target === canvas || e.target === canvasBackground || e.target === canvasContent) {
            const pos = getCanvasPosition(e);
            if (window.createNode) {
                window.createNode(pos.x, pos.y);
            }
        }
    });

    // Reset canvas button
    document.getElementById('reset-canvas').addEventListener('click', resetCanvasView);

    console.log('Canvas initialized with dimensions:', canvasWidth, 'x', canvasHeight);
}

// Create canvas structure like the old version
function createCanvasStructure() {
    const wrapper = document.getElementById('canvas-wrapper');

    // Clear existing content
    wrapper.innerHTML = '';

    // Create the background element (for the grid)
    const canvasBackground = document.createElement('div');
    canvasBackground.id = 'canvas-background';
    canvasBackground.style.position = 'absolute';
    canvasBackground.style.top = '0';
    canvasBackground.style.left = '0';
    canvasBackground.style.width = '400%';
    canvasBackground.style.height = '400%';
    canvasBackground.style.background = 'radial-gradient(var(--grid-color) 1px, transparent 1px), radial-gradient(var(--grid-color) 1px, transparent 1px)';
    canvasBackground.style.backgroundSize = '20px 20px';
    canvasBackground.style.backgroundPosition = '0 0, 10px 10px';
    canvasBackground.style.transformOrigin = '0 0';

    // Create the content element (for nodes)
    const canvasContent = document.createElement('div');
    canvasContent.id = 'canvas-content';
    canvasContent.style.position = 'absolute';
    canvasContent.style.top = '0';
    canvasContent.style.left = '0';
    canvasContent.style.width = '1000%';
    canvasContent.style.height = '1000%';
    canvasContent.style.transformOrigin = '0 0';

    // Create the main canvas container
    const canvas = document.createElement('div');
    canvas.id = 'canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.overflow = 'hidden';
    canvas.style.cursor = 'grab';

    // Append elements
    canvas.appendChild(canvasBackground);
    canvas.appendChild(canvasContent);
    wrapper.appendChild(canvas);
}

// Center the canvas
function centerCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');

    // Calculate the offset needed to place the canvas center
    // at the center of the viewport.
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const viewportCenterX = wrapper.clientWidth / 2;
    const viewportCenterY = wrapper.clientHeight / 2;

    // Position the canvas center at the viewport center
    canvasOffset.x = viewportCenterX - canvasCenterX * canvasScale;
    canvasOffset.y = viewportCenterY - canvasCenterY * canvasScale;

    updateCanvasTransform();
}

// Update the canvas transformation
function updateCanvasTransform() {
    const canvasContent = document.getElementById('canvas-content');
    const canvasBackground = document.getElementById('canvas-background');

    // Transform content with nodes
    canvasContent.style.transform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`;

    // Transform background grid with offset modulo grid size for infinite effect
    // This is key to the smooth background effect in the old version
    canvasBackground.style.transform = `translate(${canvasOffset.x % (20 * canvasScale)}px, ${canvasOffset.y % (20 * canvasScale)}px) scale(${canvasScale})`;

    // Update global variables
    window.canvasScale = canvasScale;
    window.canvasOffset = canvasOffset;

    // Update connections if function exists
    if (window.updateNodeConnections) {
        window.updateNodeConnections();
    }

    // Update viewport visibility
    if (window.viewportManager) {
        window.viewportManager.scheduleUpdate();
    }
}

// Handle zoom events - match old version's smoother zoom
function handleZoom(e) {
    e.preventDefault();

    const rect = document.getElementById('canvas-wrapper').getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Use smaller zoom factor for smoother zooming
    const zoomFactor = 1 - e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, canvasScale * zoomFactor), 4);

    // Calculate mouse position relative to canvas
    const mouseCanvasX = (mouseX - canvasOffset.x) / canvasScale;
    const mouseCanvasY = (mouseY - canvasOffset.y) / canvasScale;

    // Update offset to keep point under mouse fixed
    canvasOffset.x = mouseX - mouseCanvasX * newScale;
    canvasOffset.y = mouseY - mouseCanvasY * newScale;

    // Set the new scale
    canvasScale = newScale;

    // Update the canvas transform
    updateCanvasTransform();
}

// Reset canvas to default view with animation
function resetCanvasView() {
    // Save current state
    const startScale = canvasScale;
    const startOffsetX = canvasOffset.x;
    const startOffsetY = canvasOffset.y;

    // Calculate target state
    const targetScale = 1.0;

    // Calculate center position (same as in centerCanvas)
    const wrapper = document.getElementById('canvas-wrapper');
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const viewportCenterX = wrapper.clientWidth / 2;
    const viewportCenterY = wrapper.clientHeight / 2;

    // Target offset when scale is 1.0
    const targetOffsetX = viewportCenterX - canvasCenterX * targetScale;
    const targetOffsetY = viewportCenterY - canvasCenterY * targetScale;

    // Animate the transition
    const duration = 800; // Animation duration in ms
    const startTime = performance.now();

    function animateReset(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1); // Value between 0 and 1

        // Easing function for smooth animation (easeOutQuad)
        const eased = 1 - (1 - progress) * (1 - progress);

        // Interpolate between start and target values
        canvasScale = startScale + (targetScale - startScale) * eased;
        canvasOffset.x = startOffsetX + (targetOffsetX - startOffsetX) * eased;
        canvasOffset.y = startOffsetY + (targetOffsetY - startOffsetY) * eased;

        // Update the canvas transform
        updateCanvasTransform();

        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animateReset);
        }
    }

    requestAnimationFrame(animateReset);
}

// Get canvas position for a mouse event
function getCanvasPosition(e) {
    // Calculate the mouse position relative to the canvas origin, in canvas coordinates
    return {
        x: (e.clientX - canvasOffset.x) / canvasScale,
        y: (e.clientY - canvasOffset.y) / canvasScale
    };
}

// Deselect all nodes
function deselectAllNodes() {
    const selectedNodes = document.querySelectorAll('.node.selected');
    selectedNodes.forEach(node => {
        node.classList.remove('selected');
    });

    // Clear the selected nodes set
    if (window.selectedNodes) {
        window.selectedNodes.clear();
    }
}

// Check if a node is visible in the viewport
function isNodeVisible(node) {
    const canvasRect = document.getElementById('canvas-wrapper').getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    return (
        nodeRect.right >= canvasRect.left &&
        nodeRect.left <= canvasRect.right &&
        nodeRect.bottom >= canvasRect.top &&
        nodeRect.top <= canvasRect.bottom
    );
}

// Export functions to global scope
window.initCanvas = initCanvas;
window.getCanvasPosition = getCanvasPosition;
window.updateCanvasTransform = updateCanvasTransform;
window.deselectAllNodes = deselectAllNodes;
window.resetCanvasView = resetCanvasView;
window.centerCanvas = centerCanvas;
window.isNodeVisible = isNodeVisible;
