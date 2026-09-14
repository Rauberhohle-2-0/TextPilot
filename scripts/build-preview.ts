/**
 * Dev helper: build `preview.html` with the renderer bundle inlined,
 * plus a fetch stub so the editor loads without the API server.
 * Used to inspect the real UI in the preview tab.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

function asset(ext: "js" | "css"): string {
  const name = readdirSync("dist/renderer/assets").find((f) => f.endsWith(`.${ext}`));
  if (!name) throw new Error(`no .${ext} asset in dist/renderer/assets`);
  return name;
}

let html = readFileSync("dist/renderer/index.html", "utf8");
const js = readFileSync(`dist/renderer/assets/${asset("js")}`, "utf8");
const css = readFileSync(`dist/renderer/assets/${asset("css")}`, "utf8");

const script = `<script type="module">
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.endsWith("/api/note")) {
    const body = { text: "# Welcome\\n\\nThis is **markdown** with *formatting*.\\n\\n- one\\n- two", updatedAt: new Date().toISOString() };
    if (init?.method === "PUT") return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }
  return Promise.reject(new Error("offline preview: " + url));
};
${js.replaceAll("</script", "<\\/script")}
</script>`;

html = html
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, () => script)
  .replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);

writeFileSync("preview.html", html);
console.log(`preview.html written (${html.length} bytes)`);
