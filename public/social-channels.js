// The footer also works without JavaScript and supplies the profiles to both desks.
export const socialChannels = Array.from(document.querySelectorAll('#club-social-accounts a[data-channel]'))
  .filter(link=>!/(?:pointlookoutfishingclub|plfc)/i.test(link.href))
  .map(link=>({id:link.dataset.channel,label:link.textContent.trim(),url:link.href}));

export function setupSocialLinks() {
  for (const group of document.querySelectorAll('[data-club-social-links]')) {
    group.replaceChildren(...socialChannels.map(channel => {
      const link = document.createElement('a');
      link.href = channel.url;
      link.textContent = channel.label;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      return link;
    }));
  }
}

export function setupMemberFeed(panel) {
  const toggle = panel.querySelector('[data-toggle-feed]');
  const container = panel.querySelector('[data-feed-container]');
  const facebook = socialChannels.find(channel => channel.id === 'facebook');
  if (!facebook) {
    toggle.hidden=true;
    panel.querySelector('[data-facebook-page]')?.removeAttribute('href');
    return () => {};
  }
  panel.querySelector('[data-facebook-page]').href = facebook.url;
  let active = false;

  function close() {
    container.replaceChildren();
    container.hidden = true;
    toggle.textContent = 'Show Facebook posts';
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    if (!active) return;
    if (!container.hidden) return close();
    const frame = document.createElement('iframe');
    container.hidden = false;
    const width = Math.min(500, Math.max(180, container.clientWidth));
    const query = new URLSearchParams({href: facebook.url, tabs: 'timeline', width, height: 500,
      small_header: true, hide_cover: true, show_facepile: false, adapt_container_width: true});
    frame.title = 'Public posts from Sandy Sports Club on Facebook';
    frame.width = width;
    frame.height = 500;
    frame.referrerPolicy = 'no-referrer';
    frame.src = 'https://www.facebook.com/plugins/page.php?' + query;
    container.replaceChildren(frame);
    toggle.textContent = 'Hide Facebook posts';
    toggle.setAttribute('aria-expanded', 'true');
  });

  return function setActive(value) {
    active = value;
    if (!active) close();
  };
}
