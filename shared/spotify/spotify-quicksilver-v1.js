// 清空 quicksilver 消息：Spotify 用它下发 in-app 弹窗（App 启动/首页触发的全屏推广、
// Premium 试用促销等）。这些弹窗低概率触发，无法随时复现，所以按结构特征处理：
// 递归查找名为 messages 的数组（含 data.messages 这类包装），清空后返回原文其余部分。
//
// 找不到 messages 数组、非 200、非 JSON、解析异常时一律原样放行，
// 并把过程写进 script-logs/spotify-quicksilver.log，便于下次弹窗出现后核对。

(() => {
  const TAG = "quicksilver v1";
  const MAX_DEPTH = 4;
  let cleared = 0;
  let touched = [];

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
    if (Array.isArray(body)) return new TextDecoder().decode(new Uint8Array(body));
    return null;
  }

  function clearMessages(node, path, depth) {
    if (!node || typeof node !== "object" || depth > MAX_DEPTH) return;
    if (Array.isArray(node)) {
      for (const item of node) clearMessages(item, path, depth + 1);
      return;
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      const here = path ? path + "." + key : key;
      if (key === "messages" && Array.isArray(value)) {
        if (value.length) {
          cleared += value.length;
          touched.push(here + ":" + value.length);
        }
        node[key] = [];
        continue;
      }
      clearMessages(value, here, depth + 1);
    }
  }

  let out = null;
  let note = "";
  try {
    if ($response.status !== undefined && Number($response.status) !== 200) {
      note = "status " + $response.status + ", passthrough";
    } else {
      const text = toText($response.body);
      if (text === null) {
        note = "unsupported body type: " + typeof $response.body;
      } else {
        const data = JSON.parse(text);
        clearMessages(data, "", 0);
        if (cleared) out = { body: JSON.stringify(data) };
        note = "cleared=" + cleared + (touched.length ? " " + touched.slice(0, 3).join(",") : "");
      }
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  console.log(TAG + " " + note + " url=" + String(($request && $request.url) || ""));
  $done(out ? { body: out.body } : {});
})();
