// 广告投递接口统一清理（response 阶段，结构化处理，不伪造错误响应）。
//
// 处理的接口与结构：
//   GET /ads/v3/ads?slots=hpto      → {"pod":{"hpto":[{id,clickthrough,...}]}}
//   GET /ad-logic/prefetch          → {"pod":{"stream":[...]}}   (实测)
//   GET /pendragon/.../FetchMessageList → 消息数组               (按 messages 兜底，未抓包确认)
// 共同点：广告素材都放在 `pod` 下的 slot 数组里。清空数组、保留结构，
// 客户端拿到的是「这一屏没有广告」，不是错误响应，因此不会触发重试或异常分支。
//
// 其它广告端点由 spotify-adblock 在 request 阶段返回空响应：
//   gabo-receiver-service、pam-view-service、sponsoredplaylist、
//   ad-logic/vN/config（protobuf）
// ads/vN/config 不拦：实测回 {} 会让桌面版首页报「出错了」。
// capping-api 属于频次控制，拦了去不掉广告，不处理。
//
// prefetch 解析失败回空 stream；其余解析失败原样放行，原因写进 script-logs/spotify-adclean.log。

(() => {
  const TAG = "adclean v3";

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
    if (Array.isArray(body)) return new TextDecoder().decode(new Uint8Array(body));
    throw new Error("unsupported body type: " + typeof body);
  }

  // 清空对象里所有「数组值」的字段，返回清掉的条数；非数组字段保持不动。
  function clearArrays(obj, label, detail) {
    let removed = 0;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (!Array.isArray(value)) continue;
      if (value.length) {
        detail.push(label + "." + key + ":" + value.length);
        removed += value.length;
      }
      obj[key] = [];
    }
    return removed;
  }

  const url = $request.url || "";
  let raw = "";
  const status = $response.status;
  let out = null;
  let note = "";

  try {
    if (status !== undefined && Number(status) !== 200) {
      note = "status " + status + ", passthrough";
    } else {
      raw = toText($response.body);
      const data = JSON.parse(raw);
      const detail = [];
      let removed = 0;

      if (data && typeof data === "object" && data.pod && typeof data.pod === "object") {
        removed += clearArrays(data.pod, "pod", detail);
      }
      // 少数接口直接以数组返回广告列表
      if (Array.isArray(data)) {
        if (data.length) detail.push("root:" + data.length);
        removed += data.length;
        data.length = 0;
      }
      // pendragon 之类把消息放在 messages 里
      if (data && typeof data === "object" && Array.isArray(data.messages)) {
        if (data.messages.length) detail.push("messages:" + data.messages.length);
        removed += data.messages.length;
        data.messages = [];
      }

      note = (removed ? "removed=" + removed + " " : "clean ") + detail.join(",");
      if (removed) out = { body: JSON.stringify(data) };
    }
  } catch (e) {
    // ad-logic/prefetch 的响应固定超过 64KB（实测 len=65534/65536 被硬截断），
    // 完整 JSON 拿不到，但头部已确认是 {"pod":{"stream":[...]}}。
    // 直接回一个空 stream，等于这一轮没有可投的广告。
    if (url.indexOf("ad-logic/prefetch") >= 0) {
      out = { body: '{"pod":{"stream":[]}}' };
      note = "prefetch forced empty pod len=" + (raw ? raw.length : -1);
    } else {
      const head = raw ? raw.slice(0, 120).replace(/[\x00-\x1f]/g, ".") : "";
      note = "error " + (e && e.message ? e.message : String(e)) +
        " len=" + (raw ? raw.length : -1) + " head=" + head;
    }
  }

  console.log(TAG + " " + note + " url=" + url);
  $done(out ? { body: out.body } : {});
})();
