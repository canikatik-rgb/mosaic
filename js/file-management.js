/**
 * File Management
 * Handles saving, loading, and exporting mindmaps
 */

// Project management
let currentProjectName = 'Untitled';
let projects = [];  // Array to store all open projects
let activeProjectIndex = -1;  // Index of the active project

// Project object structure
class Project {
    constructor(name = 'Untitled', nodes = [], connections = []) {
        this.id = Date.now() + '-' + Math.floor(Math.random() * 10000);
        this.name = name;
        this.nodes = nodes;
        this.connections = connections;
        this.groups = []; // Initialize groups array
        this.canvasOffset = { x: 0, y: 0 };
        this.canvasScale = 1;
        this.driveFileId = null;
    }
}

// Initialize file management
function initFileManagement() {
    console.log('[initFileManagement] Initializing...');
    // Create tabs container if it doesn't exist
    if (!document.getElementById('project-tabs')) {
        console.log('[initFileManagement] Creating project tabs container...');
        createProjectTabsContainer();
    } else {
        console.log('[initFileManagement] Project tabs container already exists.');
    }

    // Do NOT create a default project here. Wait for user action.
    // if (projects.length === 0) {
    //     createNewProject('Untitled');
    // }
}

// Create the project tabs container
function createProjectTabsContainer() {
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'project-tabs';
    tabsContainer.className = 'project-tabs';

    // Insert before the file name display
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileNameDisplay) {
        console.log('[createProjectTabsContainer] Found file-name-display. Inserting tabs before it.');
        fileNameDisplay.parentNode.insertBefore(tabsContainer, fileNameDisplay);
        // Hide the original file name display as we'll now use tabs
        fileNameDisplay.style.display = 'none';
    } else {
        console.warn('[createProjectTabsContainer] file-name-display NOT found. Inserting at body start.');
        // If no file name display, add to the start of body
        document.body.insertBefore(tabsContainer, document.body.firstChild);
    }

    return tabsContainer;
}

// Convert a display name to a safe filename
function getSafeFilename(displayName) {
    return displayName
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'untitled';
}
window.getSafeFilename = getSafeFilename;

// Expose project data and state management globally
window.projects = projects;
window.getActiveProjectIndex = () => activeProjectIndex;
window.setActiveProjectIndex = (index) => { activeProjectIndex = index; }; // Add setter if needed elsewhere
window.saveProjectState = saveProjectState;
window.Project = Project; // Expose Project class if needed externally

// Set the current project name
function setProjectName(name) {
    // Update the current project
    currentProjectName = name || 'Untitled';

    // If there are active projects, update the current one
    if (activeProjectIndex >= 0 && projects[activeProjectIndex]) {
        projects[activeProjectIndex].name = currentProjectName;
    }

    // Update the tab display
    updateProjectTabs();
}

// Create a new project
function createNewProject(name = 'Untitled') {
    console.log(`[createNewProject] Called with name: '${name}'`); // Add log
    // Check if this is the initial 'Untitled' project being named
    const isRenamingInitial = projects.length === 1 && projects[0].name === 'Untitled' && activeProjectIndex === 0;
    const projectToPotentiallySave = isRenamingInitial ? projects[0] : new Project(name); // Prepare potential project

    // --- MODIFICATION: Check for Google Sign-In FIRST ---
    if (window.googleAccessToken && window.createAndSaveProjectToDrive) {
        console.log("[createNewProject] User signed in. Initiating Drive save flow.");
        // Rename the local 'Untitled' project *immediately* if applicable
        // This ensures the correct name is used for Drive save, even if Drive op fails
        if (isRenamingInitial) {
            console.log("[createNewProject] Renaming initial local project before Drive save.");
            projects[0].name = name;
            currentProjectName = name;
            updateProjectTabs(); // Update tab immediately to reflect rename
        }

        // Use projectToPotentiallySave.name for Drive save
        const driveProjectName = projectToPotentiallySave.name;
        console.log(`[createNewProject] Attempting to save '${driveProjectName}' to Drive...`);

        (async () => {
            let driveFileId = null;
            try {
                showLoadingOverlay(getText('creatingDriveProject') || 'Creating project on Google Drive...');
                // Create on Drive (createAndSaveProjectToDrive now handles welcome node logic)
                driveFileId = await window.createAndSaveProjectToDrive(driveProjectName);
            } catch (error) {
                console.error("[createNewProject] Error during createAndSaveProjectToDrive:", error);
                alert(getText('driveCreateError') || 'Error creating project on Drive.');
            } finally {
                hideLoadingOverlay();
            }

            if (driveFileId && window.openProjectFromDrive) {
                console.log(`[createNewProject] Drive project created (ID: ${driveFileId}). Opening from Drive...`);
                try {
                    // Open the newly created project from Drive
                    await window.openProjectFromDrive(driveFileId);
                    // openProjectFromDrive now handles adding to projects array, switching, and UI init
                    console.log("[createNewProject] openProjectFromDrive completed successfully.");
                } catch (openError) {
                    console.error("[createNewProject] Error opening project from Drive after creation:", openError);
                    alert("Failed to open the newly created project from Drive.");
                    // Fallback? Should we leave the renamed local 'Untitled' project or add a new local one?
                    // For now, do nothing extra, the renamed tab (if applicable) remains.
                }
            } else {
                console.error("[createNewProject] Failed to get Drive file ID or openProjectFromDrive is missing.");
                alert(getText('driveCreateError') || 'Failed to create or open project on Google Drive.');
                // If we were renaming the initial project, it stays renamed locally.
                // If we were creating a new one, it wasn't added locally yet.
                // Consider if a fallback local creation is needed here? For now, no.
            }
        })();

        // IMPORTANT: Exit *here* to prevent local project creation/switching logic below
        // The Drive flow handles everything via openProjectFromDrive.
        console.log("[createNewProject] Exiting early due to Drive flow.");
        return; // Prevent further execution in this function
    }
    // --- END DRIVE MODIFICATION ---

    // --- LOCAL CREATION LOGIC (Only runs if not signed in) ---
    console.log("[createNewProject] User not signed in or Drive unavailable. Proceeding with local creation.");
    if (isRenamingInitial) {
        console.log("[createNewProject] Renaming initial local project.");
        projects[0].name = name;
        currentProjectName = name;
        updateProjectTabs();
        if (document.querySelectorAll('.node').length === 0) {
            createInitialNode();
        }
        if (window.resetCanvasView) setTimeout(() => window.resetCanvasView(), 100);
        initializeAppUIIfNeeded(); // Initialize UI if needed
        return projects[0];
    } else {
        console.log("[createNewProject] Creating new local project.");
        if (activeProjectIndex >= 0) {
            saveProjectState(activeProjectIndex);
        }
        const newLocalProject = new Project(name);
        projects.push(newLocalProject);
        const newIndex = projects.length - 1;

        // Ensure UI is initialized *before* switching which might create nodes
        initializeAppUIIfNeeded();

        // Switch to the new project FIRST (this clears canvas etc.)
        switchToProject(newIndex);

        // THEN create the initial node for the *new* project
        createInitialNode();

        updateProjectTabs();
        if (window.resetCanvasView) setTimeout(() => window.resetCanvasView(), 100);
        return newLocalProject;
    }
}

// Save the current state of a project
function saveProjectState(projectIndex) {
    if (projectIndex < 0 || projectIndex >= projects.length) return;

    const project = projects[projectIndex];

    // Save canvas state (use window properties if available as they're more current)
    project.canvasOffset = {
        x: (window.canvasOffset ? window.canvasOffset.x : canvasOffset.x),
        y: (window.canvasOffset ? window.canvasOffset.y : canvasOffset.y)
    };
    project.canvasScale = window.canvasScale || canvasScale;

    console.log('Saving project state with canvas:', project.canvasOffset, project.canvasScale);
    // --- ADD Detailed Logging ---
    console.log(`[saveProjectState] Capturing state for project: '${project.name}' (ID: ${project.id}, DriveID: ${project.driveFileId})`);

    // Save nodes (using captureNodeData for consistency)
    project.nodes = []; // Clear existing nodes before saving
    document.querySelectorAll('.node').forEach(nodeEl => {
        if (window.captureNodeData) {
            const nodeData = window.captureNodeData(nodeEl);
            if (nodeData) {
                // Remove connections from node data as they are saved separately
                delete nodeData.connections;
                project.nodes.push(nodeData);
            }
        } else { // Fallback if captureNodeData is not available
            const strip = nodeEl.querySelector('.strip');
            const contentDiv = nodeEl.querySelector('.content');
            project.nodes.push({
                id: nodeEl.id,
                x: parseFloat(nodeEl.style.left),
                y: parseFloat(nodeEl.style.top),
                content: contentDiv ? contentDiv.innerHTML : '',
                stripColor: strip ? strip.style.backgroundColor : (window.stripColors ? window.stripColors[0] : '#c2f8cb'),
                nodeType: nodeEl.dataset.nodeType || 'default',
                contentOnly: nodeEl.classList.contains('content-only-mode') // Save content-only state
            });
        }
    });
    // Log node details
    const firstNodePos = project.nodes[0]?.position ? `(${project.nodes[0].position.x}, ${project.nodes[0].position.y})` : (project.nodes[0] ? `(${project.nodes[0].x}, ${project.nodes[0].y})` : 'N/A');
    console.log(`[saveProjectState] Captured ${project.nodes.length} nodes. First node position: ${firstNodePos}`);

    // Save connections
    project.connections = [];
    document.querySelectorAll('.connection').forEach(connPath => {
        const conn = connPath.closest('.connection-container')?.querySelector('.connection');
        if (conn?.dataset) {
            project.connections.push({
                startNode: conn.dataset.startNode,
                endNode: conn.dataset.endNode,
                startPin: conn.dataset.startPin,
                endPin: conn.dataset.endPin
            });
        }
    });
    // Log connection count
    console.log(`[saveProjectState] Captured ${project.connections.length} connections.`);

    // Save groups
    project.groups = [];
    if (window.groups && window.groups.size > 0) {
        window.groups.forEach((group, groupId) => {
            project.groups.push({
                id: group.id,
                name: group.name,
                color: group.color,
                nodeIds: [...group.nodeIds], // Copy array
                bounds: { ...group.bounds } // Copy bounds object
            });
        });
        console.log(`[saveProjectState] Captured ${project.groups.length} groups.`);
    } else {
        console.log(`[saveProjectState] No groups to save.`);
    }

    console.log(`Saved state for project ${project.name}: ${project.nodes.length} nodes, ${project.connections.length} connections`);
}

// Switch to a specific project
function switchToProject(index) {
    if (index < 0 || !window.projects || index >= window.projects.length) return;

    console.log(`[switchToProject] Attempting to switch to project index: ${index}`);

    // Initialize the main UI if it hasn't been initialized yet
    const appContainer = document.getElementById('app-container');
    if (appContainer && appContainer.style.display === 'none') {
        console.log("[switchToProject] Initializing UI...");
        const video = document.getElementById('background-video');

        // Start background fade-in
        document.body.classList.add('app-active');

        if (window.initializeAppUI) {
            window.initializeAppUI();
        } else {
            console.error("[switchToProject] initializeAppUI function not found!");
        }

        // Remove video after fade-in transition (matches CSS transition duration)
        setTimeout(() => {
            if (video) {
                console.log("Removing background video after transition.");
                video.remove();
            }
        }, 500); // Corresponds to the 0.5s transition in CSS
    }

    // Set flag to prevent auto-saves during restoration
    window.isRestoringProject = true;
    console.log('[switchToProject] Starting restoration. Auto-save disabled.');

    try {
        // Save current project state before switching (if not the one we're switching to)
        if (activeProjectIndex >= 0 && activeProjectIndex !== index) {
            saveProjectState(activeProjectIndex);
        }

        activeProjectIndex = index;
        const project = window.projects[index];

        // Update UI
        document.getElementById('project-name').value = project.name;
        updateProjectTabs();

        // Clear the current mindmap
        clearMindMap();

        // Restore canvas state
        // Use default values carefully if project data is missing
        const targetOffset = project.canvasOffset || { x: document.getElementById('canvas-wrapper').clientWidth / 2, y: document.getElementById('canvas-wrapper').clientHeight / 2 };
        const targetScale = (project.canvasScale && project.canvasScale > 0) ? project.canvasScale : 1;

        console.log(`[switchToProject] Project '${project.name}': Restoring offset=`, targetOffset, `scale=`, targetScale);

        canvasOffset.x = targetOffset.x;
        canvasOffset.y = targetOffset.y;
        canvasScale = targetScale;

        // Update the canvas transform and global variables
        updateCanvasTransform();

        console.log(`Switching to project '${project.name}' with state:`, project);

        // Load nodes first
        if (Array.isArray(project.nodes) && project.nodes.length > 0) {
            project.nodes.forEach(nodeData => {
                // Ensure position values are numbers, reliably accessing the position object
                const x = (typeof nodeData.position?.x === 'number') ? nodeData.position.x : (typeof nodeData.x === 'number' ? nodeData.x : 0);
                const y = (typeof nodeData.position?.y === 'number') ? nodeData.position.y : (typeof nodeData.y === 'number' ? nodeData.y : 0);

                // Get other node data
                const nodeType = nodeData.nodeType || nodeData.type || 'default';
                const stripColor = nodeData.stripColor || nodeData.color;
                const content = nodeData.content || (window.getPlaceholderText ? window.getPlaceholderText() : 'Double Click...');
                const nodeId = nodeData.id;

                if (!nodeId) {
                    console.warn("Skipping node load because ID is missing:", nodeData);
                    return; // Skip node if ID is missing
                }

                // Use createNode with all parameters
                const node = window.createNode(
                    x,
                    y,
                    content,
                    nodeType,
                    nodeId,
                    stripColor
                );

                // Restore specific properties
                if (nodeData.contentOnly && node) {
                    node.classList.add('content-only-mode');
                    const toggle = node.querySelector('.node-visibility-toggle i');
                    if (toggle) {
                        toggle.classList.remove('fa-eye');
                        toggle.classList.add('fa-eye-slash');
                    }
                }
            });
        } else {
            // If no nodes exist, create a welcome node
            if (window.createInitialNode) {
                window.createInitialNode();
            } else {
                console.warn('createInitialNode function not found.');
            }
        }

        // Then load connections
        if (Array.isArray(project.connections)) {
            project.connections.forEach(conn => {
                const startNode = document.getElementById(conn.startNode || conn.source);
                const endNode = document.getElementById(conn.endNode || conn.target);

                if (startNode && endNode && window.createFinalConnection) {
                    // Ensure createFinalConnection doesn't add history during load
                    const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
                    if (window.actionHistory) window.actionHistory.isPerformingAction = true;

                    window.createFinalConnection(startNode, endNode, conn.startPin, conn.endPin);

                    if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
                } else if (!startNode || !endNode) {
                    console.warn('Could not find start or end node for connection:', conn);
                }
            });
        }

        // Call updateNodeConnections after nodes/connections are loaded
        if (window.updateNodeConnections) {
            console.log("[switchToProject] Calling updateNodeConnections after loading project elements.");
            window.updateNodeConnections();
        }

        // Load groups AFTER nodes and connections
        console.log('[switchToProject] Checking for groups...', {
            hasGroupsArray: Array.isArray(project.groups),
            groupsLength: project.groups?.length,
            windowGroupsExists: !!window.groups,
            renderGroupExists: !!window.renderGroup
        });

        if (Array.isArray(project.groups) && project.groups.length > 0) {
            console.log(`[switchToProject] Starting group restoration for ${project.groups.length} groups`);

            if (!window.groups) {
                console.error('[switchToProject] FATAL: window.groups Map not available!');
                return;
            }

            if (!window.renderGroup) {
                console.error('[switchToProject] FATAL: window.renderGroup function not available!');
                return;
            }

            // Clear existing groups
            window.groups.clear();
            console.log('[switchToProject] Cleared existing groups');

            // Restore each group
            let restoredCount = 0;
            project.groups.forEach((groupData, index) => {
                console.log(`[switchToProject] Restoring group ${index + 1}:`, {
                    id: groupData.id,
                    name: groupData.name,
                    color: groupData.color,
                    nodeIds: groupData.nodeIds,
                    bounds: groupData.bounds
                });

                // Verify all nodes exist in DOM and filter out missing ones
                const validNodeIds = groupData.nodeIds.filter(id => document.getElementById(id));
                const missingNodes = groupData.nodeIds.filter(id => !document.getElementById(id));

                if (missingNodes.length > 0) {
                    console.warn(`[switchToProject] Group "${groupData.name}" has missing nodes:`, missingNodes);
                }

                // Create Group object
                const group = {
                    id: groupData.id,
                    name: groupData.name,
                    color: groupData.color,
                    nodeIds: validNodeIds,
                    bounds: groupData.bounds,
                    element: null
                };

                // Add to groups map
                window.groups.set(group.id, group);
                console.log(`[switchToProject] Added group to Map. Map size: ${window.groups.size}`);

                // Render the group
                try {
                    window.renderGroup(group);
                    console.log(`[switchToProject] Successfully rendered group "${group.name}"`);

                    // Verify element was created
                    if (group.element) {
                        console.log(`[switchToProject] Group element created:`, {
                            id: group.element.id,
                            className: group.element.className,
                            parentNode: group.element.parentNode?.id
                        });
                        restoredCount++;
                    } else {
                        console.error(`[switchToProject] Group element NOT created for "${group.name}"`);
                    }
                } catch (error) {
                    console.error(`[switchToProject] Error rendering group "${group.name}":`, error);
                }
            });

            console.log(`[switchToProject] Group restoration complete. ${restoredCount}/${project.groups.length} groups rendered successfully. Map size: ${window.groups.size}`);
        } else {
            console.log('[switchToProject] No groups to restore');
        }

        // Clear history when switching projects
        if (window.actionHistory) {
            window.actionHistory.clear();
        }

        console.log(`Switched to project: ${project.name}`);

    } finally {
        // Re-enable auto-saves
        window.isRestoringProject = false;
        console.log('[switchToProject] Restoration complete. Auto-save re-enabled.');
    }
}

// Close a project by index
function closeProject(projectIndex) {
    if (projectIndex < 0 || projectIndex >= projects.length) return;

    const closedProjectName = projects[projectIndex].name;
    console.log(`[closeProject] Closing project: '${closedProjectName}' at index ${projectIndex}`);

    // Check if this is the last project
    if (projects.length === 1) {
        console.log("[closeProject] Attempting to close the last project, will refresh the application.");

        // Ensure any pending Google Drive sync is completed first
        if (window.googleAccessToken && window.checkTokenValidity && window.isDriveSyncEnabled) {
            console.log("[closeProject] Drive sync enabled, checking sync status before refresh...");

            // Show loading message
            if (window.showLoadingOverlay) {
                window.showLoadingOverlay("Finishing sync before closing...");
            }

            // Wait a moment to allow any pending auto-save to complete
            setTimeout(() => {
                console.log("[closeProject] Refreshing application to return to welcome modal");
                if (window.hideLoadingOverlay) {
                    window.hideLoadingOverlay();
                }
                window.location.reload();
            }, 1500); // Give enough time for sync to complete

            return; // Exit function early
        } else {
            // No Google sync active, just refresh
            console.log("[closeProject] No Drive sync active, refreshing immediately");
            window.location.reload();
            return;
        }
    }

    // Remove the project from the array
    projects.splice(projectIndex, 1);

    // If we closed the active project, switch to another one
    if (projectIndex === activeProjectIndex) {
        // Try to switch to the previous project, or the first one if not possible
        // Ensure the new index is within the bounds of the modified array
        const newIndex = Math.min(Math.max(0, projectIndex - 1), projects.length - 1);
        console.log(`[closeProject] Closed active project. Switching to index ${newIndex}`);
        switchToProject(newIndex); // switchToProject handles updating tabs
    } else if (projectIndex < activeProjectIndex) {
        // If we closed a project before the active one, update the active index
        activeProjectIndex--;
        console.log(`[closeProject] Closed project before active. New active index: ${activeProjectIndex}`);
        updateProjectTabs();
    } else {
        // If we closed a project *after* the active one, the active index doesn't change,
        // but we still need to update the tabs display.
        console.log(`[closeProject] Closed project after active. Active index remains: ${activeProjectIndex}`);
        updateProjectTabs();
    }
}

// Update the project tabs display
function updateProjectTabs() {
    const tabsContainer = document.getElementById('project-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    projects.forEach((project, index) => {
        const tab = document.createElement('div');
        tab.className = 'project-tab';
        tab.dataset.projectId = project.id;
        tab.dataset.projectIndex = index;
        tab.draggable = true; // Make tab draggable
        if (index === activeProjectIndex) {
            tab.classList.add('active');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'project-name';
        nameSpan.textContent = project.name || 'Untitled';
        nameSpan.title = project.name || 'Untitled'; // Tooltip for long names
        tab.appendChild(nameSpan);

        // Edit Button (Rename) - Show on hover
        const editButton = document.createElement('span');
        editButton.className = 'tab-edit fas fa-pencil-alt'; // Font Awesome pencil icon
        editButton.title = getText('renameProject') || 'Rename Project'; // Localized tooltip
        editButton.style.visibility = 'hidden'; // Initially hidden
        tab.appendChild(editButton);

        // Close Button
        const closeButton = document.createElement('span');
        closeButton.className = 'tab-close';
        closeButton.innerHTML = '&times;';
        closeButton.title = getText('closeProject') || 'Close Project';
        tab.appendChild(closeButton);

        // Click to switch project
        tab.addEventListener('click', (e) => {
            if (e.target === closeButton || e.target === editButton) return; // Ignore clicks on close/edit button
            switchToProject(index);
        });

        // Click on close button
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tab switching
            closeProject(index);
        });

        // Click on edit button
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tab switching
            // Assuming showRenameProjectModal exists and is globally accessible
            if (window.showRenameProjectModal) {
                showRenameProjectModal(index);
            } else {
                console.error('showRenameProjectModal function not found!');
            }
        });

        // Show/Hide edit button on hover
        tab.addEventListener('mouseenter', () => {
            editButton.style.visibility = 'visible';
        });
        tab.addEventListener('mouseleave', () => {
            editButton.style.visibility = 'hidden';
        });

        // --- Drag and Drop Event Listeners ---
        tab.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index); // Store original index
            setTimeout(() => tab.classList.add('dragging'), 0); // Style dragging tab
        });

        tab.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            e.dataTransfer.dropEffect = 'move';
            const draggingTab = document.querySelector('.project-tab.dragging');
            if (draggingTab && draggingTab !== tab) {
                // Basic visual cue - shift tabs slightly
                const rect = tab.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                tabsContainer.querySelectorAll('.project-tab:not(.new-tab):not(.dragging)').forEach(t => t.classList.remove('drag-over-before', 'drag-over-after'));
                if (isAfter) {
                    tab.classList.add('drag-over-after');
                } else {
                    tab.classList.add('drag-over-before');
                }
            }
        });

        tab.addEventListener('dragleave', (e) => {
            tab.classList.remove('drag-over-before', 'drag-over-after');
        });

        tab.addEventListener('drop', (e) => {
            e.preventDefault();
            tab.classList.remove('drag-over-before', 'drag-over-after');
            const draggingTab = document.querySelector('.project-tab.dragging');
            if (!draggingTab) return;

            const oldIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const newIndex = index;

            if (oldIndex !== newIndex) {
                // Reorder the projects array
                const [movedProject] = projects.splice(oldIndex, 1);
                projects.splice(newIndex, 0, movedProject);

                // Update activeProjectIndex if needed
                if (activeProjectIndex === oldIndex) {
                    activeProjectIndex = newIndex;
                } else if (oldIndex < activeProjectIndex && newIndex >= activeProjectIndex) {
                    activeProjectIndex--;
                } else if (oldIndex > activeProjectIndex && newIndex <= activeProjectIndex) {
                    activeProjectIndex++;
                }

                // Redraw tabs with new order and updated active index
                updateProjectTabs();
            }
        });

        tab.addEventListener('dragend', (e) => {
            tab.classList.remove('dragging');
            tabsContainer.querySelectorAll('.project-tab').forEach(t => t.classList.remove('drag-over-before', 'drag-over-after'));
        });
        // --- End Drag and Drop ---

        tabsContainer.appendChild(tab);
    });

    // Add the "+" button for new projects
    const newTabButton = document.createElement('div');
    newTabButton.className = 'project-tab new-tab';
    newTabButton.innerHTML = '<i class="fas fa-plus"></i>';
    newTabButton.title = getText('newMosaic') || 'New Mosaic'; // Use translation
    newTabButton.addEventListener('click', () => {
        console.log('[+] Tab Button Clicked'); // Add log
        // --- MODIFICATION: Check Google Sign-In ---
        if (window.googleAccessToken) {
            console.log('[+] Tab: Signed in, showing Welcome Modal.');
            // If signed in, show Welcome Modal with Drive Dashboard
            const welcomeModal = document.getElementById('welcome-modal');

            if (welcomeModal) {
                // Ensure Drive Dashboard is shown and welcome options are hidden
                if (window.updateSignInStatus) updateSignInStatus(true);
                // Refresh file list when showing the modal this way
                if (window.listDriveFiles && window.showDriveDashboard) {
                    window.listDriveFiles().then(files => window.showDriveDashboard(files)).catch(err => console.error("Error refreshing drive list:", err));
                }
                // Show modal ON TOP, with close button if needed (handled by showModal call later)
                showModal(welcomeModal, true); // Pass flag to potentially show close button
            } else {
                console.error('[+] Tab: Welcome modal not found!');
                // Fallback? Maybe show new project modal?
                showModal(document.getElementById('new-project-modal'));
                document.getElementById('project-name').focus();
            }
        } else {
            console.log('[+] Tab: Not signed in, showing New Project Name modal.');
            // Original behavior: Show new project modal for local creation
            const newProjectModal = document.getElementById('new-project-modal');
            const projectNameInput = document.getElementById('project-name');
            if (newProjectModal && projectNameInput) {
                projectNameInput.value = ''; // Clear previous name
                showModal(newProjectModal);
                projectNameInput.focus();
                // Ensure creating for drive flag is false
                if (window.hasOwnProperty('isCreatingForDrive')) {
                    window.isCreatingForDrive = false;
                }
            } else {
                // Fallback if modal elements aren't found
                console.error('[+] Tab: New Project modal not found!');
                createNewProject('Untitled'); // Fallback to creating untitled local project
            }
        }
        // --- END MODIFICATION ---
    });
    tabsContainer.appendChild(newTabButton);
}
window.updateProjectTabs = updateProjectTabs; // Expose globally

// Function to show the rename project modal
function showRenameProjectModal(projectIndex) {
    if (projectIndex < 0 || projectIndex >= projects.length) return;

    // Get the project to rename
    const project = projects[projectIndex];

    // Check if the rename modal already exists
    let renameModal = document.getElementById('rename-project-modal');

    // Create the modal if it doesn't exist
    if (!renameModal) {
        renameModal = document.createElement('div');
        renameModal.id = 'rename-project-modal';
        renameModal.className = 'modal';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';

        const modalTitle = document.createElement('h2');
        modalTitle.id = 'rename-modal-title';
        modalTitle.textContent = window.getText ? window.getText('renameProject') : 'Rename Project';

        const closeModalBtn = document.createElement('span');
        closeModalBtn.className = 'close-modal';
        closeModalBtn.innerHTML = '&times;';
        closeModalBtn.addEventListener('click', () => hideModal(renameModal));

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeModalBtn);

        // Body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = 'rename-project-name';
        label.textContent = window.getText ? window.getText('projectName') : 'Project Name:';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'rename-project-name';
        input.name = 'rename-project-name';
        input.placeholder = window.getText ? window.getText('projectNamePlaceholder') : 'Enter a name for your project';

        // Button row
        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.justifyContent = 'space-between';
        buttonRow.style.marginTop = '20px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn';
        cancelBtn.textContent = window.getText ? window.getText('cancel') : 'Cancel';
        cancelBtn.addEventListener('click', () => hideModal(renameModal));

        const saveBtn = document.createElement('button');
        saveBtn.className = 'primary-btn';
        saveBtn.textContent = window.getText ? window.getText('save') : 'Save';
        saveBtn.id = 'rename-save-btn';

        buttonRow.appendChild(cancelBtn);
        buttonRow.appendChild(saveBtn);

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        modalBody.appendChild(formGroup);
        modalBody.appendChild(buttonRow);

        // Footer
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.textContent = 'Mosaic Mindmap Tool';

        // Assemble modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        renameModal.appendChild(modalContent);

        // Add to document
        document.body.appendChild(renameModal);

        // Setup event listeners for the newly created modal
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('rename-save-btn').click();
            } else if (e.key === 'Escape') {
                hideModal(renameModal);
            }
        });
    } else {
        // Update translations if modal already exists
        document.getElementById('rename-modal-title').textContent = window.getText ? window.getText('renameProject') : 'Rename Project';
        const label = renameModal.querySelector('label[for="rename-project-name"]');
        if (label) label.textContent = window.getText ? window.getText('projectName') : 'Project Name:';

        const saveBtn = document.getElementById('rename-save-btn');
        if (saveBtn) saveBtn.textContent = window.getText ? window.getText('save') : 'Save';

        const cancelBtn = renameModal.querySelector('.secondary-btn');
        if (cancelBtn) cancelBtn.textContent = window.getText ? window.getText('cancel') : 'Cancel';
    }

    // Update modal data
    const projectIndexAttr = document.createAttribute('data-project-index');
    projectIndexAttr.value = projectIndex;
    renameModal.setAttributeNode(projectIndexAttr);

    const input = document.getElementById('rename-project-name');
    input.value = project.name;

    // Update save button handler
    const saveBtn = document.getElementById('rename-save-btn');

    // Remove old event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    // Add new event listener
    newSaveBtn.addEventListener('click', () => {
        const name = document.getElementById('rename-project-name').value.trim();
        if (name) {
            renameProject(projectIndex, name);
            hideModal(renameModal);
        }
    });

    // Show the modal
    showModal(renameModal);

    // Focus on the input
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
}

// Function to rename a project
function renameProject(projectIndex, newName) {
    if (projectIndex < 0 || projectIndex >= projects.length || !newName) return;

    // Update the project name
    projects[projectIndex].name = newName;

    // If this is the active project, update the current name
    if (projectIndex === activeProjectIndex) {
        currentProjectName = newName;
    }

    // Update the tabs
    updateProjectTabs();

    // Schedule auto-save after renaming
    if (window.scheduleAutoSave) window.scheduleAutoSave();
}

// Show a modal
function showModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
}

// Hide a modal
function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
}

// Save the current project to a file
function saveProject() {
    if (activeProjectIndex < 0) {
        console.warn("Save Project: No active project.");
        return;
    }

    // Always save locally when the button is pressed
    console.log("Save Project button clicked. Saving locally...");
    saveProjectLocally();
}

// --- NEW FUNCTION: Extracted local save logic ---
function saveProjectLocally() {
    if (activeProjectIndex < 0) return; // Double check

    // --- CRITICAL FIX: Save current state from DOM to memory before saving to file ---
    // This ensures that recent changes (like content-only mode toggles) are captured
    saveProjectState(activeProjectIndex);
    // ----------------------------------------------------------------------------------

    const project = projects[activeProjectIndex];

    // Create data blob
    const projectData = JSON.stringify(project, null, 2);
    const blob = new Blob([projectData], { type: 'application/json' });

    // Create filename
    const filename = `${getSafeFilename(project.name)}.mosaic`;

    // Trigger download
    if (window.saveAs) { // Use FileSaver.js if available
        saveAs(blob, filename);
    } else {
        // Basic fallback download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Open a project from a file
function openProject() {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.mosaic,application/json';

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const projectData = JSON.parse(event.target.result);
                const projectName = projectData.name || file.name.replace(/\.mosaic$/, '') || 'Untitled'; // Get name

                // --- MODIFICATION: Save to Drive if logged in, otherwise load locally ---
                if (window.googleAccessToken && window.createAndSaveProjectToDrive && window.openProjectFromDrive) {
                    console.log("openProject: User is logged in, uploading local file to Drive...");
                    // Log the project name determined before calling Drive save
                    console.log(`[openProject] Project name determined for Drive upload: '${projectName}'`); // Added Log
                    showLoadingOverlay(getText('uploadingToDrive') || 'Uploading to Google Drive...'); // Show loading overlay

                    try {
                        const driveFileId = await window.createAndSaveProjectToDrive(projectName, projectData); // Pass full data

                        if (driveFileId) {
                            console.log(`openProject: Successfully uploaded to Drive. Opening file ID: ${driveFileId}`);
                            // Now open the project from Drive using the returned ID
                            await window.openProjectFromDrive(driveFileId);
                        } else {
                            console.error("openProject: Failed to upload project to Drive.");
                            alert(getText('driveUploadError') || 'Failed to upload project to Google Drive.');
                        }
                    } catch (uploadError) {
                        console.error("openProject: Error during Drive upload/open process:", uploadError);
                        alert((getText('driveUploadError') || 'An error occurred during the Drive process: ') + uploadError.message);
                    } finally {
                        hideLoadingOverlay(); // Hide loading overlay regardless of success/failure
                    }
                } else {
                    // Original behavior: Load locally if not signed in
                    console.log("openProject: User not logged in, loading project locally.");
                    const project = new Project(
                        projectName,
                        projectData.nodes || [],
                        projectData.connections || []
                    );

                    // Restore additional project properties
                    if (projectData.canvasOffset) {
                        project.canvasOffset = projectData.canvasOffset;
                    }
                    if (projectData.canvasScale) {
                        project.canvasScale = projectData.canvasScale;
                    }

                    // CRITICAL: Restore groups data
                    if (projectData.groups) {
                        project.groups = projectData.groups;
                        console.log(`[openProject] Loaded ${projectData.groups.length} groups from file`);
                    } else {
                        project.groups = [];
                    }

                    // Add to projects array
                    projects.push(project);

                    // Switch to the new project (with a minimal delay for stability)
                    setTimeout(() => {
                        switchToProject(projects.length - 1);
                        // Automatically run resetCanvasView after switching
                        if (window.resetCanvasView) {
                            setTimeout(() => window.resetCanvasView(), 50);
                        }
                    }, 0);

                    console.log(`Project loaded locally: ${project.name}`);
                }
                // --- END MODIFICATION ---

            } catch (e) {
                console.error("Error parsing project file:", e);
                alert('Could not load the project file. It may be corrupted or in an invalid format.');
            }
        };

        reader.readAsText(file);
    });

    // Trigger file selection
    fileInput.click();
}

// Export the current viewport as a PNG image
function exportAsImage() {
    // Create a notification to show during rendering
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.background = 'rgba(0, 0, 0, 0.8)';
    notification.style.color = 'white';
    notification.style.padding = '20px';
    notification.style.borderRadius = '10px';
    notification.style.zIndex = '10000';
    notification.textContent = 'Capturing viewport...';
    document.body.appendChild(notification);

    // Get the canvas wrapper which represents the viewport
    const canvasWrapper = document.getElementById('canvas-wrapper');

    if (!canvasWrapper) {
        notification.textContent = 'Cannot find canvas viewport';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
        return;
    }

    try {
        // Use html2canvas to capture the current viewport
        html2canvas(canvasWrapper, {
            backgroundColor: document.body.classList.contains('night-mode') ? '#1a1a1a' : '#f0f0f0',
            scale: 2,  // Higher quality
            useCORS: true,
            logging: false, // Disable logs
            // Don't capture scrollbars
            onclone: (clonedDoc) => {
                const style = clonedDoc.createElement('style');
                style.innerHTML = '::-webkit-scrollbar { display: none !important; }';
                clonedDoc.head.appendChild(style);
            }
        }).then(canvas => {
            // Create formatted date string (YYYY-MM-DD)
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

            // Get project name or use "Untitled"
            const projectName = (currentProjectName || 'Untitled').replace(/\s+/g, '-');

            // Generate filename
            const filename = `${projectName}-${dateStr}-viewport.png`;

            // Convert canvas to image and download
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();

            // Clean up
            document.body.removeChild(notification);

            console.log(`Exported viewport as: ${filename}`);
        }).catch(err => {
            console.error('Error exporting image:', err);
            notification.textContent = 'Error exporting image';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 2000);
        });
    } catch (err) {
        console.error('Error setting up export:', err);
        notification.textContent = 'Error setting up export';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }
}

// Export functions to global scope
window.initFileManagement = initFileManagement; // Ensure it's available for main.js
window.setProjectName = setProjectName;
window.saveProject = saveProject;
window.openProject = openProject;
window.exportAsImage = exportAsImage;
window.createNewProject = createNewProject;
window.switchToProject = switchToProject;
window.closeProject = closeProject;
window.showRenameProjectModal = showRenameProjectModal;
window.renameProject = renameProject;

// --- PDF Export Functionality ---

// Helper to convert image URL to Base64
function imageToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Handle CORS if images are from different origins
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (error) {
                console.error('Error creating base64 image:', error);
                reject(error);
            }
        };
        img.onerror = (error) => {
            console.error('Error loading image for PDF export:', url, error);
            reject(new Error(`Failed to load image: ${url}`));
        };
        img.src = url;

        // Add timeout for images that may never load
        setTimeout(() => {
            if (!img.complete) {
                reject(new Error(`Image load timeout: ${url}`));
            }
        }, 10000); // 10 second timeout
    });
}

// Helper to process HTML content for PDF
async function processNodeContent(contentEl, doc, startX, startY, availableWidth) {
    if (!contentEl) return startY;

    let currentY = startY;
    const lineHeight = 12;
    const paragraphSpacing = 8;
    const textColor = doc.getTextColor();

    // Function to process all child nodes recursively
    async function processElement(element, level = 0) {
        // Indent list items
        const indent = level * 10;
        const itemX = startX + indent;

        // Process each child node
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];

            // Handle text nodes
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    try {
                        const lines = doc.splitTextToSize(text, availableWidth - indent);
                        doc.text(lines, itemX, currentY);
                        currentY += lines.length * lineHeight;
                    } catch (error) {
                        console.error('Error processing text:', error);
                    }
                }
            }
            // Handle element nodes
            else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();

                switch (tagName) {
                    case 'img':
                        try {
                            console.log('Processing image:', child.src);
                            const imgDataUrl = await imageToBase64(child.src);

                            // Get image dimensions
                            const imgWidth = child.naturalWidth || child.width || 100;
                            const imgHeight = child.naturalHeight || child.height || 100;

                            // Scale image if too wide
                            let drawWidth = Math.min(imgWidth, availableWidth - indent);
                            let drawHeight = imgHeight * (drawWidth / imgWidth);

                            // Add image to PDF
                            doc.addImage(
                                imgDataUrl,
                                'PNG',
                                itemX,
                                currentY,
                                drawWidth,
                                drawHeight
                            );

                            currentY += drawHeight + paragraphSpacing;
                            console.log('Image added successfully at', itemX, currentY - drawHeight);
                        } catch (error) {
                            console.error('Error processing image:', error);
                            doc.setTextColor('#FF0000');
                            doc.text('[Image Error]', itemX, currentY);
                            doc.setTextColor(textColor);
                            currentY += lineHeight;
                        }
                        break;

                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                    case 'h5':
                    case 'h6':
                        // Save current font size
                        const currentSize = doc.getFontSize();
                        // Calculate heading size (h1 is largest, h6 is smallest)
                        const headingSize = currentSize * (1.5 - ((parseInt(tagName.substring(1)) - 1) * 0.1));
                        doc.setFontSize(headingSize);

                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * (headingSize / currentSize * lineHeight) + paragraphSpacing;
                        }

                        // Restore font size
                        doc.setFontSize(currentSize);
                        break;

                    case 'p':
                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * lineHeight + paragraphSpacing;
                        }
                        break;

                    case 'br':
                        currentY += lineHeight;
                        break;

                    case 'ul':
                    case 'ol':
                        // Process lists
                        const listItems = child.querySelectorAll(':scope > li');
                        for (let j = 0; j < listItems.length; j++) {
                            const item = listItems[j];
                            const bulletOrNumber = tagName === 'ul' ? '• ' : `${j + 1}. `;

                            // Add bullet/number
                            doc.text(bulletOrNumber, itemX, currentY);

                            // Process list item content with indent
                            const listItemX = itemX + doc.getTextWidth(bulletOrNumber) + 2;

                            // Handle text content in list item
                            if (item.childNodes.length === 1 && item.childNodes[0].nodeType === Node.TEXT_NODE) {
                                const lines = doc.splitTextToSize(item.textContent.trim(), availableWidth - indent - doc.getTextWidth(bulletOrNumber) - 2);
                                doc.text(lines, listItemX, currentY);
                                currentY += lines.length * lineHeight;
                            } else {
                                // Handle nested content in list item
                                const startingY = currentY;
                                await processElement(item, level + 1);
                                // If there wasn't any Y movement, add some space
                                if (currentY === startingY) {
                                    currentY += lineHeight;
                                }
                            }
                        }
                        currentY += paragraphSpacing;
                        break;

                    case 'li':
                        // List items are handled in the ul/ol case
                        await processElement(child, level + 1);
                        break;

                    case 'strong':
                    case 'b':
                        // Handle bold text
                        doc.setFont('Helvetica', 'bold');
                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * lineHeight;
                        }
                        doc.setFont('Helvetica', 'normal');
                        break;

                    case 'em':
                    case 'i':
                        // Handle italic text
                        doc.setFont('Helvetica', 'italic');
                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * lineHeight;
                        }
                        doc.setFont('Helvetica', 'normal');
                        break;

                    case 'iframe':
                        const iframeSrc = child.getAttribute('src') || '';
                        doc.setFont('Helvetica', 'italic');
                        doc.setTextColor('#888888'); // Dim color for iframe src
                        doc.text(`[Iframe: ${iframeSrc}]`, itemX, currentY, { maxWidth: availableWidth - indent });
                        doc.setTextColor(textColor);
                        doc.setFont('Helvetica', 'normal');
                        currentY += lineHeight;
                        break;

                    default:
                        // For other elements, recursively process their children
                        await processElement(child, level);
                }
            }
        }
    }

    // Start processing from the content element
    await processElement(contentEl);

    return currentY;
}

// Export the entire mindmap as a PDF document (Improved Version)
async function exportAsPDF() {
    // Ensure jsPDF is loaded
    if (typeof jspdf === 'undefined') {
        console.error('jsPDF library is not loaded.');
        alert('PDF Export library not found. Please check your internet connection or contact support.');
        return;
    }
    const { jsPDF } = jspdf;

    // Get current project data
    if (activeProjectIndex < 0 || !projects[activeProjectIndex]) {
        console.error('No active project to export');
        alert('No active project selected for export.');
        return;
    }
    saveProjectState(activeProjectIndex); // Ensure current state is captured
    const project = projects[activeProjectIndex];
    const nodes = project.nodes;
    const connections = project.connections;

    if (!nodes || nodes.length === 0) {
        alert('Cannot export an empty project.');
        return;
    }

    // --- 1. Calculate Bounds & Collect Node Elements ---
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodeElements = {}; // Store DOM elements for size/content access
    document.querySelectorAll('.node').forEach(nodeEl => {
        // Use the node data structure from saveProjectState (which uses captureNodeData)
        const nodeData = nodes.find(n => n.id === nodeEl.id);
        if (nodeData) {
            // Access position correctly
            const x = nodeData.position?.x ?? 0;
            const y = nodeData.position?.y ?? 0;
            const width = nodeEl.offsetWidth;
            const height = nodeEl.offsetHeight;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
            nodeElements[nodeEl.id] = nodeEl; // Store element
        }
    });

    const padding = 50; // Space around the content
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const pdfWidth = contentWidth + padding * 2;
    const pdfHeight = contentHeight + padding * 2;
    const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';

    // --- 2. Initialize jsPDF ---
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
    });

    // --- Font Handling for Unicode Support ---
    try {
        // Try a font with potentially better Unicode support
        doc.setFont('Arial', 'normal'); // Try Arial instead of Helvetica
        console.log("Using Arial font for PDF export.");
    } catch (fontError) {
        console.warn("Arial font not available, falling back to Helvetica.", fontError);
        try {
            doc.setFont('Helvetica', 'normal');
        } catch (fallbackError) {
            console.error("Could not set any standard font for PDF.", fallbackError);
        }
    }

    // --- 3. Set Background & Colors ---
    const isNightMode = document.body.classList.contains('night-mode');
    const backgroundColor = isNightMode ? '#1a1a1a' : '#ffffff';
    const nodeBackgroundColor = isNightMode ? '#2b2b2b' : '#ffffff';
    const textColor = isNightMode ? '#e0e0e0' : '#333333';
    const connectionColor = isNightMode ? '#a0a0a0' : '#aaaaaa'; // Slightly adjusted for visibility
    const nodeBorderColor = isNightMode ? '#555555' : '#cccccc';

    doc.setFillColor(backgroundColor);
    doc.rect(0, 0, pdfWidth, pdfHeight, 'F');

    // --- 4. Add Header ---
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const headerText = `${project.name} - ${dateStr}`;
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text(headerText, padding / 2, padding / 2 + 10);

    // --- Coordinate Transformation ---
    const transformX = (canvasX) => (canvasX - minX) + padding;
    const transformY = (canvasY) => (canvasY - minY) + padding;

    // --- 5. Draw Connections (Bezier Curves) ---
    doc.setLineWidth(1.5);
    doc.setDrawColor(connectionColor);

    connections.forEach(conn => {
        const startNodeEl = nodeElements[conn.startNode];
        const endNodeEl = nodeElements[conn.endNode];
        // Access position correctly from node data
        const startNodeData = nodes.find(n => n.id === conn.startNode);
        const endNodeData = nodes.find(n => n.id === conn.endNode);

        if (!startNodeEl || !endNodeEl || !startNodeData || !endNodeData) return;

        // Calculate absolute pin positions using correct position data
        const startX = (conn.startPin === 'left') ? startNodeData.position.x : startNodeData.position.x + startNodeEl.offsetWidth;
        const startY = startNodeData.position.y + startNodeEl.offsetHeight / 2;
        const endX = (conn.endPin === 'left') ? endNodeData.position.x : endNodeData.position.x + endNodeEl.offsetWidth;
        const endY = endNodeData.position.y + endNodeEl.offsetHeight / 2;

        // Transform coordinates for PDF
        const pdfStartX = transformX(startX);
        const pdfStartY = transformY(startY);
        const pdfEndX = transformX(endX);
        const pdfEndY = transformY(endY);

        // Calculate control points (same logic as in connections.js)
        const dx = Math.abs(pdfEndX - pdfStartX) / 2;
        let cp1X, cp2X;
        if (conn.startPin === 'left') { cp1X = pdfStartX - dx; } else { cp1X = pdfStartX + dx; }
        if (conn.endPin === 'left') { cp2X = pdfEndX - dx; } else { cp2X = pdfEndX + dx; }

        // Draw Bezier curve
        doc.path([
            { op: 'm', c: [pdfStartX, pdfStartY] }, // Move to start
            { op: 'c', c: [cp1X, pdfStartY, cp2X, pdfEndY, pdfEndX, pdfEndY] } // Bezier curve to end
        ]).stroke();
    });

    // --- 6. Draw Nodes (with Images and Text) ---
    console.log(`Processing ${nodes.length} nodes for PDF export`);
    const nodeDrawingPromises = nodes.map(async (nodeData, index) => {
        const nodeEl = nodeElements[nodeData.id];
        if (!nodeEl) {
            console.warn(`Node element not found for node data: ${nodeData.id}`);
            return;
        }

        console.log(`Processing node ${index + 1}/${nodes.length}: ${nodeData.id} (Type: ${nodeData.nodeType})`);

        // Access position correctly
        const x = nodeData.position?.x ?? 0;
        const y = nodeData.position?.y ?? 0;
        const width = nodeEl.offsetWidth;
        const height = nodeEl.offsetHeight;
        const contentEl = nodeEl.querySelector('.content');
        // Get node type and content from nodeData
        const nodeType = nodeData.nodeType || 'default';
        const nodeContent = nodeData.content;
        const stripColor = nodeData.stripColor || (isNightMode ? '#444' : '#eee');

        const pdfX = transformX(x);
        const pdfY = transformY(y);

        // Draw node background and border
        doc.setFillColor(nodeBackgroundColor);
        doc.setDrawColor(nodeBorderColor);
        doc.setLineWidth(1);
        doc.rect(pdfX, pdfY, width, height, 'FD'); // Fill and Stroke

        // Draw color strip
        const stripWidth = 5;
        doc.setFillColor(stripColor);
        doc.rect(pdfX, pdfY, stripWidth, height, 'F');

        // --- Process node content --- 
        const contentStartX = pdfX + stripWidth + 10;
        const contentStartY = pdfY + 15; // Slightly more top padding
        const availableWidth = width - stripWidth - 20;

        doc.setFontSize(10);
        doc.setTextColor(textColor);

        try {
            if (nodeType === 'checklist') {
                // Handle checklist content DIRECTLY from nodeContent (JSON string)
                doc.setFont('Arial', 'italic'); // Use the chosen font
                // doc.text("[Checklist Content - See Below]", contentStartX, contentStartY); // Remove this line
                doc.setFont('Arial', 'normal'); // Use the chosen font
                let currentY = contentStartY; // Start checklist items directly
                try {
                    // nodeContent should already be the JSON string from captureNodeData
                    const checklistData = JSON.parse(nodeContent);
                    if (checklistData && Array.isArray(checklistData.items)) {
                        doc.setFontSize(9); // Slightly smaller for checklist items
                        checklistData.items.forEach(item => {
                            const itemText = `${item.checked ? '[x]' : '[ ]'} ${item.text}`;
                            const lines = doc.splitTextToSize(itemText, availableWidth - 5); // Adjust width slightly
                            if (currentY + (lines.length * 9) > pdfY + height - 10) return; // Prevent overflow based on font size
                            doc.text(lines, contentStartX + 5, currentY);
                            currentY += lines.length * 9 + 2; // Adjust spacing
                        });
                        doc.setFontSize(10); // Reset font size
                    }
                } catch (e) {
                    doc.setFont('Arial', 'italic');
                    doc.text("(Error parsing checklist data)", contentStartX, currentY);
                    doc.setFont('Arial', 'normal');
                    currentY += 10;
                    console.error("Error parsing checklist JSON for PDF:", e, "Content:", nodeContent);
                }

            } else if (contentEl) {
                // Use existing HTML content processor for default nodes
                // Ensure processNodeContent also uses the correct font
                doc.setFont('Arial', 'normal');
                await processNodeContent(contentEl, doc, contentStartX, contentStartY, availableWidth);
            } else {
                // Fallback if content element not found
                doc.setFont('Arial', 'normal');
                doc.text(nodeContent || "(No Content)", contentStartX, contentStartY, { maxWidth: availableWidth });
            }
        } catch (error) {
            console.error(`Error processing node content for PDF: ${error.message}`, error);
            doc.setFont('Arial', 'italic');
            doc.text("(Error drawing content)", contentStartX, contentStartY);
            doc.setFont('Arial', 'normal');
        }
    });

    // Wait for all nodes (including images) to be processed
    await Promise.all(nodeDrawingPromises);

    // --- 7. Generate Filename & Save ---
    const safeProjectName = getSafeFilename(project.name);
    const filename = `${safeProjectName}-${now.toISOString().split('T')[0]}.pdf`;

    try {
        doc.save(filename);
        console.log(`Exported project as PDF: ${filename}`);
    } catch (error) {
        console.error('Error saving PDF:', error);
        alert('An error occurred while saving the PDF.');
    }
}

// --- End PDF Export ---


// Export functions to global scope
window.initFileManagement = initFileManagement; // Ensure it's available for main.js


// Export functions to global scope
window.initFileManagement = initFileManagement; // Ensure it's available for main.js
window.setProjectName = setProjectName;
window.saveProject = saveProject;
window.openProject = openProject;
window.exportAsImage = exportAsImage;
window.exportAsPDF = exportAsPDF; // Export the new function
window.createNewProject = createNewProject;
window.switchToProject = switchToProject;
window.closeProject = closeProject;
window.showRenameProjectModal = showRenameProjectModal;
window.renameProject = renameProject;

// --- Loading Indicator Functions ---
function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.color = 'white';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '10001'; // Above most elements
        overlay.style.fontSize = '1.5em';
        document.body.appendChild(overlay);
    }
    overlay.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Bu fonksiyonları pencere nesnesine ekleyelim
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;
// --- End Loading Indicator ---
