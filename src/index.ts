import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./router";
import { renderTrpcPanel } from "@metamorph/trpc-panel";
import { createTRPCHonoContext } from "./lib/context";
import { getDrizzle } from "./lib/db";

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

app.get("/", (c) => c.text("Hello from Cloudflare Worker!"));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_c, c) => createTRPCHonoContext(_c, c, getDrizzle(c)),
  })
);

app.get("/panel", (c: any) => {
  const url =
    c.env.ENVIRONMENT === "production"
      ? c.env.TRPC_URL
      : "http://localhost:8787/trpc";
  return c.html(renderTrpcPanel(appRouter, { url }));
});

export default app;
