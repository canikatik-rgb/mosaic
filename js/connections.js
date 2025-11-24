/**
 * Connection Management
 * Handles creating, updating, and removing connections between nodes
 */

// Global connection variables
let currentConnection = null;
let startNode = null;
let startPin = null;
let isDraggingPin = false;
let isRemovingConnections = false;
let removalStart = null;
let foundIntersection = false;
let removalLineStart = null; // Add variable for removal line tracking

// Start creating a connection from a pin
function startConnection(e, node, pin) {
    if (isRemovingConnections) return;

    e.stopPropagation();
    isDraggingPin = true;
    startNode = node;
    startPin = pin.classList.contains('left') ? 'left' : 'right';

    // Create SVG element for the connection
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '5'; // Below pins (z-index 10) but above other elements

    // Create path element for the connection line
    currentConnection = document.createElementNS("http://www.w3.org/2000/svg", "path");
    currentConnection.setAttribute('stroke', 'var(--connection-color)');
    currentConnection.setAttribute('stroke-width', '2');
    currentConnection.setAttribute('fill', 'none');
    svg.appendChild(currentConnection);

    // Add to canvas-content instead of canvas
    document.getElementById('canvas-content').appendChild(svg);

    // Add event listeners for updating and finishing the connection
    document.addEventListener('mousemove', updateConnection);
    document.addEventListener('mouseup', finishConnection);

    // Cursor style for connection mode
    document.body.classList.add('connecting');

    // Update the connection initially if mouse position is available
    if (e && e.clientX) {
        updateConnection(e);
    }
}

// Update the connection path while dragging
function updateConnection(e) {
    if (!isDraggingPin || !currentConnection) return;

    // Get canvas position accounting for scaling and panning
    const canvasPosition = window.getCanvasPosition(e);

    // Calculate start point based on pin position
    const startX = (startPin === 'left') ?
        parseInt(startNode.style.left) :
        parseInt(startNode.style.left) + startNode.offsetWidth;
    const startY = parseInt(startNode.style.top) + startNode.offsetHeight / 2;

    // End point is the current mouse position
    const endX = canvasPosition.x;
    const endY = canvasPosition.y;

    // Calculate the curve control points
    const dx = Math.abs(endX - startX) / 2;
    let cp1X, cp2X;

    if (startPin === 'left') {
        cp1X = startX - dx;
        cp2X = endX + dx;
    } else {
        cp1X = startX + dx;
        cp2X = endX - dx;
    }

    // Set the path data for the bezier curve
    const pathData = `M ${startX},${startY} C ${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;
    currentConnection.setAttribute('d', pathData);
}

// Finish creating a connection when mouse is released
function finishConnection(e) {
    if (!isDraggingPin) return;

    // Find if we're hovering over a node or a pin
    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    const pinElement = elementUnderMouse?.closest('.pin');
    let endNode = pinElement ? pinElement.closest('.node') : null;

    // If we're not directly over a pin, check if we're over a node
    if (!endNode) {
        endNode = elementUnderMouse?.closest('.node');
    }

    // Only create connection if end node exists and is different from start node
    if (endNode && endNode !== startNode) {
        // Determine which pin to connect to based on the relative position
        let endPin;

        if (pinElement) {
            // If dropped on a pin, use that pin
            endPin = pinElement.classList.contains('left') ? 'left' : 'right';
        } else {
            // Otherwise determine the best pin based on position
            const endNodeRect = endNode.getBoundingClientRect();
            const endNodeCenterX = endNodeRect.left + endNodeRect.width / 2;

            // Default pin assignment
            endPin = (startPin === 'left') ? 'right' : 'left';

            // Adjust if needed based on relative positions
            if (startPin === 'left' && e.clientX < endNodeCenterX) {
                endPin = 'left';
            } else if (startPin === 'right' && e.clientX > endNodeCenterX) {
                endPin = 'right';
            }
        }

        createFinalConnection(startNode, endNode, startPin, endPin);
    } else {
        // No valid end node - create a new node at the mouse position
        // Get the canvas position for the new node
        const canvasPosition = window.getCanvasPosition(e);

        // Create new node at mouse position
        if (window.createNode) {
            // Create a node with default content in the current language
            const newNode = window.createNode(
                canvasPosition.x,
                canvasPosition.y
                // No content parameter, so it will use the language-specific placeholder
            );

            // Copy color from source node if possible
            if (startNode) {
                const sourceStrip = startNode.querySelector('.strip');
                const targetStrip = newNode.querySelector('.strip');
                if (sourceStrip && targetStrip && window.setStripColor) {
                    const sourceColor = sourceStrip.style.backgroundColor;
                    if (sourceColor) {
                        window.setStripColor(targetStrip, sourceColor);
                    }
                }

                // Copy visibility mode (content-only-mode) from source node if it has that mode
                if (startNode.classList.contains('content-only-mode')) {
                    newNode.classList.add('content-only-mode');

                    // Update the visibility toggle icon if it exists
                    const visibilityToggle = newNode.querySelector('.node-visibility-toggle');
                    if (visibilityToggle) {
                        const icon = visibilityToggle.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-eye');
                            icon.classList.add('fa-eye-slash');
                            visibilityToggle.title = 'Show node frame';
                        }
                    }
                }
            }

            // Determine which pin to connect to based on the source pin
            const endPin = (startPin === 'left') ? 'right' : 'left';

            // Create connection between source node and new node
            createFinalConnection(startNode, newNode, startPin, endPin);

            console.log('Created new node at mouse position with connection from source node');
        }
    }

    // Clean up temporary connection
    if (currentConnection && currentConnection.parentNode) {
        currentConnection.parentNode.remove();
    }

    // Reset connection variables
    isDraggingPin = false;
    currentConnection = null;
    startNode = null;
    startPin = null;

    // Remove event listeners
    document.removeEventListener('mousemove', updateConnection);
    document.removeEventListener('mouseup', finishConnection);

    // Reset cursor
    document.body.classList.remove('connecting');
}

// Create the final connection between two nodes
function createFinalConnection(startNode, endNode, startPin, endPin) {
    // Check if connection already exists between these nodes with these pins
    const existingConnections = document.querySelectorAll('.connection');
    for (const conn of existingConnections) {
        if ((conn.dataset.startNode === startNode.id &&
            conn.dataset.endNode === endNode.id &&
            conn.dataset.startPin === startPin &&
            conn.dataset.endPin === endPin) ||
            (conn.dataset.startNode === endNode.id &&
                conn.dataset.endNode === startNode.id &&
                conn.dataset.startPin === endPin &&
                conn.dataset.endPin === startPin)) {
            // Connection already exists, don't create a duplicate
            return null;
        }
    }

    // Create connection SVG container
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add('connection-container');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '5';

    // Create the connection path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add('connection');
    path.setAttribute('stroke', 'var(--connection-color)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');

    // Store node and pin info as data attributes
    path.dataset.startNode = startNode.id;
    path.dataset.endNode = endNode.id;
    path.dataset.startPin = startPin;
    path.dataset.endPin = endPin;

    // Add path to SVG
    svg.appendChild(path);

    // Add SVG to canvas
    document.getElementById('canvas-content').appendChild(svg);

    // Update the path immediately
    updateConnectionPath(path);

    // Add to action history
    if (window.actionHistory && !window.actionHistory.isPerformingAction) {
        const connectionData = {
            startNodeId: startNode.id,
            endNodeId: endNode.id,
            startPin: startPin,
            endPin: endPin
        };

        const action = new window.ConnectionCreateAction(connectionData);
        window.actionHistory.addAction(action);
    }

    // Schedule auto-save after creating a connection
    if (window.scheduleAutoSave) window.scheduleAutoSave();

    // Update viewport visibility
    if (window.viewportManager) {
        window.viewportManager.scheduleUpdate();
    }

    return path;
}

// Update the positions of all connections
function updateNodeConnections() {
    const connections = document.querySelectorAll('.connection');
    connections.forEach(updateConnectionPath);
}

// Update connections for a specific node
function updateNodeConnectionsForNode(node) {
    if (!node) return;

    const nodeId = node.id;
    const connections = document.querySelectorAll(`.connection[data-start-node="${nodeId}"], .connection[data-end-node="${nodeId}"]`);
    connections.forEach(updateConnectionPath);
}

// Remove all connections associated with a node
function removeNodeConnections(node) {
    if (!node) return;

    const nodeId = node.id;
    const connections = document.querySelectorAll(`.connection[data-start-node="${nodeId}"], .connection[data-end-node="${nodeId}"]`);

    connections.forEach(conn => {
        if (conn.parentNode) {
            conn.parentNode.remove();
        }
    });
}

// Update position of a specific connection
function updateConnectionPath(connection) {
    const startNode = document.getElementById(connection.dataset.startNode);
    const endNode = document.getElementById(connection.dataset.endNode);

    if (!startNode || !endNode) {
        // If either node is missing, remove the connection
        if (connection.parentNode) {
            connection.parentNode.remove();
        }
        return;
    }

    // Calculate start point
    const startX = (connection.dataset.startPin === 'left') ?
        parseInt(startNode.style.left) :
        parseInt(startNode.style.left) + startNode.offsetWidth;
    const startY = parseInt(startNode.style.top) + startNode.offsetHeight / 2;

    // Calculate end point
    const endX = (connection.dataset.endPin === 'left') ?
        parseInt(endNode.style.left) :
        parseInt(endNode.style.left) + endNode.offsetWidth;
    const endY = parseInt(endNode.style.top) + endNode.offsetHeight / 2;

    // Calculate control points for a nice curve
    const dx = Math.abs(endX - startX) / 2;
    let cp1X, cp2X;

    if (connection.dataset.startPin === 'left') {
        cp1X = startX - dx;
    } else {
        cp1X = startX + dx;
    }

    if (connection.dataset.endPin === 'left') {
        cp2X = endX - dx;
    } else {
        cp2X = endX + dx;
    }

    // Set the bezier curve path
    const pathData = `M ${startX},${startY} C ${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;
    connection.setAttribute('d', pathData);
}

// Initialize the connection removal mode
function initConnectionRemoval() {
    // Use the existing removal line SVG from the HTML instead of creating a new one
    const removalSvg = document.getElementById('removal-line');
    const removalPath = document.getElementById('removal-path');

    // Ensure the SVG is appended to the body to stay above all elements
    if (removalSvg && removalSvg.parentNode !== document.body) {
        document.body.appendChild(removalSvg);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Alt') {
            isRemovingConnections = true;
            document.body.style.cursor = 'crosshair';

            const canvas = document.getElementById('canvas');
            canvas.addEventListener('mousedown', startRemoval);
        }
    });

    document.addEventListener('keyup', function (e) {
        if (e.key === 'Alt') {
            isRemovingConnections = false;
            document.body.style.cursor = '';

            const canvas = document.getElementById('canvas');
            canvas.removeEventListener('mousedown', startRemoval);

            // Hide the removal line
            removalPath.setAttribute('visibility', 'hidden');
            removalLineStart = null;
        }
    });

    function startRemoval(e) {
        if (!isRemovingConnections) return;

        removalLineStart = { x: e.clientX, y: e.clientY };
        removalPath.setAttribute('visibility', 'visible');
        updateRemovalLine(e);

        document.addEventListener('mousemove', updateRemoval);
        document.addEventListener('mouseup', finishRemoval);
    }

    function updateRemoval(e) {
        updateRemovalLine(e);
    }

    function finishRemoval(e) {
        if (removalLineStart) {
            const startX = (removalLineStart.x - window.canvasOffset.x) / window.canvasScale;
            const startY = (removalLineStart.y - window.canvasOffset.y) / window.canvasScale;
            const canvasPos = window.getCanvasPosition(e);
            const endX = canvasPos.x;
            const endY = canvasPos.y;

            removeIntersectingConnections(startX, startY, endX, endY);
        }

        removalPath.setAttribute('visibility', 'hidden');
        removalLineStart = null;

        document.removeEventListener('mousemove', updateRemoval);
        document.removeEventListener('mouseup', finishRemoval);
    }
}

// Function to update the removal line for connection deletion
function updateRemovalLine(e) {
    if (!removalLineStart) return;

    const line = document.getElementById('removal-path');
    if (!line) return;

    // Update line coordinates in screen space, not canvas space
    line.setAttribute('x1', removalLineStart.x);
    line.setAttribute('y1', removalLineStart.y);
    line.setAttribute('x2', e.clientX);
    line.setAttribute('y2', e.clientY);
}

// Remove intersecting connections when line is drawn across them
function removeIntersectingConnections(startX, startY, endX, endY) {
    let removed = false;
    const connections = document.querySelectorAll('.connection');
    let intersectingPaths = [];
    let removedConnections = [];

    connections.forEach(path => {
        if (doesLineIntersectPath(startX, startY, endX, endY, path)) {
            intersectingPaths.push(path);

            // Store connection data for undo/redo
            if (window.actionHistory) {
                removedConnections.push({
                    startNodeId: path.dataset.startNode,
                    endNodeId: path.dataset.endNode,
                    startPin: path.dataset.startPin,
                    endPin: path.dataset.endPin
                });
            }

            // Remove the connection SVG
            if (path.parentNode) {
                path.parentNode.remove();
            }
            removed = true;
        }
    });

    // Add to action history if connections were removed
    if (removedConnections.length > 0 && window.actionHistory) {
        const actions = removedConnections.map(conn =>
            new window.ConnectionDeleteAction(conn)
        );

        if (actions.length === 1) {
            window.actionHistory.addAction(actions[0]);
        } else if (actions.length > 1) {
            const groupAction = new window.ActionGroup('removeConnections', actions);
            window.actionHistory.addAction(groupAction);
        }
    }

    // Schedule auto-save if any connections were removed
    if (removed && window.scheduleAutoSave) {
        window.scheduleAutoSave();
    }

    return removed;
}

// Helper function to check if a line intersects with a path
function doesLineIntersectPath(x1, y1, x2, y2, path) {
    // Use point sampling to check for intersection
    const points = getPointsAlongPath(path, 20);

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        if (linesIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
            return true;
        }
    }

    return false;
}

// Sample points along a SVG path for intersection testing
function getPointsAlongPath(path, numPoints) {
    const points = [];
    const pathLength = path.getTotalLength ? path.getTotalLength() : 1000;

    for (let i = 0; i <= numPoints; i++) {
        const point = path.getPointAtLength ? path.getPointAtLength(i * pathLength / numPoints) : { x: 0, y: 0 };
        points.push(point);
    }

    return points;
}

// Math helper function to detect line intersection
function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Check if two line segments intersect
    const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));

    // Lines are parallel if denominator is zero
    if (denominator === 0) return false;

    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

    // Return true if intersection point is within both line segments
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// Initialize connection handler
function initConnections() {
    initConnectionRemoval();
    console.log('Connection system initialized');
}

// Export functions to window scope
window.startConnection = startConnection;
window.updateNodeConnections = updateNodeConnections;
window.updateNodeConnectionsForNode = updateNodeConnectionsForNode;
window.removeNodeConnections = removeNodeConnections;
window.initConnections = initConnections;
window.updateRemovalLine = updateRemovalLine;
window.removeIntersectingConnections = removeIntersectingConnections;

// Function to get all node connections with their source and target IDs
window.getNodeConnections = function getNodeConnections() {
    const connections = document.querySelectorAll('.connection');
    const connectionData = [];

    connections.forEach(conn => {
        if (conn.dataset && conn.dataset.startNode && conn.dataset.endNode) {
            // Get connection color
            const color = conn.getAttribute('stroke') || 'var(--connection-color)';

            connectionData.push({
                source: conn.dataset.startNode,
                target: conn.dataset.endNode,
                startPin: conn.dataset.startPin,
                endPin: conn.dataset.endPin,
                color: color
            });
        }
    });

    return connectionData;
};

// Create a connection between two nodes by their IDs
window.createConnection = function createConnection(sourceNodeId, targetNodeId, sourcePin, targetPin, color) {
    const sourceNode = document.getElementById(sourceNodeId);
    const targetNode = document.getElementById(targetNodeId);

    if (!sourceNode || !targetNode) {
        console.error('Cannot create connection: Node(s) not found', sourceNodeId, targetNodeId);
        return null;
    }

    // Determine which pins to use based on the parameters
    let startPin = 'right'; // Default pins
    let endPin = 'left';

    if (sourcePin && targetPin) {
        // Use provided pins if they're DOM elements
        if (sourcePin instanceof Element && targetPin instanceof Element) {
            startPin = sourcePin.classList.contains('left') ? 'left' : 'right';
            endPin = targetPin.classList.contains('left') ? 'left' : 'right';
        } else if (typeof sourcePin === 'string' && typeof targetPin === 'string') {
            // Use provided pins as strings
            startPin = sourcePin;
            endPin = targetPin;
        }
    }

    // Create the connection
    const connection = createFinalConnection(sourceNode, targetNode, startPin, endPin);

    // Set color if provided
    if (connection && color) {
        connection.setAttribute('stroke', color);
    }

    return connection;
}; 