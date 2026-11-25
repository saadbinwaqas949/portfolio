// What the Studio lets you edit, panel by panel. To expose a new field, add it
// here; the form, the live preview and saving all follow from this list.
import { BLANK, type Site } from '../src/content';

type Base = { key: string; label: string; help?: string };
export type Field =
  | (Base & { k: 'text' | 'url' | 'color' | 'toggle' | 'youtube'; placeholder?: string })
  | (Base & { k: 'area'; rows?: number; placeholder?: string })
  | (Base & { k: 'select'; options: [string, string][] })
  | (Base & { k: 'range'; min: number; max: number; marks?: string[] })
  | (Base & { k: 'strings'; placeholder?: string; one: string })
  | (Base & { k: 'image'; dir: string; caption?: boolean })
  | (Base & { k: 'images'; dir: string })
  | (Base & { k: 'file'; kind: 'video' | 'image' | 'doc'; dir: string })
  | (Base & { k: 'link' })
  | (Base & { k: 'group'; fields: Field[]; closed?: boolean })
  | (Base & {
      k: 'list';
      one: string;
      item: Field[];
      blank: unknown;
      title: (x: any) => string;
      sub?: (x: any) => string;
      thumb?: (x: any) => string | undefined;
      top?: boolean;
    });

export interface Panel {
  id: string;
  name: string;
  hint: string;
  /** section to show in the preview */
  goto: string;
  fields: Field[];
}

const text = (key: string, label: string, help?: string, placeholder?: string): Field => ({ k: 'text', key, label, help, placeholder });
const area = (key: string, label: string, rows = 3, help?: string): Field => ({ k: 'area', key, label, rows, help });

const TAPES: [string, string][] = [
  ['black', 'Black'],
  ['red', 'Red'],
  ['blue', 'Blue'],
  ['green', 'Green'],
  ['yellow', 'Yellow'],
];
const KINDS: [string, string][] = [
  ['won', 'Won'],
  ['award', 'Award'],
  ['semi', 'Semi-final'],
  ['part', 'Took part'],
  ['out', 'Lost / out'],
  ['demo', 'Demo'],
  ['next', 'Coming up'],
];
const SECTION_OPTIONS: [string, string][] = [
  ['about', 'About'],
  ['fly', 'Drones'],
  ['sim', 'Simulators'],
  ['race', 'Race car'],
  ['fight', 'NERC'],
  ['follow', 'Robots'],
  ['play', 'Games'],
  ['ship', 'Code'],
  ['chimera', 'Chimera'],
  ['log', 'Events'],
  ['toolbox', 'Toolbox'],
  ['contact', 'Contact'],
];
const firstPhoto = (x: any) => x.photos?.[0]?.src || x.images?.[0]?.src || x.image?.src;

const project = (dir: string): Field[] => [
  text('name', 'Name'),
  text('status', 'Status label', 'Printed on tape. Leave empty for none.'),
  area('text', 'What it is', 4),
  { k: 'strings', key: 'stack', label: 'Built with', one: 'tool' },
  { k: 'link', key: 'link', label: 'Link' },
  { k: 'images', key: 'images', label: 'Screenshots', dir },
];

export const PANELS: Panel[] = [
  {
    id: 'start',
    name: 'Start',
    hint: 'Name, first sentence and badges',
    goto: 'top',
    fields: [
      text('person.first', 'First name', 'The giant letters.'),
      text('person.last', 'Rest of the name'),
      area('hero.line', 'First sentence', 2, '{word|section} makes a link. Sections: fly, sim, race, fight, follow, chimera, play, ship, log. model, simulate, build, fly and automate have their own animations.'),
      area('hero.sub', 'Second line', 2),
      {
        k: 'list',
        key: 'hero.badges',
        label: 'Badges',
        one: 'badge',
        help: 'Short words on label-maker tape. Five is plenty.',
        blank: BLANK.badge,
        title: (b) => b.text,
        item: [text('text', 'Text'), { k: 'select', key: 'color', label: 'Tape', options: TAPES }],
      },
      text('hero.scrollHint', 'Note next to the drone'),
    ],
  },
  {
    id: 'about',
    name: 'About',
    hint: 'Cardboard to carbon fibre',
    goto: 'about',
    fields: [
      {
        k: 'group',
        key: 'about.left',
        label: 'Cardboard half',
        fields: [text('label', 'Label'), text('title', 'Big word'), area('text', 'Text', 4), { k: 'image', key: 'image', label: 'Photo', dir: 'photos' }],
      },
      { k: 'group', key: 'about.right', label: 'Carbon half', fields: [text('label', 'Label'), text('title', 'Big word'), area('text', 'Text', 4)] },
      area('about.statement', 'Statement next to the medal', 4),
      {
        k: 'list',
        key: 'about.disciplines',
        label: 'What you do',
        one: 'discipline',
        blank: BLANK.discipline,
        title: (d) => d.name,
        sub: (d) => d.text,
        item: [text('name', 'Name'), text('text', 'Short note'), { k: 'select', key: 'link', label: 'Goes to', options: SECTION_OPTIONS }],
      },
      text('about.title', 'Section title for search engines and screen readers'),
    ],
  },
  {
    id: 'fly',
    name: 'Drones',
    hint: 'FPV build, aircraft, sim recording',
    goto: 'fly',
    fields: [
      text('fly.title', 'Big word'),
      area('fly.intro', 'Intro', 2),
      {
        k: 'list',
        key: 'fly.aircraft',
        label: 'Aircraft',
        one: 'aircraft',
        blank: BLANK.aircraft,
        title: (a) => a.name,
        sub: (a) => a.text,
        thumb: firstPhoto,
        item: [
          text('name', 'Name'),
          area('text', 'Text', 3),
          {
            k: 'select',
            key: 'model',
            label: '3D model',
            options: [
              ['fpv1', 'FPV quad, taped arms, red props'],
              ['quad5', 'FPV quad, 5-inch'],
              ['px4', 'Quad with GPS, red and white arms'],
              ['naze', 'Quad, black arms'],
              ['longrange', 'Long-range quad'],
              ['commission', 'Quad in a shipping box'],
              ['plane', 'RC plane'],
            ],
          },
          text('status', 'Status label', 'For example: Commission. Leave empty for none.'),
          { k: 'images', key: 'images', label: 'Photos and clips', dir: 'drones' },
          { k: 'url', key: 'link', label: 'Link to more' },
        ],
      },
      {
        k: 'group',
        key: 'fly.build',
        label: 'Exploded FPV build',
        closed: true,
        fields: [
          text('name', 'Name'),
          text('tag', 'Title block line'),
          area('text', 'Text', 4),
          { k: 'link', key: 'link', label: 'Link' },
          { k: 'list', key: 'stats', label: 'Numbers', one: 'number', blank: BLANK.stat, title: (s) => s.value, sub: (s) => s.label, item: [text('value', 'Value'), text('label', 'What it is')] },
          {
            k: 'list',
            key: 'parts',
            label: 'Parts',
            one: 'part',
            blank: BLANK.part,
            title: (p) => p.name,
            sub: (p) => p.note,
            item: [
              text('name', 'Part'),
              text('note', 'Detail'),
              {
                k: 'select',
                key: 'anchor',
                label: 'Points at',
                options: ['frame', 'motors', 'props', 'esc', 'fc', 'camera', 'receiver', 'vtx', 'antenna', 'plates', 'battery'].map((x) => [x, x]),
              },
            ],
          },
        ],
      },
      { k: 'group', key: 'fly.notebook', label: 'Photo next to the receiver', closed: true, fields: [{ k: 'image', key: 'image', label: 'Photo', dir: 'drones' }, text('caption', 'Note under it')] },
      {
        k: 'group',
        key: 'fly.field',
        label: 'Receiver (short clips)',
        help: 'Each clip is a channel. Under ten seconds works best.',
        fields: [text('title', 'Title'), text('text', 'Text'), { k: 'images', key: 'clips', label: 'Clips', dir: 'clips' }],
      },
    ],
  },
  {
    id: 'sim',
    name: 'Simulators',
    hint: 'DRL cuts, other sims, Gazebo',
    goto: 'sim',
    fields: [
      text('sim.title', 'Big word'),
      area('sim.intro', 'Intro', 2),
      text('sim.main', 'Main simulator'),
      text('sim.mainText', 'Line next to it'),
      { k: 'images', key: 'sim.clips', label: 'Cuts', dir: 'clips' },
      { k: 'strings', key: 'sim.others', label: 'Other simulators', one: 'simulator' },
      text('sim.othersText', 'Line after them'),
      { k: 'group', key: 'sim.gazebo', label: 'Gazebo', fields: [text('title', 'Title'), area('text', 'Text', 3), { k: 'image', key: 'image', label: 'Screenshot', dir: 'sim' }] },
      { k: 'group', key: 'sim.game', label: 'Playable gates', closed: true, fields: [text('title', 'Title'), text('text', 'How to play')] },
    ],
  },
  {
    id: 'race',
    name: 'Race car',
    hint: 'Race Pakistan',
    goto: 'race',
    fields: [
      text('race.title', 'Big word'),
      area('race.lead', 'Intro', 2),
      text('race.event', 'Event'),
      text('race.status', 'Status label'),
      text('race.date', 'Date, as shown'),
      text('race.iso', 'Countdown to', 'Like 2027-01-30T09:00:00+05:00. Empty hides the countdown.'),
      text('race.place', 'Place'),
      { k: 'link', key: 'race.link', label: 'Link' },
      { k: 'list', key: 'race.stats', label: 'Numbers over the wind tunnel', one: 'number', blank: BLANK.stat, title: (x) => x.value, sub: (x) => x.label, item: [text('value', 'Value'), text('label', 'What it is')] },
      text('race.stand', 'Note under the car'),
      text('race.launch', 'Launch button'),
      area('race.text', 'About the competition', 5),
      text('race.judgedTitle', 'Title of the score sheet'),
      { k: 'list', key: 'race.judged', label: 'Score sheet', one: 'row', blank: BLANK.stat, title: (x) => x.label, sub: (x) => x.value, item: [text('label', 'Category'), text('value', 'Points')] },
      { k: 'images', key: 'race.clips', label: 'CAD clips and photos', dir: 'race' },
    ],
  },
  {
    id: 'fight',
    name: 'NERC',
    hint: 'The sumo arena story',
    goto: 'fight',
    fields: [
      text('fight.title', 'Big word'),
      area('fight.text', 'Intro', 3),
      text('fight.event', 'Event'),
      text('fight.eventLong', 'Full name and place'),
      text('fight.lead', 'Gold letters at the end'),
      {
        k: 'list',
        key: 'fight.rounds',
        label: 'Story, in order',
        one: 'round',
        blank: BLANK.round,
        title: (r) => r.title,
        sub: (r) => r.when,
        item: [
          text('when', 'When'),
          text('title', 'Title'),
          area('text', 'Text', 3),
          { k: 'select', key: 'result', label: 'Result', options: [['out', 'Out'], ['won', 'Won'], ['semi', 'Semi-final']] },
        ],
      },
      text('fight.photosTitle', 'Title over the photos'),
      { k: 'images', key: 'fight.photos', label: 'Photos and clips', dir: 'robots' },
      { k: 'group', key: 'fight.game', label: 'Mini-game', closed: true, fields: [text('title', 'Title'), text('text', 'How to play'), text('start', 'Button')] },
    ],
  },
  {
    id: 'follow',
    name: 'Robots',
    hint: 'Arduino robots and photos',
    goto: 'follow',
    fields: [
      text('follow.title', 'Big words'),
      area('follow.intro', 'Intro', 2),
      {
        k: 'list',
        key: 'follow.robots',
        label: 'Robots',
        one: 'robot',
        blank: BLANK.robot,
        title: (r) => r.name,
        sub: (r) => r.text,
        item: [
          text('name', 'Name'),
          area('text', 'Text', 2),
          text('note', 'Result label', 'Printed on tape. Leave empty for none.'),
          {
            k: 'select',
            key: 'model',
            label: 'Live demo',
            options: [
              ['line', 'Follows a line'],
              ['avoid', 'Avoids obstacles'],
              ['soccer', 'Plays soccer'],
              ['bluetooth', 'Driven by the visitor'],
              ['sumo1', 'Pushes cans off the board'],
              ['sumo2', 'Guards the ring'],
              ['walker', 'Walks'],
            ],
          },
          { k: 'images', key: 'images', label: 'Photos and clips', dir: 'robots' },
        ],
      },
      { k: 'images', key: 'follow.photos', label: 'Photos at the end', dir: 'robots' },
    ],
  },
  {
    id: 'play',
    name: 'Games',
    hint: 'Cartridges for the handheld',
    goto: 'play',
    fields: [
      text('play.title', 'Big word'),
      area('play.intro', 'Intro', 2),
      {
        k: 'list',
        key: 'play.games',
        label: 'Games',
        one: 'game',
        blank: BLANK.game,
        title: (g) => g.name,
        sub: (g) => g.text,
        thumb: firstPhoto,
        item: [
          text('name', 'Name'),
          area('text', 'Text', 3),
          { k: 'url', key: 'url', label: 'itch.io link' },
          { k: 'select', key: 'platform', label: 'Where it runs', options: [['browser', 'In the browser'], ['windows', 'Windows download']] },
          text('tag', 'Extra label', 'For example: Kenney Jam 2024.'),
          { k: 'color', key: 'color', label: 'Cartridge colour' },
          { k: 'images', key: 'images', label: 'Screenshots', dir: 'games', help: 'The first one goes on the cartridge label.' },
        ],
      },
      { k: 'url', key: 'play.profile', label: 'itch.io profile' },
    ],
  },
  {
    id: 'ship',
    name: 'Code',
    hint: 'CODShield, ragNready and more',
    goto: 'ship',
    fields: [
      text('ship.title', 'Big word'),
      area('ship.intro', 'Intro', 2),
      { k: 'list', key: 'ship.projects', label: 'More projects', one: 'project', blank: BLANK.project, title: (p) => p.name, sub: (p) => p.text, thumb: firstPhoto, item: project('software'), help: 'Each one appears under ragNready.' },
      {
        k: 'group',
        key: 'ship.codshield',
        label: 'CODShield',
        closed: true,
        fields: [
          text('name', 'Name'),
          text('status', 'Status label'),
          area('text', 'What it is', 4),
          { k: 'list', key: 'points', label: 'The four steps', one: 'step', blank: BLANK.point, title: (p) => p.title, item: [text('title', 'Title'), area('text', 'Text', 2)], help: 'In order: chat, address, risk, call.' },
          { k: 'strings', key: 'working', label: 'Working now', one: 'thing' },
          { k: 'strings', key: 'next', label: 'Coming next', one: 'thing' },
          { k: 'strings', key: 'stack', label: 'Built with', one: 'tool' },
          { k: 'link', key: 'link', label: 'Link' },
          {
            k: 'group',
            key: 'demo',
            label: 'Example order',
            closed: true,
            fields: [
              { k: 'list', key: 'chat', label: 'Chat', one: 'message', blank: BLANK.chat, title: (m) => m.text, sub: (m) => m.from, item: [{ k: 'select', key: 'from', label: 'Who', options: [['customer', 'Customer'], ['shop', 'Shop']] }, text('text', 'Message')] },
              text('addressBefore', 'Address as typed'),
              text('addressAfter', 'Address cleaned'),
              { k: 'range', key: 'risk', label: 'Risk needle', min: 0, max: 100 },
              text('riskLabel', 'Risk label'),
              { k: 'strings', key: 'reasons', label: 'Reasons', one: 'reason' },
              text('note', 'Small print'),
            ],
          },
        ],
      },
      { k: 'group', key: 'ship.ragnready', label: 'ragNready', closed: true, fields: project('software') },
    ],
  },
  {
    id: 'chimera',
    name: 'Chimera',
    hint: 'Four machines in one',
    goto: 'chimera',
    fields: [
      text('chimera.title', 'Name'),
      { k: 'toggle', key: 'chimera.open', label: 'Open the crate', help: 'Off: a teaser. On: the box opens and shows the story and photos.' },
      area('chimera.teaser', 'First line', 2),
      area('chimera.story', 'Short version', 4),
      text('chimera.status', 'Status label'),
      {
        k: 'list',
        key: 'chimera.modes',
        label: 'Modes',
        one: 'mode',
        blank: BLANK.mode,
        title: (m) => m.title,
        sub: (m) => m.text,
        item: [{ k: 'select', key: 'id', label: 'Shape', options: [['car', 'Car'], ['boat', 'Boat'], ['plane', 'Plane'], ['quad', 'Quadcopter']] }, text('title', 'Name'), area('text', 'Text', 3)],
      },
      { k: 'list', key: 'chimera.stats', label: 'Numbers', one: 'number', blank: BLANK.stat, title: (x) => x.value, sub: (x) => x.label, item: [text('value', 'Value'), text('label', 'What it is')] },
      { k: 'strings', key: 'chimera.uses', label: 'Uses (the moving line)', one: 'use' },
      {
        k: 'list',
        key: 'chimera.chapters',
        label: 'Story, in order',
        one: 'chapter',
        blank: BLANK.round,
        help: 'Each chapter sits next to the picture with the same number below.',
        title: (c) => c.title,
        sub: (c) => c.when,
        item: [text('when', 'When'), text('title', 'Title'), area('text', 'Text', 4), { k: 'select', key: 'result', label: 'Label colour', options: [['', 'Black'], ['out', 'Red']] }],
      },
      { k: 'images', key: 'chimera.images', label: 'Photos', dir: 'chimera' },
      { k: 'link', key: 'chimera.link', label: 'Link' },
    ],
  },
  {
    id: 'log',
    name: 'Events',
    hint: 'Competitions, awards, fairs',
    goto: 'log',
    fields: [
      {
        k: 'list',
        key: 'log.events',
        label: 'Events',
        one: 'event',
        blank: BLANK.event,
        top: true,
        title: (e) => e.title,
        sub: (e) => [e.result, e.date].filter(Boolean).join(', '),
        thumb: firstPhoto,
        item: [
          text('title', 'Event'),
          text('host', 'Who ran it, where'),
          text('date', 'Date', 'Any wording: 5–7 May 2023, or just 2023.'),
          { k: 'range', key: 'importance', label: 'How big is it?', min: 1, max: 3, marks: ['One line', 'Card', 'Headline'] },
          { k: 'select', key: 'kind', label: 'Outcome', options: KINDS },
          text('result', 'Result in a few words'),
          area('text', 'What happened', 4),
          {
            k: 'list',
            key: 'entries',
            label: 'Categories entered',
            one: 'category',
            blank: BLANK.entry,
            title: (x) => x.name,
            sub: (x) => x.result,
            item: [text('name', 'Category'), text('result', 'Result'), { k: 'select', key: 'kind', label: 'Outcome', options: KINDS }],
          },
          { k: 'images', key: 'photos', label: 'Photos and clips', dir: 'events' },
          { k: 'youtube', key: 'video', label: 'YouTube video' },
        ],
      },
      text('log.title', 'Title', 'The part after the comma falls over.'),
      area('log.intro', 'Intro', 2),
      {
        k: 'group',
        key: 'extra.lipo',
        label: 'The battery incident',
        closed: true,
        fields: [{ k: 'toggle', key: 'show', label: 'Show it' }, text('title', 'Title'), area('text', 'Text', 3), { k: 'image', key: 'image', label: 'Photo', dir: 'photos' }, { k: 'youtube', key: 'video', label: 'YouTube video' }],
      },
    ],
  },
  {
    id: 'toolbox',
    name: 'Toolbox',
    hint: 'Skills and courses',
    goto: 'toolbox',
    fields: [
      text('toolbox.title', 'Big word'),
      text('toolbox.intro', 'Intro'),
      { k: 'list', key: 'toolbox.groups', label: 'Skills', one: 'group', blank: BLANK.group, title: (g) => g.name, sub: (g) => (g.items ?? []).join(', '), item: [text('name', 'Group'), { k: 'strings', key: 'items', label: 'Skills', one: 'skill' }] },
      { k: 'list', key: 'toolbox.courses', label: 'Courses and training', one: 'course', blank: BLANK.course, title: (c) => c.name, sub: (c) => c.date, item: [text('name', 'Name'), text('date', 'Date')] },
      { k: 'images', key: 'toolbox.photos', label: 'Photos', dir: 'events' },
    ],
  },
  {
    id: 'contact',
    name: 'Contact',
    hint: 'Email, links, sign-off',
    goto: 'contact',
    fields: [
      text('contact.title', 'Big letters'),
      area('contact.text', 'Text', 2),
      text('person.email', 'Email', 'Shown publicly. Leave empty to hide it.'),
      text('person.phone', 'Phone', 'Shown publicly. Empty means hidden, which is safer.'),
      { k: 'file', key: 'person.resume', label: 'CV (PDF)', kind: 'doc', dir: 'docs', help: 'Optional. Check it has nothing private in it first.' },
      {
        k: 'list',
        key: 'person.links',
        label: 'Links',
        one: 'link',
        blank: BLANK.link,
        title: (l) => l.label,
        sub: (l) => l.url,
        item: [
          text('label', 'Label'),
          { k: 'url', key: 'url', label: 'Address' },
          { k: 'select', key: 'icon', label: 'Icon', options: ['github', 'youtube', 'itch', 'linkedin', 'instagram', 'file', 'link'].map((x) => [x, x]) },
        ],
      },
      text('contact.button', 'Copy button'),
      text('contact.copied', 'After copying'),
      text('contact.footer', 'Last line'),
      text('person.location', 'Location'),
    ],
  },
  {
    id: 'custom',
    name: 'Extra sections',
    hint: 'Galleries and cards you add',
    goto: '',
    fields: [
      {
        k: 'list',
        key: 'custom',
        label: 'Extra sections',
        one: 'section',
        help: 'For anything new: CAD renders, a trip, a new hobby. Put it in order under Page order.',
        blank: BLANK.custom,
        title: (c) => c.title,
        sub: (c) => c.intro,
        thumb: firstPhoto,
        item: [
          text('title', 'Big word'),
          {
            k: 'select',
            key: 'material',
            label: 'Letters made of',
            options: [['night', 'Gunmetal'], ['kraft', 'Cardboard'], ['carbon', 'Carbon fibre'], ['metal', 'Aluminium'], ['toy', 'Plastic'], ['gold', 'Gold'], ['wood', 'Wood'], ['foam', 'White foam'], ['steel', 'Steel']],
          },
          area('intro', 'Intro', 2),
          area('text', 'Text', 5),
          { k: 'images', key: 'images', label: 'Photos', dir: 'extra' },
          {
            k: 'list',
            key: 'cards',
            label: 'Cards',
            one: 'card',
            blank: BLANK.card,
            title: (c) => c.title,
            sub: (c) => c.text,
            thumb: firstPhoto,
            item: [text('title', 'Title'), area('text', 'Text', 3), { k: 'image', key: 'image', label: 'Photo', dir: 'extra' }, { k: 'link', key: 'link', label: 'Link' }],
          },
        ],
      },
    ],
  },
  {
    id: 'site',
    name: 'Search and sharing',
    hint: 'Title, description, preview image',
    goto: '',
    fields: [
      text('meta.title', 'Browser tab title'),
      area('meta.description', 'Description for Google and link previews', 4),
      { k: 'url', key: 'meta.url', label: 'Live address', help: 'For example https://name.github.io/portfolio/. Needed for link previews.' },
      text('meta.ogImage', 'Link preview image', 'A file in the public folder.'),
    ],
  },
];

/** Things the Add button can create. */
export const QUICK: { name: string; panel: string; path: string; blank: unknown; top?: boolean }[] = [
  { name: 'Event or award', panel: 'log', path: 'log.events', blank: BLANK.event, top: true },
  { name: 'Drone or plane', panel: 'fly', path: 'fly.aircraft', blank: BLANK.aircraft },
  { name: 'Robot', panel: 'follow', path: 'follow.robots', blank: BLANK.robot },
  { name: 'Game', panel: 'play', path: 'play.games', blank: BLANK.game, top: true },
  { name: 'Code project', panel: 'ship', path: 'ship.projects', blank: BLANK.project },
  { name: 'Course', panel: 'toolbox', path: 'toolbox.courses', blank: BLANK.course },
  { name: 'Social link', panel: 'contact', path: 'person.links', blank: BLANK.link },
  { name: 'New section', panel: 'custom', path: 'custom', blank: BLANK.custom },
];

/** Which sections have to be rebuilt when a path changes. */
export function dirtyFor(path: string): string[] {
  const a = path.split('.')[0];
  if (a === 'person') return ['hero', 'contact', 'fly', 'fight'];
  if (a === 'extra') return ['log'];
  if (a === 'layout' || a === 'meta') return [];
  return [a];
}

export type { Site };
