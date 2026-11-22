import {preparePhoto} from './member-photo.js';

const endpoint = '/api/member/recipes';
const dates = new Intl.DateTimeFormat('en-AU', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane'});

export function setupMemberRecipes({api, esc}) {
  const host = document.getElementById('member-recipes');
  if (!host) return;
  let session, socialAccess, routeController, reading = false, canShare = false;
  let recipes = [], next = null, editor = null, ready = false;

  const onPage = () => location.hash === '#members/recipes';
  const getStatus = () => host.querySelector('[data-recipe-status]');
  const notify = message => { const node = getStatus(); if (node) node.textContent = message; };
  function clear() {
    routeController?.abort();
    routeController = null;
    editor = null;
    recipes = [];
    next = null;
    ready = reading = canShare = false;
    host.replaceChildren();
  }

  function card(recipe) {
    const title = esc(recipe.title), id = esc(recipe.id), photos = recipe.photos || [];
    const cover = photos[0] ? '<img class="recipe-cover" src="' + esc(photos[0].url) + '" alt="" loading="lazy">' : '';
    const date = new Date(recipe.created);
    const dateText = Number.isFinite(+date) ? ' · ' + dates.format(date) : '';
    return '<details class="recipe-card" data-recipe-id="' + id + '"><summary>' + cover +
      '<span class="recipe-card-caption"><strong>' + title + '</strong><span>' + esc(recipe.byline) + dateText + '</span>' +
      (recipe.published === false ? '<span class="recipe-private">Visible only to you</span>' : '') +
      '<span class="recipe-open">Read recipe</span></span></summary><div class="recipe-content">' +
      '<h4>Ingredients</h4><p class="recipe-text">' + esc(recipe.ingredients) + '</p><h4>Method</h4><p class="recipe-text">' + esc(recipe.method) + '</p>' +
      (photos.length ? '<details class="recipe-photo-set"><summary>View ' + (photos.length === 1 ? 'full photo' : 'all ' + photos.length + ' photos') + '</summary><div>' +
        photos.map((p,i) => '<img loading="lazy" src="' + esc(p.url) + '" alt="' + title + ', photo ' + (i+1) + '">').join('') + '</div></details>' : '') +
      (recipe.own && canShare ? '<button class="button outline small" type="button" data-edit-recipe="' + id + '">Edit my recipe</button>' : '') +
      ((recipe.own || session.role === 'committee') && !session.readOnly && !session.showcase && !session.demo ? '<details class="recipe-remove"><summary>Remove recipe</summary><p>This removes the recipe and its photos from the book.</p><button type="button" class="button outline small" data-remove-recipe="' + id + '">Confirm removal</button></details>' : '') +
      '</div></details>';
  }
  function list() {
    const el = host.querySelector('[data-recipe-list]');
    if (!el) return;
    el.innerHTML = recipes.length ? recipes.map(card).join('') : '<p class="recipe-empty">' +
      (canShare ? 'The recipe book is open. Share the first dish from your kitchen.' : 'There are no shared recipes yet.') + '</p>';
    const more = host.querySelector('[data-more-recipes]');
    more.hidden = !next; more.disabled = reading;
  }
  function book() {
    host.innerHTML = '<div class="recipe-heading"><div><h2>Member recipe book</h2><p>Recipes from club kitchens. Open a dish to see the ingredients and method.</p></div>' +
      (canShare ? '<button type="button" class="button" data-new-recipe>Add a recipe</button>' : '') +
      '</div><div data-recipe-editor></div><p class="recipe-status" role="status" data-recipe-status></p>' +
      '<div class="recipe-grid" data-recipe-list></div><button type="button" class="button outline small" data-more-recipes hidden>Show earlier recipes</button>';
    list();
  }
  function gate() {
    host.innerHTML = '<h2>Member recipe book</h2><p>To read and share recipes, the club checks your 16+ age group and your sharing agreement.</p><a class="button outline" href="#members/safety">Open my access and safety</a>';
  }
  async function read(append = false, message = '') {
    const signal = routeController?.signal;
    if (!signal || reading || (append && !next)) return;
    reading = true;
    const more = host.querySelector('[data-more-recipes]'); if (more) more.disabled = true;
    try {
      const page = await api(endpoint + (append ? '?before=' + encodeURIComponent(next) : ''), {signal});
      if (signal.aborted) return;
      canShare = Boolean(page.canShare && !session?.readOnly && !session?.showcase && !session?.demo);
      if (append) {
        const ids = new Set(recipes.map(row => row.id));
        recipes.push(...page.recipes.filter(row => !ids.has(row.id)));
      } else recipes = page.recipes;
      next = page.next;
      reading = false;
      if (!ready) { ready = true; book(); } else list();
      notify(message || (append ? 'Earlier recipes loaded.' : ''));
    } catch (error) {
      if (signal.aborted) return;
      if (error.status === 403 || error.status === 401) { clear(); gate(); return; }
      if (!ready) host.innerHTML = '<h2>Member recipe book</h2><p role="status" data-recipe-status></p><button type="button" class="button outline small" data-retry-recipes>Try again</button>';
      notify(error.message);
    } finally {
      if (!signal.aborted) {
        reading = false;
        const el = host.querySelector('[data-more-recipes]'); if (el) el.disabled = false;
      }
    }
  }
  function navigate() {
    if (!onPage() || !session?.authenticated || !session.storageReady) { if (routeController || host.childElementCount) clear(); return; }
    if (session.role !== 'committee' && socialAccess === false) { clear(); gate(); return; }
    if (routeController) return;
    routeController = new AbortController();
    host.innerHTML = '<h2>Member recipe book</h2><p role="status" data-recipe-status>Opening the recipe book…</p>';
    read();
  }
  function closeEditor() {
    editor = null;
    host.querySelector('[data-recipe-editor]')?.replaceChildren();
    const add = host.querySelector('[data-new-recipe]'); if (add) add.hidden = false;
  }
  function edit(recipe) {
    if (!canShare || editor) return;
    const draft = {
      id: recipe?.id || crypto.randomUUID(), version: recipe?.version || 0,
      photos: (recipe?.photos || []).map(photo => ({value: photo.slot, src: photo.url})), busy: false
    };
    editor = draft;
    host.querySelector('[data-new-recipe]').hidden = true;
    const holder = host.querySelector('[data-recipe-editor]');
    const submit = recipe?.published === false ? 'Share recipe again' : recipe ? 'Save changes' : 'Share with members';
    holder.innerHTML = '<form class="recipe-form"><h3>' + (recipe ? 'Edit my recipe' : 'Add a recipe') + '</h3>' +
      (recipe?.published === false ? '<p>This recipe is private. Sharing it again will let members see it and its photos.</p>' : '') +
      '<label>Recipe name<input name="title" maxlength="100" autocomplete="off" required></label>' +
      '<label>Ingredients <small>Put each ingredient on its own line.</small><textarea name="ingredients" maxlength="2500" rows="4" required></textarea></label>' +
      '<label>Method <small>Describe the steps in the order you cook them.</small><textarea name="method" maxlength="4500" rows="5" required></textarea></label>' +
      '<label>Your name on the recipe (optional)<input name="byline" maxlength="65" placeholder="Club member"></label>' +
      '<fieldset><legend>Photos (optional)</legend><p>Add up to four photos you have permission to share. The first is the cover.</p>' +
      '<div class="recipe-edit-photos" data-recipe-photos></div><label data-file-label>Choose photos<input name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label></fieldset>' +
      '<p role="status" data-editor-message></p><div class="recipe-actions"><button type="submit" class="button">' + submit + '</button><button type="button" class="text-link" data-cancel-recipe>Cancel</button></div></form>';
    const form = holder.querySelector('form');
    for (const field of ['title','byline','ingredients','method']) form.elements[field].value = recipe?.[field] || '';
    const message = form.querySelector('[data-editor-message]');
    const photoArea = form.querySelector('[data-recipe-photos]');
    function renderPhotos() {
      photoArea.replaceChildren();
      draft.photos.forEach((photo,i) => {
        const figure = document.createElement('figure'), img = document.createElement('img'), button = document.createElement('button');
        img.src = photo.src; img.alt = 'Recipe photo ' + (i+1);
        button.type = 'button'; button.className = 'text-link'; button.textContent = 'Remove photo ' + (i+1);
        button.onclick = () => { if (draft.busy) return; draft.photos.splice(i,1); renderPhotos(); form.elements.files.focus(); };
        figure.append(img,button); photoArea.append(figure);
      });
      form.querySelector('[data-file-label]').hidden = draft.photos.length >= 4;
    }
    const signal = routeController.signal;
    function busy(value) {
      draft.busy = value;
      for (const control of form.elements) control.disabled = value;
    }
    renderPhotos();
    form.elements.title.focus();
    form.elements.files.onchange = async () => {
      const files = [...form.elements.files.files]; form.elements.files.value = '';
      if (!files.length || draft.busy) return;
      if (files.length + draft.photos.length > 4) { message.textContent = 'Choose up to four photos in total.'; return; }
      busy(true); message.textContent = 'Preparing your photos…';
      try {
        const additions = [];
        for (const file of files) {
          const data = await preparePhoto(file);
          if (signal.aborted || editor !== draft) return;
          if (!data) throw Error('That file is empty. Choose a photo and try again.');
          additions.push({value:data,src:data});
        }
        draft.photos.push(...additions); renderPhotos(); message.textContent = 'Photos ready.';
      } catch (error) { if (!signal.aborted) message.textContent = error.message; }
      finally { if (!signal.aborted && editor === draft) busy(false); }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (draft.busy || reading) return;
      const payload = {action:'save', id:draft.id, version:draft.version, photos:draft.photos.map(photo => photo.value)};
      for (const field of ['title','byline','ingredients','method']) payload[field] = form.elements[field].value.trim();
      busy(true); message.textContent = 'Saving your recipe…';
      try {
        await api(endpoint,{method:'POST',body:JSON.stringify(payload),signal});
        if (signal.aborted) return;
        closeEditor();
        await read(false, recipe && recipe.published !== false ? 'Recipe updated.' : 'Recipe shared with members.');
        host.querySelector('[data-new-recipe]')?.focus();
      } catch (error) {
        if (!signal.aborted) {
          message.textContent = error.message;
          if (error.status === 409) {
            const refresh = document.createElement('button');refresh.type='button';refresh.className='text-link';
            refresh.textContent='Reload saved recipes';refresh.onclick=()=>{closeEditor();read();};message.append(' ',refresh);
          }
        }
      } finally { if (!signal.aborted && editor === draft) busy(false); }
    };
  }
  host.addEventListener('click',async event => {
    const button = event.target.closest('button'); if (!button || !routeController) return;
    if (button.matches('[data-retry-recipes]')) return read();
    if (button.matches('[data-more-recipes]')) return read(true);
    if (button.matches('[data-new-recipe]')) { if(!canShare)return; return edit(); }
    if (button.matches('[data-cancel-recipe]')) { closeEditor(); host.querySelector('[data-new-recipe]')?.focus(); return; }
    const id = button.dataset.editRecipe || button.dataset.removeRecipe;
    if (!id || reading || editor) return;
    const recipe = recipes.find(row => row.id === id); if (!recipe) return;
    if (button.hasAttribute('data-edit-recipe')) return edit(recipe);
    if (button.disabled) return;
    const signal = routeController.signal;
    button.disabled = true;
    try {
      await api(endpoint,{method:'POST',body:JSON.stringify({action:'remove',id,version:recipe.version}),signal});
      if (signal.aborted) return;
      recipes = recipes.filter(row => row.id !== id); list(); notify('Recipe removed.');
    } catch (error) {
      if (!signal.aborted) { notify(error.message); button.disabled = false; }
    }
  });
  window.addEventListener('plfc:navigated',navigate);
  window.addEventListener('plfc:session-changed',({detail}) => { clear(); session = detail; socialAccess = undefined; navigate(); });
  window.addEventListener('plfc:safeguards',({detail}) => { socialAccess = detail?.socialAccess; navigate(); });
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event => { if (event.persisted) navigate(); });
}
