const fs = require('fs');
const path = require('path');

const directory = 'C:\\Users\\Mustafa Yağız ÜNAL\\.gemini\\antigravity\\scratch\\b2byedekparca\\b2b-bronz-paket-xml';

function walkSync(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        var filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            if (!['node_modules', '.git', '.vercel', 'public'].includes(file)) {
                walkSync(filepath, callback);
            }
        } else if (stats.isFile()) {
            callback(filepath);
        }
    });
}

function replaceWithCase(str, target) {
    if (str === str.toUpperCase()) return target.toUpperCase();
    if (str === str.toLowerCase()) return target.toLowerCase();
    
    // Capitalized first letter
    const firstChar = str.charAt(0);
    if (firstChar === firstChar.toUpperCase()) {
        return target.charAt(0).toUpperCase() + target.slice(1).toLowerCase();
    }
    
    return target; // fallback
}

let modifiedFiles = 0;
walkSync(directory, (filepath) => {
    if (filepath.endsWith('.env.local') || filepath.endsWith('.env') || filepath.endsWith('.env.test.local')) {
        return;
    }
    if(filepath.match(/\.(sqlite|db|exe|dll|webp|png|jpg|jpeg|gif|pdf|ico|DS_Store|lock|woff|woff2|ttf)$/i)) return;

    let content;
    try {
        content = fs.readFileSync(filepath, 'utf8');
    } catch(e) {
        return;
    }
    
    let newContent = content;
    
    // Pattern to catch ARTPAR, ARTPAR, etc.
    const pattern = /artpar\s*group['’]?s|artpar\s*groups|artpar/gi;
    
    newContent = newContent.replace(pattern, (match) => {
        return replaceWithCase(match, "artpar");
    });
    
    // Also let's check if there are any "ARTPAR" left that didn't get caught because of Turkish İ
    const pattern2 = /omİ\s*group['’]?s|omİ\s*groups|artpar/gi;
    newContent = newContent.replace(pattern2, (match) => {
        return replaceWithCase(match, "artpar");
    });

    if (content !== newContent) {
        fs.writeFileSync(filepath, newContent, 'utf8');
        modifiedFiles++;
        console.log("Modified:", filepath);
    }
});

console.log("Total modified files for group fix:", modifiedFiles);
