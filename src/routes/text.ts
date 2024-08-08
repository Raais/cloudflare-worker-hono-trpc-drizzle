import { Hono } from "hono";

const PREFIX = "_txt";
const prefix = (key: string) => `${PREFIX}:${key}`;

const text = new Hono<{
  Bindings: {
    KV: KVNamespace;
  };
}>();

text.get("/", (c) => c.text("Created notes will expire after 10 minutes.", 200));

text.all("/new", async (c) => {
    if (c.req.method !== "POST") return c.text(`POST "text" & "path"`, 400);
    
    const url = new URL(c.req.url);
    const formData = await c.req.formData();
    const text = formData.get("text");
    let path = formData.get("path");

    if (!text || !path) return c.text(`POST "text" & "path"`, 400);

    let ttl = 10 * 60; // 10 minutes

    if (path.startsWith("/__")) {
        path = path.replace("/__", "/");
        ttl = 86400; // 1 day
    }

    await c.env.KV.put(prefix(path), text, { expirationTtl: ttl });

    const urlPath = `https://${url.hostname}/txt${path}`;
    const createdLink = `
          <html>
            <body>
            <p>Your note has been created: </p>
            <a href="${urlPath}">${urlPath}</a>
            </body>
          </html>
        `;
    
    return c.html(createdLink);
});

text.get("*", async (c) => {
    if (c.req.path === "/txt/") return c.redirect("/txt", 301);

    const path = c.req.path.slice(4); // /txt

    const text = await c.env.KV.get(prefix(path));

    if (text) {
        return c.text(text, 200);
    } else {
        const htmlResponse = `
          <html>
          <body>
            <form action="/txt/new" method="POST">
            <input type="hidden" name="path" value="${path}">
            <textarea id="text" name="text" required></textarea>
            <input type="submit" value="Create">
            </form>
          </body>
        </html>
        `;

        return c.html(htmlResponse);
    }
});

export { text };