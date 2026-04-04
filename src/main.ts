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
