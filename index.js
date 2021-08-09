// This file is for fetching data from wiki
import 'reflect-metadata';

const chapter = require('./chapter.js');
const memory = require('./memory.js');

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

let CHAPTERS = require("./chapters.json");
let MEMORIES = require("./memories.json");
let IMAGE_PROGRESS = require("./image-progress.json");
const {camelize} = require("./utils");

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function refreshMemory(online) {
    let data;
    console.log("Recalling Memories");
    if (!fs.existsSync('./web/memories/index.html') || online) fs.writeFileSync('./web/memories/index.html', data = await fetch("https://azurlane.koumakan.jp/Memories"));
    else data = fs.readFileSync('./web/memories/index.html', 'utf8');
    for (let galleryPack of new JSDOM(data).window.document.querySelectorAll(".gallery.mw-gallery-packed")) {
        for (let galleryBox of galleryPack.children) {
            let icon = "https://azurlane.koumakan.jp" + galleryThumbnailUrlToActualUrl(galleryBox.querySelector('.thumb img').src);
            let name = galleryBox.querySelector(".gallerytext a").textContent;
            let simple_name = camelize(name.replace(/[^\w\s]/g, ''));
            let url = "https://azurlane.koumakan.jp" + galleryBox.querySelector(".gallerytext a").href;
            process.stdout.write(("Recalling \"" + name + "\"...").padEnd(80, ' '));
            if (!fs.existsSync('./web/memories/' + simple_name + '.html') || online) fs.writeFileSync('./web/memories/' + simple_name + '.html', data = await fetch(url));
            else data = fs.readFileSync('./web/memories/' + simple_name + '.html', 'utf8');
            process.stdout.write(" .");
            MEMORIES[simple_name] = memory.parseMemory(new JSDOM(data).window.document, name, icon, url);
            const used = process.memoryUsage().heapUsed / 1024 / 1024;
            process.stdout.write(` done. ${Math.round(used * 100) / 100}MB used\n`);
            fs.writeFileSync('./memories.internal.json', JSON.stringify(MEMORIES, null, '\t'));
            if (used > 1000) await timeout(1000);
        }
    }
    fs.writeFileSync('./memories.internal.json', JSON.stringify(MEMORIES, null, '\t'));
    console.log("\nDone");
}

async function publishMemoriesAndImages() {
    for (let key of Object.keys(MEMORIES)) {
        let memory = MEMORIES[key];
        let thumbnailFile = "./images/memoryThumbnails/" + memory.thumbnail.substring(memory.thumbnail.lastIndexOf('/') + 1);
        await fetchImage(memory.thumbnail, thumbnailFile);
    }
}



// Promise Wrapper for request, I dont trust their own promise support


