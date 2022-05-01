import fs from "fs";
import path from "path";
import { fetch } from "../utils";
import { parseChapter } from "./parser";
import { JSDOM } from "jsdom";

const ROOT = path.join(__dirname, "..", "..");
export const CHAPTERS_MIN_PATH = path.join(ROOT, "dist", "chapters.min.json");
export const CHAPTERS_PATH = path.join(ROOT, "dist", "chapters.json");

export async function refreshChapter() {
  if (!fs.existsSync(path.join(ROOT, "web", "chapters")))
    fs.mkdirSync(path.join(ROOT, "web", "chapters"));
  let names = parseChaptersNames(
    new JSDOM(
      await fetch(
        "https://azurlane.koumakan.jp/Campaign",
        path.join(ROOT, "web", "chapters", "index.html")
      )
    ).window.document
  );
  let CHAPTERS = [];
  for (let i = 1; i <= 14; i++) {
    process.stdout.write("Refreshing Chapter " + i + " Details");
    CHAPTERS.push(
      parseChapter(
        new JSDOM(
          await fetch(
            "https://azurlane.koumakan.jp/Chapter_" + i,
            path.join(ROOT, "web", "chapters", i + ".html")
          )
        ).window.document,
        i,
        names
      )
    );
    fs.writeFileSync(CHAPTERS_PATH, JSON.stringify(CHAPTERS, null, '\t'));
    console.log("\nDone");
  }
  fs.writeFileSync(CHAPTERS_MIN_PATH, JSON.stringify(CHAPTERS));
}

function parseChaptersNames(doc: Document) {
  let rows = doc.querySelector(".wikitable tbody").children;
  let names: any = {};
  for (let i = 0; i < 14; i++) {
    names[i + 1] = {
      en: rows[i * 5 + 1].children[1].textContent.trim(),
      cn: rows[i * 5 + 1].children[2].textContent.trim(),
      jp: rows[i * 5 + 1].children[3].textContent.trim(),
    };
    for (let j = 1; j <= 4; j++)
      names[rows[i * 5 + j + 1].children[0].textContent.trim()] = {
        en: rows[i * 5 + j + 1].children[1].textContent.trim(),
        cn: rows[i * 5 + j + 1].children[2].textContent.trim(),
        jp: rows[i * 5 + j + 1].children[3].textContent.trim(),
      };
  }
  return names;
}
