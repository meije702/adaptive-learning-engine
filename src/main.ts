import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { loadConfig } from "./config/loader.ts";
import { getKv } from "./db/kv.ts";
import { createRepositories } from "./db/factory.ts";
import { seedDomains } from "./db/seed.ts";

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

const loggerMiddleware = define.middleware((ctx) => {
    console.log(`${ctx.req.method} ${ctx.req.url}`);
    return ctx.next();
});
app.use(loggerMiddleware);

app.fsRoutes();
