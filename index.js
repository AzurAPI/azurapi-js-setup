// This file is for fetching data from wiki
const crypto = require('crypto');
const fs = require('fs');
const request = require('request');
const JSDOM = require('jsdom').JSDOM;

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
async function refreshChapter(online) {
    let namesHTML;
    process.stdout.write("Refreshing Chapter Names");
    if (!fs.existsSync('./web/chapters/names.html') || online) fs.writeFileSync('./web/chapters/names.html', namesHTML = await fetch("https://azurlane.koumakan.jp/Campaign"));
    else namesHTML = fs.readFileSync('./web/chapters/names.html', 'utf8');
    let names = parseChaptersNames(namesHTML);
    process.stdout.write("  Done\n");
    console.log(JSON.stringify(names));
    for (let i = 1; i <= 13; i++) {
        let data;
        process.stdout.write("Refreshing Chapter " + i + " Details");
        if (!fs.existsSync('./web/chapters/' + i + '.html') || online) fs.writeFileSync('./web/chapters/' + i + '.html', data = await fetch("https://azurlane.koumakan.jp/Chapter_" + i));
        else data = fs.readFileSync('./web/chapters/' + i + '.html', 'utf8');
        CHAPTERS[i] = chapter.parseChapter(new JSDOM(data).window.document, i, names);
        fs.writeFileSync('./chapters.json', JSON.stringify(CHAPTERS, null, '\t'));
        console.log("\nDone");
    }
    fs.writeFileSync('./chapters.min.json', JSON.stringify(CHAPTERS));
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

function parseChaptersNames(body) {
    let names = {};
    const doc = new JSDOM(body).window.document;
    let rows = doc.querySelector(".wikitable tbody").children;
    for (let i = 0; i < 13; i++) {
        names[i + 1] = {
            en: rows[i * 5 + 1].children[1].textContent.trim(),
            cn: rows[i * 5 + 1].children[2].textContent.trim(),
            jp: rows[i * 5 + 1].children[3].textContent.trim()
        };
        for (let j = 1; j <= 4; j++) names[rows[i * 5 + j + 1].children[0].textContent.trim()] = {
            en: rows[i * 5 + j + 1].children[1].textContent.trim(),
            cn: rows[i * 5 + j + 1].children[2].textContent.trim(),
            jp: rows[i * 5 + j + 1].children[3].textContent.trim()
        };
    }
    return names;
}

// Promise Wrapper for request, I dont trust their own promise support


