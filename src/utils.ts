import fs from "fs";
import crypto from "crypto";
import node_fetch from "node-fetch";
import path from "path";
import { SingleBar } from "cli-progress";

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
  cookie: "VEE=wikitext",
};
export const BASE = "https://azurlane.koumakan.jp";

let PATH_SIZE_FILE = path.join(__dirname, "..", "path-sizes.json");
console.log(PATH_SIZE_FILE);
let PATH_SIZE = JSON.parse(fs.readFileSync(PATH_SIZE_FILE).toString());

export function verifyFile(url: string, localPath: string): boolean {
  if (!(fs.existsSync(localPath) && PATH_SIZE[url])) return false;
  return Number(fs.statSync(localPath)["size"]) === Number(PATH_SIZE[url]);
}

export function fetch(url: string, localPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(localPath)) resolve(fs.readFileSync(localPath, "utf8"));
    else
      node_fetch(url, {
        headers: HEADERS,
      })
        .then((res) => res.buffer())
        .then((text) => {
          fs.writeFileSync(localPath, text);
          resolve(text.toString("utf8"));
        })
        .catch(reject);
  });
}

let task_pool: Promise<any>[] = [];

async function run(promise: Promise<void>): Promise<void> {
  while (task_pool.length >= 10) {
    await Promise.race(task_pool).catch(() => {});
  }
  task_pool.push(promise);
  promise.finally(() => {
    task_pool = task_pool.filter((e) => e !== promise);
  });
}

export function fetchImage(url: string, localPath: string, bar?: SingleBar): Promise<void> {
  if (!url) return Promise.resolve();
  if (url.includes("thumb")) url = galleryThumbnailUrlToActualUrl(url);
  return run(
    new Promise((resolve, reject) => {
      if (fs.existsSync(localPath))
        if (verifyFile(url, localPath)) return resolve();
        else {
          delete PATH_SIZE[url];
          fs.unlinkSync(localPath);
        }
      if (bar) bar.update(0);
      node_fetch(url, {
        headers: HEADERS,
      }).then((res) => {
        PATH_SIZE[url] = res.headers.get("content-length");
        if (bar) bar.setTotal(PATH_SIZE[url]);
        fs.writeFileSync(PATH_SIZE_FILE, JSON.stringify(PATH_SIZE));
        if (bar) res.body.on("data", (data) => bar.increment(data.length));
        res.body
          .pipe(fs.createWriteStream(localPath))
          .on("finish", () => resolve())
          .on("error", () => reject());
      }).catch(e=>console.trace("error fetchImage.fetch",e));
      setTimeout(() => reject(), 20000);
    }).catch(e=>console.trace("error fetchImage",e))
  );
}

export function deepToString(parent: Element) {
  if (parent.nodeType === 3) return parent.textContent;
  if (parent.tagName === "IMG" && (<HTMLElement>parent).title)
    return `"${(<HTMLElement>parent).title}"`;
  if (parent.tagName === "IMG")
    return `"${(parent as HTMLImageElement).alt.replace(/(Icon)?.png/, "")}"`;
  if (parent.tagName === "BR") return "\n";
  if (parent.childNodes.length > 0) {
    let text = "";
    for (let node of parent.childNodes) text += deepToString(node as HTMLElement);
    return text;
  } else {
    return (<HTMLElement>parent).title || parent.textContent;
  }
}

export function getHash(text: string) {
  const hash = crypto.createHash("sha1");
  hash.setEncoding("hex");
  hash.write(text);
  hash.end();
  return hash.read();
}

export function camelize(str: string) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, i) => {
    if (+match === 0) return "";
    return i === 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function deleteAll(path: string) {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach((file) => {
      const curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) deleteAll(curPath);
      else fs.unlinkSync(curPath);
    });
    fs.rmdirSync(path);
  }
}

export function repeat(pat: string, n: number): string {
  return n > 0 ? pat.concat(repeat(pat, --n)) : "";
}

export function galleryThumbnailUrlToActualUrl(tdir: string) {
  return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, "/w/images/$1/$2");
}

export function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

export function textOr(node: Node, other: string) {
  return node ? node.textContent : other;
}
// No Shame
// https://stackoverflow.com/a/64123628
export function keepIfInEnum<T>(value: string, enumObject: { [key: string]: T }) {
  if (Object.values(enumObject).includes(value as unknown as T)) {
    return value as unknown as T;
  } else {
    return undefined;
  }
}

export const normalizeName = (name: string) =>
  name
    .replace(/ ?\(Battleship\)/, "(BB)")
    .replace("\u00b5", "\u03bc")
    .replace("Pamiat Merkuria", "Pamiat' Merkuria")
    .replace("Ookami", "Ōkami")
    .replace("Kasumi (DOA)", "Kasumi")
    .replace("Enterprise (Royal Navy)", "HMS Enterprise")
    .normalize("NFKC") // Needed for muse characters, in my experience.
    .trim();
