---
name: proxy-config-authoring
description: Use when writing or editing a Stash .stoverride or a Surge .sgmodule — rules, MITM hostnames, HTTP scripts, override/module metadata, or porting a config between the two clients. Starts by re-checking the official docs every time.
---

# 编写 Stash / Surge 配置

## 第 0 步：核对官方文档（每次必做）

写任何一行配置之前先跑：

```bash
~/WorkSpaces/proxy-modules/.claude/skills/proxy-config-authoring/scripts/check-docs.sh
```

| 输出 | 处理 |
|---|---|
| 全部 `OK` | 按 `references/` 的要点写 |
| `CHANGED <url>` | 读该页，把差异落进对应 `references/` 文件，再写配置 |
| `NEW <url>` | 文档新增页面，评估是否并入 `references/` |
| `FAIL <url>` | 网络问题，重试；仍失败就说明「未核对文档」并停止动手 |

写完后 `--update` 记录新摘要。

**记忆、旧 skill、别人仓库里的现成配置都只是线索，不是依据。** 语法、默认值、能力边界一律以本次抓到的官方文档为准。文档没写但实测有效的，写进 `references/verified-vs-docs.md` 并标版本和日期；下次文档更新后先复测这些条目。

**Stash 的 wiki 落后于版本**，新版本特性先看 appcast（`https://releases.stash.ws/appcast.xml`，
脚本已在跟踪）。本机版本用 `stash-cli status` 或 App 的 `Info.plist` 确认；写某个能力前先确认
目标客户端版本够不够（如 `#!append`、`pre-matching` 需 5.0+）。

## 先判定要动哪一层

| 层 | 配置项 | 没配好的表现 |
|---|---|---|
| 路由 | Stash `rules:` / Surge `[Rule]` | 请求根本没走代理 |
| 解密 | Stash `http.mitm` / Surge `[MITM] hostname` | 请求列表里没有这条记录 |
| 改写 | Stash `http.script` / Surge `[Script]` | 有记录但内容没变 |

三层缺一层，表现都是「没生效」且不报错。先确认走的是哪一层，再写。

## 两端对照

| 能力 | Stash `.stoverride` | Surge `.sgmodule` |
|---|---|---|
| 文件格式 | YAML | 分段文本（同 profile） |
| 元信息 | `name` / `desc` / `icon` 等 YAML 键 | `#!name=` / `#!desc=` / `#!system=` / `#!arguments=` / `#!requirement=` |
| 规则 | `rules:` 数组，默认插到最前 | `[Rule]`，新行插到最前 |
| 规则顺序 | 键后加 `#!append` 改为追加到最后 | 不支持追加，只能插最前 |
| MITM | `http.mitm` 列表 | `[MITM]` 的 `hostname = %APPEND% a, b` |
| 脚本 | `http.script` 的 `match` / `name` / `type` | `NAME = type=http-request\|http-response, pattern="…"` |
| 响应体 | `require-body: true` | `requires-body=1` |
| 二进制 | `binary-mode: true` | `binary-body-mode=1` |
| 体积上限 | `max-size`（字节）。**5.0 实测 `0` 不等于不限**，大响应仍被截在 ~64KB，写显式字节数 | `max-size=-1` 不限；默认 iOS 1MB / macOS 10MB |
| 引擎 | `engine: auto\|webkit\|jsc` | `engine=auto\|jsc\|webview` |
| 脚本刷新 | `script-providers` + `interval` | `script-path` 直接写 URL + `script-update-interval` |
| 参数化 | `arguments-version` + `${args.x}` | `#!arguments` + `{{{x}}}` |

细节：Stash 见 [references/stash.md](references/stash.md)，Surge 见 [references/surge.md](references/surge.md)，
文档更新记录与实测差异见 [references/official-docs.md](references/official-docs.md)、
[references/verified-vs-docs.md](references/verified-vs-docs.md)。

## 两端通用规则

- 脚本只依赖 `$request` / `$response` / `$done` / `$notification` / `$persistentStore` / `$httpClient`，
  放 `shared/<模块>/`，两端引用同一个 raw URL，不各存一份。
- 第三方脚本锁 commit SHA，避免上游改动导致行为漂移。
- 每个模块都要图标，放 `shared/<模块>/`，两端指向同一个 PNG（512×512、透明底、清晰居中）。
  换图片内容必须换文件名。
- 逻辑规则最多嵌套 10 层；`FINAL` 不能作子规则。
- `REJECT` 立即返回错误，`REJECT-DROP` 静默丢包；普通拦截用 `REJECT`，
  压高频重试才用 `REJECT-DROP`。
- 伪造响应前先确认该接口是否被页面渲染依赖：配置类接口（如广告位 config）回空会
  直接打垮页面（实测桌面版首页报「出错了」）。
- 响应超过 ~64KB 且无法完整解析时，可按已知头部结构合成空响应
  （如 `{"pod":{"stream":[]}}`），比放行更有效。

## 写完必须验证

静态检查（两端都要）：

1. 每个 `script-path` / `script-providers.url` 能 `curl` 到 200 且内容正确。
2. 规则、MITM 主机、脚本条目数量与顺序，两端一一对应。
3. 脚本按接口编码选 body 形态：JSON 接口回合法 JSON，protobuf 接口回 0 字节。

实机检查按三层各做一次：配置解析无报错 → 目标域名证书 issuer 变成对应客户端的 CA →
脚本产生预期行为（日志或请求备注）。本机没装客户端时只能静态校验，**不要说已生效**。

Stash 排障细节见 skill `stash-override-debug`。
