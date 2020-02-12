const azurlane = require("./index.js");
// azurlane.refreshShips(false);
// azurlane.refreshEquipments(false);
// azurlane.refreshChapter(false);
// azurlane.refreshShipImages();
// azurlane.refreshEQImages();
// azurlane.publishShips();
// azurlane.publishEQ();
// azurlane.refreshMemory();
const e1 = require("./equipments.internal.json");
const e2 = require("./equipments.json");
console.log(Object.keys(e1).length,Object.keys(e2).length)
