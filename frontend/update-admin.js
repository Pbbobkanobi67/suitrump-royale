const fs = require("fs");
const content = fs.readFileSync("src/pages/AdminPage.jsx", "utf8");

// Find the Quick Actions section end and insert new sections before Admin Wallet Info
const quickActionsEnd = content.indexOf("</div>\n      </div>\n\n      {/* Admin Wallet Info */}");
if (quickActionsEnd === -1) {
  console.log("Looking for alternative marker...");
  const altMarker = content.indexOf("{/* Admin Wallet Info */}");
  console.log("Alt marker at:", altMarker);
}
console.log("Quick actions end at:", quickActionsEnd);
console.log("File length:", content.length);

