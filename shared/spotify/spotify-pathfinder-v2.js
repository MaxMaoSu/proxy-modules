// 过滤桌面版首页的 GraphQL 数据（api-partner.spotify.com/pathfinder）。
//
// 首页除了 `ads/v3/ads` 的广告位，还有一类「像广告的版块」：全宽画布视频、
// 品牌推广 section。它们不在 ads 接口里，而是随 pathfinder 的 JSON 下发。
//
// 只有一条规则有上游依据：__typename === 'HomeFeedBaselineSectionData'（全宽画布版块），
// 与 SpotX 的 js-helper/sectionBlock.js 一致（它还按固定 section ID 黑名单删推广版块、
// 按 BLOCKED_CONTENT_TYPES 删播客/有声书，本脚本不复刻那两份业务清单）。
// 另外两条是本仓库的启发式，尚未在真实响应里验证：
//   - __typename 命中 AdsSection / AdSlot / AdBreak 等广告类型
//   - uri / id 以 |brand-ad（iPhone casita 实测过）、|sponsored、|canvas 结尾
// 任何解析失败或结构不认识都原样放行，并把原因写进日志。

(() => {
  const TAG = "pathfinder v1";
  // 不用裸 /Ad/：HomeFeedAddSectionData、HomeFeedAdaptiveSectionData 会被误伤。
  const AD_TYPENAME = /Ads?(?:Section|Slot|Break|Element|Card|Unit|Impression)/;
  const AD_URI = /\|(brand-ad|sponsored|canvas)$/i;

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
    if (Array.isArray(body)) return new TextDecoder().decode(new Uint8Array(body));
    throw new Error("unsupported body type: " + typeof body);
  }

  function shouldDrop(item) {
    const typename = item && item.data && item.data.__typename;
    if (typename === "HomeFeedBaselineSectionData") return "canvas";
    if (typeof typename === "string" && AD_TYPENAME.test(typename)) return "typename:" + typename;
    const uri = (item && (item.uri || item.id)) || "";
    if (typeof uri === "string" && AD_URI.test(uri)) return "uri:" + uri.slice(-40);
    return null;
  }

  function filterList(list, removed) {
    for (let i = list.length - 1; i >= 0; i--) {
      const reason = shouldDrop(list[i]);
      if (reason) {
        removed.push(reason);
        list.splice(i, 1);
      }
    }
  }

  let out = null;
  let note = "";
  try {
    if ($response.status !== undefined && Number($response.status) !== 200) {
      note = "status " + $response.status + ", passthrough";
    } else {
      const data = JSON.parse(toText($response.body));
      const removed = [];
      const op = ($request.url.match(/[?&]operationName=([^&]+)/) || [])[1] || "-";
      const home = data && data.data && data.data.home;
      const sections = home && home.sectionContainer && home.sectionContainer.sections;
      if (sections && Array.isArray(sections.items)) {
        filterList(sections.items, removed);
        // 删完同步分页计数，避免客户端按总数多拉一次空页
        if (removed.length && typeof sections.totalCount === "number") {
          sections.totalCount = sections.items.length;
        }
      }
      const content = data && data.data && data.data.content;
      if (content && Array.isArray(content.items)) filterList(content.items, removed);

      if (removed.length) out = { body: JSON.stringify(data) };
      const homeItems = sections && sections.items ? sections.items.length : -1;
      const contentItems = content && content.items ? content.items.length : -1;
      note = "op=" + op + " home=" + homeItems + " content=" + contentItems +
        " removed=" + removed.length + (removed.length ? " " + removed.slice(0, 5).join(",") : "");
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  console.log(TAG + " " + note + " url=" + $request.url);
  $done(out ? { body: out.body } : {});
})();
