const fs = require("fs");

function renameAll(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function(file, index) {
            var curPath = path + "/" + file;
            var correctPath = path + "/" + file.replace(/ +/g, "_");
            if (fs.statSync(curPath).isDirectory()) { // recurse
                renameAll(curPath);
                fs.renameSync(curPath, correctPath);
            } else { // delete file
                fs.renameSync(curPath, correctPath);
            }
        });
    }
}
renameAll("./images");
