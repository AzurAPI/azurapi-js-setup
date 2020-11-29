const equipments = require("./equipment/index.js");
equipments.refreshEquipments()
    .then(() => equipments.refreshEQImages())
    .then(() => equipments.publishEQ());
