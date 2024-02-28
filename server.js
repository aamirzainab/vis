const fs = require('fs');
const path = require('path');

function generateFolderStructure(rootDir) {
    const structure = {};

    const rootDirectories = ['RealWorld', 'VirtualWorld'];

    rootDirectories.forEach(dir => {
        const fullPath = path.join(rootDir, dir);
        structure[dir] = readDirectory(fullPath);
    });

    return structure;
}

function readDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const folderContents = [];

    entries.forEach(entry => {
        // Check if the entry is a file starting with '.' and ignore it
        if (!entry.name.startsWith('.')) {
            if (entry.isDirectory()) {
                folderContents.push({
                    name: entry.name,
                    type: 'folder',
                    children: readDirectory(path.join(dirPath, entry.name)) // Recursively read subdirectories
                });
            } else {
                folderContents.push({
                    name: entry.name,
                    type: 'file'
                });
            }
        }
    });

    return folderContents;
}


// const rootDir = ""
const rootDir = process.cwd();// Replace this with the path to the directory containing RealWorld and VirtualWorld
const folderStructure = generateFolderStructure(rootDir);

// console.log(folderStructure);
fs.writeFileSync('folderStructure.json', JSON.stringify(folderStructure, null, 2), 'utf-8');