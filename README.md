# proxy-modules

个人代理模块合集：Stash 覆写与 Surge 模块共用同一套 JS 脚本，通过 raw URL 订阅，改完 push 即生效。

## 模块列表

| 模块 | Stash | Surge |
|---|---|---|
| Spotify 解锁 | `https://raw.githubusercontent.com/MaxMaoSu/proxy-modules/main/stash/spotify/Spotify.stoverride` | `https://raw.githubusercontent.com/MaxMaoSu/proxy-modules/main/surge/spotify/Spotify.sgmodule` |
| 小红书去广告 | `https://raw.githubusercontent.com/MaxMaoSu/proxy-modules/main/stash/xiaohongshu/Xiaohongshu.stoverride` | 无 |

## 目录约定

```
proxy-modules/
├── shared/<模块>/     客户端无关的 JS 脚本与图标
├── stash/<模块>/      .stoverride（Stash）
└── surge/<模块>/      .sgmodule（Surge）
```

维护约定与技术细节见 [CLAUDE.md](CLAUDE.md)。
