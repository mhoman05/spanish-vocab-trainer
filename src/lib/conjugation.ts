/**
 * Curated irregular-verb conjugation data + a generator that turns it into
 * drill cards. Each card asks for ONE form (verb x tense x person) and shows a
 * plain-English cue so you don't need to know grammar terminology.
 */

export type Tense = "present" | "preterite" | "imperfect" | "future" | "conditional";

export const TENSES: Tense[] = ["present", "preterite", "imperfect", "future", "conditional"];

/** Plain-language description shown under every card. */
export const TENSE_LABEL: Record<Tense, string> = {
  present: "present — happening now / in general",
  preterite: "simple past — one finished action (“I did it”)",
  imperfect: "past — habit or ongoing background (“I used to / was …ing”)",
  future: "future — “will …”",
  conditional: "conditional — “would …”",
};

export const PERSONS = [
  { key: "yo", es: "yo", subj: "I" },
  { key: "tu", es: "tú", subj: "you" },
  { key: "el", es: "él / ella / usted", subj: "he" },
  { key: "nos", es: "nosotros", subj: "we" },
  { key: "vos", es: "vosotros", subj: "you all" },
  { key: "ellos", es: "ellos / ellas / ustedes", subj: "they" },
] as const;

interface EnglishSpec {
  base: string; // bare form, e.g. "have"
  third: string; // 3rd-person singular present, e.g. "has"
  past: string; // simple past, e.g. "had"
  presentParadigm?: string[]; // override all 6 present forms (for "to be")
  pastParadigm?: string[]; // override all 6 simple-past forms (for "to be")
  modal?: Partial<Record<Tense, string>>; // full replacement phrase per person-less tense (poder)
}

interface VerbData {
  inf: string;
  gloss: string; // shown as the English meaning of the verb
  en: EnglishSpec;
  present: string[]; // 6 forms
  preterite: string[]; // 6 forms
  imperfect?: string[]; // only when irregular
  futureStem?: string; // only when irregular (conditional shares it)
}

const be: EnglishSpec = {
  base: "be",
  third: "is",
  past: "was",
  presentParadigm: ["am", "are", "is", "are", "are", "are"],
  pastParadigm: ["was", "were", "was", "were", "were", "were"],
};

// Ordered by rough frequency — earlier verbs are introduced first.
export const VERBS: VerbData[] = [
  {
    inf: "ser", gloss: "to be (identity, traits)", en: be,
    present: ["soy", "eres", "es", "somos", "sois", "son"],
    preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    imperfect: ["era", "eras", "era", "éramos", "erais", "eran"],
  },
  {
    inf: "estar", gloss: "to be (state, location)", en: be,
    present: ["estoy", "estás", "está", "estamos", "estáis", "están"],
    preterite: ["estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron"],
  },
  {
    inf: "tener", gloss: "to have", en: { base: "have", third: "has", past: "had" },
    present: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
    preterite: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"],
    futureStem: "tendr",
  },
  {
    inf: "hacer", gloss: "to do / to make", en: { base: "make", third: "makes", past: "made" },
    present: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
    preterite: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"],
    futureStem: "har",
  },
  {
    inf: "poder", gloss: "to be able / can",
    en: {
      base: "be able to", third: "is able to", past: "was able to",
      modal: {
        present: "can",
        preterite: "could (managed to)",
        imperfect: "could / used to be able to",
        future: "will be able to",
        conditional: "would be able to",
      },
    },
    present: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
    preterite: ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"],
    futureStem: "podr",
  },
  {
    inf: "decir", gloss: "to say / to tell", en: { base: "say", third: "says", past: "said" },
    present: ["digo", "dices", "dice", "decimos", "decís", "dicen"],
    preterite: ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"],
    futureStem: "dir",
  },
  {
    inf: "ir", gloss: "to go", en: { base: "go", third: "goes", past: "went" },
    present: ["voy", "vas", "va", "vamos", "vais", "van"],
    preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    imperfect: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"],
  },
  {
    inf: "ver", gloss: "to see", en: { base: "see", third: "sees", past: "saw" },
    present: ["veo", "ves", "ve", "vemos", "veis", "ven"],
    preterite: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
    imperfect: ["veía", "veías", "veía", "veíamos", "veíais", "veían"],
  },
  {
    inf: "dar", gloss: "to give", en: { base: "give", third: "gives", past: "gave" },
    present: ["doy", "das", "da", "damos", "dais", "dan"],
    preterite: ["di", "diste", "dio", "dimos", "disteis", "dieron"],
  },
  {
    inf: "saber", gloss: "to know (a fact)", en: { base: "know", third: "knows", past: "knew" },
    present: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
    preterite: ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"],
    futureStem: "sabr",
  },
  {
    inf: "querer", gloss: "to want", en: { base: "want", third: "wants", past: "wanted" },
    present: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
    preterite: ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"],
    futureStem: "querr",
  },
  {
    inf: "poner", gloss: "to put", en: { base: "put", third: "puts", past: "put" },
    present: ["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"],
    preterite: ["puse", "pusiste", "puso", "pusimos", "pusisteis", "pusieron"],
    futureStem: "pondr",
  },
  {
    inf: "venir", gloss: "to come", en: { base: "come", third: "comes", past: "came" },
    present: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
    preterite: ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"],
    futureStem: "vendr",
  },
  {
    inf: "salir", gloss: "to leave / to go out", en: { base: "leave", third: "leaves", past: "left" },
    present: ["salgo", "sales", "sale", "salimos", "salís", "salen"],
    preterite: ["salí", "saliste", "salió", "salimos", "salisteis", "salieron"],
    futureStem: "saldr",
  },
  {
    inf: "traer", gloss: "to bring", en: { base: "bring", third: "brings", past: "brought" },
    present: ["traigo", "traes", "trae", "traemos", "traéis", "traen"],
    preterite: ["traje", "trajiste", "trajo", "trajimos", "trajisteis", "trajeron"],
  },
  {
    inf: "conocer", gloss: "to know (a person / place)", en: { base: "know", third: "knows", past: "knew" },
    present: ["conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"],
    preterite: ["conocí", "conociste", "conoció", "conocimos", "conocisteis", "conocieron"],
  },
  {
    inf: "pedir", gloss: "to ask for / to order", en: { base: "ask for", third: "asks for", past: "asked for" },
    present: ["pido", "pides", "pide", "pedimos", "pedís", "piden"],
    preterite: ["pedí", "pediste", "pidió", "pedimos", "pedisteis", "pidieron"],
  },
  {
    inf: "sentir", gloss: "to feel", en: { base: "feel", third: "feels", past: "felt" },
    present: ["siento", "sientes", "siente", "sentimos", "sentís", "sienten"],
    preterite: ["sentí", "sentiste", "sintió", "sentimos", "sentisteis", "sintieron"],
  },
  {
    inf: "dormir", gloss: "to sleep", en: { base: "sleep", third: "sleeps", past: "slept" },
    present: ["duermo", "duermes", "duerme", "dormimos", "dormís", "duermen"],
    preterite: ["dormí", "dormiste", "durmió", "dormimos", "dormisteis", "durmieron"],
  },
  {
    inf: "seguir", gloss: "to follow / to keep on", en: { base: "follow", third: "follows", past: "followed" },
    present: ["sigo", "sigues", "sigue", "seguimos", "seguís", "siguen"],
    preterite: ["seguí", "seguiste", "siguió", "seguimos", "seguisteis", "siguieron"],
  },
  {
    inf: "volver", gloss: "to return / to come back", en: { base: "return", third: "returns", past: "returned" },
    present: ["vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"],
    preterite: ["volví", "volviste", "volvió", "volvimos", "volvisteis", "volvieron"],
  },
  {
    inf: "pensar", gloss: "to think", en: { base: "think", third: "thinks", past: "thought" },
    present: ["pienso", "piensas", "piensa", "pensamos", "pensáis", "piensan"],
    preterite: ["pensé", "pensaste", "pensó", "pensamos", "pensasteis", "pensaron"],
  },
  {
    inf: "empezar", gloss: "to begin / to start", en: { base: "begin", third: "begins", past: "began" },
    present: ["empiezo", "empiezas", "empieza", "empezamos", "empezáis", "empiezan"],
    preterite: ["empecé", "empezaste", "empezó", "empezamos", "empezasteis", "empezaron"],
  },
  {
    inf: "contar", gloss: "to count / to tell", en: { base: "tell", third: "tells", past: "told" },
    present: ["cuento", "cuentas", "cuenta", "contamos", "contáis", "cuentan"],
    preterite: ["conté", "contaste", "contó", "contamos", "contasteis", "contaron"],
  },
  {
    inf: "jugar", gloss: "to play", en: { base: "play", third: "plays", past: "played" },
    present: ["juego", "juegas", "juega", "jugamos", "jugáis", "juegan"],
    preterite: ["jugué", "jugaste", "jugó", "jugamos", "jugasteis", "jugaron"],
  },
  {
    inf: "entender", gloss: "to understand", en: { base: "understand", third: "understands", past: "understood" },
    present: ["entiendo", "entiendes", "entiende", "entendemos", "entendéis", "entienden"],
    preterite: ["entendí", "entendiste", "entendió", "entendimos", "entendisteis", "entendieron"],
  },
  {
    inf: "conducir", gloss: "to drive", en: { base: "drive", third: "drives", past: "drove" },
    present: ["conduzco", "conduces", "conduce", "conducimos", "conducís", "conducen"],
    preterite: ["conduje", "condujiste", "condujo", "condujimos", "condujisteis", "condujeron"],
  },
  {
    inf: "oír", gloss: "to hear", en: { base: "hear", third: "hears", past: "heard" },
    present: ["oigo", "oyes", "oye", "oímos", "oís", "oyen"],
    preterite: ["oí", "oíste", "oyó", "oímos", "oísteis", "oyeron"],
  },
  {
    inf: "caer", gloss: "to fall", en: { base: "fall", third: "falls", past: "fell" },
    present: ["caigo", "caes", "cae", "caemos", "caéis", "caen"],
    preterite: ["caí", "caíste", "cayó", "caímos", "caísteis", "cayeron"],
  },
];

const FUT_ENDINGS = ["é", "ás", "á", "emos", "éis", "án"];
const COND_ENDINGS = ["ía", "ías", "ía", "íamos", "íais", "ían"];

function imperfect(v: VerbData): string[] {
  if (v.imperfect) return v.imperfect;
  const stem = v.inf.slice(0, -2);
  const e = v.inf.endsWith("ar")
    ? ["aba", "abas", "aba", "ábamos", "abais", "aban"]
    : ["ía", "ías", "ía", "íamos", "íais", "ían"];
  return e.map((end) => stem + end);
}

function future(v: VerbData): string[] {
  const stem = v.futureStem ?? v.inf;
  return FUT_ENDINGS.map((end) => stem + end);
}

function conditional(v: VerbData): string[] {
  const stem = v.futureStem ?? v.inf;
  return COND_ENDINGS.map((end) => stem + end);
}

export function formsFor(v: VerbData, tense: Tense): string[] {
  switch (tense) {
    case "present": return v.present;
    case "preterite": return v.preterite;
    case "imperfect": return imperfect(v);
    case "future": return future(v);
    case "conditional": return conditional(v);
  }
}

/** Plain-English prompt for a form, e.g. "he had  (one completed action)". */
export function englishCue(v: VerbData, tense: Tense, person: number): string {
  const subj = PERSONS[person].subj;
  const en = v.en;
  if (en.modal?.[tense]) return `${subj} ${en.modal[tense]}`;

  switch (tense) {
    case "present": {
      const form = en.presentParadigm
        ? en.presentParadigm[person]
        : person === 2
          ? en.third
          : en.base;
      return `${subj} ${form}`;
    }
    case "preterite": {
      const form = en.pastParadigm ? en.pastParadigm[person] : en.past;
      return `${subj} ${form}`;
    }
    case "imperfect":
      return `${subj} used to ${en.base}`;
    case "future":
      return `${subj} will ${en.base}`;
    case "conditional":
      return `${subj} would ${en.base}`;
  }
}

export interface GeneratedCard {
  id: string;
  verb: string;
  gloss: string;
  tense: Tense;
  person: number;
  answer: string;
  cue: string;
  order: number; // introduction order
}

/** Every verb x tense x person combination as a flat list. */
export function generateAllCards(): GeneratedCard[] {
  const out: GeneratedCard[] = [];
  const tenseOrder: Tense[] = ["present", "preterite", "imperfect", "future", "conditional"];
  VERBS.forEach((v, vi) => {
    tenseOrder.forEach((tense, ti) => {
      const forms = formsFor(v, tense);
      PERSONS.forEach((_, pi) => {
        out.push({
          id: `${v.inf}:${tense}:${pi}`,
          verb: v.inf,
          gloss: v.gloss,
          tense,
          person: pi,
          answer: forms[pi],
          cue: englishCue(v, tense, pi),
          order: vi * 1000 + ti * 100 + pi,
        });
      });
    });
  });
  return out;
}
