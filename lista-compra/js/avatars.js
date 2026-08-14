// ============================================================
// Catálogo de avatares — iconos en icons/avatars/<id>.png
// ============================================================
const AVATAR_IDS = [
  'apple', 'banana', 'avocado', 'strawberry', 'grapes', 'orange', 'pear', 'watermelon',
  'tomato', 'broccoli', 'carrot', 'cucumber', 'cabbage', 'corn', 'eggplant', 'potato',
  'garlic', 'onion', 'red_pepper', 'yellow_pepper', 'peas', 'pumpkin', 'chili', 'mushroom',
  'milk', 'cheese', 'yogurt', 'egg', 'bread', 'rice', 'pasta', 'chocolate',
  'donut', 'coffee', 'cookie', 'popcorn', 'jam', 'honey', 'olive', 'sushi',
  'fish', 'chicken', 'steak', 'shrimp', 'canned_fish', 'water', 'tea', 'beer'
];

const DEFAULT_AVATAR_ID = 'apple';

function avatarUrl(avatarId) {
  const id = AVATAR_IDS.includes(avatarId) ? avatarId : DEFAULT_AVATAR_ID;
  return `icons/avatars/${id}.png`;
}
