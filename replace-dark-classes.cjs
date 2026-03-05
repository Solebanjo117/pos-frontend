const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = path.join(__dirname, 'resources', 'js');

let replacedFiles = 0;

walkDir(targetDir, function (filePath) {
    if (filePath.endsWith('.vue')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;

        // Backgrounds
        content = content.replace(/dark:bg-gray-800/g, 'dark:bg-card');
        content = content.replace(/dark:bg-gray-700/g, 'dark:bg-muted');
        content = content.replace(/dark:bg-gray-900/g, 'dark:bg-background');
        content = content.replace(/dark:bg-slate-800/g, 'dark:bg-card');
        content = content.replace(/dark:bg-slate-700/g, 'dark:bg-muted');
        content = content.replace(/dark:bg-slate-900/g, 'dark:bg-background');
        content = content.replace(/dark:bg-zinc-800/g, 'dark:bg-card');
        content = content.replace(/dark:bg-zinc-700/g, 'dark:bg-muted');
        content = content.replace(/dark:bg-zinc-900/g, 'dark:bg-background');
        // Borders
        content = content.replace(/dark:border-gray-800/g, 'dark:border-border');
        content = content.replace(/dark:border-gray-700/g, 'dark:border-border');
        content = content.replace(/dark:border-gray-600/g, 'dark:border-border');
        // Divides
        content = content.replace(/dark:divide-gray-800/g, 'dark:divide-border');
        content = content.replace(/dark:divide-gray-700/g, 'dark:divide-border');
        content = content.replace(/dark:divide-gray-600/g, 'dark:divide-border');
        // Hover
        content = content.replace(/dark:hover:bg-gray-800/g, 'dark:hover:bg-card');
        content = content.replace(/dark:hover:bg-gray-700/g, 'dark:hover:bg-muted/50');
        content = content.replace(/dark:hover:bg-gray-600/g, 'dark:hover:bg-muted');
        // Focus rings
        content = content.replace(/dark:focus:ring-gray-700/g, 'dark:focus:ring-border');
        content = content.replace(/dark:focus:ring-gray-800/g, 'dark:focus:ring-border');

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            replacedFiles++;
        }
    }
});

console.log(`Replacement complete. Modified ${replacedFiles} files.`);
