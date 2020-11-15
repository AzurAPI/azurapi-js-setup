const ships = require("./ships/index.js");
ships.refreshShips()
    .then(() => ships.refreshShipImages())
    .then(() => ships.publishShips());
