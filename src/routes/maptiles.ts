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
  { latitude: 4.196813177657901, longitude: 73.54277870432617 },
  { latitude: 4.215803368185959, longitude: 73.54862589056742 },
  { latitude: 4.239804064084623, longitude: 73.55562518327312 },
  { latitude: 4.243724427459853, longitude: 73.55078317993267 },
  { latitude: 4.241429611682747, longitude: 73.53951718062171 },
  { latitude: 4.235644661082858, longitude: 73.53707220863734 },
  { latitude: 4.220154193371471, longitude: 73.5306002295433 },
  { latitude: 4.218820738055996, longitude: 73.5341273522975 },
  { latitude: 4.207605889267228, longitude: 73.53344980817062 },
  { latitude: 4.198305009527061, longitude: 73.5381356627768 },
  { latitude: 4.196813177657901, longitude: 73.54277870432617 },
];

const BOUNDS_GULHIFALHU_THILAFUSHI = [
  { latitude: 4.189499814904821, longitude: 73.46923237700565 },
  { latitude: 4.1868001172472304, longitude: 73.45368748137071 },
  { latitude: 4.193380496508894, longitude: 73.41342918256527 },
  { latitude: 4.182113107828101, longitude: 73.4030222569042 },
  { latitude: 4.177158563626861, longitude: 73.44262809799508 },
  { latitude: 4.169599586624358, longitude: 73.479982406999 },
  { latitude: 4.177158647544331, longitude: 73.48021442203509 },
  { latitude: 4.187185860839648, longitude: 73.47387267772257 },
  { latitude: 4.189499814904821, longitude: 73.46923237700565 },
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
