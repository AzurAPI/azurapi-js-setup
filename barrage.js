const fs = require("fs");
const nodefetch = require("node-fetch");
const request = require("request");
const REPO_URL = "https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/";
const WIKI_URL = "https://azurlane.koumakan.jp";
const JSDOM = require("jsdom").JSDOM;
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
  cookie: "VEE=wikitext",
};
const PATH_SIZE = require("./path-sizes.json");
const IDS = [];
exports.refreshBarrage = async function () {
  console.log("Refreshing Barrage");
  if (!fs.existsSync("./web/barrages")) fs.mkdirSync("./web/barrages");
  if (!fs.existsSync("./web/files")) fs.mkdirSync("./web/files");
  let tables = new JSDOM(
    await fetch("https://azurlane.koumakan.jp/Barrage", "./web/barrages/index.html")
  ).window.document.getElementsByClassName("wikitable");
  let barrages = (await parseTable(tables[0], "ship"))
    .concat(await parseTable(tables[1], "class"))
    .concat(await parseTable(tables[2], "skill"));
  fs.writeFileSync("barrage.internal.json", JSON.stringify(barrages, null, 4));
  let published = await publish(barrages);
  fs.writeFileSync("barrage.json", JSON.stringify(published));
  fs.writeFileSync("barrage.formatted.json", JSON.stringify(published, null, 4));
  console.log("Done");
};

if (require.main === module) {
  console.log("Nice");
  exports.refreshBarrage().then((r) => console.log("done")); //.finally(() => process.exit());
}

async function publish(barrages) {
  let paths = [];
  if (!fs.existsSync("images/barrages")) fs.mkdirSync("./images/barrages");
  for (let barrage of barrages) {
    if (!fs.existsSync("images/barrages/" + barrage.id))
      fs.mkdirSync("./images/barrages/" + barrage.id);
    let localPath = "images/barrages/" + barrage.id + "/";
    while (paths.includes(localPath)) localPath = localPath + "_";
    paths.push(localPath);

    await fetchImage(barrage.icon, localPath + "icon.png");
    barrage.icon = REPO_URL + localPath + "icon.png";
    if (barrage.image) {
      await fetchImage(barrage.image, localPath + "image.gif");
      barrage.image = REPO_URL + localPath + "image.gif";
    }
    process.stdout.write(".");
  }
  process.stdout.write("\nDone!\n");
  return barrages;
}

function generateUUID(name) {
  while (IDS.includes(name)) name = name + "_";
  return name;
}

async function parseTable(table, type) {
  let list = Array.from(table.getElementsByTagName("tr"));
  let barrages = [];
  for (let r = 0, i = 0; r < list.length; r++) {
    let tr = list[r];
    if (!(tr.id || tr.className)) continue;
    if (tr.className === "expand-child") {
      barrages[i - 1].rounds.push(parseRound(tr, 0));
    } else {
      console.log(tr.children[1].textContent.trim());
      barrages[i] = {
        id: generateUUID(tr.id),
        type: type,
        icon:
          tr.firstElementChild.firstElementChild && tr.firstElementChild.firstElementChild.src
            ? galleryThumbnailUrlToActualUrl(tr.firstElementChild.firstElementChild.src)
            : undefined,
        name: tr.children[1].textContent.trim(),
        image:
          tr.children[2].childElementCount > 0
            ? await getDirectLink(tr.children[2].firstElementChild.href)
            : undefined,
        ships: Array.from(tr.children[3].getElementsByTagName("a")).map((a) => a.title),
        hull: tr.children[4].textContent.trim(),
        rounds: [parseRound(tr, 5)],
      };
      IDS.push(barrages[i].id);
      i++;
    }
    process.stdout.write(".");
    if (r % 20 === 0) process.stdout.write("|\n");
  }
  console.log("\n" + type + " done\n");
  return barrages;
}

const col_name = ["type", "dmgL", "dmgM", "dmgH", "note"];

function parseRound(tr, start) {
  let round = {};
  for (let i = 0; i < 5; i++) {
    round[col_name[i]] = tr.children[i + start].textContent.trim();
    if (!isNaN(round[col_name[i]])) round[col_name[i]] = parseFloat(round[col_name[i]]);
  }
  return round;
}

async function getDirectLink(file) {
  file = file.replace("/wiki/File:", "");
  return galleryThumbnailUrlToActualUrl(
    new JSDOM(
      await fetch("https://azurlane.koumakan.jp/wiki/File:" + file, "./web/files/" + file + ".html")
    ).window.document.querySelector("#file img").src
  );
}

function fetch(url, localPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(localPath)) resolve(fs.readFileSync(localPath, "utf8"));
    else
      nodefetch(url, {
        headers: HEADERS,
      })
        .then((res) => res.text())
        .then((text) => {
          fs.writeFileSync(localPath, text);
          resolve(text);
        })
        .catch(reject);
  });
}

function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, i) => {
    if (+match === 0) return "";
    return i == 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

function fetchImage(url, localPath) {
  if (!url) return new Promise((resolve, reject) => resolve());
  if (url.includes("thumb")) url = galleryThumbnailUrlToActualUrl(url);
  return new Promise((resolve, reject) => {
    if (fs.existsSync(localPath)) {
      // Check local file
      verifyFile(url, localPath).then((valid) => {
        if (valid) {
          process.stdout.write("-");
          resolve();
        } else {
          fs.unlinkSync(localPath);
          console.log("Redownloading " + localPath);
          fetchImage(url, localPath).then(resolve);
        }
      });
    } else {
      console.log("URL: " + url);
      request(url)
        .pipe(fs.createWriteStream(localPath))
        .on("close", () => resolve())
        .on("error", (e) => reject(e));
    }
  });
}

async function verifyFile(url, localPath) {
  let correctSize;
  if (PATH_SIZE[url]) correctSize = PATH_SIZE[url];
  else {
    PATH_SIZE[url] = correctSize = parseInt((await head(url)).res.headers["content-length"]);
    fs.writeFileSync("./path-sizes.json", JSON.stringify(PATH_SIZE));
  }
  if (fs.statSync(localPath)["size"] === correctSize) return true;
  else {
    console.log("File Corrupted: " + localPath);
    delete PATH_SIZE[url];
    fs.writeFileSync("./path-sizes.json", JSON.stringify(PATH_SIZE));
    return false;
  }
}

function head(url) {
  return new Promise((resolve, reject) => {
    request.head(url, function (err, res, body) {
      resolve({
        err: err,
        res: res,
        body: body,
      });
    });
  });
}

// Its only a prediction
function galleryThumbnailUrlToActualUrl(tdir) {
  return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, "/w/images/$1/$2");
}
