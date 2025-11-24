# Mosaic - Mindmap Tool

Mosaic is a web-based concept mapping tool that allows you to create visual representations of ideas and their connections. It features an infinite canvas, node creation, and powerful connection tools, all wrapped in a clean, modern interface.

## Features

- **Infinite Canvas**: Pan and zoom within a limitless workspace
- **Node Creation**: Double-click anywhere to create new nodes
- **Rich Content**: Add text, images, and links to your nodes
- **Connections**: Drag from pins to connect nodes together
- **Removal Tool**: Hold Alt/Option and drag across connections to remove them
- **Styling Options**: Change node colors with a simple click
- **Night Mode**: Toggle between light and dark themes
- **Project Management**: Save, open, and create new projects
- **Export**: Export your mindmap as an image

## Getting Started

1. Open `index.html` in your web browser
2. Choose to start a new project or open an existing one
3. Double-click anywhere on the canvas to create a new node
4. Connect nodes by dragging from one pin to another
5. Double-click on a node to edit its content

## Usage Tips

### Basic Controls
- **Pan**: Click and drag on empty canvas
- **Zoom**: Mouse wheel / trackpad pinch
- **Create Node**: Double-click on empty canvas
- **Edit Node**: Double-click on a node
- **Move Node**: Click and drag a node
- **Delete Node**: Click the 'X' in the top-right corner of a node
- **Select Multiple Nodes**: Hold Shift or Ctrl/Cmd while clicking nodes

### Connections
- **Create Connection**: Drag from one pin to another pin (or just close to a node)
- **Remove Connection**: Hold Alt/Option key and drag across connection

### Styling
- **Change Node Color**: Click on the node's colored strip

### File Management
- **New Project**: Click the '+' button and select "New Mosaic"
- **Save Project**: Click the '+' button and select "Save Project"
- **Open Project**: Click the '+' button and select "Open Project"
- **Export as Image**: Click the '+' button and select "Export as Image"

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save project
- **Ctrl/Cmd + O**: Open project
- **Ctrl/Cmd + N**: New project
- **Delete/Backspace**: Delete selected nodes
- **Escape**: Deselect all nodes or exit fullscreen

## Technical Details

Mosaic is built with vanilla JavaScript, HTML5, and CSS3, with no external dependencies for the core functionality. For image exports, it utilizes the html2canvas library, which is loaded dynamically when needed.

## Project Structure

```
/Mosaic
├── index.html        # Main HTML file
├── README.md         # This documentation
├── css/
│   └── styles.css    # All styling
└── js/
    ├── canvas.js     # Canvas handling
    ├── nodes.js      # Node management
    ├── connections.js # Connection handling
    ├── ui.js         # UI interactions
    ├── file-management.js # File operations
    └── main.js       # Application initialization
```

## License

Mosaic © by Ad Nouveau

## Contact

For questions or support, visit [Ad Nouveau](https://ad-nouveau.com/). 