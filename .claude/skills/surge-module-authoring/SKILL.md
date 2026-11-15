---
name: surge-module-authoring
description: Use when writing or editing a Surge .sgmodule, or converting an existing Stash .stoverride into a Surge module — rules, MITM hosts, HTTP scripts, or module metadata.
---

# 编写 Surge 模块

同一个策略在 Stash 和 Surge 里只差语法。**脚本本身两端通用**：
只依赖 `$request` / `$response` / `$done`，放 `shared/<模块>/`，两边引用同一个 raw URL，
不要各存一份。新增模块的目录约定见仓库 `CLAUDE.md`。

## 模块骨架

```
#!name=Spotify 解锁
#!desc=适配 Spotify Nebula 接口，解锁 Premium，过滤屏幕广告位
#!icon=https://raw.githubusercontent.com/<owner>/proxy-modules/main/shared/spotify/spotify.png
#!author=MaxMaoSu
#!category=去广告
#!version=1.1.0

[Rule]
AND,((DOMAIN-SUFFIX,spotify.com),(PROTOCOL,QUIC)),REJECT-DROP
DOMAIN,aet.spotify.com,REJECT

[MITM]
hostname = %APPEND% spclient.wg.spotify.com, *spclient.spotify.com, *-spclient.wg.spotify.com

[Script]
spotify-adclean = type=http-response, pattern="^https://…$", requires-body=1, binary-body-mode=1, max-size=-1, timeout=10, script-path=https://raw.githubusercontent.com/…/spotify-adclean-v1.js
```

`#!` 头只写实际支持的：`name` / `desc` / `icon` / `author` / `category` / `version`。
**不要写 `#!system=ios,mac`**：官方只定义单值 `mac` / `ios`，多值写法在部分版本被判为
invalid module；不写即两端可用。

## Stash → Surge 对照

| 能力 | Stash `.stoverride` | Surge `.sgmodule` |
|---|---|---|
| 元信息 | `#!name =` / `#!desc =` / `icon:` | `#!name=` / `#!desc=` / `#!icon=` |
| 规则 | `rules:` 数组 | `[Rule]` 段，一行一条 |
| MITM | `http.mitm` 列表 | `[MITM]` 的 `hostname = %APPEND% a, b` |
| 脚本 | `http.script` 的 `match/name/type/timeout` | `NAME = type=http-request\|http-response, pattern="…", …` |
| 响应体 | `require-body: true` | `requires-body=1` |
| 二进制 | `binary-mode: true` | `binary-body-mode=1` |
| 体积上限 | `max-size: 0`（不限） | `max-size=-1`（不限）；正整数是字节数，默认 1MB |
| 脚本来源 | `script-providers` + `interval` | 直接在 `script-path=` 写 URL，默认 86400 秒刷新 |

正则转换只做一件事：把 JSON/YAML 字符串里的 `\/` 还原成 `/`，
`\.`、`\?`、`[^?]*` 等保持原样；`pattern` 用双引号包裹，内部不要再出现未转义的双引号。

## 脚本写法差异

- 请求阶段要伪造响应：`$done({ response: { status, headers, body } })` 两端都支持。
- **protobuf 端点回 0 字节 body，JSON 端点回 `{}`**；给 protobuf 回 `{}` 会在客户端解码时报错。
- 请求/响应体的类型：`binary-body-mode=1` 下是 `Uint8Array`；同时兼容字符串（Stash 某些版本给 base64）。
- 大响应必须显式 `max-size=-1`，否则超过默认 1MB 会被静默截断、脚本拿到坏 JSON。

## 转换清单

1. 头信息按上表逐项改写，去掉 `#!system`、`#SUBSCRIBED`（后者是 Stash 专有）。
2. 规则逐条搬到 `[Rule]`，逻辑规则写法不变。
3. MITM 主机合并成一行 `hostname = %APPEND% …`。
4. 每个 script 条目转成一行，`pattern` 用双引号、`\/` 还原成 `/`。
5. 第三方脚本仍用 commit-pinned raw URL；自写脚本用 `shared/<模块>/` 的 URL。
6. 对照检查：脚本数量、顺序、type、timeout、MITM 主机必须与 Stash 版一一对应。

## 验证

本机没装 Surge 时**只能静态校验**，不要声称已生效：

- 逐条比对正则与 Stash 版是否等价（去掉 `\/` 后应完全相同）。
- `curl` 每个 `script-path`，确认 200 且内容正确。
- 在 CLAUDE.md 的模块说明里标注「未实机验证」。

装好后按三层各自确认一遍：模块已启用且无报错 → 目标域名证书 issuer 变为 Surge CA →
`script-path` 对应的日志/行为出现预期变化。
