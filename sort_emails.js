const fs = require('fs');
const path = require('path');

// Path to your markdown file
const INPUT_FILE = path.join(__dirname, 'elder_andrews_emails.md');
const OUTPUT_FILE = path.join(__dirname, 'elder_andrews_emails_sorted.md');

// Read the file
const content = fs.readFileSync(INPUT_FILE, 'utf-8');

// Split into sections — each starts with "## Subject:"
const sections = content
    .split(/^## /m) // split but lose the "## " prefix
    .filter(s => s.trim().length > 0) // remove empty
    .map(s => '## ' + s.trim()); // add back the prefix

// Helper to extract first Date: line and parse it
function extractDate(section) {
    const dateLine = section.split('\n').find(line => line.startsWith('Date:'));
    if (!dateLine) return null;

    const dateStr = dateLine.replace(/^Date:\s*/, '').trim();
    const parsed = new Date(dateStr);
    return isNaN(parsed) ? null : parsed;
}

// Sort sections by extracted date
sections.sort((a, b) => {
    const dateA = extractDate(a);
    const dateB = extractDate(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB; // oldest first; flip for newest first
});

// Join back into a single string
const sortedContent = sections.join('\n\n' + '-'.repeat(80) + '\n\n');

// Write to output file
fs.writeFileSync(OUTPUT_FILE, sortedContent, 'utf-8');

console.log(`Sorted ${sections.length} sections by first Date: line → ${OUTPUT_FILE}`);
