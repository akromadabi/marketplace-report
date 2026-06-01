const fs = require('fs');
const path = require('path');

// Helper to copy directory recursively with exclusions
function copyDirSync(src, dest, excludeFiles = []) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        if (excludeFiles.includes(entry.name)) {
            continue;
        }

        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath, excludeFiles);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Ensure build folder exists
if (!fs.existsSync('build')) {
    console.error('Error: "build" directory not found. Please run "npm run build" first.');
    process.exit(1);
}

console.log('Copying build files to public directories...');

// 1. Copy everything from build/ to root public/ (EXCLUDING index.html to prevent template pollution)
copyDirSync('build', 'public', ['index.html']);
console.log('✓ Copied build assets to root public/ (excluding index.html)');

// 2. Copy everything from build/ to marketplace-api/public/ (EXCLUDING index.php and .htaccess)
copyDirSync('build', 'marketplace-api/public', ['index.php', '.htaccess']);
console.log('✓ Copied build assets to marketplace-api/public/ (excluding index.php and .htaccess)');

console.log('All local build files copied successfully!');
