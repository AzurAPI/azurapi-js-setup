import {
    FORMATTED_SHIPS_PATH,
    INTERNAL_SHIPS_PATH,
    publishShips,
    refreshShipImages,
    refreshShips,
    SHIP_LIST_PATH,
    SHIPS_PATH
} from './ships';
import {EQUIPMENTS_PATH, INTERNAL_EQUIPMENTS_PATH, publishEQ, refreshEQImages, refreshEquipments} from './equipments';
import {CHAPTERS_MIN_PATH, CHAPTERS_PATH, refreshChapter} from "./chapters";
import fs from 'fs'
import path from "path";

(async function () {
    let args = process.argv.slice(2);
    console.log("path", __dirname);
    mkdirIfNotExist(path.join(__dirname, '..', 'web'));
    switch (args[0]) {
        case 'ship':
        case 'ships':
            mkdirIfNotExist(path.join(__dirname, '..', 'web', 'ships'));
            mkdirIfNotExist(path.join(__dirname, '..', 'web', 'ships.gallery'));
            if (args.includes('reset')) {
                deleteIfExist(SHIP_LIST_PATH);
                deleteIfExist(SHIPS_PATH);
                deleteIfExist(INTERNAL_SHIPS_PATH);
                deleteIfExist(FORMATTED_SHIPS_PATH);
                if (args.includes("web")) {
                    clearFiles(path.join(__dirname, '..', 'web', 'ships'));
                    clearFiles(path.join(__dirname, '..', 'web', 'ships.gallery'));
                    deleteIfExist(path.join(__dirname, '..', 'web', 'ships.index.html'));
                }
                console.log("Ship Data Reset");
            }
            if (args.includes('refresh')) {
                await refreshShips();
                console.log("Ships Refreshed");
            }
            if (args.includes('img')) {
                await refreshShipImages();
                console.log("Ship Images Refreshed");
            }
            if (args.includes('publish')) {
                await publishShips();
                fs.copyFileSync(path.join(__dirname, '..', 'dist', 'ships.json'), path.join(__dirname, '..', 'ships.json'));
                fs.copyFileSync(path.join(__dirname, '..', 'dist', 'version.json'), path.join(__dirname, '..', 'version-info.json'));
                console.log("Ships Published");
            }
            break;
        case 'eq':
        case 'equipments':
            mkdirIfNotExist(path.join(__dirname, '..', 'web', 'equipments'));
            if (args.includes('reset')) {
                clearFiles(path.join(__dirname, '..', 'web', 'equipments'));
                deleteIfExist(EQUIPMENTS_PATH);
                deleteIfExist(INTERNAL_EQUIPMENTS_PATH);
                console.log("Equipments Data Reset");
            }
            if (args.includes('refresh')) {
                await refreshEquipments();
                console.log("Equipments Refreshed");
            }
            if (args.includes('img')) {
                await refreshEQImages();
                console.log("Equipments Images Refreshed");
            }
            if (args.includes('publish')) {
                await publishEQ();
                fs.copyFileSync(path.join(__dirname, '..', 'dist', 'equipments.json'), path.join(__dirname, '..', 'equipments.json'));
                fs.copyFileSync(path.join(__dirname, '..', 'dist', 'version.json'), path.join(__dirname, '..', 'version-info.json'));
                console.log("Equipments Published");
            }
            break;
        case 'chapter':
        case 'chapters':
            mkdirIfNotExist(path.join(__dirname, '..', 'web', 'chapters'));
            if (args.includes('reset')) {
                clearFiles(path.join(__dirname, '..', 'web', 'chapters'));
                deleteIfExist(CHAPTERS_PATH);
                deleteIfExist(CHAPTERS_MIN_PATH);
                console.log("Chapters Data Reset");
            }
            if (args.includes('refresh')) {
                await refreshChapter();
                console.log("Chapters Refreshed");
            }
    }
})();


function mkdirIfNotExist(path: string) {
    if (!fs.existsSync(path)) fs.mkdirSync(path);
}

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
