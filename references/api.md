# Yuque API 参考

## API 端点

| 用途 | 方法 | URL | 说明 |
|------|------|-----|------|
| 知识库列表 | GET | /api/books | 返回所有知识库 |
| 知识库页面 | GET | /{user}/{slug} | HTML，嵌入 appData JSON |
| 文档内容 | PUT | /api/docs/{id} | 必须带 Referer |
| 图片资源 | GET | 任意 cdn.nlark.com URL | 需带 Cookie |

## 认证 Headers

```
Cookie: {完整 cookie 字符串}
X-Csrf-Token: {yuque_ctoken 的值}
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

## TOC level 层级规则

TOC 数组中每个 item 的 level 字段决定 TITLE 嵌套关系：
- level=0：根级 TITLE
- level=1：最近一个 level=0 的子级
- level=N：最近一个 level=N-1 的子级

DOC 的 parent_uuid 指向其所属 TITLE 的 uuid。

## 文档 ID Fallback

- 新格式文档：TOC 中有 doc_id 字段
- 旧格式文档：TOC 中有 id 字段（无 doc_id）
- 使用 `item.doc_id || item.id` 获取文档 ID

## 企业空间跳转

部分文档属于企业空间（如 hlwcpyfzx.yuque.com），API 返回 302：
- 从响应头 Location 提取新的 hostname
- 重新 PUT 到新 hostname

## 图片下载

- 来源：cdn.nlark.com
- 命名：MD5(url).substring(0,10) + 扩展名
- 间隔：>=300ms 防止限流
- 存储：每个知识库的 assets/ 目录

## lakesheet 解析

1. 解析 body/body_draft 为 JSON（format="lakesheet"）
2. sheet 字段是 zlib 压缩的二进制数据
3. 用 inflateSync 解压后得到 sheets 数组
4. 每个 sheet.data = {行号: {列号: {v:值, t:类型}}}
