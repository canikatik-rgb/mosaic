// node_types/default.js
function createDefaultNodeHTML(id, x, y, content, stripColor) {
    const nodeHTML = `
        <div class="node" id="${id}" style="left: ${x}px; top: ${y}px;">
            <div class="strip" style="background-color: ${stripColor || '#c2f8cb'};">
            </div>
            <div class="content" contenteditable="false">
                ${content}
            </div>
            <div class="pin left"></div>
            <div class="pin right"></div>
        </div>
    `;
    // Create a temporary container to parse the HTML string
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = nodeHTML.trim();
    return tempContainer.firstChild; // Return the node element itself
}

// Make the function globally accessible or export it depending on module system
if (typeof window !== 'undefined') {
    window.nodeTypeLoaders = window.nodeTypeLoaders || {};
    window.nodeTypeLoaders['default'] = createDefaultNodeHTML;
} else {
    // Handle Node.js environment if needed (e.g., for testing)
    module.exports = createDefaultNodeHTML;
} 