# 实测结论与官方文档的差异

每条都标了版本和日期。**官方文档更新后先复测这里，再按文档写。**
文档没写、实测有效的，同样记在这里。

## Stash

| 结论 | 版本 / 日期 | 与文档的关系 |
|---|---|---|
| 覆写内 `http.url-rewrite` / `header-rewrite` / `body-rewrite` / `mock` **5.0 全部生效**：`reject-200` / `reject-dict` / `reject-img`、`request-add` / `request-del`、`response-json-add` / `response-json-replace`、`mock` 的 `status-code`+`text` 均实测通过 | 5.0.0，2026-11-17 | 与文档一致。4.3.5 时这些段全部静默无效，已修复 |
| `reject-dict` 响应带 `content-type: application/json`、2 字节 `{}`；`reject-200` 无 content-type、0 字节；`reject-img` 带 `image/gif`、49 字节 1×1 GIF | 5.0.0，2026-11-17 | 文档只说返回形态，未说响应头，实测可替代等价的手写脚本 |
| `script-providers` 只认 `url:` 且必须 https，`path:` 不生效 | 4.3.5，2026-11-14 | 文档现已记载 `path` / `payload`，需按当前版本复测 |
| 首行 `#SUBSCRIBED <自身 raw URL>` 让客户端当订阅源自动更新 | 4.3.5，2026-11-14 | 文档未记载 |
| 重载只有 App 内一个入口（菜单栏图标 → 重新加载配置）；`⌘R`、重启 App、`stash://reload`、控制器 API 都不重载（`Core/config.yaml` mtime 不变） | 4.3.5，2026-11-14 | 文档未记载 |
| 脚本按 URL 路径缓存，`?v=2` 会被规范化掉，改内容必须换文件名 | 4.3.5，2026-11-15 | 文档未记载 |
| iPhone 上 `provider update` 返回 404 且不刷新 | 4.3.5，2026-11-15 | 文档未记载 |
| 图标按 URL 缓存，换图片内容必须换文件名 | 4.3.5，2026-11-15 | 文档未记载 |
| `binary-mode` 下取证脚本要 `max-size: 0` 才不截断 | 4.3.5，2026-11-15 | 文档只说「超过该大小不触发脚本」，未定义 0 的语义 |
| **5.0 下 `max-size: 0` 不再等于不限**：`ad-logic/prefetch` 与首页 protobuf 仍被截在 65532~65536，写显式字节数（16MB）后才拿到完整 body | 5.0.0，2026-11-18 | 与上一行 4.3.5 结论相反；文档未定义 0，也未说明硬上限 |
| 伪造「配置类」接口会破坏页面渲染：`ads/vN/config` 回 `{}` 后桌面版首页直接报「出错了」 | 5.0.0，2026-11-18 | 文档未记载；拦截前先确认该接口是否被页面渲染依赖 |
| Mac 与 iPhone 共用 iCloud 覆写目录，Mac 改完自动同步，新建覆写首次仍需在 App 里启用 | 4.3.5，2026-11-15 | 文档未记载 |
| `pre-matching` 写在覆写的 `rules:` 里与主配置等价：`rule match` 返回 `early ... refused at the dns stage` | 5.0.0，2026-11-17 | 与文档一致，已实机确认 |
| 5.0 改完 iCloud 覆写文件后无需手动重载即生效（至少一次实测），4.3.5 则必须点「重新加载配置」 | 5.0.0，2026-11-17 | 与 4.3.5 旧结论冲突，未确认是否依赖 iCloud 同步事件 |

## Surge

| 结论 | 版本 / 日期 | 与文档的关系 |
|---|---|---|
| `[Header Rewrite]` 只认 `header-add` / `header-del` / `header-replace` / `header-replace-regex`；照搬 Stash 的 `request-del` 不报错、整行被忽略，请求头原样发出（表现为条件请求恒得 304） | Mac 6.12.0，2026-11-21；iOS 6.0.1 上观察到同一失败现象 | 与文档一致；文档未提醒跨客户端语法不能照搬 |
| `[Map Local]` 的 `data-type=text data=""` 返回 200、0 字节、`content-type: text/plain`；命中 Map Local 后不再执行同一 URL 的脚本（请求备注只有 `Matched map local rule`） | Mac 6.12.0，2026-11-21 | 文档未说明两者的优先级 |
| `#!category=` / `#!author=` / `#!icon=` / `#!homepage=` / `#!openUrl=` / `#!repo=` 手册未列，但会被解析进 `list_modules` 的 header；`#!category` 同时决定模块列表分组 | Mac 6.12.0，2026-11-21；iOS 6.0.1 仅在第三方模块（iRingo）上佐证 | 文档未记载 |
| `[Map Local]` 可用 `curl -x http://127.0.0.1:6152 <URL>` 直接验证：映射中的回 200 与配置的 body，未映射的照常透传 | Mac 6.12.0，2026-11-21 | 文档未提供验证方法 |

## 版本门槛

| 能力 | 起始版本 | 旧版表现 |
|---|---|---|
| `#!append`（覆写追加到配置末尾） | 5.0 | 注释被忽略，仍插到最前 |
| `pre-matching` 规则旗标 | 5.0 | 未知旗标 |
| 覆写参数 | iOS/tvOS 3.7+、macOS 4.4+ | — |

## 待复测

上表 4.3.5 的条目都在 5.0 之前测得，升版本后需重跑最小用例：

- `script-providers.path` / `payload` 是否可用。
- `max-size: 0` 的语义。
- `#!append` 的实际顺序（规则、代理组分别验证）。
- Surge `auto-quic-block` 在目标域名上的实际表现（默认开启，理论上不必再写 QUIC 拦截规则）。
