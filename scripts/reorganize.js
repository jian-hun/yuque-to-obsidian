const fs = require("fs");
const path = require("path");
const https = require("https");

const COOKIE = fs.readFileSync("C:\\Users\\22\\Documents\\Codex\\2026-06-04\\obsidian-token\\yuque_cookie.txt", "utf8").trim();
const OUTPUT_ROOT = "D:\\obsidian\\建昏的obsidian";
const IMG_DIR = "assets";

function httpGet(url) {
    return new Promise(function(resolve, reject) {
        https.get({ hostname: "www.yuque.com", path: url,
            headers: { "User-Agent": "Mozilla/5.0", "Cookie": COOKIE, "Accept": "text/html" }
        }, function(res) { var d = "";
            res.on("data", function(c) { d += c; });
            res.on("end", function() { resolve(d); });
        }).on("error", reject);
    });
}

function extractBook(html) {
    var match = html.match(/%7B%22me[^"]+/);
    if (!match) return null;
    var decoded = decodeURIComponent(match[0]);
    var bk = "\"book\":";
    var si = decoded.indexOf(bk) + bk.length;
    var dp = 0, ei = si;
    for (var i = si; i < decoded.length; i++) {
        if (decoded[i] === "{") dp++;
        else if (decoded[i] === "}") { dp--; if (dp === 0) { ei = i + 1; break; } }
    }
    return JSON.parse(decoded.substring(si, ei));
}

function sanitize(n) {
    return n.replace(/[\\/:*?"<>|#{}[\]~\r\n]/g, "_").trim().substring(0, 200) || "untitled";
}

async function reorganizeBook(slug, bookName) {
    console.log("\n" + "=".repeat(50));
    console.log("📚 " + bookName);

    var html = await httpGet("/woshijianhun/" + slug);
    var book = extractBook(html);
    if (!book) { console.log("  无法获取"); return; }

    var vaultDir = path.join(OUTPUT_ROOT, sanitize(bookName));
    if (!fs.existsSync(vaultDir)) { console.log("  目录不存在，跳过"); return; }

    // Build a uuid->title map for TITLE items
    var uuidToTitle = {};
    book.toc.forEach(function(item) {
        if (item.type === "TITLE" && item.uuid) {
            uuidToTitle[item.uuid] = item.title;
        }
    });

    // Walk through TOC to build TITLE hierarchy
    var titleStack = []; // { title, level, uuid, path }
    var docTargets = {}; // sanitized doc title -> target subfolder path

    for (var i = 0; i < book.toc.length; i++) {
        var item = book.toc[i];
        var level = item.level !== undefined ? item.level : 0;

        if (item.type === "TITLE") {
            // Pop higher-or-equal level TITLES
            while (titleStack.length > 0 && titleStack[titleStack.length - 1].level >= level) {
                titleStack.pop();
            }

            // Parent path = top of stack after popping
            var parentPath = titleStack.length > 0 ? titleStack[titleStack.length - 1].path : "";
            var folderPath = parentPath ? parentPath + "/" + sanitize(item.title) : sanitize(item.title);

            titleStack.push({ title: item.title, level: level, uuid: item.uuid, path: folderPath });
        } else if (item.type === "DOC") {
            var targetPath = "";

            // Find parent TITLE by parent_uuid
            if (item.parent_uuid && uuidToTitle[item.parent_uuid]) {
                var parentTitle = uuidToTitle[item.parent_uuid];
                // Find this title in the stack
                for (var j = titleStack.length - 1; j >= 0; j--) {
                    if (titleStack[j].uuid === item.parent_uuid) {
                        targetPath = titleStack[j].path;
                        break;
                    }
                }
            }

            docTargets[sanitize(item.title)] = targetPath;
        }
    }

    // Scan vaultDir for .md files
    var allFiles = [];
    function scanDir(dir, relPath) {
        try {
            var entries = fs.readdirSync(dir);
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                if (e === IMG_DIR || e === ".git" || e.endsWith(".csv") || e.endsWith(".json")) continue;
                var fp = path.join(dir, e);
                if (fs.statSync(fp).isDirectory()) {
                    scanDir(fp, relPath ? relPath + "/" + e : e);
                } else if (e.endsWith(".md")) {
                    var base = e.replace(/\.md$/, "");
                    allFiles.push({ path: fp, base: base, oldRel: relPath ? relPath + "/" + e : e });
                }
            }
        } catch(e) {}
    }
    scanDir(vaultDir, "");

    console.log("  找到 " + allFiles.length + " 个 .md 文件");

    var moved = 0;
    var fileMap = {};

    // First pass: get current location of each doc
    allFiles.forEach(function(f) {
        if (!fileMap[f.base] || path.dirname(fileMap[f.base].path).includes("assets")) {
            fileMap[f.base] = f;
        }
    });

    // Second pass: move files to correct locations
    for (var baseName in fileMap) {
        var f = fileMap[baseName];
        var targetRel = docTargets[baseName];

        if (targetRel === undefined) continue; // Not in TOC, keep as-is

        var targetDir = targetRel ? path.join(vaultDir, targetRel) : vaultDir;
        var targetFile = path.join(targetDir, baseName + ".md");

        if (targetFile === f.path) continue; // Already correct

        // Ensure target directory exists
        fs.mkdirSync(targetDir, { recursive: true });

        // Read content
        var content = fs.readFileSync(f.path, "utf8");

        // Fix image paths
        if (f.oldRel) {
            var oldDepth = f.oldRel.split("/").filter(function(s) { return s; }).length - 1;
            var newDepth = targetRel ? targetRel.split("/").filter(function(s) { return s; }).length : 0;

            if (newDepth > oldDepth) {
                for (var d = 0; d < newDepth - oldDepth; d++) {
                    content = content.replace(/\]\(\.\//g, "(../");
                }
            } else if (newDepth < oldDepth) {
                for (var d = 0; d < oldDepth - newDepth; d++) {
                    content = content.replace(/\]\(\.\.\//g, "(./");
                }
            }
        }

        // Delete old file
        try { fs.unlinkSync(f.path); } catch(e) {}
        // Write new file
        fs.writeFileSync(targetFile, content, "utf8");

        console.log("  📄 " + baseName + " -> " + (targetRel ? targetRel + "/" : "根目录/"));
        moved++;
    }

    // Clean up empty directories
    function removeEmptyDirs(dir) {
        try {
            if (dir === vaultDir) return;
            var items = fs.readdirSync(dir);
            if (items.length === 0) {
                fs.rmdirSync(dir);
                removeEmptyDirs(path.dirname(dir));
            }
        } catch(e) {}
    }
    allFiles.forEach(function(f) {
        var oldDir = path.dirname(f.path);
        if (oldDir !== vaultDir) {
            try {
                var items = fs.readdirSync(oldDir);
                if (items.length === 0) {
                    removeEmptyDirs(oldDir);
                }
            } catch(e) {}
        }
    });

    // Show final structure
    console.log("  移动了 " + moved + " 个文件");
    console.log("\n  📁 最终结构:");
    showStructure(vaultDir, "", 0);
}

function showStructure(dir, prefix, depth) {
    if (depth > 4) return;
    try {
        var items = fs.readdirSync(dir).sort();
        var dirs = items.filter(function(f) { return f !== IMG_DIR && f !== ".git" && !f.endsWith(".csv") && !f.endsWith(".json") && fs.statSync(path.join(dir, f)).isDirectory(); });
        var files = items.filter(function(f) { return f.endsWith(".md"); });

        dirs.forEach(function(d) {
            var sub = fs.readdirSync(path.join(dir, d));
            var mdCount = sub.filter(function(f) { return f.endsWith(".md"); }).length;
            console.log("    " + prefix + "📁 " + d + " (" + mdCount + "篇)");
            showStructure(path.join(dir, d), prefix + "  ", depth + 1);
        });
        files.forEach(function(f) {
            console.log("    " + prefix + "📄 " + f);
        });
    } catch(e) {}
}

async function main() {
    var books = [
        { slug: "hyk0pi", name: "交易中心" },
        { slug: "re4q9b", name: "在康佳的日常工作" },
        { slug: "ruevz4", name: "我的个人文档" },
        { slug: "ig6g09", name: "应用商店" },
        { slug: "akch2s", name: "我的生活呀" },
        { slug: "rbs62l", name: "应用升级" },
        { slug: "notes", name: "我的速记" },
        { slug: "ovgumq", name: "易学" },
        { slug: "63047e61-cfcf-50ac-17ca-cd3052031e2f", name: "语雀剪藏默认仓库" }
    ];

    for (var i = 0; i < books.length; i++) {
        await reorganizeBook(books[i].slug, books[i].name);
    }
    console.log("\n✅ 完成");
}
main().catch(function(e) { console.log("Error:", e); });
