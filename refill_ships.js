const azurlane = require("./index.js");
azurlane.refreshShips(false)
    .then(() => azurlane.refreshShipImages())
    .then(() => azurlane.publishShips());
