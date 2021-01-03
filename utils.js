const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};
const fs = require('fs');
const crypto = require('crypto');
const request = require('request');
const nodefetch = require('node-fetch');
const BASE = "https://azurlane.koumakan.jp";

let PATH_SIZE = require("./path-sizes.json");

async function verifyFile(url, localPath) {
    let correctSize;
    if (PATH_SIZE[url]) correctSize = PATH_SIZE[url];
    else {
        try {
            let header = await head(url);
            if (!header.res) console.log(header);
            PATH_SIZE[url] = correctSize = parseInt(header.res.headers['content-length']);
            fs.writeFileSync('./path-sizes.json', JSON.stringify(PATH_SIZE, null, '\t'));
        } catch (e) {
            console.log("Error " + url);
        }
    }
    if (fs.statSync(localPath)["size"] === correctSize) return true;
    else {
        console.log("File Corrupted: " + localPath, url);
        delete PATH_SIZE[url];
        fs.writeFileSync('./path-sizes.json', JSON.stringify(PATH_SIZE, null, '\t'));
        return false;
    }
}

function fetch(url, localPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(localPath)) resolve(fs.readFileSync(localPath, 'utf8'));
        else nodefetch(url, {
            headers: HEADERS,
        }).then(res => res.text()).then(text => {
            fs.writeFileSync(localPath, text.toString());
            resolve(text);
        }).catch(reject);
    });
}

function head(url) {
    return new Promise(resolve => request.head(url, (err, res, body) => resolve({
        err: err,
        res: res,
        body: body
    })));
}

function fetchImage(url, localPath) {
    if (!url) return Promise.resolve();
    if (url.includes("thumb")) url = galleryThumbnailUrlToActualUrl(url);
    return new Promise((resolve, reject) => {
        if (fs.existsSync(localPath)) verifyFile(url, localPath).then(valid => {
            if (valid) resolve(); else {
                fs.unlinkSync(localPath);
                fetchImage(url, localPath).then(resolve);
            }
        }); else request(url).pipe(fs.createWriteStream(localPath)).on('close', () => resolve()).on('error', reject);
    });
}

function deepToString(parent) {
    if (parent.nodeType === 3) return parent.textContent;
    if (parent.tagName === "IMG" && parent.title) return `"${parent.title}"`;
    if (parent.tagName === "IMG") return `"${parent.alt.replace(/(Icon)?.png/, '')}"`;
    if (parent.tagName === "BR") return '\n';
    if (parent.childNodes.length > 0) {
        let text = "";
        for (let node of parent.childNodes) text += deepToString(node);
        return text;
    } else {
        if (parent.title) return parent.title;
        return parent.textContent;
    }
}

function getHash(text) {
    const hash = crypto.createHash('sha1');
    hash.setEncoding('hex');
    hash.write(text);
    hash.end();
    return hash.read();
}

function camelize(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, i) => {
        if (+match === 0) return "";
        return i === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function deleteAll(path) {
    let files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(file => {
            const curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) deleteAll(curPath); else fs.unlinkSync(curPath);
        });
        fs.rmdirSync(path);
    }
}

function repeat(pat, n) {
    return (n > 0) ? pat.concat(repeat(pat, --n)) : "";
}

function galleryThumbnailUrlToActualUrl(tdir) {
    return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, '/w/images/$1/$2');
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

module.exports = {
    BASE,
    fetch,
    fetchImage,
    deepToString,
    getHash,
    camelize,
    clone,
    deleteAll,
    repeat,
    galleryThumbnailUrlToActualUrl,
    timeout
}
