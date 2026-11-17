# 官方文档索引与更新检查

最后核对：2026-11-17（摘要见 `doc-digest.txt`）。

## 检查方式

```bash
~/WorkSpaces/proxy-modules/.claude/skills/proxy-config-authoring/scripts/check-docs.sh          # 只比对
~/WorkSpaces/proxy-modules/.claude/skills/proxy-config-authoring/scripts/check-docs.sh --update # 比对并记录
```

脚本抓取下列页面、算正文 SHA-256 与 `doc-digest.txt` 比对。`CHANGED` 说明文档改过，
必须读该页并把差异落进 `references/`，再动配置；`NEW` 说明文档新增页面，评估是否并入。

## Surge（https://manual.nssurge.com/）

| 页面 | 内容 |
|---|---|
| `profile/module.html` | 模块可覆盖的段、`%APPEND%`/`%INSERT%`、元信息、参数表、`#!requirement` |
| `profile/format.html` | profile 各段格式、Host List 等参数类型 |
| `scripting/overview.html` | 脚本通用参数与默认值、引擎选择、性能限制 |
| `scripting/http-request.html` / `http-response.html` | `$request` / `$response` / `$done` 字段与限制 |
| `http/mitm.html` | `hostname` 语义、`auto-quic-block`、证书相关键 |
| `http/url-rewrite.html`、`header-rewrite.html`、`body-rewrite.html`、`map-local.html` | 重写与本地映射语法 |
| `rules/overview.html`、`rules/logical.html` | 规则类型与逻辑规则 |
| `policies/reject.html` | `REJECT` / `REJECT-DROP` / `REJECT-TINYGIF` |

注意：模块页是 `profile/module.html`，`manual.nssurge.com/module.html` 返回 404。

## Stash（https://stash.wiki/）

| 页面 | 内容 |
|---|---|
| `configuration/override` | 覆写合并规则、`#!replace` / `#!append`、覆写参数 |
| `http-engine/mitm` | `http.mitm` 语法、端口与通配符 |
| `http-engine/rewrite` | `url-rewrite` / `header-rewrite` / `body-rewrite` / `mock` 语法 |
| `script/rewrite-requests` | `http.script` 参数、`engine`、`$request` / `$response` / `$done` |
| `script/manage-script` | `script-providers` 的 `url` / `path` / `payload` / `headers` |
| `script/syntax-and-interface` | 脚本全局方法、`$httpClient`、`$persistentStore` |
| `rules/rule-types` | 规则类型、`PROTOCOL`、`REJECT` 家族、`pre-matching` |
| `release-notes/macos`、`release-notes/ios` | 站内更新日志（通常滞后于真实版本） |
| `https://releases.stash.ws/appcast.xml` | App 内更新说明的原始数据，**版本特性以此为准** |

**官方 wiki 落后于版本**：5.0 发布时 wiki 仍停在 4.2.0。新版本特性先看 appcast，
再等 wiki 补齐；两者冲突时，已实机确认的版本行为优先，并把差异写进 `verified-vs-docs.md`。

本机版本：`/Applications/Stash.app/Contents/Info.plist` 的 `CFBundleShortVersionString`，
或 `stash-cli status` 的 `Version` 行。

Stash 文档是 Next.js 站点，`curl` 拿到的是 SSR 后的 HTML，正文可直接读；
比对用原始 HTML 摘要，导航或构建变化也会触发 `CHANGED`，看到后确认正文是否真的变了。
