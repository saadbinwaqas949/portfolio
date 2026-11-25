// Everything on the page comes from content/site.json.
// Edit it in the Studio (double-click "Edit Portfolio.bat") or by hand.
import { createContext, useContext } from 'react';
import raw from '../content/site.json';

export interface Img {
  src: string;
  alt: string;
  caption?: string;
  /** which part to keep when the photo is cropped */
  focus?: string;
}
export interface Link {
  label: string;
  url: string;
  icon?: string;
}
export interface LayoutItem {
  id: string;
  nav: string;
  visible: boolean;
  inNav: boolean;
}
export interface Badge {
  text: string;
  color: string;
}
export interface AboutSide {
  label: string;
  title: string;
  text: string;
  image?: Img;
}
export interface Discipline {
  name: string;
  text: string;
  link: string;
}
export interface Stat {
  value: string;
  label: string;
}
export interface Part {
  name: string;
  note: string;
  anchor: string;
}
export interface Aircraft {
  name: string;
  text: string;
  model: string;
  status: string;
  images: Img[];
  video: string;
  link: string;
}
export interface Round {
  when: string;
  title: string;
  text: string;
  result: string;
}
export interface Robot {
  name: string;
  text: string;
  model: string;
  note: string;
}
export interface Game {
  name: string;
  text: string;
  tag: string;
  platform: string;
  url: string;
  color: string;
  images: Img[];
}
export interface Point {
  title: string;
  text: string;
}
export interface ChatLine {
  from: string;
  text: string;
}
export interface Project {
  name: string;
  status: string;
  text: string;
  stack: string[];
  link: Link;
  images: Img[];
}
export interface EventEntry {
  name: string;
  result: string;
  kind: string;
}
export interface EventItem {
  title: string;
  host: string;
  date: string;
  importance: number;
  kind: string;
  result: string;
  text: string;
  entries: EventEntry[];
  photos: Img[];
  video: string;
}
export interface SkillGroup {
  name: string;
  items: string[];
}
export interface Course {
  name: string;
  date: string;
}
export interface Card {
  title: string;
  text: string;
  image?: Img;
  link?: Link;
}
export interface CustomSection {
  id: string;
  title: string;
  intro: string;
  material: string;
  text: string;
  images: Img[];
  cards: Card[];
}

export interface Site {
  meta: { title: string; description: string; url: string; ogImage: string };
  person: {
    first: string;
    last: string;
    location: string;
    email: string;
    phone: string;
    resume: string;
    links: Link[];
  };
  layout: LayoutItem[];
  hero: { line: string; sub: string; badges: Badge[]; scrollHint: string };
  about: { title: string; left: AboutSide; right: AboutSide; statement: string; disciplines: Discipline[] };
  fly: {
    title: string;
    intro: string;
    build: { name: string; tag: string; text: string; link: Link; stats: Stat[]; parts: Part[] };
    notebook: { image: Img; caption: string };
    sim: { title: string; text: string; video: string; poster: string };
    aircraft: Aircraft[];
  };
  fight: {
    title: string;
    event: string;
    eventLong: string;
    lead: string;
    text: string;
    rounds: Round[];
    game: { title: string; text: string; start: string };
  };
  follow: { title: string; intro: string; robots: Robot[]; photos: Img[] };
  play: { title: string; intro: string; profile: string; games: Game[] };
  ship: {
    title: string;
    intro: string;
    codshield: {
      name: string;
      status: string;
      text: string;
      points: Point[];
      working: string[];
      next: string[];
      stack: string[];
      link: Link;
      demo: {
        chat: ChatLine[];
        addressBefore: string;
        addressAfter: string;
        risk: number;
        riskLabel: string;
        reasons: string[];
        note: string;
      };
    };
    ragnready: Project;
    projects: Project[];
  };
  chimera: { title: string; teaser: string; open: boolean; story: string; images: Img[]; link: Link };
  log: { title: string; intro: string; events: EventItem[] };
  toolbox: { title: string; intro: string; groups: SkillGroup[]; courses: Course[] };
  extra: { lipo: { show: boolean; title: string; text: string; image: Img; video: string } };
  contact: { title: string; text: string; button: string; copied: string; footer: string };
  custom: CustomSection[];
}

const IMG: Img = { src: '', alt: '', caption: '' };
const LINK: Link = { label: '', url: '' };

/** Shape of one blank entry per list, so half-filled content never crashes the page. */
export const BLANK = {
  link: { label: '', url: '', icon: 'link' } as Link,
  badge: { text: '', color: 'black' } as Badge,
  discipline: { name: '', text: '', link: 'fly' } as Discipline,
  stat: { value: '', label: '' } as Stat,
  part: { name: '', note: '', anchor: 'frame' } as Part,
  aircraft: { name: '', text: '', model: 'px4', status: '', images: [], video: '', link: '' } as Aircraft,
  round: { when: '', title: '', text: '', result: 'out' } as Round,
  robot: { name: '', text: '', model: 'line', note: '' } as Robot,
  game: { name: '', text: '', tag: '', platform: 'browser', url: '', color: '#2f6bff', images: [] } as Game,
  point: { title: '', text: '' } as Point,
  chat: { from: 'customer', text: '' } as ChatLine,
  project: { name: '', status: '', text: '', stack: [], link: LINK, images: [] } as Project,
  entry: { name: '', result: '', kind: 'part' } as EventEntry,
  event: { title: '', host: '', date: '', importance: 2, kind: 'part', result: '', text: '', entries: [], photos: [], video: '' } as EventItem,
  group: { name: '', items: [] } as SkillGroup,
  course: { name: '', date: '' } as Course,
  card: { title: '', text: '', image: IMG, link: LINK } as Card,
  custom: { id: '', title: '', intro: '', material: 'kraft', text: '', images: [], cards: [] } as CustomSection,
};

const DEFAULTS = {
  meta: { title: '', description: '', url: '', ogImage: '' },
  person: { first: 'Saad', last: '', location: '', email: '', phone: '', resume: '', links: [] },
  layout: [],
  hero: { line: '', sub: '', badges: [], scrollHint: '' },
  about: { title: '', left: { label: '', title: '', text: '', image: IMG }, right: { label: '', title: '', text: '' }, statement: '', disciplines: [] },
  fly: {
    title: 'Fly',
    intro: '',
    build: { name: '', tag: '', text: '', link: LINK, stats: [], parts: [] },
    notebook: { image: IMG, caption: '' },
    sim: { title: '', text: '', video: '', poster: '' },
    aircraft: [],
  },
  fight: { title: 'Fight', event: '', eventLong: '', lead: '', text: '', rounds: [], game: { title: '', text: '', start: '' } },
  follow: { title: 'Follow lines', intro: '', robots: [], photos: [] },
  play: { title: 'Play', intro: '', profile: '', games: [] },
  ship: {
    title: 'Ship',
    intro: '',
    codshield: {
      name: '', status: '', text: '', points: [], working: [], next: [], stack: [], link: LINK,
      demo: { chat: [], addressBefore: '', addressAfter: '', risk: 50, riskLabel: '', reasons: [], note: '' },
    },
    ragnready: BLANK.project,
    projects: [],
  },
  chimera: { title: 'Chimera', teaser: '', open: false, story: '', images: [], link: LINK },
  log: { title: '', intro: '', events: [] },
  toolbox: { title: 'Toolbox', intro: '', groups: [], courses: [] },
  extra: { lipo: { show: false, title: '', text: '', image: IMG, video: '' } },
  contact: { title: 'Say hi', text: '', button: 'Copy email', copied: 'Copied', footer: '' },
  custom: [],
};

type Any = Record<string, any>;
function fill(base: Any, over: Any | undefined): Any {
  if (!over || typeof over !== 'object') return base;
  const out: Any = { ...over };
  for (const k in base) {
    const b = base[k];
    const o = over[k];
    if (o === undefined || o === null) out[k] = b;
    else if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = fill(b, o);
    else if (Array.isArray(b) && !Array.isArray(o)) out[k] = b;
  }
  return out;
}
const each = (list: Any[], blank: Any) => list.filter(Boolean).map((x) => fill(blank, x));

/** Fill in anything missing so sections can trust the shape. */
export function normalise(input: unknown): Site {
  const s = fill(DEFAULTS, input as Any) as Any;
  s.person.links = each(s.person.links, BLANK.link);
  s.hero.badges = each(s.hero.badges, BLANK.badge);
  s.about.disciplines = each(s.about.disciplines, BLANK.discipline);
  s.fly.build.stats = each(s.fly.build.stats, BLANK.stat);
  s.fly.build.parts = each(s.fly.build.parts, BLANK.part);
  s.fly.aircraft = each(s.fly.aircraft, BLANK.aircraft);
  s.fight.rounds = each(s.fight.rounds, BLANK.round);
  s.follow.robots = each(s.follow.robots, BLANK.robot);
  s.play.games = each(s.play.games, BLANK.game);
  s.ship.codshield.points = each(s.ship.codshield.points, BLANK.point);
  s.ship.codshield.demo.chat = each(s.ship.codshield.demo.chat, BLANK.chat);
  s.ship.ragnready = fill(BLANK.project, s.ship.ragnready);
  s.ship.projects = each(s.ship.projects, BLANK.project);
  s.log.events = each(s.log.events, BLANK.event);
  s.toolbox.groups = each(s.toolbox.groups, BLANK.group);
  s.toolbox.courses = each(s.toolbox.courses, BLANK.course);
  s.custom = each(s.custom, BLANK.custom);
  return s as Site;
}

export const site = normalise(raw);
export const SiteContext = createContext<Site>(site);
export const useSite = () => useContext(SiteContext);

/** Media paths are stored relative so the site works from any folder. */
export const media = (src: string) => (/^(https?:|data:|blob:|\/)/.test(src) ? src : import.meta.env.BASE_URL + src);

export function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/) ?? url.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
