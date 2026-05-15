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

function preserveCaseReplace(text) {
    let newText = text;

    // Pattern 1: artpar, artpar, artpar
    const groupPattern = /artpar\s*group['’]?s|artpar\s*groups|artpar/gi;
    newText = newText.replace(groupPattern, (match) => replaceWithCase(match, "artpar"));

    // Pattern 2: artpar and ARTPAR (Turkish I) as standalone words
    const omiPattern = /(^|[^a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ])(artpar|artpar)(?![a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ])/gi;
    
    newText = newText.replace(omiPattern, (match, p1, p2) => {
        return p1 + replaceWithCase(p2, "artpar");
    });

    return newText;
}

let modifiedFiles = 0;
walkSync(directory, (filepath) => {
    // Ignore .env files
    if (filepath.endsWith('.env.local') || filepath.endsWith('.env') || filepath.endsWith('.env.test.local')) {
        return;
    }
    
    // Ignore binary/image files
    if(filepath.match(/\.(sqlite|db|exe|dll|webp|png|jpg|jpeg|gif|pdf|ico|DS_Store|lock|woff|woff2|ttf)$/i)) return;

    let content;
    try {
        content = fs.readFileSync(filepath, 'utf8');
    } catch(e) {
        return;
    }
    
    const newContent = preserveCaseReplace(content);
    if (content !== newContent) {
        fs.writeFileSync(filepath, newContent, 'utf8');
        modifiedFiles++;
        console.log("Modified:", filepath);
    }
});

console.log("Total modified files:", modifiedFiles);
