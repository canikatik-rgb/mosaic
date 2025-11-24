// node_types/checklist.js

/**
 * Checklist Node Type
 * Creates a node with checklist functionality.
 */

// Function to get localized texts for this node type (used by node type switcher)
function getChecklistTexts() {
    return {
        nodeName: {
            en: 'Checklist',
            es: 'Lista de Tareas',
            fr: 'Liste de Contrôle',
            de: 'Checkliste',
            tr: 'Kontrol Listesi'
        },
        newItemPlaceholder: {
            en: 'New Task',
            tr: 'Yeni Görev',
            es: 'Nueva Tarea',
            fr: 'Nouvelle Tâche',
            de: 'Neue Aufgabe'
        },
        addItemButton: {
            en: '+ Add Item',
            tr: '+ Öğe Ekle',
            es: '+ Añadir Elemento',
            fr: '+ Ajouter Élément',
            de: '+ Element Hinzufügen'
        },
        removeItemTitle: {
            en: 'Remove Item',
            tr: 'Öğeyi Kaldır',
            es: 'Eliminar Elemento',
            fr: 'Supprimer Élément',
            de: 'Element Entfernen'
        },
        changeNodeTypeTitle: {
            en: 'Change Node Type',
            tr: 'Düğüm Türünü Değiştir',
            es: 'Cambiar Tipo de Nodo',
            fr: 'Changer le Type de Noeud',
            de: 'Knotentyp ändern'
        }
    };
}

// Load the checklist node functionality
function loadChecklistNode(id, x, y, content = null, stripColor = null) {
    const node = document.createElement('div');
    node.id = id;
    node.className = 'node node-checklist'; // Add specific class
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.dataset.nodeType = 'checklist'; // Set node type

    // --- Node Structure ---
    // Strip (Header)
    const strip = document.createElement('div');
    strip.className = 'strip';
    if (stripColor) {
        strip.style.backgroundColor = stripColor;
    }
    // Add type switch icon - REMOVED
    // Delete button - REMOVED
    node.appendChild(strip);

    // Content Area
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';

    const checklistItemsContainer = document.createElement('div');
    checklistItemsContainer.className = 'checklist-items';
    contentDiv.appendChild(checklistItemsContainer);

    // Add Checklist Item Button
    const addItemButton = document.createElement('button');
    addItemButton.className = 'add-checklist-item';
    // Use the correct translation key and remove fallback '+'
    addItemButton.innerHTML = `<i class="fas fa-plus"></i> ${getText('checklistAddItem') || 'Add Item'}`;
    addItemButton.onclick = () => {
        const newItemDiv = addChecklistItem(checklistItemsContainer);
        // Focus and clear placeholder of the new item
        const newSpan = newItemDiv.querySelector('span');
        if (newSpan) {
            setTimeout(() => { // Timeout needed to ensure focus works after DOM changes
                newSpan.focus();
                // Clear placeholder explicitly after focusing
                const placeholderText = getText('checklistAddItem') || 'New Task';
                if (newSpan.textContent === placeholderText) {
                    newSpan.textContent = '';
                    newSpan.classList.remove('is-placeholder');
                }
            }, 0);
        }
        // Schedule auto-save after adding an item
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    };
    contentDiv.appendChild(addItemButton);

    node.appendChild(contentDiv);

    // Connection Pins
    const leftPin = document.createElement('div');
    leftPin.className = 'pin left';
    node.appendChild(leftPin);
    const rightPin = document.createElement('div');
    rightPin.className = 'pin right';
    node.appendChild(rightPin);

    // --- Load Content ---
    loadChecklistContent(checklistItemsContainer, content);

    // --- Add methods specific to checklist ---
    node.getContentData = () => { // Method to get content in JSON format
        const items = [];
        const placeholderText = getText('checklistAddItem') || 'New Task';
        checklistItemsContainer.querySelectorAll('.checklist-item').forEach(itemDiv => {
            const checkbox = itemDiv.querySelector('input[type="checkbox"]');
            const span = itemDiv.querySelector('span');
            // Only save if it's not the placeholder text
            if (checkbox && span && span.textContent !== placeholderText) {
                items.push({
                    text: span.textContent,
                    checked: checkbox.checked
                });
            }
        });
        // If after filtering placeholders, the list is empty, return null or empty JSON
        // to signify no real content, allowing placeholder restoration on load if needed.
        return items.length > 0 ? JSON.stringify({ items }) : JSON.stringify({ items: [] }); // Return empty array if no real items
    };


    return node;
}

// Helper function to load checklist content (JSON or initial)
function loadChecklistContent(container, content) {
    container.innerHTML = ''; // Clear previous items
    let items = [];
    const placeholderText = getText('checklistAddItem') || 'New Task'; // Get placeholder text

    if (content) {
        try {
            const parsedData = JSON.parse(content);
            // Ensure parsedData and items exist and items is an array
            if (parsedData && Array.isArray(parsedData.items)) {
                // Filter out any potential saved items that are just the placeholder text
                items = parsedData.items.filter(item => item.text !== placeholderText);
            } else if (typeof content === 'string' && content !== placeholderText) {
                // Handle case where content might be a single string (legacy or conversion)
                items = [{ text: content, checked: false }];
            }
        } catch (e) {
            console.warn("Could not parse checklist content as JSON, treating as plain text:", content, e);
            // If content is not valid JSON and not the placeholder, treat it as the text for the first item
            if (typeof content === 'string' && content !== placeholderText) {
                items = [{ text: content, checked: false }];
            }
        }
    }

    // If no *real* items were loaded or parsed, create a default first item with placeholder
    if (items.length === 0) {
        // Pass null to addChecklistItem to trigger placeholder logic
        addChecklistItem(container, null, false);
    } else {
        // Add the loaded items
        items.forEach(itemData => {
            addChecklistItem(container, itemData.text, itemData.checked);
        });
    }
}


// Helper function to add a checklist item to the container
function addChecklistItem(container, text = null, checked = false) { // Default text to null
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item';
    const placeholderText = getText('checklistAddItem') || 'New Task';
    // Use placeholder if text is null or explicitly the placeholder text itself (handles loading saved state)
    const initialText = (text === null || text === placeholderText) ? placeholderText : text;

    if (checked) {
        itemDiv.classList.add('completed');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => {
        itemDiv.classList.toggle('completed', checkbox.checked);
        // Schedule auto-save when checkbox state changes
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    });

    const span = document.createElement('span');
    span.contentEditable = 'true';
    span.textContent = initialText; // Set initial text

    // Add placeholder class initially if needed
    if (initialText === placeholderText) {
        span.classList.add('is-placeholder');
    }

    span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent new line in span
            const newItemDiv = addChecklistItem(container); // Add a new item below
            // Focus and clear placeholder of the new item
            const newSpan = newItemDiv.querySelector('span');
            if (newSpan) {
                setTimeout(() => { // Timeout needed to ensure focus works after DOM changes
                    newSpan.focus();
                    // Clear placeholder explicitly after focusing
                    if (newSpan.textContent === placeholderText) {
                        newSpan.textContent = '';
                        newSpan.classList.remove('is-placeholder');
                    }
                }, 0);
            }
        } else if (e.key === 'Backspace' && span.textContent === '') {
            // If backspace is pressed on an empty item that *wasn't* the placeholder, remove it
            if (!span.classList.contains('is-placeholder')) {
                e.preventDefault();
                const previousItem = itemDiv.previousElementSibling;
                itemDiv.remove();
                // Schedule auto-save after removing item with backspace
                if (window.scheduleAutoSave) window.scheduleAutoSave();
                if (previousItem) {
                    // Focus the span of the previous item
                    const prevSpan = previousItem.querySelector('span');
                    if (prevSpan) {
                        prevSpan.focus();
                        // Move cursor to the end of the previous item's text
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(prevSpan);
                        range.collapse(false); // Collapse to the end
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }
        }
    });

    // Clear placeholder on focus
    span.addEventListener('focus', () => {
        if (span.classList.contains('is-placeholder')) {
            span.textContent = '';
            span.classList.remove('is-placeholder');
        }
    });

    // Restore placeholder on blur if empty
    span.addEventListener('blur', () => {
        const currentText = span.textContent.trim();
        if (currentText === '') {
            span.textContent = placeholderText;
            span.classList.add('is-placeholder');
        } else {
            // Schedule auto-save when content changes (on blur)
            // Compare with initialText or previous state if needed for more robust check
            if (window.scheduleAutoSave) window.scheduleAutoSave();
        }
    });

    const removeItemBtn = document.createElement('button');
    removeItemBtn.className = 'remove-item';
    removeItemBtn.innerHTML = '&times;';
    removeItemBtn.title = getText('removeItemTitle') || 'Remove Item';
    removeItemBtn.addEventListener('click', () => {
        const parent = itemDiv.parentNode;
        itemDiv.remove();
        // Schedule auto-save after removing item with button
        if (window.scheduleAutoSave) window.scheduleAutoSave();
        // Add placeholder if it was the last item
        if (parent && parent.children.length === 0) {
            addChecklistItem(parent, null, false);
        }
    });

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(span);
    itemDiv.appendChild(removeItemBtn);
    container.appendChild(itemDiv);
    return itemDiv; // Return the created item div
}


// Register the loader function
if (window.nodeTypeLoaders) {
    window.nodeTypeLoaders.checklist = loadChecklistNode;
    window.nodeTypeLoaders.checklist.getTexts = getChecklistTexts; // Expose texts for switcher
} else {
    console.error("window.nodeTypeLoaders is not defined. Checklist node type cannot be registered.");
}
