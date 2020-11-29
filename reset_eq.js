const fs = require("fs");
const clearFiles = (path) => fs.readdirSync(path).forEach((file, index) => {
    const curPath = path + "/" + file;
    if (fs.lstatSync(curPath).isDirectory()) clearFiles(curPath);
    else fs.unlinkSync(curPath);
});
if (!fs.existsSync("./web")) fs.mkdirSync("./web");
if (!fs.existsSync("./web/equipments")) fs.mkdirSync("./web/equipments");
clearFiles("./web/equipments");
fs.writeFileSync("equipments.json", "{}");
fs.writeFileSync("equipments.internal.json", "{}");
console.log("Reset Done");