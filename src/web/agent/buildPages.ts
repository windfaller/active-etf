import type { Plugin } from "vite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentCopy, agentLocales, skillMarkdown } from "../../shared/agentCopy";
import { claudeInstall } from "../../shared/claudeInstall.js";
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function agentPagesPlugin(): Plugin {
  return {
    name: "member-agent-pages",
    closeBundle: {
      order: "post",
      sequential: true,
      handler() {
        const skillPublic = process.env.VITE_MCP_SKILL_PUBLIC === "true";
        const pages = skillPublic ? ["", "/skill", "/connect"] : ["", "/connect"];
        const root = resolve("dist"),
          base = readFileSync(resolve(root, "index.html"), "utf8");
        const site = (
          process.env.VITE_AGENT_SITE_ORIGIN ?? "https://active-etf.inthewins.com"
        ).replace(/\/$/, "");
        const gatewayOrigin = (process.env.VITE_MCP_PUBLIC_ORIGIN ?? "https://active-etf-mcp.inthewins.com").replace(/\/$/, "");
        for (const lang of agentLocales) {
          const t = agentCopy[lang];
          const claude = claudeInstall[lang];
          for (const page of pages) {
            const path = `/${lang}/mcp${page}`,
              title =
                page === "/skill"
                  ? t.skillTitle
                  : page === "/connect"
                    ? t.account
                    : t.title;
            const description = page === "/skill" ? t.skillIntro : t.intro;
            const canonical = site + path;
            const structuredData = JSON.stringify({"@context":"https://schema.org","@type":"WebPage",name:title+" · "+t.brand,description,url:canonical,inLanguage:lang}).replace(/</g,"\\u003c");
            const alternate = agentLocales.map(l => '<link rel="alternate" hreflang="'+l+'" href="'+site+'/'+l+'/mcp'+page+'">').join("");
            const head = '<!-- SEO_HEAD_START --><title>'+escape(title)+' · '+escape(t.brand)+'</title><meta name="description" content="'+escape(description)+'"><meta name="robots" content="'+(page === "/connect" ? "noindex, nofollow" : "index, follow")+'"><link rel="canonical" href="'+canonical+'">'+alternate+'<link rel="alternate" hreflang="x-default" href="'+site+'/en/mcp'+page+'"><meta property="og:type" content="website"><meta property="og:site_name" content="'+escape(t.brand)+'"><meta property="og:title" content="'+escape(title)+' · '+escape(t.brand)+'"><meta property="og:description" content="'+escape(description)+'"><meta property="og:url" content="'+canonical+'"><meta name="twitter:card" content="summary"><script type="application/ld+json">'+structuredData+'</script><!-- SEO_HEAD_END -->';
            const details = page === "/skill"
              ? "<h2>"+escape(t.workflow)+"</h2><ol>"+[t.step1,t.step2,t.step3,t.step4].map(step=>"<li>"+escape(step)+"</li>").join("")+"</ol><h2>"+escape(t.install)+"</h2><p>"+escape(t.installText)+"</p><p>"+escape(t.installChat)+"</p><p>"+escape(t.installGrok)+"</p><h3>"+escape(claude.platform)+"</h3><p>"+escape(claude.guide)+"</p><p>"+escape(claude.codeSave)+"</p><p>"+escape(claude.webSkill)+"</p><a href=\""+site+"/skills/"+lang+"/active-etf-research/SKILL.md\">"+escape(t.download)+"</a><h2>"+escape(t.prompts)+"</h2><ul>"+[t.prompt1,t.prompt2,t.prompt3,t.prompt4].map(prompt=>"<li>"+escape(prompt)+"</li>").join("")+"</ul><h2>"+escape(t.limits)+"</h2><p>"+escape(t.limitsText)+"</p><p>"+escape(t.scope)+"</p>"
              : page === "/connect" ? ""
              : "<p>"+escape(t.scope)+"</p><h2>"+escape(t.quotaTitle)+"</h2><p>"+escape(t.quota)+"</p><h2>"+escape(t.tools)+"</h2><p>"+[t.search,t.snapshot,t.changes,t.comparison,t.stock,t.brief].map(escape).join(" · ")+"</p><h2>"+escape(claude.platform)+"</h2><p>"+escape(claude.guide)+"</p><p>"+escape(t.platformCosts)+"</p>";
            const body = '<!-- SEO_BODY_START --><main class="static-seo-shell"><h1>'+escape(title)+'</h1><p>'+escape(description)+'</p>'+details+'<nav><a href="/'+lang+'/mcp">'+escape(t.overview)+'</a>'+(skillPublic ? ' · <a href="/'+lang+'/mcp/skill">'+escape(t.skill)+'</a>' : "")+'</nav></main><!-- SEO_BODY_END -->';
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
          if (skillPublic) {
          const dest = resolve(root, "skills", lang, "active-etf-research");
          mkdirSync(dest, { recursive: true });
          writeFileSync(resolve(dest, "SKILL.md"), skillMarkdown(lang));
          }
        }
        if (skillPublic) {
          writeFileSync(resolve(root, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + site + "/sitemap.xml\n");
          const urls = agentLocales.flatMap(lang => ["/"+lang+"/mcp", "/"+lang+"/mcp/skill"]);
          writeFileSync(resolve(root, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(path => "<url><loc>"+site+path+"</loc></url>").join("")+"</urlset>\n");
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
          if (site !== gatewayOrigin) return {route: path, redirect: gatewayOrigin + path, statusCode: 302, headers: {"cache-control": "no-store"}};
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
          ...(!skillPublic ? [
            ...agentLocales.map(lang => ({route: `/${lang}/mcp/skill*`, statusCode: 404, headers: {"cache-control": "no-store", "x-robots-tag": "noindex"}})),
            {route: "/skills/*", statusCode: 404, headers: {"cache-control": "no-store", "x-robots-tag": "noindex"}},
          ] : []),
          ...discoveryRoutes,
          ...agentLocales.flatMap((lang) =>
            pages.map((page) => site === gatewayOrigin ? ({
              route: `/${lang}/mcp${page}`,
              rewrite: `/${lang}/mcp${page}/index.html`,
              headers: { "cache-control": "no-cache, must-revalidate" },
            }) : ({
              route: `/${lang}/mcp${page}`,
              redirect: `${gatewayOrigin}/${lang}/mcp${page}`,
              statusCode: 302,
              headers: { "cache-control": "no-store" },
            })),
          ),
          ...config.routes,
        ];
        writeFileSync(configPath, JSON.stringify(config) + "\n");
      },
    },
  };
}
