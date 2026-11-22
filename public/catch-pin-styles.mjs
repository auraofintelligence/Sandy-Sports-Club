// Symbols describe an entry. Its ownership and audience are shown separately.
export const pinStyles = Object.freeze({fish:'Fish', float:'Fishing float', anchor:'Anchor', flag:'Flag', drop:'Location pin'});
export const isPinStyle = value => typeof value === 'string' && Object.hasOwn(pinStyles, value);
export function styleForPin(style,kind) {
  if (isPinStyle(style)) return style;
  return ({journal:'float',shared:'flag',chosen:'drop'})[kind] || 'anchor';
}
