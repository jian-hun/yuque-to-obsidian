<p align="center">
  <img src="https://img.shields.io/badge/语雀-→-Obsidian-7c3aed?style=for-the-badge" alt="Yuque to Obsidian"/>
  <img src="https://img.shields.io/badge/Codex-Skill-22c55e?style=for-the-badge" alt="Codex Skill"/>
</p>

<h1 align="center">📚 语雀 → Obsidian 迁移工具</h1>

<p align="center">
  <b>一键迁移语雀知识库到 Obsidian</b><br/>
  无需语雀会员、无需 Token、纯文本为主 + 图片自动下载 + 目录结构完整保留
</p>

---

## ✨ 功能特性

| 特性 | 说明 |
|------|------|
| 🚫 **无需 Token** | 利用浏览器 Cookie 认证，免费用户也能用 |
| 📄 **Markdown 导出** | 正文自动转为 Obsidian 友好的 Markdown |
| 🖼️ **图片本地化** | CDN 图片自动下载到本地 assets/ 目录 |
| 📊 **表格兼容** | 语雀在线表格 (lakesheet) 转为 Markdown 表格 + CSV |
| 📁 **目录还原** | 完整保留语雀的 TOC 分组和层级结构 |
| ⚡ **批量迁移** | 一次处理整个知识库，支持全部 9 个知识库同时迁移 |
| 🔄 **断点续迁** | 失败文档自动记录，支持重试 |
| 🔗 **企业空间** | 支持企业组织下的知识库（自动跟随 302 重定向） |

## 🎯 适用场景

- 🏢 **打工人迁移**：把语雀的工作笔记、知识库搬到 Obsidian 本地
- 🔒 **隐私保护**：私有知识库也能导出，数据完全掌握在自己手里
- 💰 **省钱方案**：语雀免费版没有 API Token，但 Cookie 认证完全可用
- 📦 **批量备份**：几百篇文档一次搞定

## 🚀 快速开始

### 前置准备

1. **浏览器登录语雀**（确保能访问你的知识库）
2. **安装 Cookie-Editor** 浏览器扩展
3. **导出 Cookie**：
   - 打开 [语雀](https://www.yuque.com)
   - 点击 Cookie-Editor 图标 → Export → 复制 JSON
   - 把 `yuque_ctoken` 的值记下来

### 使用 Codex CLI

```bash
# 1️⃣ 准备认证文件
echo "yuque_ctoken=xxx; lang=zh-cn; ..." > yuque_cookie.txt

# 2️⃣ 获取知识库列表
curl -s -H "Cookie: $(cat yuque_cookie.txt)" \
     -H "X-Csrf-Token: xxx" \
     https://www.yuque.com/api/books > books_list.json

# 3️⃣ 开始迁移
node scripts/migrate.js books_list.json yuque_cookie.txt ./obsidian_vault

# 4️⃣ 修复目录结构（按 TOC 层级组织文件夹）
node scripts/reorganize.js
```

### 在 Codex CLI 中直接调用

```
$yuque-to-obsidian 将我的语雀知识库迁移到 Obsidian
```

## 📁 输出结构

```
obsidian_vault/
├── 在康佳的日常工作/
│   ├── assets/              # 本地图片
│   ├── 2025.md               # 根级文档
│   ├── 周工作汇总/
│   │   └── 2025年/
│   │       ├── 11月/
│   │       │   ├── 11-03——11-07.md
│   │       │   └── ...
│   │       └── 12月/
│   │           └── ...
│   └── 流程知识汇总/
│       └── ...
├── 交易中心/
├── 我的个人文档/
└── ...
```

## 📊 已知限制

| 限制 | 说明 |
|------|------|
| ⏱️ **请求频率** | 语雀 API 有限流，脚本内置 300ms 间隔 |
| 🔑 **Cookie 过期** | Cookie 有效期有限，过期需重新导出 |
| 📊 **复杂表格** | 合并单元格、数据验证等高级特性转为纯表格 |
| 🎨 **白板/画板** | lake-board 格式暂不支持 |
| 📎 **附件** | 暂不支持下载文档附件 |

## 📝 隐私说明

- 你的 Cookie **仅用于本次迁移**，不会上传到任何第三方
- 所有数据直接从语雀 API 拉取到本地
- 迁移完成后可删除 Cookie 文件

## 🤝 贡献

欢迎提交 Issue 和 PR！如果你想把这个 skill 做得更好：

1. Fork 本仓库
2. 创建你的特性分支
3. 提交 PR

## 📄 开源协议

MIT


## 🧠 实战经验

这个 skill 在迁移 9 个知识库、351 篇文档的过程中踩过这些坑：

### 1. 新旧文档 ID 不兼容
早期文档的 TOC 中用 `id` 而非 `doc_id`，直接取 `doc.doc_id` 会得到 undefined。
> 解决：使用 `doc.doc_id || doc.id`

### 2. 企业空间 302 跳转
部分文档属于企业组织（如 hlwcpyfzx.yuque.com），API 返回 302 重定向。
> 解决：跟随 Location 头，重新 PUT 到新 hostname

### 3. 文档内容在 body_draft
部分文档的正文存在 `body_draft` 而非 `body` 中。
> 解决：优先用 `data.body_draft || data.body`

### 4. 在线表格是压缩二进制
lakesheet 格式的 sheet 字段是 zlib 压缩数据，直接输出是乱码。
> 解决：用 Buffer + charCodeAt + inflateSync 解压

### 5. TITLE 层级不能只靠 parent_uuid
TITLE 之间的嵌套由 `level` 字段决定，仅用 parent_uuid 会丢失层级。
> 解决：先按 level 构建 TITLE 树，再挂 DOC

### 6. 空分组不应创建文件夹
TITLE 有 0 个子文档时应跳过，否则产生空目录。
> 解决：`if (group.children.length === 0) continue;`
