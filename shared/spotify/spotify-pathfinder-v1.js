// 过滤桌面版首页的 GraphQL 数据（api-partner.spotify.com/pathfinder）。
//
// 首页除了 `ads/v3/ads` 的广告位，还有一类「像广告的版块」：全宽画布视频、
// 品牌推广 section。它们不在 ads 接口里，而是随 pathfinder 的 JSON 下发
// （参考 SpotX 的 sectionBlock：api-partner.spotify.com/pathfinder 和
//  api.spotify.com/v1/views/personalized-recommendations）。
//
// 判定只认三种确定信号，命中才删：
//   1. section 的 __typename 是 HomeFeedBaselineSectionData（全宽画布版块）
//   2. __typename 里带 Ad（AdsSection / AdSlotSection 等）
//   3. uri / id 以 |brand-ad、|sponsored、|canvas 结尾
// 任何解析失败或结构不认识都原样放行，并把原因写进日志。

(() => {
  const TAG = "pathfinder v1";
  const AD_TYPENAME = /Ad/;
  const AD_URI = /\|(brand-ad|sponsored|canvas)$/i;

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
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
      const home = data && data.data && data.data.home;
      const sections = home && home.sectionContainer && home.sectionContainer.sections;
      if (sections && Array.isArray(sections.items)) filterList(sections.items, removed);
      const content = data && data.data && data.data.content;
      if (content && Array.isArray(content.items)) filterList(content.items, removed);

      if (removed.length) out = { body: JSON.stringify(data) };
      note = "removed=" + removed.length + (removed.length ? " " + removed.slice(0, 5).join(",") : "");
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  console.log(TAG + " " + note + " url=" + $request.url);
  $done(out ? { body: out.body } : {});
})();
