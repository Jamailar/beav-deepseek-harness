# Beav for DeepSeek Harness

The native DeepSeek Harness connector for Beav. It exposes Beav workspaces, projects, durable creator tasks, and verified artifacts through Cordis services, Harness tools, background jobs, slash commands, session events, and Web client contributions. It does not use MCP.

## Install

Requirements:

- Beav 2.7.3 or later
- DeepSeek Harness `0.1.0-rc.6`
- Node.js 22 or later

Install into a Harness profile:

```bash
dsh plugin --profile web add beav-deepseek-harness
```

Start that profile, open **Settings → Plugins → Beav**, and paste a Creator Gateway token created in Beav. Harness stores the token through its credentials provider under `BEAV_CREATOR_TOKEN`; this plugin never returns it to the browser after the write, adds it to a session event, or includes it in a tool result.

If Beav is not running, an operation that needs it opens `beav://open` once and performs a bounded health retry. You can override the local endpoint or credential reference in the profile patch:

```yaml
- update:
    id: beav
    config:
      endpoint: http://127.0.0.1:41700
      tokenRef: BEAV_CREATOR_TOKEN
      autoLaunch: on-demand
      requestTimeoutMs: 30000
```

Only loopback HTTP endpoints are accepted.

## Use

- Ask naturally: “Use Beav to turn the latest knowledge in my launch workspace into an article, cover images, and a 60-second video.”
- Type `@beav` to select a stable workspace or project reference.
- Use `/beav status`, `/beav open`, `/beav workspaces`, `/beav new`, `/beav import`, or `/beav save` for direct actions without a model turn.
- Long-running work appears as a native Harness job and a replayable Beav task card.
- Completion is accepted only after Beav reports durable artifact read-back verification and each returned artifact can be read back through the Creator Gateway.

Beav retains ownership of AI orchestration, knowledge access, media generation, approvals, billing, persistence, and artifact verification. The connector cannot auto-approve paid or destructive actions.

## Trust and privacy

This package runs as trusted local Host code. It connects only to Beav on loopback, requests bounded summaries, and never transfers raw media bytes through model tool parameters. The connector source is public so the community can audit the integration. The Beav desktop application, creator runtime, knowledge engine, media pipeline, and commercial services remain proprietary and are not included in this repository or npm package.

This is a community plugin and is not an official DeepSeek product or endorsement.

## Development

Clone the official Harness checkout at the pinned compatibility revision beside this repository:

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness
git -C ../deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm -C ../deepseek-harness install
pnpm -C ../deepseek-harness run build:lib
pnpm install
pnpm check
```

The published tarball contains prebuilt `lib/` files and treats every Harness runtime package as a peer dependency. Users do not run a build or prepare script during plugin installation.

## License

MIT. This license applies to the connector only, not to the Beav application or services.
