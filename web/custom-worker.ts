// Custom Cloudflare Worker entry — wraps the OpenNext-generated handler and
// adds a scheduled (cron) handler that drives the app's job scheduler.

// @ts-expect-error generated at build time
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      handler.fetch(
        new Request("https://cron.internal/api/cron", {
          method: "POST",
          headers: { authorization: `Bearer ${(env as unknown as { CRON_SECRET: string }).CRON_SECRET}` },
        }),
        env,
        ctx
      )
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;

// @ts-expect-error generated at build time
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
