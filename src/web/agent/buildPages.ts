import type { Plugin } from "vite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentCopy, agentLocales, skillMarkdown } from "../../shared/agentCopy";
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export function agentPagesPlugin(): Plugin {
  return {
    name: "member-agent-pages",
    closeBundle: {
      order: "post",
      sequential: true,
      handler() {
        const root = resolve("dist"),
          base = readFileSync(resolve(root, "index.html"), "utf8");
        const site = (
          process.env.VITE_AGENT_SITE_ORIGIN ?? "https://active-etf.inthewins.com"
        ).replace(/\/$/, "");
        for (const lang of agentLocales) {
          const t = agentCopy[lang];
          for (const page of ["", "/skill", "/connect"]) {
            const path = `/${lang}/mcp${page}`,
              title =
                page === "/skill"
                  ? t.skillTitle
                  : page === "/connect"
                    ? t.account
                    : t.title;
            const head = `<!-- SEO_HEAD_START --><title>${escape(title)} · ${escape(t.brand)}</title><meta name="description" content="${escape(page === "/skill" ? t.skillIntro : t.intro)}"><meta name="robots" content="${page === "/connect" ? "noindex, nofollow" : "index, follow"}"><link rel="canonical" href="${site}${path}">${agentLocales.map((l) => `<link rel="alternate" hreflang="${l}" href="${site}/${l}/mcp${page}">`).join("")}<link rel="alternate" hreflang="x-default" href="${site}/en/mcp${page}"><!-- SEO_HEAD_END -->`;
            const body = `<!-- SEO_BODY_START --><main class="static-seo-shell"><h1>${escape(title)}</h1><p>${escape(page === "/skill" ? t.skillIntro : t.intro)}</p><a href="/${lang}/mcp">${escape(t.overview)}</a> · <a href="/${lang}/mcp/skill">${escape(t.skill)}</a></main><!-- SEO_BODY_END -->`;
            const html = base
              .replace(/<html[^>]*>/, '<html lang="' + lang + '">')
              .replace(
                /<!-- SEO_HEAD_START -->[\s\S]*?<!-- SEO_HEAD_END -->/,
                head,
              )
              .replace(
                /<!-- SEO_BODY_START -->[\s\S]*?<!-- SEO_BODY_END -->/,
                body,
              );
            const dir = resolve(root, path.slice(1));
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, "index.html"), html);
          }
          const dest = resolve(root, "skills", lang, "active-etf-research");
          mkdirSync(dest, { recursive: true });
          writeFileSync(resolve(dest, "SKILL.md"), skillMarkdown(lang));
        }
        const configPath = resolve(root, "staticwebapp.config.json"),
          config = JSON.parse(readFileSync(configPath, "utf8"));
        const oauth = {
          issuer: site,
          authorization_endpoint: site + "/api/oauth/authorize",
          token_endpoint: site + "/api/oauth/token",
          registration_endpoint: site + "/api/oauth/register",
          revocation_endpoint: site + "/api/oauth/revoke",
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          scopes_supported: ["active_etf:read"],
        };
        const protectedResource = {
          resource: site + "/api/mcp",
          authorization_servers: [site],
          scopes_supported: ["active_etf:read"],
          bearer_methods_supported: ["header"],
        };
        const discovery = [
          ["/.well-known/oauth-authorization-server", oauth],
          ["/.well-known/oauth-protected-resource", protectedResource],
          ["/.well-known/oauth-protected-resource/api/mcp", protectedResource],
        ] as const;
        const discoveryRoutes = discovery.map(([path, data], i) => {
          const target = `/mcp-discovery-${i}.json`;
          writeFileSync(resolve(root, target.slice(1)), JSON.stringify(data));
          return {
            route: path,
            rewrite: target,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          };
        });
        config.platform = { ...config.platform, apiRuntime: "node:20" };
        config.routes = [
          ...discoveryRoutes,
          ...agentLocales.flatMap((lang) =>
            ["", "/skill", "/connect"].map((page) => ({
              route: `/${lang}/mcp${page}`,
              rewrite: `/${lang}/mcp${page}/index.html`,
              headers: { "cache-control": "no-cache, must-revalidate" },
            })),
          ),
          ...config.routes,
        ];
        writeFileSync(configPath, JSON.stringify(config) + "\n");
      },
    },
  };
}
