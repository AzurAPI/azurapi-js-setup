const fs = require("fs");
const clearFiles = (path) => fs.readdirSync(path).forEach((file, index) => {
    const curPath = path + "/" + file;
    if (fs.lstatSync(curPath).isDirectory()) clearFiles(curPath);
    else fs.unlinkSync(curPath);
});
if (!fs.existsSync("./web")) fs.mkdirSync("./web");
if (!fs.existsSync("./web/ships")) fs.mkdirSync("./web/ships");
if (!fs.existsSync("./web/ships.gallery")) fs.mkdirSync("./web/ships.gallery");
clearFiles("./web");
fs.writeFileSync("ships.json", "[]");
fs.writeFileSync("ships.internal.json", "{}");
fs.writeFileSync("ships.formatted.json", "[]");
fs.writeFileSync("ship-list.json", "{}");
console.log("Reset Done");