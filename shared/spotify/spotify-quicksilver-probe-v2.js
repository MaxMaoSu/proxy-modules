// 临时只读诊断：记录 quicksilver 消息接口的响应结构，用于确定全屏推广弹窗的字段位置。
// 定位后删除，改为正式过滤脚本。

(() => {
  const TAG = "qs-probe v2";
  const SINK = "http://10.0.0.2:8765/log";
  let note = "";

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
    return null;
  }

  try {
    const text = toText($response.body);
    if (text === null) {
      note = "no body, status=" + $response.status;
    } else {
      const data = JSON.parse(text);
      const keys = data && typeof data === "object" ? Object.keys(data) : [];
      let shape = "";
      for (const k of keys) {
        const v = data[k];
        if (Array.isArray(v)) shape += k + "[]=" + v.length + ";";
        else if (v && typeof v === "object") {
          const inner = Object.keys(v).map((ik) => ik + (Array.isArray(v[ik]) ? "[]=" + v[ik].length : ""));
          shape += k + "{" + inner.join(",") + "};";
        }
      }
      const head = text.slice(0, 400).replace(/\s+/g, " ");
      note = "len=" + text.length + " top=" + keys.join(",") + " shape=" + shape + " head=" + head;
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  const line = TAG + " " + note + " url=" + String(($request && $request.url) || "");
  console.log(line);
  $httpClient.post({ url: SINK, headers: { "content-type": "text/plain" }, body: line }, () => $done({}));
})();
