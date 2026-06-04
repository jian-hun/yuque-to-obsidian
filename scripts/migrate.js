const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

const COOKIE = fs.readFileSync("C:\\Users\\22\\Documents\\Codex\\2026-06-04\\obsidian-token\\yuque_cookie.txt", "utf8").trim();
const CTOKEN = "MNn5iFUA35WWFKfxW7by2PM5";
const BOOKS_FILE = "C:\\Users\\22\\Documents\\Codex\\2026-06-04\\obsidian-token\\work\\books_list.json";
const OUTPUT_ROOT = "D:\\obsidian\\建昏的obsidian";
const IMG_DIR = "assets";
const DELAY = 300;
const SKIP_BOOKS = new Set(["re4q9b"]);

function slp(ms) { return new Promise(r => setTimeout(r, ms)); }

function request(url, method, extraHeaders, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const mod = u.protocol === "https:" ? https : http;
        const opts = {
            hostname: u.hostname, port: u.port, path: u.pathname + u.search,
            method: method || "GET",
            headers: Object.assign({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/plain, */*",
                "Cookie": COOKIE,
                "X-Csrf-Token": CTOKEN
            }, extraHeaders || {})
        };
        const req = mod.request(opts, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve({ json: JSON.parse(d), status: res.statusCode }); }
                    catch(e) { resolve({ text: d, status: res.statusCode }); }
                } else {
                    resolve({ text: d, status: res.statusCode });
                }
            });
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

function downloadImage(url, savePath) {
    return new Promise(resolve => {
        const u = new URL(url);
        const mod = u.protocol === "https:" ? https : http;
        mod.get({
            hostname: u.hostname, port: u.port, path: u.pathname + u.search,
            headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.yuque.com/", "Cookie": COOKIE }
        }, res => {
            if (res.statusCode !== 200) { resolve(null); return; }
            const chunks = [];
            res.on("data", c => chunks.push(c));
            res.on("end", () => {
                const ct = res.headers["content-type"] || "";
                const ext = ct.includes("jpeg") ? ".jpg" : ct.includes("png") ? ".png" : ct.includes("gif") ? ".gif" : ct.includes("webp") ? ".webp" : ".png";
                const fp = savePath + ext;
                fs.writeFileSync(fp, Buffer.concat(chunks));
                resolve(path.basename(fp));
            });
        }).on("error", () => resolve(null));
    });
}

function sanitize(n) {
    return n.replace(/[\\/:*?"<>|#{}[\]~\r\n]/g, "_").trim().substring(0, 200) || "untitled";
}

function html2md(html) {
    if (!html) return "";
    let md = html;
    md = md.replace(/<div class="lake-content"[^>]*>/g, "").replace(/<\/div>/g, "");
    md = md.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (m, level, content) => {
        const txt = content.replace(/<[^>]+>/g, "");
        return "\n" + "#".repeat(parseInt(level)) + " " + txt + "\n";
    });
    md = md.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, '\n![$2]($1)\n');
    md = md.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, '\n![image]($1)\n');
    md = md.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
    md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
    md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");
    md = md.replace(/<u>(.*?)<\/u>/gi, "$1");
    md = md.replace(/<s>(.*?)<\/s>/gi, "~~$1~~");
    md = md.replace(/<del>(.*?)<\/del>/gi, "~~$1~~");
    md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");
    md = md.replace(/<ul[^>]*>/gi, "\n").replace(/<\/ul>/gi, "\n");
    md = md.replace(/<ol[^>]*>/gi, "\n").replace(/<\/ol>/gi, "\n");
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "\n> $1\n");
    md = md.replace(/<hr[^>]*>/gi, "\n---\n");
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
    md = md.replace(/<br\s*\/?>/gi, "\n");
    md = md.replace(/<span[^>]*>(.*?)<\/span>/gi, "$1");
    md = md.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1");
    md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gi, "\n```\n$1\n```\n");
    md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, "\n$1\n");
    md = md.replace(/<tr[^>]*>(.*?)<\/tr>/gi, "$1\n");
    md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, "| $1 ");
    md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, "| $1 ");
    md = md.replace(/<input[^>]+type="checkbox"[^>]*checked[^>]*>/gi, "- [x]");
    md = md.replace(/<input[^>]+type="checkbox"[^>]*>/gi, "- [ ]");
    md = md.replace(/<[^>]+>/g, "");
    const ents = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&#x27;": "'" };
    for (const [k, v] of Object.entries(ents)) { md = md.split(k).join(v); }
    md = md.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)));
    md = md.replace(/\n{4,}/g, "\n\n\n");
    return md.trim();
}

function getPageHTML(bookSlug) {
    return new Promise((resolve, reject) => {
        const u = new URL("https://www.yuque.com/woshijianhun/" + bookSlug);
        https.get({
            hostname: u.hostname, path: u.pathname + u.search,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Cookie": COOKIE,
                "Accept": "text/html,application/xhtml+xml"
            }
        }, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => { resolve(d); });
        }).on("error", reject);
    });
}

function extractBookFromHTML(html) {
    const match = html.match(/%7B%22me[^"]+/);
    if (!match) return null;
    const decoded = decodeURIComponent(match[0]);
    const bk = '"book":';
    const si = decoded.indexOf(bk) + bk.length;
    let dp = 0, ei = si;
    for (let i = si; i < decoded.length; i++) {
        if (decoded[i] === "{") dp++;
        else if (decoded[i] === "}") { dp--; if (dp === 0) { ei = i + 1; break; } }
    }
    try {
        return JSON.parse(decoded.substring(si, ei));
    } catch(e) {
        return null;
    }
}

async function fetchDoc(docId, slug, bookSlug) {
    const result = await request("https://www.yuque.com/api/docs/" + docId, "PUT", {
        "Referer": "https://www.yuque.com/woshijianhun/" + bookSlug + "/" + slug,
        "Content-Type": "application/json"
    });
    return result.json && result.json.data ? result.json.data : null;
}

async function processImages(md, assetsDir, vaultDir) {
    const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let result = md;
    let imgs = 0;
    let match;
    while ((match = imgRe.exec(md)) !== null) {
        const alt = match[1], url = match[2];
        if (!url.startsWith("http")) continue;
        const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 10);
        const base = path.join(assetsDir, "img_" + hash);
        const fname = await downloadImage(url, base);
        if (fname) {
            const relPath = path.relative(vaultDir, path.join(assetsDir, fname)).replace(/\\/g, "/");
            result = result.split(match[0]).join("![" + alt + "](" + relPath + ")");
            imgs++;
        }
    }
    return { md: result, imgs };
}

async function migrateBook(book) {
    const bookName = book.name;
    const bookSlug = book.slug;
    console.log("\n" + "=".repeat(60));
    console.log("📚 开始迁移知识库: " + bookName);
    console.log("   链接: https://www.yuque.com/woshijianhun/" + bookSlug);

    console.log("[1/4] 获取目录结构...");
    const html = await getPageHTML(bookSlug);
    const bookData = extractBookFromHTML(html);
    if (!bookData) {
        console.log("   ❌ 无法解析目录，跳过");
        return { ok: 0, fail: 0, imgs: 0 };
    }

    const docs = bookData.toc.filter(d => d.type === "DOC");
    const titleItems = bookData.toc.filter(i => i.type === "TITLE");
    console.log("   知识库: " + bookData.name + ", 文档数: " + docs.length + ", 分组: " + titleItems.length);

    if (docs.length === 0) {
        console.log("   ⚠️ 没有文档，跳过");
        return { ok: 0, fail: 0, imgs: 0 };
    }

    console.log("[2/4] 创建输出目录...");
    const vaultDir = path.join(OUTPUT_ROOT, sanitize(bookName));
    const assetsDir = path.join(vaultDir, IMG_DIR);
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log("   输出: " + vaultDir);

    console.log("[3/4] 开始迁移文档...");
    let ok = 0, fail = 0, imgs = 0;
    const migratedDocs = [];
    const padLen = String(docs.length).length;

    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const title = doc.title || "untitled";
        const did = doc.doc_id;
        const slug = doc.url;
        const idx = String(i + 1).padStart(padLen, " ");

        process.stdout.write("   [" + idx + "/" + docs.length + "] " + title + "... ");

        try {
            await slp(DELAY);
            const data = await fetchDoc(did, slug, bookSlug);
            if (!data) { console.log("❌ API无响应"); fail++; continue; }

            let md = html2md(data.body || data.body_draft || "");
            const imgResult = await processImages(md, assetsDir, vaultDir);
            md = imgResult.md;
            imgs += imgResult.imgs;

            const safe = sanitize(title);
            const yaml = "---\ntitle: \"" + title.replace(/"/g, '\\"') + "\"\nsource: https://www.yuque.com/woshijianhun/" + bookSlug + "/" + slug + "\ndoc_id: " + did + "\nexport_date: " + new Date().toISOString().split("T")[0] + (data.word_count ? "\nword_count: " + data.word_count : "") + "\n---\n\n";

            migratedDocs.push({
                title: title,
                safeName: safe,
                doc: doc,
                content: yaml + md
            });

            console.log("✅ (" + (data.word_count || "?") + "字)");
            ok++;
        } catch (e) {
            console.log("❌ " + e.message.substring(0, 60));
            fail++;
        }
    }

    console.log("[4/4] 整理文件到分组文件夹...");
    const groups = {};
    const topDocs = [];
    titleItems.forEach(t => { groups[t.uuid] = { name: t.title, children: [] }; });

    for (const doc of migratedDocs) {
        if (doc.doc.parent_uuid && groups[doc.doc.parent_uuid]) {
            groups[doc.doc.parent_uuid].children.push(doc);
        } else {
            topDocs.push(doc);
        }
    }

    // Write root-level docs
    for (const doc of topDocs) {
        fs.writeFileSync(path.join(vaultDir, doc.safeName + ".md"), doc.content, "utf8");
    }

    // Write grouped docs
    for (const [uuid, group] of Object.entries(groups)) {
        if (group.children.length === 0) continue;
        const folderName = sanitize(group.name);
        const folderPath = path.join(vaultDir, folderName);
        fs.mkdirSync(folderPath, { recursive: true });

        for (const doc of group.children) {
            let content = doc.content;
            content = content.replace(/\]\(\.\//g, "(../");
            const fp = path.join(folderPath, doc.safeName + ".md");
            fs.writeFileSync(fp, content, "utf8");
        }
        console.log("   📁 " + folderName + ": " + group.children.length + " 篇");
    }

    console.log("\n✅ " + bookName + " 完成! 成功: " + ok + " 篇, 失败: " + fail + " 篇, 图片: " + imgs + " 张");
    return { ok, fail, imgs };
}

async function main() {
    console.log("=".repeat(60));
    console.log("  🚀 语雀 → Obsidian 批量迁移工具");
    console.log("=".repeat(60));

    const raw = fs.readFileSync(BOOKS_FILE, "utf8");
    const books = JSON.parse(raw);
    console.log("\n共 " + books.length + " 个知识库，跳过已迁移的 " + SKIP_BOOKS.size + " 个");

    let totalOk = 0, totalFail = 0, totalImgs = 0;

    for (const book of books) {
        if (SKIP_BOOKS.has(book.slug)) {
            console.log("\n⏭️ 跳过: " + book.name + " (已在康佳的日常工作中迁移)");
            continue;
        }
        const result = await migrateBook(book);
        totalOk += result.ok;
        totalFail += result.fail;
        totalImgs += result.imgs;
    }

    console.log("\n" + "=".repeat(60));
    console.log("  📊 全部迁移完成");
    console.log("=".repeat(60));
    console.log("  总成功: " + totalOk + " 篇");
    console.log("  总失败: " + totalFail + " 篇");
    console.log("  总图片: " + totalImgs + " 张");
    console.log("  输出到: " + OUTPUT_ROOT);
    console.log("=".repeat(60));
}

main().catch(e => console.log("Fatal:", e));

