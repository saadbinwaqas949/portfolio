// Fills index.html from content/site.json: title, description, link previews,
// structured data, and a plain-HTML version of the page for visitors and
// crawlers without JavaScript.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function seo(): Plugin {
  let root = process.cwd();
  return {
    name: 'portfolio-seo',
    configResolved(c) {
      root = c.root;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // only the portfolio page, not the Studio
        if (ctx.path.includes('studio')) return html;
        const s = JSON.parse(fs.readFileSync(path.join(root, 'content', 'site.json'), 'utf8'));
        const base = (s.meta?.url ?? '').replace(/\/?$/, '/');
        const live = /^https?:/.test(s.meta?.url ?? '');
        const abs = (p: string) => (live ? base + p.replace(/^\//, '') : p);
        const name = `${s.person?.first ?? ''} ${s.person?.last ?? ''}`.trim();

        const person = {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name,
          ...(live ? { url: base } : {}),
          address: s.person?.location,
          sameAs: (s.person?.links ?? []).map((l: any) => l.url).filter(Boolean),
          knowsAbout: (s.toolbox?.groups ?? []).flatMap((g: any) => g.items ?? []),
          award: (s.log?.events ?? []).filter((e: any) => ['won', 'award', 'semi'].includes(e.kind)).map((e: any) => `${e.result}, ${e.title}`),
        };

        const tags = [
          `<title>${esc(s.meta?.title || name)}</title>`,
          `<meta name="description" content="${esc(s.meta?.description)}" />`,
          `<meta name="author" content="${esc(name)}" />`,
          live ? `<link rel="canonical" href="${esc(base)}" />` : '',
          `<meta property="og:type" content="website" />`,
          `<meta property="og:title" content="${esc(s.meta?.title || name)}" />`,
          `<meta property="og:description" content="${esc(s.meta?.description)}" />`,
          live ? `<meta property="og:url" content="${esc(base)}" />` : '',
          s.meta?.ogImage ? `<meta property="og:image" content="${esc(abs(s.meta.ogImage))}" />` : '',
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<script type="application/ld+json">${JSON.stringify(person).replace(/</g, '\\u003c')}</script>`,
        ].filter(Boolean);

        const li = (x: string) => `<li>${x}</li>`;
        const link = (u: string, t: string) => (u ? `<a href="${esc(u)}">${esc(t)}</a>` : esc(t));
        const plain = `<noscript><main style="max-width:760px;margin:40px auto;padding:0 20px;font:18px/1.6 system-ui,sans-serif;color:#eef3ff">
<h1>${esc(name)}</h1>
<p>${esc((s.hero?.line ?? '').replace(/\{([^|}]+)(\|[^}]*)?\}/g, '$1'))} ${esc(s.hero?.sub)}</p>
<ul>${(s.hero?.badges ?? []).map((b: any) => li(esc(b.text))).join('')}</ul>
<h2>${esc(s.about?.title)}</h2><p>${esc(s.about?.left?.text)}</p><p>${esc(s.about?.right?.text)}</p><p>${esc(s.about?.statement)}</p>
<h2>Drones</h2><p>${esc(s.fly?.intro)}</p><h3>${esc(s.fly?.build?.name)}</h3><p>${esc(s.fly?.build?.text)}</p>
<ul>${(s.fly?.build?.parts ?? []).map((p: any) => li(`${esc(p.name)}: ${esc(p.note)}`)).join('')}</ul>
<ul>${(s.fly?.aircraft ?? []).map((a: any) => li(`${esc(a.name)}. ${esc(a.text)}`)).join('')}</ul>
<h2>${esc(s.fight?.event)}</h2><p>${esc(s.fight?.eventLong)}. ${esc(s.fight?.text)}</p>
<h2>Robots</h2><ul>${(s.follow?.robots ?? []).map((r: any) => li(`${esc(r.name)}. ${esc(r.text)} ${esc(r.note)}`)).join('')}</ul>
<h2>${esc(s.race?.event)}</h2><p>${esc(s.race?.lead)} ${esc(s.race?.text)}</p>
<h2>${esc(s.chimera?.title)}</h2><p>${esc(s.chimera?.teaser)} ${s.chimera?.open ? esc(s.chimera?.story) : ''}</p>
<h2>Simulators</h2><p>${esc([s.sim?.main, ...(s.sim?.others ?? []), s.sim?.gazebo?.title].filter(Boolean).join(', '))}</p>
<h2>Games</h2><ul>${(s.play?.games ?? []).map((g: any) => li(`${link(g.url, g.name)}. ${esc(g.text)}`)).join('')}</ul>
<h2>Software</h2><h3>${link(s.ship?.codshield?.link?.url, s.ship?.codshield?.name)}</h3><p>${esc(s.ship?.codshield?.text)}</p>
<h3>${link(s.ship?.ragnready?.link?.url, s.ship?.ragnready?.name)}</h3><p>${esc(s.ship?.ragnready?.text)}</p>
<h2>Events</h2><ul>${(s.log?.events ?? []).map((e: any) => li(`<b>${esc(e.title)}</b>, ${esc(e.host)}${e.date ? ', ' + esc(e.date) : ''}. ${esc(e.result)}. ${esc(e.text)}`)).join('')}</ul>
<h2>Skills</h2><p>${esc((s.toolbox?.groups ?? []).flatMap((g: any) => g.items ?? []).join(', '))}</p>
<h2>Contact</h2><p>${s.person?.email ? link('mailto:' + s.person.email, s.person.email) : ''}</p>
<ul>${(s.person?.links ?? []).map((l: any) => li(link(l.url, l.label))).join('')}</ul>
</main></noscript>`;

        return html.replace('<!--seo-->', tags.join('\n    ')).replace('<!--noscript-->', plain);
      },
    },
  };
}
