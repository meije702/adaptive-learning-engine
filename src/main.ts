import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { loadConfig } from "./config/loader.ts";
import { getKv } from "./db/kv.ts";
import { createRepositories } from "./db/factory.ts";
import { seedDomains } from "./db/seed.ts";
import { log } from "./obs/logger.ts";
import { newCorrelationId, withCorrelationId } from "./obs/correlation.ts";

const config = await loadConfig();
const kv = await getKv();
const repos = createRepositories(kv, config.system);

await seedDomains(kv, config.curriculum, config.system);

export const app = new App<State>();

app.use(staticFiles());

// Auth middleware for API routes
app.use((ctx) => {
  if (
    ctx.url.pathname.startsWith("/api/") &&
    config.system.auth.type === "bearer"
  ) {
    const token = ctx.req.headers.get("Authorization")?.replace("Bearer ", "");
    const expected = Deno.env.get("ALE_AUTH_TOKEN");
    if (expected && token !== expected) {
      return new Response(
        JSON.stringify({
          type: "https://learning.app/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/problem+json" },
        },
      );
    }
  }
  return ctx.next();
});

app.use((ctx) => {
  ctx.state.config = config;
  ctx.state.repos = repos;
  return ctx.next();
});

const loggerMiddleware = define.middleware(async (ctx) => {
  const correlationId = newCorrelationId();
  const started = performance.now();
  return await withCorrelationId(correlationId, async () => {
    const response = await ctx.next();
    log.info("http", {
      method: ctx.req.method,
      url: ctx.url.pathname + ctx.url.search,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
    return response;
  });
});
app.use(loggerMiddleware);

app.fsRoutes();
