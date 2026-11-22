import {mountGrantFinder} from './grant-finder.js?v=20261121-clubhouse-menu';
import {mountGrantResearch} from './grant-research.js';

const activePages = new WeakMap();

export function mountGrantPage(container, {signal}={}) {
  activePages.get(container)?.();
  if (signal?.aborted) return () => {};
  const controller = new AbortController();
  const cleanup = () => {
    controller.abort();
    signal?.removeEventListener('abort',cleanup);
    if (activePages.get(container) === cleanup) {
      activePages.delete(container);
      container.replaceChildren();
    }
  };
  activePages.set(container,cleanup);
  signal?.addEventListener('abort',cleanup,{once:true});
  container.innerHTML = `<div class="gr-page">
  <section class="gr-intro" aria-labelledby="grant-page-title"><div><h1 id="grant-page-title">Grants and community projects</h1>
    <p>Sandy Sports Club is building a sport and culture programme for Minjerribah. The funding finder connects possible projects to the funder's own rules; an officer must check eligibility and agree a budget before any application.</p>
    <a class="button" href="#grants/funding">Find funding</a></div>
    <img src="/assets/hero-funding.webp" alt="Community members review project plans together beside a coastal recreation area" width="1600" height="900" loading="lazy"></section>
  <nav class="gr-jumps" aria-label="On this page"><a href="#grants/funding">Funding finder</a><a href="#grants/projects">Project ideas</a><a href="#grants/research">Research the next round</a><a href="#grants/club-details">Application checks</a></nav>
  <section id="grants-funding" data-gr-public-finder></section>
  <section id="grants-projects"><h2>Ideas for local projects</h2><p>These are starting points for committee discussion. Partners, venue permission, costs, dates and delivery plans still need agreement.</p>
    <div class="gr-projects">
      <article><h3>Try a new sport</h3><p>Prepare shared flag football and volleyball equipment for supervised come-and-try sessions. Ask families what they would use and check the venue before choosing gear.</p></article>
      <article><h3>Accessible community activities</h3><p>Work with participants and local providers to identify practical supports for children and people with access needs. A specific proposal should begin with those needs, not a preselected purchase.</p></article>
      <article><h3>Film and culture gatherings</h3><p>Explore small community screenings and other cultural activities with local organisers. Obtain screening rights, venue approval and a costed plan before seeking event funding.</p></article>
    </div></section>
  <div data-gr-public-research></div>
  <section class="gr-about" id="grants-club-details"><h2>Checks before an application</h2>
    <p>Confirm the legal applicant, ABN, bank account, insurance, safeguarding arrangements and any partner or auspice agreement. A proposed facility or site needs its own tenure and owner permissions. The Treasurer and committee should approve the budget and any contribution.</p>
    <p>Each funder decides eligibility. Check the current round guidelines, permitted expenses, closing time and whether work may start before approval. The private <a href="/clubhouse.html#committee/grants">committee grant register</a> can hold the assigned follow-up and decision.</p>
  </section>
  </div>`;
  mountGrantFinder(container.querySelector('[data-gr-public-finder]'),{signal:controller.signal});
  mountGrantResearch(container.querySelector('[data-gr-public-research]'),{signal:controller.signal});
  return cleanup;
}

export function scrollToGrantSection(container, section) {
  const targets = {funding:'#grants-funding',projects:'#grants-projects',research:'#grant-research',
    'grant-research':'#grant-research','club-details':'#grants-club-details'};
  if (!Object.hasOwn(targets,section)) return;
  const heading = container.querySelector(targets[section])?.querySelector('h2');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({preventScroll:true});
  heading.scrollIntoView({block:'start'});
}
