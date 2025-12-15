const fs = require('fs');
const content = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

// Find markers
const quickActionsStart = content.indexOf('{/* Quick Actions */}');
const adminWalletStart = content.indexOf('{/* Admin Wallet Info */}');

console.log('Quick Actions starts at line:', content.substring(0, quickActionsStart).split('\n').length);
console.log('Admin Wallet starts at line:', content.substring(0, adminWalletStart).split('\n').length);

// Find the closing of Quick Actions section (we need to find the matching </div>)
// Quick Actions section structure: admin-section > section-title + quick-actions-grid
// We need to find where Quick Actions ends

// Get the text between these markers
const betweenText = content.substring(quickActionsStart, adminWalletStart);
console.log('Characters between markers:', betweenText.length);
console.log('Lines between markers:', betweenText.split('\n').length);
