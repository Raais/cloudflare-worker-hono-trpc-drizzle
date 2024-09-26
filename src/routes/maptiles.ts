import { Hono } from "hono";
import { Buffer } from "node:buffer";
import { isPointInPolygon } from "geolib";

const MAX_HITS = 500; // 200,000
const PREFIX = "_tiles";
const prefix = (key: string) => `${PREFIX}:${key}`;

const ALLOWED_BOUNDS_GREATER_MALE = [
  { latitude: 5.27402109359528, longitude: 71.66117980975153 },
  { latitude: 5.3420912644821215, longitude: 74.99286272485952 },
  { latitude: 3.3789574137604745, longitude: 75.01565127022587 },
  { latitude: 3.2333535062166447, longitude: 71.61560030165396 },
];

const BOUNDS_HULHUMALE = [
  { latitude: 4.242483692401549, longitude: 73.52426202683628 },
  { latitude: 4.216954355962557, longitude: 73.52430550191599 },
  { latitude: 4.216799192571202, longitude: 73.5328304070893 },
  { latitude: 4.198203976604418, longitude: 73.53311343737488 },
  { latitude: 4.198486203159462, longitude: 73.56116083722304 },
  { latitude: 4.2458637906497785, longitude: 73.56269333634052 },
  { latitude: 4.242483692401549, longitude: 73.52426202683628 },
];

const BOUNDS_GULHIFALHU_THILAFUSHI = [
  { latitude: 4.197746105416513, longitude: 73.48146846876966 },
  { latitude: 4.20709925662365, longitude: 73.41879306225107 },
  { latitude: 4.1612903473804295, longitude: 73.390648862539 },
  { latitude: 4.15971834716602, longitude: 73.48194863756183 },
  { latitude: 4.197746105416513, longitude: 73.48146846876966 },
];

const tiles = new Hono<{
  Bindings: {
    KV: KVNamespace;
    TILES: KVNamespace;
    MAP_API_KEYNAME: string;
    MAP_API_KEY: string;
    CFW_RATE_LIMITER: any;
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

  const ARCGIS_URL = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const CARTO_URL = `https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/${z}/${x}/${y}.png`;

  // const { success } = await c.env.CFW_RATE_LIMITER.limit({ key: KEYNAME });
  // if (!success) {
  //   return c.text(`Error`, 400);
  // }

  function tile2long(x: number, z: number) {
    return (x / Math.pow(2, z)) * 360 - 180;
  }
  function tile2lat(y: number, z: number) {
    var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  const lat = tile2lat(parseInt(y), parseInt(z));
  const long = tile2long(parseInt(x), parseInt(z));

  if (!isPointInPolygon({ latitude: lat, longitude: long }, ALLOWED_BOUNDS_GREATER_MALE)) {
    return c.text(`Error`, 400);
  }

  if (
    isPointInPolygon({ latitude: lat, longitude: long }, BOUNDS_HULHUMALE) ||
    isPointInPolygon(
      { latitude: lat, longitude: long },
      BOUNDS_GULHIFALHU_THILAFUSHI
    )
  ) {
    const arcgis = await fetch(ARCGIS_URL);
    return new Response(arcgis.body, arcgis);
  }

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
      return c.text(`Error`, 400);
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
      expirationTtl: 24 * 60 * 60 * 1, // 1 days
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
