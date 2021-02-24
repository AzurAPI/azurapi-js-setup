import * as ships from './ships';
import {FORMATTED_SHIPS_PATH, INTERNAL_SHIPS_PATH, SHIP_LIST_PATH, SHIPS_PATH} from './ships';
import fs from 'fs'
import path from "path";

(async function () {
    let args = process.argv.slice(2);
    switch (args[0]) {
        case 'ship':
        case 'ships':
            if (args[1] === 'reset') {
                clearFiles(path.join(__dirname, '..', 'web', 'ships'));
                clearFiles(path.join(__dirname, '..', 'web', 'ships.gallery'));
                deleteIfExist(path.join(__dirname, '..', 'web', 'ships.index.html'));
                deleteIfExist(SHIP_LIST_PATH);
                deleteIfExist(SHIPS_PATH);
                deleteIfExist(INTERNAL_SHIPS_PATH);
                deleteIfExist(FORMATTED_SHIPS_PATH);
                console.log("Ship Data Reset");
            } else if (args[1] === 'img') {
                await ships.refreshShipImages();
                console.log("Ship Images Refreshed");
            } else if (args[1] === 'publish') {
                await ships.publishShips();
                fs.copyFileSync(path.join(__dirname, '..', 'dist', 'ships.json'), path.join(__dirname, '..', 'ships.json'));
                fs.copyFileSync(path.join(__dirname, '..', 'dist', 'version.json'), path.join(__dirname, '..', 'version-info.json'));
                console.log("Ships Published");
            } else {
                await ships.refreshShips();
                console.log("Ships Refreshed");
            }
    }
})();

function deleteIfExist(path: string) {
    if (fs.existsSync(path)) fs.unlinkSync(path);
}

function clearFiles(path: string) {
    return fs.readdirSync(path).forEach((file, index) => {
        const curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) clearFiles(curPath);
        else fs.unlinkSync(curPath);
    });
}