import { Hono } from "hono";

const PREFIX = "_links";
const prefix = (key: string) => `${PREFIX}:${key}`;

const links = new Hono<{
  Bindings: {
    KV: KVNamespace;
  };
}>();

links.get("/", (c) => c.text("Created links will expire after 10 minutes.", 200));

links.all("/new", async (c) => {
    if (c.req.method !== "POST") return c.text(`POST "link" & "path"`, 400);
    
    const url = new URL(c.req.url);
    const formData = await c.req.formData();
    const link = formData.get("link");
    let path = formData.get("path");

    if (!link || !path) return c.text(`POST "link" & "path"`, 400);

    let ttl = 10 * 60; // 10 minutes

    if (path.startsWith("/__")) {
        path = path.replace("/__", "/");
        ttl = 86400; // 1 day
    }

    await c.env.KV.put(prefix(path), link, { expirationTtl: ttl });

    const urlPath = `https://${url.hostname}/go${path}`;
    const createdLink = `
          <html>
            <body>
            <a href="${urlPath}">${urlPath}</a>
            </body>
          </html>
        `;
    
    return c.html(createdLink);
});

links.get("*", async (c) => {
    if (c.req.path === "/go/") return c.redirect("/go", 301);

    const path = c.req.path.slice(3); // /go

    const redirect = await c.env.KV.get(prefix(path));

    if (redirect) {
        return c.redirect(decodeURIComponent(redirect), 301);
    } else {
        const htmlResponse = `
          <html>
            <body>
              <form action="/go/new" method="POST">
                <input type="url" id="link" name="link" required>
                <input type="hidden" name="path" value="${path}">
                <input type="submit" value="Create">
              </form>
            </body>
          </html>
        `;

        return c.html(htmlResponse);
    }
});

export { links };