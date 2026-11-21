# proxy-modules 维护约定

## 仓库结构

按客户端分目录，客户端无关的 JS 与图标放 `shared/`：

```
proxy-modules/
├── README.md                仅枚举模块与订阅地址，不写技术细节
├── CLAUDE.md                本文件：维护约定与技术细节
├── shared/<模块>/           JS 脚本、图标（Stash 与 Surge 共用同一份）
├── stash/<模块>/            <模块>.stoverride
└── surge/<模块>/            <模块>.sgmodule
```

新增模块：双端都支持的建 `shared/` + `stash/` + `surge/` 三处；只支持 Stash 的建 `shared/` + `stash/` 两处。README 表格加一行。
脚本只写 `$request` / `$response` / `$done` 这套通用 API，两端才能共用。
**每个模块必须有图标**：图标放 `shared/<模块>/`，Stash 用 `icon: '<raw URL>'`
（不是 `#!icon`），Surge 用 `#!icon=`，两端指向同一个文件
（512×512、透明底，优先产品官方 logo）。
图标必须清晰、居中：SVG 转 PNG 要 `-density 2400` + `-trim` + `-extent`，
直接 `-resize` 会糊且偏心，完整命令见 skill `proxy-config-authoring`。
换图片内容必须换文件名，Stash 按 URL 缓存图标。
第三方脚本用远程 URL，不复制进仓库。

## 发布方式

`.stoverride` 首行写自身 raw 地址：

```yaml
#SUBSCRIBED https://raw.githubusercontent.com/MaxMaoSu/proxy-modules/main/stash/<模块>/<文件名>.stoverride
```

客户端会把它当订阅源自动更新。**改文件名或路径必须同步改这一行**，
否则客户端仍指向旧地址。改完 push，客户端在菜单栏 Stash 图标 →「重新加载配置」后生效。
`⌘R`、重启 App、`stash://reload`、控制器 API 都不触发重载（实测）。

Stash 的「更新」按钮有时拉不到新内容（本地文件 mtime 不变），且可能在文件里
重复追加 `#SUBSCRIBED` 行。此时直接改 iCloud 目录下的同名文件、只保留一行
`#SUBSCRIBED`，再在菜单栏点「重新加载配置」。

## Surge 模块

`surge/<模块>/<模块>.sgmodule` 与 Stash 覆写是同一套策略，只是语法不同：

| 能力 | Stash | Surge |
|---|---|---|
| 元信息 | `#!name =` / `#!desc =` / `icon:` / `author` 等 | `#!name=` / `#!desc=`；`#!category=` / `#!author=` / `#!icon=` / `#!homepage=` / `#!openUrl=` 官方手册未列，但 Surge 会解析并用于模块列表分组与展示（实测 6.12） |
| 规则 | `rules:` 数组 | `[Rule]` 段，一行一条 |
| 改写请求头 | `header-rewrite` 的 `request-del X` | `[Header Rewrite]`：`http-request <正则> header-del X`；**`request-del` 在 Surge 里是不报错的空操作** |
| MITM | `http.mitm` 数组 | `[MITM]` 的 `hostname = %APPEND% a, b` |
| 脚本 | `http.script` 的 `match/name/type/timeout` | `[Script]`：`NAME = type=http-request|http-response, pattern="…", …` |
| 响应体 | `require-body: true` | `requires-body=1` |
| 二进制 | `binary-mode: true` | `binary-body-mode=1` |
| 体积上限 | `max-size`（字节；实测 `0` 为不限） | `max-size=-1`（不限）；默认 iOS 1MB / macOS 10MB |
| 引擎 | `engine: auto\|webkit\|jsc` | `engine=auto\|jsc\|webview`；用 WebAPI 的显式写 webview |

脚本直接用 `shared/` 的同一份文件（只依赖 `$request` / `$response` / `$done`），
不需要复制。新增或修改脚本后两端同时生效。

Surge 的 `auto-quic-block` 默认开启（iOS 5.8+ / Mac 5.4+），命中 MITM 列表的 QUIC 连接会被自动阻断，
所以 Surge 模块里不必再为 MITM 域名单独写 QUIC 拦截规则；Stash 没有这个能力，必须显式写规则。

Surge 6.12（Mac）已实机验证：模块启用、MITM 生效、脚本与 `[Map Local]` 均命中。
Map Local 可用 `curl -x http://127.0.0.1:6152` 直接验证：被映射的 URL 返回 200 与配置的 body，
未映射的照常透传（如 `quicksilver/v2/messages` 回 401）。
iOS 6.0.1 只验证到修复前的现象（请求带 `if-none-match`、响应 304）；安装新版模块后需复测一次。

`[Map Local]` 优先于 `[Script]`：同一 URL 命中 Map Local 后不再执行脚本（实测请求备注只有
`Matched map local rule`）。Map Local 与脚本 pattern 有意重叠时，以 Map Local 的结果为准。

## 跨端同步

Mac 与 iPhone 共用 iCloud 目录
`~/Library/Mobile Documents/iCloud~ws~stash~icloud/Documents/override/`。
在 Mac 上更新覆写文件后，iCloud 会自动同步到手机，**手机端不需要任何手动操作**
（不用重新订阅、不用重装），只会弹一次「配置已更新」提示。
新建的覆写首次仍需在 App 里启用，之后内容更新即自动生效。

## 脚本缓存

Stash 按 URL 路径缓存脚本，`interval` 未到期不会重新下载。
改脚本内容时改文件名（如 `xxx-v2.js`）能强制刷新；给 URL 加 `?v=2` **无效**，
会被规范化掉。

## Stash 覆写的实际能力边界（5.0.0 实测，2026-11-17）

| 键 | 可用 | 说明 |
|---|---|---|
| `rules` | ✅ | 数组默认 prepend，覆写规则优先 |
| `http.mitm` | ✅ | 中缀通配可用，`*spclient.a.com` 能匹配 `guc3-spclient.a.com` |
| `http.script` | ✅ | 支持 `require-body` / `binary-mode` / `max-size` / `timeout` |
| `script-providers` | ✅ | 4.3.5 只认 https `url:`；`path:` / `payload` 待复测 |
| `url-rewrite` | ✅ | `reject` / `reject-200` / `reject-img` / `reject-dict` 均生效 |
| `header-rewrite` | ✅ | `request-add` 生效 |
| `body-rewrite` | ✅ | `response-json-add` 生效 |
| `mock` | ✅ | `status-code` 与 `text` 生效 |

**4.3.5 时这些 rewrite 段全部静默无效，5.0 已修复**，不必再为改请求头、伪造状态码写脚本。
改完 iCloud 覆写文件约 8 秒内自动生效，不需要点「重新加载配置」。

5.0 新增：`#!append`（覆写追加到配置末尾）、
`pre-matching`（REJECT 规则提前到连接建立前，只允许域名/GEOSITE/IP/GEOIP/DST-PORT/SRC-*/NETWORK/RULE-SET
及其组合，目标只能是 REJECT 族）、安装覆写前填参数、事件脚本、合并结果校验。
广告类域名优先加 `pre-matching`，iOS 下省内存和 CPU 最直接；
已在 `DOMAIN,aet.spotify.com,REJECT,pre-matching`（Stash 与 Surge 两版）落地并实机确认。
官方 wiki 落后于版本，新特性看 `https://releases.stash.ws/appcast.xml`。

## 排查顺序

1. **配置是否解析成功**：引用不存在的 provider 会让整份配置失效
   （App 弹「配置文件无效」），之后所有规则静默不生效。
2. **MITM 是否生效**：`openssl s_client -proxy 127.0.0.1:7890 -connect <host>:443`
   看 issuer 是否为 `Stash Generated CA`。
3. **规则/rewrite 是否命中**：先取直连基准——很多端点在没有干预时就是 `200` 空响应，
   拿它当"生效"的证据会得出完全相反的结论。只有直连返回非 200 的端点才能区分。
4. **脚本是否执行**：`~/Library/Application Support/Stash/Core/script-logs/<脚本名>.log`
   记录脚本自己的 `console.log`；`Core/logs/*.log` 记录引擎级错误（超时、pipeline 失败）。
5. **效果**：找免费状态下恒定存在的 UI 标志消失，而不是"等一会儿没广告"。

手机端排查用 CLI 直连控制器：`stash-iphone status` / `stash-iphone conn ls`；
Mac 的 Stash Dashboard「远程控制器 → 已保存的设备 → 连接」看的是同一套连接。
API 密钥在 `~/.claude/secrets/stash-iphone-controller`（600），
地址由 mDNS 发现（`MaoSutekiiPhone.local:9090`）。iOS 的 `/configs` 只回极简配置，
判断覆写是否生效要看 App 里的覆写内容或实际连接；`provider ls` 里的脚本缓存
存在不代表仍挂载。移除脚本后 toggle 覆写开关不一定会停掉已加载的脚本 VM，
必须退出 Stash 再重开，并用 Mac 的 `script-logs/*.log` 行数增量确认。

## Spotify 专项

- **QUIC 必须拦且不能收窄**：`AND,((DOMAIN-SUFFIX,spotify.com),(PROTOCOL,QUIC)),REJECT-DROP`。
  写成 `DOMAIN-SUFFIX,spclient.spotify.com` 会因标签边界（`-` 不是 `.`）
  匹配不到 `guc3-spclient.spotify.com`，规则静默失效。
- **接口**：9.1.98 起不走 `bootstrap`/`customize`，账号属性在
  `nebula/v1/configuration/attributes`。桌面版同样请求这个接口，因此同一份覆写两端通用。
- **proto 脚本 timeout 给 30 秒**：406KB 内嵌 protobuf schema，默认 10 秒跑不完，
  只在引擎日志报 `script execution timed out`。
- **`remote-config-resolver` 不要交给 proto**：桌面版该接口返回 JSON，
  protobuf 解码抛 `invalid wire type`，异常会重置 WebKit 引擎，
  连带让同期 nebula 的脚本跑不掉。
- **304 无 body**：服务器命中 ETag 返回 304 时脚本拿不到数据，要删
  `If-None-Match` / `If-Modified-Since`。Stash 用 `request-del`，Surge 用
  `http-request <正则> header-del <头名>`。**Surge 里写 `request-del` 不会报错，只是永不命中**：
  实测 iPhone 上 `nebula/v1/configuration/attributes` 的请求仍带 `if-none-match`，
  响应 304、`spotify-proto` 拿到空 body 直接放行，账号属性改不掉。
- **广告位都在 `ads/v3/ads?slots=…`**：`hpto` = 首页顶部全宽卡，
  `marquee` = 播放页歌词下方那张（实测 iPhone「广告 / Chase」卡片），`preroll` = 播前。
  响应形如 `{"pod":{"<slot>":[{id, clickthrough, ...}]}}`。
  `spotify-adclean-v1.js` 清空 `pod` 下各数组 slot、保留结构。
- **客户端会缓存广告素材**：iPhone 上 `ads/v3/ads?slots=marquee` 已返回
  `{"pod":{"marquee":[]}}`，界面仍显示上一张卡片；判断是否生效前先**强制退出 App**
  （上滑关闭）再重开，别把缓存当成过滤失效。
- **`casita/v1/home` 只有 iPhone 请求**：桌面版全量探测从未请求；
  iPhone 首页走 `casita/v1/home/default`，响应 87–93KB protobuf，
  section 标识形如 `spotify:section:<id>|<kind>`（实测 31 个 section，
  kind 有 `shortcuts`、`musicfeed-*` 等）。
- **iPhone 端脚本缓存**：`provider update` 对手机控制器返回 404 且不刷新；
  改脚本内容要**换文件名**（`xxx-v2.js`）并同步 iCloud，再让手机重载覆写。
- **广告拦截分两层**：response 阶段（`spotify-adclean-v1.js`，仍需脚本）清空
  `ads/vN/ads`、`ad-logic/prefetch`、`pendragon` 的数组，保留 JSON 结构；
  请求阶段改用 `url-rewrite` 的 `reject-200` / `reject-dict` 由引擎直接合成响应，
  不跑脚本：`sponsoredplaylist`、`ad-logic/vN/config` 是 protobuf 回 0 字节，
  `gabo-receiver-service`、`pam-view-service` 是 JSON 回 `{}`。
  **`ads/vN/config` 不能拦**：实测回 `{}` 后桌面版首页直接报「出错了」，首页依赖它渲染。
  protobuf 给 `{}` 会让客户端解码抛异常。两层 match 尽量不重叠；有意重叠时以 Map Local 为准。
  adclean 保留脚本是因为它要按 `pod` 下任意键名清数组、还要兼容根数组与 `messages`，
  jq 写起来更脆。
- **`ad-logic/prefetch` 固定超过 64KB 且不可解析**：实测 `len=65532~65536`，
  `max-size` 设到 16MB 也一样被截断，完整 JSON 永远拿不到；头部形如
  `{"pod":{"stream":[{"clickthrough":"https://adclick.g.doubleclick.net/..."}]}}`，
  即音频/视频广告 pod。脚本在解析失败时直接回 `{"pod":{"stream":[]}}`。
- **`max-size: 0` 不要当"不限"**：5.0 实测大响应仍被截断在 64KB，一律写显式字节数（16MB）。
- **全屏推广弹窗有两个通道**：
  1. `pendragon/…/FetchMessage`：9.1.x 起 CMP（ClientMessagingPlatform）改用
     `com.spotify.pendragon.v1.ClientMessageService` 的 FetchMessage / FetchMessageList /
     FetchMessageForPreview 下发全屏接管页与首页 Premium 横幅（「只需 US$0，即可体验 3 个月」
     即此类）。空 body 等于「没有消息」，已用 Map Local 直接回 0 字节，不跑脚本。
  2. `quicksilver/vN/messages`：老通道，桌面版与部分 iOS 版本仍用（SpotX 里称
     in-app messaging modal）。`spotify-quicksilver-v1.js` 递归清空名为 `messages` 的数组，
     找不到则放行；副作用是公告类 in-app 消息也一并清掉。响应真实结构未证实。
     判断通道是否命中看 logbook：脚本命中会有 `spotify-quicksilver` 的
     「脚本开始执行」记录，没有记录说明该次弹窗不是这个通道下发的。
- **推广与展示广告端点**（均用 Map Local 直接合成，不跑脚本）：
  `premium-marketing/upsellOffer` 回 `{}`；`dac/view/v1/`（展示广告容器，
  搜索页/首页卡片）与 `ad-on-app-open`（开屏）回 0 字节。
  `premium-marketing/upsellOffer` 是推广报价数据，回 `{}` 会连带隐藏 Premium 页的升级卡片；
  这是与 EeveeSpotify 基准一致的取舍：目标是消除推广面，需要订阅时走网页端。
  `trials-facade/start-trial` **不拦**：它只响应用户主动点「开始试用」，
  拦截会破坏正常订阅流程。
- **实现基准**：改 Spotify 模块前先看 `SpotX-Official/SpotX` 与
  `SideloadLabs/EeveeSpotifyReincarnated` 的最新实现，接口、路径、字段名以它们为准。
- **pathfinder 方案不适用当前桌面版**：SpotX 靠拦截 `api-partner.spotify.com/pathfinder`
  删首页 ad-like section。实测本机桌面版点击首页不产生新的 pathfinder 请求
  （日志只有 `home=-1 content=-1` 的其它查询），该脚本永远不会命中，
  且给最繁忙的 GraphQL 主机加 MITM 无收益，已移除。
- **描述只写实际能力**：已处理屏幕广告位、`ad-logic/prefetch`、`pendragon`
  以及 gabo/pam/sponsored 等投递端点的拦截；`capping-api` 未处理。
  音频广告是否被 Premium 属性完全抑制**未实测**，不要当作已知结论。
  `#!desc` / `desc` 不得写「去广告」。
- **排障要点**：覆写是 `#SUBSCRIBED` 订阅源，改 GitHub main 后必须重载才生效；
  重启 App 不会重载，重载动作只在 App 内（菜单栏图标 → 重新加载配置）。
- **已知未解**：桌面版后续 nebula 请求在 proto 日志里不留记录（curl 触发正常），
  UI 表现为 premium 但无法从日志确认每次改写。
- **效果判据**：底部导航的 Premium 入口消失，或窗口标题显示 `Spotify Premium`。
  音质仍无法设为「超高」，这是规则方案的固有限制。

## 小红书专项

移植自 QingRex/LoonKissSurge 的「小红书去广告」模块。伪造响应与搜索页改写已回归到
`url-rewrite` / `body-rewrite`，不再需要自写脚本（Stash 5.0 起覆写内生效）。

- **伪造响应走 `url-rewrite`**：watermark 配置接口用 `reject-img` 回 1×1 GIF
  （`Content-Type: image/gif`），其余 4 组用 `reject-dict` 回 `{}` + `application/json`。
  都不跑脚本。Surge 侧对应 `[Map Local]` 的 `data-type=tiny-gif` / `data-type=text data="{}"`。
- **搜索页推广位走 `body-rewrite`**：banner_list 清 `data`、hot_list 清 `data.items`、
  hint 清 `data.hint_words`、trending 一次清 `data.queries` 与 `data.hint_word`。
  `response-json-replace` 只在当前值不是 false/null 时替换，路径缺失不动，与原脚本一致。
- **主脚本**：RedPaper_remove_ads.js，镜像在 `Repcz/Tool`，锁 commit SHA。
  匹配 12 组端点，覆盖信息流广告、开屏、详情页小部件、图片/视频/实况照片水印。
  MITM 要放开 `ci` / `so` 两个非常用子域，否则 mock 与搜索脚本不触发。
- **QUIC 必须拦**：`AND,((PROTOCOL,QUIC),(DOMAIN-SUFFIX,xiaohongshu.com)),REJECT-DROP`。
- **效果判据**：搜索页无「猜你想搜」和 banner；开屏不出现广告图；保存图片无水印。
- **图标**：simpleicons 的 `xiaohongshu`（红色 #FF2442 字标）。

## 第三方脚本

- Reukix/ukix 的 `Spotify-{proto,home,search,scroll}.js`
- app2smile/rules 的 `spotify-json.js`

一律锁定 commit SHA，避免上游改动导致行为漂移。升级时改 SHA、重载，
确认 `script-logs` 尾部时间戳更新且无 `passthrough` / `timed out`。

## 项目技能

`.claude/skills/proxy-config-authoring`（写/改 Stash 覆写与 Surge 模块，每次动手前先跑
`scripts/check-docs.sh` 核对官方文档）、`.claude/skills/stash-override-debug`（规则或脚本静默失效时排查）。
只在本仓库会话加载。
