---
name: yuque-to-obsidian
description: >-
  Migrate Yuque knowledge bases to Obsidian vault. Fetches docs via Yuque API
  using browser cookies for auth (no token needed). Converts HTML to Markdown,
  downloads images, handles online spreadsheets (lakesheet), and organizes by
  TOC folder structure. Use when user wants to export from Yuque, migrate
  knowledge bases, backup Yuque docs, or switch from Yuque to Obsidian.
---

# 语雀 → Obsidian 迁移

## 前置准备

1. 用户在浏览器登录语雀，从 Cookie-Editor 插件导出 cookies 字符串
2. 从 cookie 中提取 `yuque_ctoken` 值（用于 X-Csrf-Token header）
3. 保存到 `yuque_cookie.txt`（一行）

## 工作流程

### 1. 获取知识库列表

```
GET https://www.yuque.com/api/books
Headers:
  Cookie: {cookie_string}
  X-Csrf-Token: {yuque_ctoken}
  User-Agent: Mozilla/5.0
```

返回 data 数组保存为 books_list.json。

### 2. 获取目录结构 (TOC)

访问 `https://www.yuque.com/{user}/{slug}` HTML 页面，从 appData JSON 中提取 book.toc。

```js
match = html.match(/%7B%22me[^"]+/);
decoded = decodeURIComponent(match[0]);
// 在 decoded 中查找 book:{...} 并解析
```

每个 toc 项有 type, title, uuid, level 字段：
- TITLE：文件夹分组
- DOC：文档（doc_id/id, url, parent_uuid）

### 3. 获取文档内容

```
PUT https://www.yuque.com/api/docs/{doc_id}
Headers:
  Referer: https://www.yuque.com/{user}/{slug}/{doc_slug}
  X-Csrf-Token: {token}
```

- 新文档用 doc_id，旧文档用 id（无 doc_id 时 fallback）
- 企业空间文档返回 302 跳转到 {org}.yuque.com，需跟随重定向

### 4. HTML 转 Markdown

- 语雀 lake 格式：p/span 包裹文本
- 图片链接 src=https://cdn.nlark.com/... 需下载到本地
- 图片用 MD5 哈希命名防重复，存到 assets/ 目录
- 修正路径：根目录用 ./assets/，子文件夹用 ../assets/

### 5. 在线表格 (lakesheet) 处理

当 body/body_draft 中格式为 lakesheet 时，sheet 字段为 zlib 压缩数据：

```js
var buf = Buffer.alloc(sheet.length);
for (var i = 0; i < sheet.length; i++) buf[i] = sheet.charCodeAt(i) & 0xFF;
var sheets = JSON.parse(zlib.inflateSync(buf).toString("utf8"));
```

导出：Markdown 表格 + CSV(UTF-8 BOM) + JSON 备份

### 6. 文件夹组织

根据 TOC 的 level + parent_uuid 构建嵌套：
- TITLE 按 level 决定父子关系
- DOC 通过 parent_uuid 匹配到对应 TITLE 文件夹
- 移动文件时修正图片相对路径

### 7. 脚本

```bash
node scripts/migrate.js          # 批量迁移所有知识库
node scripts/convert_sheet.js     # 转换 lakesheet 表格
node scripts/reorganize.js        # 修复目录组织
```

## 关键注意点

- 认证：cookie 会过期，需在浏览器重新登录后刷新
- 频率：每次 API 调用间隔 >= 300ms
- 旧文档兼容：doc_id 不存在时 fallback 到 id 字段
- 企业空间：处理 302 重定向到组织域名
- 文件名：替换特殊字符为 _
- 空分组：TITLE 无子文档时不创建文件夹
