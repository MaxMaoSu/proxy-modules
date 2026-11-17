# Surge 模块（.sgmodule）

来源：https://manual.nssurge.com/ — `profile/module.html`、`profile/format.html`、
`scripting/overview.html`、`scripting/http-request.html`、`scripting/http-response.html`、
`http/mitm.html`、`http/*-rewrite.html`、`http/map-local.html`、`rules/*`、`policies/reject.html`。
核对日期见 `official-docs.md`。

## 模块骨架

```
#!name=Spotify 解锁
#!desc=适配 Spotify Nebula 接口，解锁 Premium，过滤屏幕广告位

[Rule]
AND,((DOMAIN-SUFFIX,spotify.com),(PROTOCOL,QUIC)),REJECT-DROP

[MITM]
hostname = %APPEND% spclient.wg.spotify.com, *spclient.spotify.com

[Script]
my-request-script = type=http-request, pattern="^https://…$", engine=jsc, timeout=5, script-path=https://raw.githubusercontent.com/…/my-request.js
spotify-adclean = type=http-response, pattern="^https://…$", requires-body=1, binary-body-mode=1, max-size=-1, engine=webview, timeout=10, script-path=https://raw.githubusercontent.com/…/spotify-adclean-v1.js
```

模块语法与 profile 相同，但只能动下列段：

| 段 | 行为 |
|---|---|
| `[General]`、`[MITM]`、`[Ponte]`、`[DHCP]` | 按键覆盖，支持 `%APPEND%` / `%INSERT%` |
| `[Rule]`、`[Script]`、`[URL Rewrite]`、`[Header Rewrite]`、`[Body Rewrite]`、`[Map Local]`、`[Host]`、`[IP Rewrite]`、`[SSID Setting]`、`[Panel]` | 新行插到原内容最前 |
| `[WireGuard *]`、`[Tailscale *]`、`[MTProto]`、`[Snell Server]` | 整段替换同名段，必须写完整 |
| `[Ruleset *]` | 追加行到同名规则集，不能删改已有行 |

不能动 `[Proxy]` / `[Proxy Group]`，不能改 MITM 的 CA 证书。
`[MITM]` 里只能操作 `hostname`、`client-source-address`、`skip-server-cert-verify`、
`tcp-connection`、`h2`。

模块规则只能用内置策略（`DIRECT`、`REJECT`、`REJECT-DROP`、`REJECT-TINYGIF` 等）
或 profile 里已存在的策略/策略组，不能新定义策略。

## 元信息

官方字段只有这些：

| 字段 | 说明 |
|---|---|
| `#!name=` | 显示名 |
| `#!desc=` | 描述 |
| `#!system=` | 限平台：`mac` / `ios` / `tvOS`；双端通用时不写 |
| `#!arguments=` / `#!arguments-desc=` | 参数表（Mac 5.5.0+） |
| `#!requirement=` | 版本/平台条件，如 `CORE_VERSION>=20`，支持 `&&` / `\|\|` |

`#!icon` / `#!author` / `#!category` / `#!version` 官方未定义，写了不显示。
图标只在 Panel/策略组里通过 `argument=icon=` 或 `icon-url=` 实现，与模块头无关。

## 参数表（Mac 5.5.0+）

```
#!arguments=policy:DIRECT,hostname:example.com
#!arguments-desc=选择策略与主机名

[Rule]
DOMAIN-SUFFIX,example.com,{{{policy}}}
```

占位符是三层花括号 `{{{name}}}`，区分大小写；参数名只用字母、数字、下划线。
不支持 query-string 形式和 `%PARAMETER%` 占位。

## 脚本参数（官方默认值）

| 参数 | 默认 | 说明 |
|---|---|---|
| `type` | `generic` | HTTP 脚本用 `http-request` / `http-response`，显式写 |
| `script-path` | 必填 | 相对 profile 目录、绝对路径或 http(s) URL；远程脚本自动缓存 |
| `script-update-interval` | 86400 秒 | 仅 URL 生效 |
| `pattern` | HTTP 脚本必填 | 匹配 URL 的正则，编译失败即整行无效 |
| `requires-body` | `false` | 开启才缓冲完整 body 并允许返回 body |
| `max-size` | iOS 1MB / macOS 10MB | 响应超限跳过脚本透传；请求超限直接断连；`-1` 不限（请求体硬顶 32MB） |
| `binary-body-mode` | `false` | body 以 `Uint8Array` 传入/返回 |
| `full-header-mode` | `false` | headers 以 `{field, value}` 数组传入，保留重复字段 |
| `timeout` | 5 秒 | 到点未 `$done()` 记为超时 |
| `engine` | `auto` | `auto` 在有 WebView 时优先 WebView；可选 `jsc` / `webview` |
| `argument` | — | 任意字符串，脚本里是 `$argument` |
| `debug` | `false` | 每次运行重载本地脚本；HTTP 脚本的 `console.log` 显示在请求备注 |
| `cronexp` / `event-name` / `wake-system` | — | 定时/事件脚本用，与 HTTP 脚本无关 |

**引擎选择**：用了 `fetch` / `crypto` / `TextDecoder` 等 WebAPI 的显式写 `engine=webview`；
高频、逻辑极简的（去条件头、伪造空响应）写 `engine=jsc`。JSC 在 NE 进程内跑，占内存；
WebView 独立进程，最多 3 个并行，超出排队、排不上按超时算。

**匹配语义**：每个请求每种类型只运行**第一个**匹配的脚本（按 profile 顺序），
所以 `pattern` 要尽可能窄，`requires-body` 只在必要时开。

## MITM

- `hostname` 是 Host List：支持 `*` / `?`，`-` 前缀排除（排除项写最前，按顺序匹配）；
  裸写 `example.com` 只匹配 443，`example.com:8443` 指定端口，`example.com:0` 匹配所有端口。
- `auto-quic-block` 默认 `true`（iOS 5.8+ / Mac 5.4+）：命中 MITM 列表的 QUIC 连接会被自动阻断，
  客户端回退到 HTTP/2/1.1。**因此不必再为 MITM 域名单独写 QUIC 拦截规则**；
  只有需要与 MITM 无关地封 QUIC 时才用 `[General] block-quic` 或 `block-quic` 策略参数。
- `h2` 默认 `false`，开启后 MITM 走 HTTP/2，并发请求更快。
- 证书固定的应用在 MITM 后必然断连；握手完成但不发请求时 Surge 会在日志里提示。
- `server-certificates`（iOS 6.0+ / Mac 6.11+）可给指定主机换用自己的证书。

## 拦截与改写

`[URL Rewrite]` 的模式只有四种：`header`、`302`、`307`、`reject`。
没有 Stash 的 `reject-200` / `reject-img` / `reject-dict` / `reject-array`，等价物在 `[Map Local]`：

| 想要 | Surge 写法 |
|---|---|
| 404 + 空 body | `[URL Rewrite]` + `reject` |
| 200 + 空 body | `[Map Local] … data-type=text data=""` |
| 200 + `{}` | `… data-type=text data="{}" header="Content-Type:application/json"` |
| 200 + `[]` | `… data-type=text data="[]" header="Content-Type:application/json"` |
| 200 + 1px GIF | `… data-type=tiny-gif` |
| 200 + 任意文本/二进制 | `data-type=text` / `data-type=base64`，`status-code` 可改 |

`[Map Local]` 只在 Rewrite 功能开启且请求经过 HTTP 引擎时生效，HTTPS 需要目标主机已 MITM。

## 规则要点

- 逻辑规则最多嵌套 10 层，`FINAL` 不能作子规则。
- 子规则可带 `no-resolve` 等标志；`pre-matching` 不能加在子规则上，但整条逻辑规则可以，
  前提是子规则类型都支持 pre-matching 且策略属于 REJECT 家族。
- `PROTOCOL` 支持 `QUIC`；`PROTOCOL,UDP` 同时命中 QUIC 和 STUN。
- `REJECT` 立即返回错误，`REJECT-DROP` 静默丢包。普通拦截用 `REJECT`。

## 从 Stash 覆写转换

1. 头信息只留 `#!name` / `#!desc`，平台专属才加 `#!system`。
2. 规则逐条搬到 `[Rule]`，逻辑规则写法不变。
3. MITM 主机合并成一行 `hostname = %APPEND% …`。
4. 每个 script 条目转成一行；YAML 里的 `\/` 还原成 `/`，`pattern` 用双引号包；
   依赖 WebAPI 的加 `engine=webview`，高频极简的加 `engine=jsc`。
5. 大响应脚本显式 `max-size=-1`。
6. 对照检查：脚本数量、顺序、type、timeout、MITM 主机与 Stash 版一一对应。

正则转换只做一件事：`\/` → `/`；`\.`、`\?`、`[^?]*` 保持原样。

## 验证

本机没装 Surge 时只能静态校验，不要声称已生效：

- 逐条比对正则与 Stash 版是否等价。
- `curl` 每个 `script-path`，确认 200 且内容正确。
- 在 CLAUDE.md 的模块说明里标「未实机验证」。

装好后按三层各确认一次：模块已启用且无报错 → 目标域名证书 issuer 变为 Surge CA →
脚本行为（日志/请求备注）出现预期变化。
