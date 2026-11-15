---
name: surge-module-authoring
description: Use when writing or editing a Surge .sgmodule, or converting an existing Stash .stoverride into a Surge module — rules, MITM hosts, HTTP scripts, or module metadata.
---

# 编写 Surge 模块

语法以官方手册为准（`manual.nssurge.com`）：`/profile/module.html`（模块与头字段）、
`/scripting/overview.html`（脚本通用参数与引擎）、`/scripting/http-request.html`、
`/scripting/http-response.html`、`/rules/logical.html`、`/rules/protocol-and-network.html`、
`/policies/reject.html`。

脚本本身两端通用：只依赖 `$request` / `$response` / `$done`，放 `shared/<模块>/`，
Stash 与 Surge 引用同一个 raw URL，不要各存一份。

## 模块骨架

```
#!name=Spotify 解锁
#!desc=适配 Spotify Nebula 接口，解锁 Premium，过滤屏幕广告位

[Rule]
AND,((DOMAIN-SUFFIX,spotify.com),(PROTOCOL,QUIC)),REJECT-DROP
DOMAIN,aet.spotify.com,REJECT

[MITM]
hostname = %APPEND% spclient.wg.spotify.com, *spclient.spotify.com, *-spclient.wg.spotify.com

[Script]
spotify-strip304 = type=http-request, pattern="^https://…$", engine=jsc, timeout=5, script-path=https://raw.githubusercontent.com/…/spotify-strip304-v2.js
spotify-adclean = type=http-response, pattern="^https://…$", requires-body=1, binary-body-mode=1, max-size=-1, engine=webview, timeout=10, script-path=https://raw.githubusercontent.com/…/spotify-adclean-v1.js
```

**头字段只有这些是官方的**：`#!name=`、`#!desc=`、`#!system=`（单值 `mac` 或 `ios`）、
`#!arguments=` / `#!arguments-desc=`、`#!requirement=`。
`#!icon`、`#!author`、`#!category`、`#!version` 官方未定义，写了也不会显示——
图标只在 Panel/策略组里通过 `argument=icon=` 或 `icon-url=` 实现，与模块头无关。
模块同时支持两端时不写 `#!system`。

## 通用脚本参数（官方默认值）

| 参数 | 默认 | 说明 |
|---|---|---|
| `type` | `generic` | HTTP 脚本用 `http-request` / `http-response` |
| `script-path` | 必填 | 相对 profile 目录、绝对路径或 http(s) URL；远程脚本自动缓存 |
| `script-update-interval` | 86400 秒 | 仅 URL 生效 |
| `pattern` | HTTP 脚本必填 | 匹配 URL 的正则 |
| `requires-body` | `false` | 开启才缓冲完整 body 并允许返回 body |
| `max-size` | iOS 1MB / macOS 10MB | 超出即**跳过脚本**并透传；`-1` 表示不限（仍有硬上限） |
| `binary-body-mode` | `false` | body 以 `Uint8Array` 传入/返回，而非 UTF-8 字符串 |
| `timeout` | 5 秒 | 到点未 `$done()` 记为超时 |
| `engine` | `auto` | `auto` 在支持时优先 WebView；可选 `jsc` / `webview` |
| `debug` | `false` | 每次运行重载本地脚本；HTTP 脚本的 `console.log` 显示在请求备注 |

**引擎选择**：用了 `TextDecoder` / `TextEncoder` / `fetch` / `crypto` 等 WebAPI 的脚本
显式写 `engine=webview`（否则在不支持 WebView 的环境会失败）；
每次请求都跑、逻辑极简的（如去条件头、伪造空响应）写 `engine=jsc`，省 Network Extension 内存。

**匹配语义**：每个请求**每种类型只运行第一个匹配的脚本**（按 profile 顺序）。
顺序有意义，`pattern` 要尽可能窄——`requires-body` 会把整条响应读进内存，iOS 的 NE 内存有限。

## Stash → Surge 对照

| 能力 | Stash `.stoverride` | Surge `.sgmodule` |
|---|---|---|
| 元信息 | `#!name =` / `#!desc =` / `icon:` | `#!name=` / `#!desc=`（其余非官方） |
| 规则 | `rules:` 数组 | `[Rule]` 段，一行一条 |
| MITM | `http.mitm` 列表 | `[MITM]`：`hostname = %APPEND% a, b`（也可 `%INSERT%`） |
| 脚本 | `http.script` 的 `match/name/type/timeout` | `NAME = type=…, pattern="…", …` |
| 响应体 | `require-body: true` | `requires-body=1` |
| 二进制 | `binary-mode: true` | `binary-body-mode=1` |
| 体积上限 | `max-size: 0`（不限） | `max-size=-1`（不限），默认 iOS 1MB / macOS 10MB |
| 引擎 | 无对应键 | `engine=jsc\|webview` |
| 脚本刷新 | `script-providers` + `interval` | `script-path` 直接写 URL，`script-update-interval` 默认 86400 |

正则转换只做一件事：把 YAML/JSON 字符串里的 `\/` 还原成 `/`，
`\.`、`\?`、`[^?]*` 保持原样；`pattern` 用双引号包裹。

## 模块能力边界（官方限制）

- 不能改 `[Proxy]`、`[Proxy Group]`，不能改 MITM 的 CA 证书。
- `[MITM]` 只能操作 `hostname`、`client-source-address`、`skip-server-cert-verify`、
  `tcp-connection`、`h2`。
- `[Rule]` / `[Script]` 等段是**插入到原配置顶部**，所以模块规则优先于 profile 里的规则。
- 规则策略只能用配置里已有的策略或内置策略（`DIRECT`、`REJECT`、`REJECT-DROP` 等）。
- 逻辑规则最多嵌套 10 层，`FINAL` 不能作为子规则。

## 规则要点

- `PROTOCOL` 支持 `QUIC`，但不保证识别所有 QUIC draft 版本；
  `PROTOCOL,UDP` 同时命中 QUIC 和 STUN。
- `REJECT-DROP` 静默丢包，用于压制高频重试；普通拦截用 `REJECT` 即可。

## 转换清单

1. 头信息只留 `#!name` / `#!desc`（平台专属才加 `#!system`）。
2. 规则逐条搬到 `[Rule]`，逻辑规则写法不变。
3. MITM 主机合并成一行 `hostname = %APPEND% …`。
4. 每个 script 条目转成一行；`\/` 还原、`pattern` 加双引号；
   依赖 WebAPI 的加 `engine=webview`，高频极简的加 `engine=jsc`。
5. 大响应的脚本显式 `max-size=-1`。
6. 对照检查：脚本数量、顺序、type、timeout、MITM 主机必须与 Stash 版一一对应。

## 验证

本机没装 Surge 时只能静态校验，不要声称已生效：

- 去掉 `\/` 后逐条比对正则与 Stash 版是否等价。
- `curl` 每个 `script-path`，确认 200 且内容正确。
- 在 CLAUDE.md 的模块说明里标注「未实机验证」。

装好后按三层确认：模块已启用且无报错 → 目标域名证书 issuer 变为 Surge CA →
对应脚本的行为（日志/请求备注）出现预期变化。
