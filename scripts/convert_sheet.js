const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");

const COOKIE = fs.readFileSync("C:\\Users\\22\\Documents\\Codex\\2026-06-04\\obsidian-token\\yuque_cookie.txt", "utf8").trim();
const CTOKEN = "MNn5iFUA35WWFKfxW7by2PM5";

function request(hostname, pathname, extra) {
    return new Promise(function(resolve, reject) {
        var opts = { hostname: hostname, path: pathname, method: "PUT",
            headers: Object.assign({ "User-Agent": "Mozilla/5.0", "Content-Type": "application/json",
                "Cookie": COOKIE, "X-Csrf-Token": CTOKEN }, extra || {}) };
        var req = https.request(opts, function(res) {
            var d = "";
            res.on("data", function(c) { d += c; });
            res.on("end", function() {
                if (res.statusCode === 302 && res.headers.location) {
                    var loc = new URL(res.headers.location);
                    request(loc.hostname, loc.pathname, extra).then(resolve).catch(reject);
                } else { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } }
            });
        });
        req.on("error", reject);
        req.end();
    });
}

function cellValue(cell) {
    if (!cell) return "";
    if (typeof cell === "string") return cell;
    if (typeof cell === "number") return cell % 1 === 0 ? String(cell) : cell.toFixed(2);
    var val = cell.v;
    if (val === undefined || val === null) return "";
    if (typeof val === "object" && val !== null) {
        if (val.class === "formula" && val.value !== undefined) {
            var fv = val.value;
            return typeof fv === "number" ? (fv % 1 === 0 ? String(fv) : fv.toFixed(2)) : String(fv);
        }
        return JSON.stringify(val);
    }
    if (typeof val === "number") return val % 1 === 0 ? String(val) : val.toFixed(2);
    return String(val);
}

function sheetToMD(sheet) {
    var data = sheet.data || {};
    var rowNums = Object.keys(data).map(Number).filter(function(n) { return !isNaN(n); }).sort(function(a, b) { return a - b; });
    if (rowNums.length < 2) return "（空表格）";

    var maxCol = 0;
    rowNums.forEach(function(ri) {
        Object.keys(data[String(ri)]).forEach(function(k) { maxCol = Math.max(maxCol, parseInt(k)); });
    });

    var headers = [];
    var hRow = data["0"] || {};
    for (var c = 0; c <= maxCol; c++) { headers.push(cellValue(hRow[String(c)])); }
    while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();
    if (headers.length === 0) return "（无表头）";

    var lines = [];
    lines.push("| " + headers.join(" | ") + " |");
    lines.push("| " + headers.map(function() { return "---"; }).join(" | ") + " |");

    var dataCount = 0;
    for (var ri = 0; ri < rowNums.length; ri++) {
        var rn = rowNums[ri];
        if (rn === 0) continue; // skip header
        var row = data[String(rn)];
        if (!row) continue;

        var cells = [];
        var hasContent = false;
        for (var c = 0; c < headers.length; c++) {
            var val = cellValue(row[String(c)]);
            cells.push(val);
            if (val !== "") hasContent = true;
        }
        if (!hasContent) continue;
        lines.push("| " + cells.join(" | ") + " |");
        dataCount++;
    }

    return { md: lines.join("\n"), count: dataCount };
}

function sheetToCSV(sheet) {
    var data = sheet.data || {};
    var rowNums = Object.keys(data).map(Number).filter(function(n) { return !isNaN(n); }).sort(function(a, b) { return a - b; });
    var maxCol = 0;
    rowNums.forEach(function(ri) {
        Object.keys(data[String(ri)]).forEach(function(k) { maxCol = Math.max(maxCol, parseInt(k)); });
    });
    var lines = [];
    for (var ri = 0; ri < rowNums.length; ri++) {
        var row = data[String(rowNums[ri])];
        if (!row) { lines.push(""); continue; }
        var vals = [];
        for (var c = 0; c <= maxCol; c++) {
            var val = cellValue(row[String(c)]);
            if (val.includes(",") || val.includes("\"") || val.includes("\n")) {
                val = "\"" + val.replace(/"/g, "\"\"") + "\"";
            }
            vals.push(val);
        }
        lines.push(vals.join(","));
    }
    return lines.join("\n");
}

async function main() {
    var outputDir = "D:\\obsidian\\建昏的obsidian\\我的个人文档";
    console.log("Fetching sheet data...");

    var result = await request("www.yuque.com", "/api/docs/121753295", {
        "Referer": "https://www.yuque.com/woshijianhun/ruevz4/rs1tbeps51ky585g"
    });
    var body = JSON.parse(result.data.body);
    var buf = Buffer.alloc(body.sheet.length);
    for (var i = 0; i < body.sheet.length; i++) { buf[i] = body.sheet.charCodeAt(i) & 0xFF; }
    var sheets = JSON.parse(zlib.inflateSync(buf).toString("utf8"));

    console.log("Found " + sheets.length + " sheets\n");

    var md = "---\ntitle: \"演唱会开销\"\nsource: https://www.yuque.com/woshijianhun/ruevz4/rs1tbeps51ky585g\ndoc_id: 121753295\nexport_date: 2026-06-04\n---\n\n# 演唱会开销\n\n> 此文档原为语雀在线表格，共 " + sheets.length + " 个子表。\n> 📎 同目录下也有 CSV 文件和原始数据 JSON 可供 Excel 导入。\n\n";
    var totalRows = 0;

    for (var si = 0; si < sheets.length; si++) {
        var s = sheets[si];
        var sn = s.name || ("Sheet" + (si + 1));
        var result = sheetToMD(s);
        md += "## " + sn + "\n\n" + result.md + "\n\n";
        totalRows += result.count;
        console.log("  " + sn + ": " + result.count + " 行数据");

        // Save CSV
        var csvFile = path.join(outputDir, "演唱会开销_" + sn + ".csv");
        fs.writeFileSync(csvFile, "\uFEFF" + sheetToCSV(s), "utf8");
    }

    // Save raw data
    fs.writeFileSync(path.join(outputDir, "演唱会开销_原始数据.json"), JSON.stringify(sheets, null, 2), "utf8");

    // Save markdown
    fs.writeFileSync(path.join(outputDir, "演唱会开销.md"), md, "utf8");

    console.log("\n✅ 共 " + totalRows + " 行数据");
    console.log("✅ Markdown: 演唱会开销.md");
    console.log("✅ CSV: 每子表一个文件");
    console.log("✅ 原始数据: 演唱会开销_原始数据.json");

    // Print first sheet preview
    var preview = md.split("\n").slice(0, 25).join("\n");
    console.log("\n--- 预览 ---\n" + preview);
}
main().catch(function(e) { console.log("Error:", e); });
