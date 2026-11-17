# Stash 覆写（.stoverride）

来源：https://stash.wiki/configuration/override 、`/http-engine/mitm`、`/http-engine/rewrite`、
`/script/rewrite-requests`、`/script/manage-script`、`/script/syntax-and-interface`、`/rules/rule-types`。
核对日期见 `official-docs.md`。

## 文件骨架

```yaml
#SUBSCRIBED https://raw.githubusercontent.com/<user>/<repo>/main/stash/<模块>/<文件>.stoverride
name: 显示名称
desc: 一句话说明
icon: 'https://raw.githubusercontent.com/<user>/<repo>/main/shared/<模块>/<模块>.png'

rules:
  - AND,((DOMAIN-SUFFIX,example.com),(PROTOCOL,QUIC)),REJECT-DROP

http:
  mitm:
    - 'spclient.wg.example.com'
    - '*spclient.example.com'
  script:
    - match: '^https://…/api/path(?:\?.*)?$'
      name: my-script
      type: response
      require-body: true
      binary-mode: true
      timeout: 30
script-providers:
  my-script:
    url: https://raw.githubusercontent.com/…/my-script.js
    interval: 86400
```

`name` / `desc` / `icon` 只用于展示。`#SUBSCRIBED` 是 Stash 订阅源标记（官方文档未记载，实测有效），
首行写自身 raw 地址；改文件名或路径必须同步改这一行。

## 合并规则（官方）

| 原类型 | 行为 |
|---|---|
| string / number / boolean | 直接覆盖 |
| 字典 | 递归键值合并 |
| 数组 | 覆写数组插入到原数组**前面** |
| 数组 + 键后 `#!append` | 追加到原数组**后面** |
| 任意类型 + 键后 `#!replace` | 完全覆盖 |

数组默认前置，意味着覆写里的规则先于配置文件的规则匹配；但覆写加的代理组也会排最前，
需要排后时用 `#!append`。`#!append` 需要 **Stash 5.0+**（4.x 会忽略该注释，仍插到前面）。
当前版本不支持修改数组中的特定元素。

## Stash 5.0 的覆写能力

来源：`https://releases.stash.ws/appcast.xml` 5.0.0 更新说明（2026-11-14）。**官方 wiki 落后于版本**
（5.0 发布时 wiki 最新仍写 4.2.0），wiki 里没有的内容以 appcast 为准。

| 能力 | 说明 |
|---|---|
| 覆写序列可追加到配置末尾 | `#!append`，见上 |
| 安装覆写前设置参数 | 预览页可先填参数、可「仅安装」不启用；「参数」页签可改，并能预览本覆写合并后的配置 |
| 规则预匹配 | `pre-matching` 旗标，见下 |
| 事件脚本 | 网络变化、引擎启动、配置重载、收到通知时运行脚本 |
| 新建规则可写进覆写 | 从菜单栏/仪表盘建的规则会走正常保存流程，支持 iCloud 配置与覆写里定义的目标 |
| 合并结果校验 | 启用后若合并结果有问题，App 提示「覆写可能无法运行」 |
| 恢复模式 | 恢复会创建新的默认配置并**关闭覆写、MITM、脚本、重写**，修问题时别把「覆写全没了」当成故障 |

## 规则预匹配（pre-matching，Stash 5.0）

广告、统计类域名请求量大、重试快，用 `pre-matching` 把它们提前到连接建立前拒绝，
是 iOS 下省内存和 CPU 最直接的手段。

```yaml
rules:
  - DOMAIN-SUFFIX,ads.example,REJECT,pre-matching
  - RULE-SET,advertising,REJECT-DROP,pre-matching
  - AND,((DOMAIN-KEYWORD,track),(DST-PORT,443)),REJECT,pre-matching
```

- 目标只能是 `REJECT` 或 `REJECT-DROP`，写别的会让配置加载失败。
- 只能用连接建立前就能判断的规则类型：域名类、`GEOSITE`、`IP-CIDR`、`GEOIP`、`IP-ASN`（不触发解析）、
  `DST-PORT`、`SRC-IP`、`SRC-PORT`、`NETWORK`、`RULE-SET`，以及它们的 `AND`/`OR`/`NOT`。
  `PROCESS-NAME`、`PROCESS-PATH`、`USER-AGENT`、`URL-REGEX`、`PROTOCOL`、`SCRIPT` 带该旗标会报错。
- **陷阱**：提前阶段只看带 `pre-matching` 的规则。写在它前面但不带该旗标的规则不构成豁免，
  例如先 `DOMAIN,api.ads.example,DIRECT` 再 `DOMAIN-SUFFIX,ads.example,REJECT,pre-matching`，
  `api.ads.example` 仍会在 DNS 阶段被拒。要豁免就把豁免规则也加上 `pre-matching` 并排在前面。
- 被提前拒绝的请求不进连接列表；核心日志每目标每 5 分钟记一条 `pre-matched`。
  `/rules/match` 返回的 `stage` 字段能看出某目标在哪个阶段被拒。

## 覆写参数（iOS/tvOS 3.7+、macOS 4.4+；5.0 起安装前即可填写）

```yaml
arguments-version: 1
arguments:
  dns_server:
    type: input          # input / select / switch
    title: DNS 地址
    default: https://dns.alidns.com/dns-query
    required: true
dns:
  nameserver: #!replace
    - '${args.dns_server}'
```

- `arguments-version` 固定为 `1`；参数名以字母开头、字母数字下划线、最长 64、区分大小写。
- 值里只有一个 `${args.x}` 时保留原类型（布尔/整数），与文字拼接时变成字符串；`$${…}` 转义。
- 传给脚本要编码成 JSON：`argument: '{"region":${args.region|json}}'`，脚本里 `JSON.parse($argument)`。
- `name` / `desc` / `category` / `icon` 等展示字段不展开引用。

## 图标

`icon:` 键（不是 `#!icon`），值是 raw URL。图标放 `shared/<模块>/`，Stash 与 Surge 共用。

必须做对的两件事：**清晰、居中**。直接 `magick logo.svg -resize 512x512` 会先按 72 DPI
栅格化再放大，出来是糊的；官方 SVG 自带内边距，不裁会偏心。

```bash
magick -background none -density 2400 logo.svg \
  -resize 1024x1024 -trim +repage \
  -resize 944x944 -gravity center -background none -extent 1024x1024 \
  -resize 512x512 -depth 8 icon.png
```

官方 logo 取 simpleicons（`https://cdn.simpleicons.org/<slug>`，返回 SVG），
不要用 Wikimedia 的 thumb 地址（返回 HTML 错误页）。改完图标要重载配置才刷新，
Stash 按 URL 缓存图标，换内容必须换文件名。

## 可用的键

| 键 | 说明 |
|---|---|
| `rules` | 路由规则，数组默认前置，`#!append` 改追加 |
| `http.mitm` | 需要解密的域名；`example.com` 只匹配 443，`example.com:*` 匹配所有端口，`*`/`?` 通配 |
| `http.script` | 脚本挂载：`match` / `name` / `type` / `require-body` / `binary-mode` / `max-size` / `timeout` / `argument` / `engine` |
| `http.force-http-engine` | 强制走 HTTP 引擎的主机，可带端口 |
| `script-providers` | 脚本体来源：`url` / `path` / `payload` / `interval` / `headers` |
| `http.url-rewrite` / `header-rewrite` / `body-rewrite` / `mock` | 官方文档列为配置键，覆写内是否生效见 `verified-vs-docs.md`；先写最小用例验证，不生效就改脚本 |
| `dns.*` / `proxy-groups` / `log-level` / `ipv6` | 可用但少用 |

`http.script` 的 `engine`：`auto`（默认，iOS/macOS 优先 WebKit）、`webkit`、`jsc`。
依赖 `fetch` / `crypto` / `TextEncoder` 的显式写 `webkit`；每次请求都跑、逻辑极简的写 `jsc`。

`script-providers` 三种来源：`url`（定时下载，遵循 Etag/Last-Modified）、
`payload`（脚本内联，仅调试用，拖慢配置解析）、`path`（本地缓存文件，只写 `path` 不写 `url`
则不更新；路径被限制在配置文件所在目录内）。

## 三个必须先处理的坑

1. **QUIC 绕过 MITM**。客户端走 HTTP/3 时完全不经解密，请求列表里连记录都没有。
   ```yaml
   - AND,((DOMAIN-SUFFIX,<注册域>),(PROTOCOL,QUIC)),REJECT-DROP
   ```
   必须写注册域（`example.com`）。收窄成 `spclient.example.com` 会因标签边界
   （`-` 不是 `.`）匹配不到 `guc3-spclient.example.com`，规则静默失效。

2. **MITM 通配符按标签写**。`*spclient.example.com` 能匹配 `guc3-spclient.example.com`；
   `*.example.com` 会把同域所有子域一起解密，增加开销还可能影响别的功能——只列真正要改写的域名。
   裸写 `example.com` 只覆盖 443 端口。

3. **大脚本必须给足 timeout**。内嵌 protobuf/schema 的脚本动辄 400KB，
   默认 10 秒跑不完，报 `script execution timed out`，只写在 `Core/logs/*.log` 里。给 30 秒。

## 配方

### 删请求头（最常见：绕开 304）

服务器命中 ETag 返回 304 时不带 body，response 脚本拿不到数据。request 阶段删条件请求头：

```yaml
- match: '^https://…/api/path(?:\?.*)?$'
  name: strip-conditional
  type: request
  timeout: 5
```

```js
const headers = Object.assign({}, $request.headers || {});
for (const k of Object.keys(headers)) {
  const l = k.toLowerCase();
  if (l === "if-none-match" || l === "if-modified-since") delete headers[k];
}
$done({ headers });
```

### 改响应内容

`type: response` + `require-body: true`；二进制（protobuf 等）再加 `binary-mode: true`。
读 `$response.body`，改完 `$done({ body })`。

### 自己伪造响应（替代 mock）

挂在 `type: request`，match 到直接返回，不再发往服务器。**body 要按接口编码选**：

```js
// JSON 接口：必须给合法 JSON，0 字节会抛 SyntaxError
$done({ response: { status: 200, headers: { "content-type": "application/json",
  "content-length": "2" }, body: "{}" } });

// protobuf 接口：空 body 就是合法的空 message
$done({ response: { status: 200, headers: { "content-length": "0" }, body: "" } });
```

不确定编码时先抓一次真实响应看 `content-type`。

### 拒绝某个域名

`- DOMAIN,telemetry.example.com,REJECT`。断连会让客户端反复重试，非必要不用 `REJECT-DROP`。

## 脚本接口

- `$script.name` / `$script.type` / `$script.startTime`、`$environment["stash-version"]`、`$argument`。
- `$done(value)` 只有第一次生效，必须调用；`$done()` 打断请求，`$done({})` 不改任何内容。
- `$httpClient.get/post/put/delete/head/options/patch`，回调 `(error, response, data)`；
  请求对象支持 `timeout`（默认 5 秒）、`binary-mode`、`insecure`、`auto-cookie`、`auto-redirect`、
  `X-Stash-Selected-Proxy`（值需 `encodeURIComponent`）。
- `$persistentStore.read/write`，value 必须是字符串，省略 key 时用脚本名。
- 定时器：`setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` / `queueMicrotask`，
  脚本结束未触发的定时器会一并取消。

## 发布与同步

- 个人规则放 public 仓库，`stash/<模块>/` 放覆写，脚本与图标放 `shared/<模块>/`。
- Mac 与 iPhone 共用 iCloud 覆写目录，Mac 上改完自动同步到手机，手机不需手动操作
  （只弹一次「配置已更新」）；新建覆写首次仍需在 App 里启用。
- 重载只有 App 内一个入口：菜单栏 Stash 图标 →「重新加载配置」。`⌘R`、重启 App、
  `stash://reload`、控制器 API 都不重载。
- 订阅的「更新」按钮有时拉不到新内容（本地文件 mtime 不变），此时直接改 iCloud 目录下的
  同名文件、只保留一行 `#SUBSCRIBED`，再点「重新加载配置」。
