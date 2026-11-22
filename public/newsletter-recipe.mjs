export const recipeExample = {
  title: 'Lemon squid for two',
  ingredients: '250 g cleaned squid tubes\n1 teaspoon olive oil\nHalf a lemon\nA handful of parsley',
  method: 'Pat the squid dry, cut into thin rings and toss with the oil.\nCook in a single layer in a hot pan, turning until opaque all the way through. Cook in batches if needed.\nLift onto a clean plate. Add lemon juice and chopped parsley and serve straight away.',
};

// Plain text keeps the same recipe readable in an inbox, an export or an archived edition.
export function recipeBody({ingredients,method}) {
  return [ingredients.trim() && 'Ingredients\n'+ingredients.trim(),method.trim() && 'Method\n'+method.trim()].filter(Boolean).join('\n\n');
}

export function readRecipe(body='') {
  const match=/^(?:Ingredients\n([\s\S]*?))?(?:^|\n\n)?(?:Method\n([\s\S]*))?$/.exec(body);
  return match ? {ingredients:(match[1]||'').trim(),method:(match[2]||'').trim()} : {ingredients:'',method:''};
}
