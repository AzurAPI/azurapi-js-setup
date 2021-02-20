const ships = require("./build/ships/index");
ships.refreshShips()
    .then(() => ships.refreshShipImages())
    .then(() => ships.publishShips());
