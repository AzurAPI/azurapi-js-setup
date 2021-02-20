const equipments = require("./src/equipments/index.js");
equipments.refreshEquipments()
    .then(() => equipments.refreshEQImages())
    .then(() => equipments.publishEQ());
