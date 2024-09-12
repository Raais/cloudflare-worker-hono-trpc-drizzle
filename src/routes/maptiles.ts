import { Hono } from "hono";
import { Buffer } from "node:buffer";

const MAX_HITS = 500; // 200,000
const PREFIX = "_tiles";
const prefix = (key: string) => `${PREFIX}:${key}`;

const tiles = new Hono<{
  Bindings: {
    KV: KVNamespace;
    TILES: KVNamespace;
    MAP_API_KEYNAME: string;
    MAP_API_KEY: string;
  };
}>();

tiles.get("/", (c) => c.text("Dev map tiles proxy API.", 200));

// http://localhost:8787/map/tiles/static/{z}/{x}/{y}
// https://cfw.raa.is/map/tiles/static/{z}/{x}/{y}

tiles.get("/static/:z/:x/:y", async (c) => {

  const KEYNAME = c.env.MAP_API_KEYNAME;
  const KEY = c.env.MAP_API_KEY;

  const z = c.req.param("z");
  const x = c.req.param("x");
  const y = c.req.param("y");

  const cacheKey = `cfwtiles:${z}:${x}:${y}`;

  const cached = await c.env.TILES.get(cacheKey);

  if (cached) {
    const res = JSON.parse(cached);
    
    let headers = res.headers;
    headers["cfw-cached"] = "true";

    const options = {
      headers: headers,
      status: 200,
      statusText: "OK",
      ok: true,
      redirected: false,
      webSocket: null,
    };

    return new Response(Buffer.from(res.bytes, "base64"), options);
  }

  const hits = await c.env.KV.get(prefix(KEYNAME));
  if (hits) {
    const current = parseInt(hits);
    if (current >= MAX_HITS) {
        //   return c.text("Too many requests.", 429);
        // fallback
        const carto = await fetch(`https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/${z}/${x}/${y}.png`);
        return new Response(carto.body, carto);
    } else {
      const newHits = current + 1;
      await c.env.KV.put(prefix(KEYNAME), newHits.toString());
    }
  } else {
    await c.env.KV.put(prefix(KEYNAME), "1");
  }

  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/${z}/${x}/${y}?access_token=${KEY}`;

  const res = await fetch(url);

  if (res.status == 200) {
    const uint8 = await res.bytes();
    const bytes = Buffer.from(uint8).toString("base64");
    let headers: any = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    if (hits) headers["cfw-hits"] = hits;

    const serialize = {
      headers: headers,
      bytes: bytes,
    };

    await c.env.TILES.put(cacheKey, JSON.stringify(serialize), {
      expirationTtl: 24 * 60 * 60 * 5, // 5 days
    });

    const options = {
      headers: headers,
      status: 200,
      statusText: "OK",
      ok: true,
      redirected: false,
      webSocket: null,
    };

    return new Response(Buffer.from(bytes, "base64"), options);
  } else {
    return c.text(`Error`, 400);
  }
});

export { tiles };
