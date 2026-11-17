#!/usr/bin/env bash
# 抓取 Stash / Surge 官方文档并比对摘要，判断是否更新过。
# 用法：check-docs.sh [--update]
# 退出码：0 全部未变；1 有新增/变更/抓取失败
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIGEST="$HERE/references/doc-digest.txt"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PAGES=(
  https://manual.nssurge.com/profile/module.html
  https://manual.nssurge.com/profile/format.html
  https://manual.nssurge.com/scripting/overview.html
  https://manual.nssurge.com/scripting/http-request.html
  https://manual.nssurge.com/scripting/http-response.html
  https://manual.nssurge.com/http/mitm.html
  https://manual.nssurge.com/http/url-rewrite.html
  https://manual.nssurge.com/http/header-rewrite.html
  https://manual.nssurge.com/http/body-rewrite.html
  https://manual.nssurge.com/http/map-local.html
  https://manual.nssurge.com/rules/overview.html
  https://manual.nssurge.com/rules/logical.html
  https://manual.nssurge.com/policies/reject.html
  https://stash.wiki/configuration/override
  https://stash.wiki/http-engine/mitm
  https://stash.wiki/http-engine/rewrite
  https://stash.wiki/script/rewrite-requests
  https://stash.wiki/script/manage-script
  https://stash.wiki/script/syntax-and-interface
  https://stash.wiki/rules/rule-types
  https://stash.wiki/release-notes/macos
  https://stash.wiki/release-notes/ios
  https://releases.stash.ws/appcast.xml
)

update=0
[ "${1:-}" = "--update" ] && update=1

status=0
newdigest=""
for url in "${PAGES[@]}"; do
  file="$TMP/$(printf '%s' "$url" | sed 's#https://##; s#[/?&=]#_#g')"
  if ! curl -fsSL --max-time 30 -A 'Mozilla/5.0' "$url" -o "$file"; then
    echo "FAIL     $url"
    status=1
    continue
  fi
  # Cloudflare Rocket Loader 每次请求注入随机 nonce（script type 与 data-cf-settings），先归一化再算摘要
  sum="$(sed -E \
      -e 's/type="[0-9a-f]+-text\/javascript"/type="text\/javascript"/g' \
      -e 's/data-cf-settings="[0-9a-f]+-/data-cf-settings="NONCE-/g' \
      "$file" | shasum -a 256 | cut -d' ' -f1)"
  old="$(awk -v u="$url" '$2==u {print $1}' "$DIGEST" 2>/dev/null || true)"
  if [ -z "$old" ]; then
    echo "NEW      $url"
    status=1
  elif [ "$old" != "$sum" ]; then
    echo "CHANGED  $url"
    status=1
  else
    echo "OK       $url"
  fi
  newdigest+="$sum $url"$'\n'
done

if [ "$update" = 1 ]; then
  printf '%s' "$newdigest" > "$DIGEST"
  echo "摘要已更新：$DIGEST"
fi

exit "$status"
