// Sections added later from the Studio: a photo gallery, a set of cards, or text.
import { Print } from '../components/Print';
import { useSite, type CustomSection } from '../content';
import { useGsap } from '../lib/hooks';
import { reveals } from '../lib/reveal';
import { Letters } from '../world/hooks';
import type { LetterStyle } from '../world/letters';
import { popLetters } from './About';

const STYLES: LetterStyle[] = ['kraft', 'carbon', 'metal', 'toy', 'gold', 'wood', 'foam', 'steel'];

export function Custom({ c }: { c: CustomSection }) {
  const site = useSite();
  const root = useGsap<HTMLElement>((el) => reveals(el), [site, c]);
  const style = (STYLES as string[]).includes(c.material) ? (c.material as LetterStyle) : 'kraft';
  return (
    <section id={c.id} data-sec ref={root} className="custom">
      <div
        className="section"
        data-track="[[0.5,0],[0.5,0.06],[0.972,0.06],[0.972,0.94],[0.5,0.94],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]"
      >
        <div className="wrap">
          <Letters
            as="h2"
            text={(c.title || 'New section').toUpperCase()}
            style={style}
            depth={34}
            bevel={style === 'kraft' ? 0 : 2.5}
            curve={style === 'kraft' ? 3 : 7}
            className={'title3d ' + (c.title.length > 6 ? 'long' : '')}
            onLetters={(l, s) => popLetters(l, s)}
          />
          {c.intro ? <p className="lede cu-intro" data-rv="lines">{c.intro}</p> : null}
          {c.text ? <p className="rag-text" data-rv="lines">{c.text}</p> : null}
          {c.cards?.length ? (
            <div className="mid-grid cu-cards">
              {c.cards.map((k, i) => (
                <article className="mid" key={i}>
                  {k.image?.src ? <Print img={k.image} rot={i % 2 ? 2.5 : -3} /> : null}
                  <h3>{k.title}</h3>
                  <p>{k.text}</p>
                  {k.link?.url ? (
                    <a className="tlink" href={k.link.url} target="_blank" rel="noreferrer">
                      {k.link.label || 'See more'}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {c.images?.length ? (
            <div className="follow-photos">
              {c.images.map((im, i) => (
                <Print key={im.src + i} img={im} rot={[-4, 3, -2, 4][i % 4]} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
