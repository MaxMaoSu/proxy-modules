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
| Mac 与 iPhone 共用 iCloud 覆写目录，Mac 改完自动同步，新建覆写首次仍需在 App 里启用 | 4.3.5，2026-11-15 | 文档未记载 |
| `pre-matching` 写在覆写的 `rules:` 里与主配置等价：`rule match` 返回 `early ... refused at the dns stage` | 5.0.0，2026-11-17 | 与文档一致，已实机确认 |
| 5.0 改完 iCloud 覆写文件后无需手动重载即生效（至少一次实测），4.3.5 则必须点「重新加载配置」 | 5.0.0，2026-11-17 | 与 4.3.5 旧结论冲突，未确认是否依赖 iCloud 同步事件 |

## Surge

| 结论 | 版本 / 日期 | 与文档的关系 |
|---|---|---|
| 本机未安装 Surge，`surge/` 下的模块按官方语法编写但未实机验证 | 2026-11-17 | — |

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
