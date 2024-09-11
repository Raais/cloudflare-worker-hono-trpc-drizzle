import dayjs from "dayjs";
import { Hono } from "hono";

const PREFIX = "_notes";
const prefix = (key: string) => `${PREFIX}:${key}`;

const notes = new Hono<{
  Bindings: {
    KV: KVNamespace;
  };
}>();

notes.get("/", (c) => c.text("Private note cloud.", 200));

notes.get("/get", async (c: any) => {
  const key = c.req.header("cfw-api-key");
  if (!key) return c.text(`Invalid API key.`, 400);
  if (key !== c.env.CFW_API_KEY) return c.text(`Invalid API key.`, 400);

  const list = await c.env.KV.list({ prefix: PREFIX });
  const keys = list.keys.map((key: any) => {
    const d = dayjs.unix(parseInt(key.name.split(":")[1]));
    return {
      title: d.format("ddd DD MMM HH:mm A"),
      subtitle: d.fromNow(),
      arg: key.name,
    };
  });
  return c.json(keys);
});

notes.post("/fetch", async (c) => {
    const body = await c.req.text();
    if (!body.startsWith(PREFIX)) return c.text(`Invalid key.`, 400);

    const item = await c.env.KV.get(body);
    if (!item) return c.text(`Invalid key.`, 400);
    await c.env.KV.delete(body);

    return c.text(item);
});

notes.all("/push", async (c: any) => {
  if (c.req.method !== "POST") return c.text(`POST "body"`, 400);

  const body = await c.req.text();
  if (!body) return c.text(`POST "body"`, 400);

  const key = c.req.header("cfw-api-key");
  if (!key) return c.text(`Invalid API key.`, 400);
  if (key !== c.env.CFW_API_KEY) return c.text(`Invalid API key.`, 400);

  const timestamp = dayjs().unix();

  await c.env.KV.put(prefix(timestamp.toString()), body);

  return c.text("ok");
});

export { notes };
