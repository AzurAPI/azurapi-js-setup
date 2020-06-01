const fs = require("fs");
const azurlane = require("./index.js");

fs.writeFileSync("ships.json", "{}");
fs.writeFileSync("ships.internal.json", "{}");
fs.writeFileSync("ships.formatted.json", "{}");
fs.writeFileSync("ship-list.json", "{}");

azurlane.refreshShips(false)
    .then(azurlane.refreshShipImages)
    .then(azurlane.publishShips);
