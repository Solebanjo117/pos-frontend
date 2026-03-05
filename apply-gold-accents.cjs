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

        // Backgrounds (adding dark mode gold)
        content = content.replace(/bg-blue-600(?! dark:bg-primary)/g, 'bg-blue-600 dark:bg-primary dark:text-primary-foreground');
        content = content.replace(/bg-indigo-600(?! dark:bg-primary)/g, 'bg-indigo-600 dark:bg-primary dark:text-primary-foreground');

        // Hovers
        content = content.replace(/hover:bg-blue-700(?! dark:hover:bg-primary\/90)/g, 'hover:bg-blue-700 dark:hover:bg-primary/90');
        content = content.replace(/hover:bg-indigo-700(?! dark:hover:bg-primary\/90)/g, 'hover:bg-indigo-700 dark:hover:bg-primary/90');

        // Texts
        content = content.replace(/text-blue-600(?! dark:text-primary)/g, 'text-blue-600 dark:text-primary');
        content = content.replace(/text-indigo-600(?! dark:text-primary)/g, 'text-indigo-600 dark:text-primary');

        // Borders
        content = content.replace(/border-blue-600(?! dark:border-primary)/g, 'border-blue-600 dark:border-primary');
        content = content.replace(/border-indigo-600(?! dark:border-primary)/g, 'border-indigo-600 dark:border-primary');

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            replacedFiles++;
        }
    }
});

console.log(`Replacement complete. Modified ${replacedFiles} files.`);
