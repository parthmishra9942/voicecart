(function(){
/* =========================================================================
 * data.js — Knowledge Base for VoiceCart
 * This module is the "brains" behind the smart features — a curated,
 * human-readable dataset rather than a black-box call. Every recommendation
 * and categorization path reads from here, so the logic is explainable.
 * Sections: PRODUCTS, ALIAS_MAP, BRANDS_BY_TYPE, PRICE_RANGES,
 * SUBSTITUTES, SEASONAL, INTENT_PATTERNS, QUANTITY_WORDS, UNIT_WORDS, STOPWORDS
 * ========================================================================= */
'use strict';

const PRODUCTS = [
  { id:'milk',        name:'milk',        category:'dairy',     unitPrice:3.5, perishable:true,  aliases:['milk','2% milk','whole milk'] },
  { id:'eggs',        name:'eggs',        category:'dairy',     unitPrice:4.0, perishable:true,  aliases:['eggs','egg'] },
  { id:'cheese',      name:'cheese',      category:'dairy',     unitPrice:5.0, perishable:true },
  { id:'butter',      name:'butter',      category:'dairy',     unitPrice:3.8, perishable:true },
  { id:'yogurt',      name:'yogurt',      category:'dairy',     unitPrice:1.2, perishable:true },

  { id:'apples',      name:'apples',      category:'produce',   unitPrice:2.5, perishable:true, aliases:['apples','apple'] },
  { id:'bananas',     name:'bananas',     category:'produce',   unitPrice:1.1, perishable:true, aliases:['bananas','banana'] },
  { id:'oranges',     name:'oranges',     category:'produce',   unitPrice:1.3, perishable:true, aliases:['oranges','orange'] },
  { id:'carrots',     name:'carrots',     category:'produce',   unitPrice:1.0, perishable:true, aliases:['carrots','carrot'] },
  { id:'broccoli',    name:'broccoli',    category:'produce',   unitPrice:1.9, perishable:true },
  { id:'spinach',     name:'spinach',     category:'produce',   unitPrice:2.0, perishable:true },
  { id:'tomatoes',    name:'tomatoes',    category:'produce',   unitPrice:1.6, perishable:true, aliases:['tomatoes','tomato'] },
  { id:'onions',      name:'onions',      category:'produce',   unitPrice:1.2, perishable:true, aliases:['onions','onion'] },
  { id:'potatoes',    name:'potatoes',    category:'produce',   unitPrice:0.9, perishable:true, aliases:['potatoes','potato'] },
  { id:'lettuce',     name:'lettuce',     category:'produce',   unitPrice:1.4, perishable:true },
  { id:'strawberries',name:'strawberries',category:'produce',   unitPrice:3.0, perishable:true, aliases:['strawberries','strawberry'] },

  { id:'chicken',     name:'chicken',     category:'protein',   unitPrice:5.2, perishable:true },
  { id:'beef',        name:'beef',        category:'protein',   unitPrice:6.0, perishable:true, aliases:['beef','steak'] },
  { id:'salmon',      name:'salmon',      category:'protein',   unitPrice:8.5, perishable:true, aliases:['salmon','fish'] },

  { id:'bread',       name:'bread',       category:'bakery',    unitPrice:3.0, perishable:true, aliases:['bread','loaf','baguette'] },
  { id:'bagels',      name:'bagels',      category:'bakery',    unitPrice:4.5, perishable:true, aliases:['bagels','bagel'] },

  { id:'rice',        name:'rice',        category:'pantry',    unitPrice:2.8, perishable:false },
  { id:'pasta',       name:'pasta',       category:'pantry',    unitPrice:1.4, perishable:false, aliases:['pasta','noodles','spaghetti'] },
  { id:'oliveOil',    name:'olive oil',   category:'pantry',    unitPrice:7.0, perishable:false, aliases:['olive oil','oil'] },
  { id:'salt',        name:'salt',        category:'pantry',    unitPrice:0.6, perishable:false },
  { id:'cereal',      name:'cereal',      category:'pantry',    unitPrice:3.9, perishable:false },

  { id:'chips',       name:'chips',       category:'snacks',    unitPrice:3.2, perishable:false, aliases:['chips','crisps'] },
  { id:'cookies',     name:'cookies',     category:'snacks',    unitPrice:2.5, perishable:false, aliases:['cookies','cookie','biscuits'] },
  { id:'granolaBars', name:'granola bars',category:'snacks',    unitPrice:4.0, perishable:false, aliases:['granola bars','granola'] },

  { id:'water',       name:'water',       category:'beverages', unitPrice:1.0, perishable:false, aliases:['water','bottle of water'] },
  { id:'coffee',      name:'coffee',      category:'beverages', unitPrice:2.0, perishable:false },
  { id:'tea',         name:'tea',         category:'beverages', unitPrice:2.2, perishable:false },

  { id:'toothpaste',  name:'toothpaste',  category:'household', unitPrice:2.5, perishable:false },
  { id:'soap',        name:'soap',        category:'household', unitPrice:1.8, perishable:false },
  { id:'tissues',     name:'tissues',     category:'household', unitPrice:1.5, perishable:false, aliases:['tissues','tissue'] },
  { id:'detergent',   name:'detergent',   category:'household', unitPrice:6.0, perishable:false },
  { id:'toiletPaper', name:'toilet paper',category:'household', unitPrice:5.0, perishable:false, aliases:['toilet paper','tissue'] },
];
/* -------------------------------------------------------------------------
 * 2. ALIAS_MAP — map a normalized user word/phrase to a canonical product id.
 * ----------------------------------------------------------------------- */
const ALIAS_MAP = {
  'milk': 'milk', 'whole': 'milk', 'skim': 'milk', 'semi': 'milk', '2 percent milk': 'milk', 'two percent': 'milk',
  'egg': 'eggs', 'eggs': 'eggs',
  'cheese': 'cheese', 'cheddar': 'cheese', 'parmesan': 'cheese',
  'butter': 'butter',
  'yogurt': 'yogurt', 'yoghurt': 'yogurt',
  'apple': 'apples', 'apples': 'apples',
  'banana': 'bananas', 'bananas': 'bananas',
  'orange': 'oranges', 'oranges': 'oranges',
  'carrot': 'carrots', 'carrots': 'carrots',
  'broccoli': 'broccoli', 'brocolli': 'broccoli',
  'spinach': 'spinach', 'spinich': 'spinach',
  'tomato': 'tomatoes', 'tomatoes': 'tomatoes',
  'onion': 'onions', 'onions': 'onions',
  'potato': 'potatoes', 'potatoes': 'potatoes',
  'lettuce': 'lettuce',
  'strawberry': 'strawberries', 'strawberries': 'strawberries',
  'chicken': 'chicken', 'poultry': 'chicken',
  'beef': 'beef', 'steak': 'beef',
  'salmon': 'salmon', 'fish': 'salmon',
  'bread': 'bread', 'loaf': 'bread', 'baguette': 'bread',
  'bagel': 'bagels', 'bagels': 'bagels',
  'rice': 'rice',
  'pasta': 'pasta', 'noodles': 'pasta', 'spaghetti': 'pasta',
  'olive oil': 'oliveOil', 'oliveoil': 'oliveOil', 'oil': 'oliveOil',
  'salt': 'salt',
  'cereal': 'cereal', 'granola': 'granolaBars',
  'chips': 'chips', 'crisps': 'chips',
  'cookie': 'cookies', 'cookies': 'cookies', 'biscuit': 'cookies', 'biscuits': 'cookies',
  'granola bars': 'granolaBars', 'granolabars': 'granolaBars',
  'water': 'water', 'bottle of water': 'water', 'bottles of water': 'water',
  'coffee': 'coffee', 'espresso': 'coffee',
  'tea': 'tea', 'green tea': 'tea',
  'toothpaste': 'toothpaste',
  'soap': 'soap', 'body wash': 'soap',
  'tissue': 'tissues', 'tissues': 'tissues', 'kleenex': 'tissues',
  'detergent': 'detergent', 'laundry detergent': 'detergent',
  'toilet paper': 'toiletPaper', 'toiletpaper': 'toiletPaper',
  // -- bilingual aliases (Spanish FR/ES) for a taste of multilingual coverage --
  'leche': 'milk', 'leche desnatada': 'milk', 'lait': 'milk', 'lait demi ecrémé': 'milk',
  'agua': 'water', 'eau': 'water', 'agua agua': 'water',
  'manzanas': 'apples', 'manzana': 'apples', 'pommes': 'apples', 'pomme': 'apples',
  'platanos': 'bananas', 'platano': 'bananas', 'bananes': 'bananas', 'banane': 'bananas',
  'naranjas': 'oranges', 'naranja': 'oranges',
  'zanahorias': 'carrots', 'zanahoria': 'carrots', 'carottes': 'carrots', 'carotte': 'carrots',
  'huevos': 'eggs', 'huevo': 'eggs', 'oeufs': 'eggs', 'oeuf': 'eggs',
  'pan': 'bread', 'pain': 'bread', 'pane': 'bread',
  'queso': 'cheese', 'fromage': 'cheese', 'quesillo': 'cheese',
  'tomates': 'tomatoes', 'tomate': 'tomatoes', 'pomodoro': 'tomatoes',
  'pollo': 'chicken', 'poulet': 'chicken', 'pollo pollo': 'chicken',
  'arroz': 'rice', 'riz': 'rice',
  'pates': 'pasta',
  'sal': 'salt', 'sel': 'salt', 'sal sal': 'salt',
  'cafe': 'coffee', 'café': 'coffee', 'cafe cafe': 'coffee',
  'te': 'tea', 'thé': 'tea', 'the': 'tea', 'te verde': 'tea',
};

/* -------------------------------------------------------------------------
 * 3. BRANDS_BY_TYPE — common brand names for voice search by category.
 * ----------------------------------------------------------------------- */
const BRANDS_BY_TYPE = {
  dairy: ['DairyPure', 'Horizon', 'Fairlife'],
  produce: ['Organic', 'Del Monte', 'Dole'],
  protein: ['Just Bare', 'Perdue', 'Wegmans'],
  bakery: ['Pepperidge', "Dave's", 'Bimbo'],
  pantry: ['Barilla', 'Tio', 'Knorr'],
  snacks: ["Lay's", 'Doritos', 'SunChips'],
  beverages: ['Starbucks', 'Folgers', 'Lipton'],
  household: ['Colgate', 'Crest'],
};

/* -------------------------------------------------------------------------
 * 4. PRICE_RANGES — typical price bands by category (dollars).
 * ----------------------------------------------------------------------- */
const PRICE_RANGES = {
  dairy: { min:2, mid:4, max:7 },
  produce: { min:0.5, mid:2, max:5 },
  protein: { min:4, mid:8, max:15 },
  bakery: { min:1, mid:3, max:6 },
  pantry: { min:1, mid:4, max:8 },
  snacks: { min:1, mid:3, max:5 },
  beverages: { min:0.8, mid:2.5, max:6 },
  household: { min:1.5, mid:4, max:8 },
};

/* -------------------------------------------------------------------------
 * 5. SUBSTITUTES — alternatives graph (product -> options).
 * ----------------------------------------------------------------------- */
const SUBSTITUTES = {
  'milk': ['oat milk', 'almond milk', 'soy milk'],
  'eggs': ['flax seeds', 'chia seeds'],
  'butter': ['olive oil', 'coconut oil'],
  'bread': ['tortillas', 'wraps', 'bagels'],
  'pasta': ['whole wheat pasta', 'zucchini noodles'],
  'coffee': ['tea', 'decaf coffee'],
  'salt': ['sea salt', 'kosher salt'],
  'apples': ['pears', 'grapes'],
  'bananas': ['apples', 'berries'],
  'spinach': ['kale', 'romaine'],
  'strawberries': ['blueberries', 'raspberries'],
  'water': ['sparkling water', 'flavored water'],
};

/* -------------------------------------------------------------------------
 * 6. SEASONAL — produce availability by month (1-12).
 * ----------------------------------------------------------------------- */
const SEASONAL = {
  1: ['oranges', 'kale', 'carrots', 'grapefruit'],
  2: ['cabbage', 'broccoli', 'cauliflower', 'leeks'],
  3: ['spinach', 'peas', 'asparagus'],
  4: ['asparagus', 'strawberries', 'rhubarb'],
  5: ['strawberries', 'cherries', 'spinach'],
  6: ['tomatoes', 'strawberries', 'zucchini'],
  7: ['tomatoes', 'corn', 'berries'],
  8: ['tomatoes', 'corn', 'eggplant'],
  9: ['apples', 'grapes', 'broccoli'],
  10: ['apples', 'pumpkin', 'pears'],
  11: ['brussels sprouts', 'cranberries', 'squash'],
  12: ['citrus', 'winter squash', 'brussels sprouts'],
};
/* -------------------------------------------------------------------------
 * 7. INTENT_PATTERNS — multilingual utterance patterns. %IT% is an arbitrary
 *    product/query slot. Matching is greedy so the longest pattern wins.
 * ----------------------------------------------------------------------- */
const INTENT_PATTERNS = {
  add: {
    en: ['add %IT% to my list', 'i need %IT%', 'i want %IT%', 'buy %IT%',
         'get %IT%', 'please add %IT%', 'i could use %IT%', 'add %IT%', 'we need %IT%'],
    es: ['añade %IT% a mi lista', 'necesito %IT%', 'quiero %IT%', 'compra %IT%'],
    fr: ['ajoute %IT% à ma liste', 'j ai besoin de %IT%', 'je veux %IT%', 'achète %IT%'],
    hi: ['meri list me %IT% add karo', 'mujhe %IT% chahiye', 'main %IT% chahata hoon'],
  },
  remove: {
    en: ['remove %IT% from my list', 'remove %IT%', 'delete %IT%', 'take %IT% off my list',
         'i dont need %IT% anymore', 'drop %IT%'],
    es: ['quita %IT%', 'elimina %IT%', 'borra %IT% de mi lista'],
    fr: ['retire %IT%', 'efface %IT%', 'ôte %IT% de ma liste'],
    hi: ['%IT% hatamdo', '%IT% remove karo'],
  },
  list: {
    en: ['what is on my list', 'show my list', 'read my list', 'show me my list', 'my list'],
    es: ['muéstrame la lista', 'qué hay en mi lista'],
    fr: ['montre ma liste', 'que ya-t-il sur ma liste'],
    hi: ['meri list dikhao'],
  },
  search: {
    en: ['find %IT%', 'search for %IT%', 'do you have %IT%', 'look for %IT%', 'show %IT%'],
    es: ['buscar %IT%', 'encuentra %IT%'],
    fr: ['cherche %IT%', 'trouve %IT%'],
    hi: ['%IT% dhoondo', '%IT% search karo'],
  },
  clear: {
    en: ['clear my list', 'empty my list', 'remove everything', 'start over'],
    es: ['vacía mi lista', 'borra todo'],
    fr: ['vide ma liste', 'efface tout'],
    hi: ['meri list khali karo'],
  },
  help: {
    en: ['help', 'what can i do', 'how do i use this'],
    es: ['ayuda', 'qué hago'],
    fr: ['aide'],
    hi: ['madd', 'help'],
  },
};

/* -------------------------------------------------------------------------
 * INTENT_EXAMPLES — labeled utterances that train the on-device TF-IDF/k-NN
 * intent classifier in ml.js. These are real paraphrases (not keywords), so
 * the classifier generalizes: "we ran out of milk" and "i need milk" both
 * resolve to add_item. EN only; non-EN falls back to the rule patterns.
 * ----------------------------------------------------------------------- */
const INTENT_EXAMPLES = {
  add: [
    'add milk to my list', 'i need milk', 'i want milk', 'buy milk',
    'get milk', 'i could use some milk', 'grab milk', 'add milk',
    'we need milk', 'we are out of milk', 'put milk on my list',
    'can you add eggs', 'i want two apples', 'add 2 bottles of water',
    'pick up some bananas', 'stock up on cheese', 'add coffee please',
  ],
  remove: [
    'remove milk from my list', 'delete milk', 'take milk off my list',
    'i do not need milk anymore', 'drop milk', 'remove eggs',
    'cross off cheese', 'strikethrough bananas',
  ],
  list: [
    'what is on my list', 'show my list', 'read my list', 'show me my list',
    'my list', 'what did i add', 'how many items are there',
  ],
  search: [
    'find organic apples', 'search for apples', 'do you have apples',
    'look for apples', 'find toothpaste under 5', 'show me coffee',
    'what brands of cheese', 'where is the milk',
  ],
  clear: [
    'clear my list', 'empty my list', 'remove everything', 'start over',
    'delete my list', 'reset the list',
  ],
  help: [
    'help', 'what can i do', 'how do i use this', 'what commands',
    'how to use',
  ],
};

/* ------------------------------------------------------------------------
 * 8. QUANTITY words + unit tokens.
 * ----------------------------------------------------------------------- */
const QUANTITY_WORDS = {
  'a': 1, 'one': 1, '1': 1, 'two': 2, '2': 2, 'three': 3, '3': 3, 'four': 4, '4': 4,
  'five': 5, '5': 5, 'six': 6, '6': 6, 'seven': 7, '7': 7, 'eight': 8, '8': 8,
  'nine': 9, '9': 9, 'ten': 10, '10': 10, 'a dozen': 12, 'dozen': 12, 'half': 0.5,
};
const UNIT_WORDS = ['packets','packet','bottles','bottle','loaves','loaf','cups','cup','boxes','box',
  'bags','bag','liters','liter','litres','litre','kilos','kilo','kg','grams','gram','g'];

/* -------------------------------------------------------------------------
 * 9. STOPWORDS — stripped from the transcript before intent matching.
 * ----------------------------------------------------------------------- */
const STOPWORDS = new Set([
  'please','a','an','the','of','and','could','you','can','do','me','want','to',
  'very','really','so','some','just','would','like','my','list','from','need','i',
  "'m",'am','buy','get','us','on','looking','find','search',''
]);

/* -------------------------------------------------------------------------
 * Export: work in the browser (window.VOICE_DATA) and in Node tests.
 * ----------------------------------------------------------------------- */
if (typeof window !== 'undefined' && window) {
  window.VOICE_DATA = {
    PRODUCTS, ALIAS_MAP, BRANDS_BY_TYPE, PRICE_RANGES, SUBSTITUTES,
    SEASONAL, INTENT_PATTERNS, INTENT_EXAMPLES, QUANTITY_WORDS, UNIT_WORDS, STOPWORDS,
  };
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
    PRODUCTS, ALIAS_MAP, BRANDS_BY_TYPE, PRICE_RANGES, SUBSTITUTES,
    SEASONAL, INTENT_PATTERNS, INTENT_EXAMPLES, QUANTITY_WORDS, UNIT_WORDS, STOPWORDS,
  };
}

})();
