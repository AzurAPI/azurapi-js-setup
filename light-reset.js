const fs = require("fs");
fs.writeFileSync("ships.json", "{}");
fs.writeFileSync("ships.internal.json", "{}");
fs.writeFileSync("ships.formatted.json", "{}");
fs.writeFileSync("ship-list.json", "{}");

const azurlane = require("./index.js");

azurlane.refreshShips(false)
    .then(azurlane.refreshShipImages)
    .then(azurlane.publishShips);
