const fs = require("fs");
const clearFiles = (path) => fs.readdirSync(path).forEach((file, index) => {
    const curPath = path + "/" + file;
    if (fs.lstatSync(curPath).isDirectory()) clearFiles(curPath);
    else fs.unlinkSync(curPath);
});

clearFiles("./web");
fs.writeFileSync("ships.json", "[]");
fs.writeFileSync("ships.internal.json", "{}");
fs.writeFileSync("ships.formatted.json", "[]");
fs.writeFileSync("ship-list.json", "{}");
console.log("Reset Done");