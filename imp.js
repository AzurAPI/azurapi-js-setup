const azurlane = require("./index.js");
const fs = require('fs');
// azurlane.refreshImages(false);

azurlane.fetchEquipment("https://azurlane.koumakan.jp/Single_138.6mm_(Mle_1929)", "Single 138.6mm (Mle 1929)", "Destroyer", true)
    .then(j => fs.writeFileSync('./tmp.json', JSON.stringify(j)));
