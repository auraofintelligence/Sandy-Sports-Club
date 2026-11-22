import {opportunities} from './grant-opportunities.mjs';

export function mountGrantResearch(container, {committee=false, wish, signal}) {
  const prefix = committee ? 'committee-' : '';
  container.innerHTML = `<section id="${prefix}grant-research" aria-labelledby="${prefix}research-title"><h2 id="${prefix}research-title">Research the next round</h2>
    <p>Browse the <a href="https://auraofintelligence.github.io/stradbroke-grants-lab/index.html">Stradbroke Grants Lab</a> for island-wide funding and its <a href="https://auraofintelligence.github.io/stradbroke-grants-lab/grant-watchlist.html">funding watchlist</a>. Each lead below links to the funder for an eligibility check.</p>
    <ol class="gr-steps"><li><strong>Choose a club project.</strong> Agree who it will help and roughly what it will cost.</li><li><strong>Check the funder’s guidelines.</strong> Look for the applicant, location, cash contribution and closing time. “Watch” means there is a program worth following and an open round still needs confirmation.</li><li><strong>Give someone the next step.</strong> Officers can save a promising round in the ${committee?'committee grant register':'<a href="#committee/grants">committee grant register</a>'}, choose who will follow up and record the deadline.</li></ol>
    <details class="gr-prompt"><summary>Use an AI assistant to refresh the search</summary>
      <p>Copy these instructions into a research assistant with web access. Check its sources before an officer saves a grant.</p>
      <label for="${prefix}grant-prompt">Research instructions</label>
      <textarea id="${prefix}grant-prompt" data-gr-prompt rows="12" readonly>Find grants and sponsorship opportunities for Sandy Sports Club, a proposed community sport and culture project on Minjerribah / North Stradbroke Island in Redland City, Queensland. Use today's date in Brisbane and search for new rounds and changes to previously listed programmes. Do not assume the project already has an incorporated applicant, ABN, insurance, venue control, confirmed membership or approved budget.

Search Redland City Council grants and sponsorships, Queensland sport and recreation and community infrastructure programmes, the Gambling Community Benefit Fund, community culture and events, environment, resilience and tourism programmes, Australian Government GrantConnect, and private foundations. Look for opportunities for children and families, volunteering, community equipment, accessible recreation, local sport, film and culture, regional and island communities, energy and local tourism. Distinguish a club activity from any proposed multipurpose venue or capital project.

Use official guidelines for each round. Verify who can apply, the region or postcode, entity type, any DGR or ABN requirement, incorporation, public liability cover, site tenure and owner consent, co-contribution, allowable expenses, amount, closing time and time zone. Distinguish opportunities the project could pursue directly once eligible from those requiring a partner, auspice or Indigenous-led applicant. Confirm any remote or regional classification for the particular programme. Seek local leadership and consent before proposing a First Nations partnership. Leave membership fees and prices to the Treasurer.

Compare with the previous findings below. Flag new and changed rounds, closed rounds, announced reopening dates and any source you could not verify. Link to the funder's round page and record the date you checked. Report separate sections for open, upcoming, watch and closed rounds. Give each result a project category, a possible Sandy use, any eligibility hurdle and one next step. Identify the strongest leads for committee review and explain why. If none are suitable yet, say so. Applications, contacts and payments require separate committee approval.</textarea>
      <button type="button" class="button outline" id="${prefix}copy-grant-prompt" data-gr-copy>Copy research instructions</button><p role="status" id="${prefix}grant-copy-status" data-gr-copied></p>
    </details></section>`;
  const prompt = container.querySelector('[data-gr-prompt]');
  prompt.value += '\n\nReview the Stradbroke Grants Lab watchlist at https://auraofintelligence.github.io/stradbroke-grants-lab/grant-watchlist.html for additional leads. Verify each with its original funder.\n\nClub funding sources from the last search\n' + opportunities.map(grant =>
    [grant.name, grant.funder, grant.status, grant.closing || 'no confirmed closing date', 'checked ' + grant.checked, grant.url].join(' | ')
  ).join('\n');
  const copy = container.querySelector('[data-gr-copy]');
  const copied = container.querySelector('[data-gr-copied]');
  if (committee && wish?.name) {
    const base = prompt.value;
    const option = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    option.className = 'gr-wish-prompt-option';
    option.append(check, 'Include the name and purpose of “' + wish.name + '” in the instructions I copy');
    prompt.parentElement.insertBefore(option, prompt.previousElementSibling);
    check.addEventListener('change', () => {
      prompt.value = check.checked
        ? base + '\n\nEquipment wish selected by the committee\n' + wish.name + '\n' + (wish.purpose || '') +
          '\nLook for funding that covers this item and its intended use. Identify any purchase exclusions and whether a loan, hire or in-kind offer could meet the need. If the sources show no suitable round, say so.'
        : base;
      copied.textContent = '';
    }, {signal});
  }
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt.value);
      if (signal.aborted) return;
      copied.textContent = 'Copied. Paste the instructions into your research assistant.';
    } catch {
      if (signal.aborted) return;
      prompt.focus();
      prompt.select();
      copied.textContent = 'The instructions are selected. Choose Copy in your browser, then paste them into your research assistant.';
    }
  }, {signal});
}
