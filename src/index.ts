import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./router";
import { renderTrpcPanel } from "@metamorph/trpc-panel";
import { createTRPCHonoContext } from "./lib/context";
import { dts, mjs } from "../export/dist/strings";
import { clerkMiddleware } from '@hono/clerk-auth';
import { getDrizzle } from "./lib/db";
import { links } from "./routes/links";
import { text } from "./routes/text";
import { utils } from "./routes/utils";
import { notes } from "./routes/notes";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const app = new Hono<{
  Bindings: {
    KV: KVNamespace;
  };
}>();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use("*", (c: any, next) =>
  clerkMiddleware({
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
    secretKey: c.env.CLERK_SECRET_KEY,
  })(c, next)
);

/* REST API */
app.get("/", (c) => c.text("Hello from Cloudflare Worker!"));
app.route("/go", links);
app.route("/txt", text);
app.route("/utils", utils);
app.route("/notes", notes);

/* TRPC */
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_c, c) => createTRPCHonoContext(_c, c, getDrizzle(c)),
  })
);

/* Used by client - development */
app.get('/trpci', async (c) => {
  return c.json({ dts: dts, mjs: mjs });
});

/* Optional */
app.get("/panel", (c: any) => {
  const url =
    c.env.ENVIRONMENT === "production"
      ? c.env.TRPC_URL
      : "http://localhost:8787/trpc";
  return c.html(renderTrpcPanel(appRouter, { url }));
});

export default app;
