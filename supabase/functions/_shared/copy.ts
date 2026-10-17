// Textes des notifications, écrits dans chaque langue (pas traduits mot à mot), dans le ton de l'app (design system Fondant) :
// minuscules, court, un peu insolent. Seul emoji permis : la réaction reçue.
export type Lang = 'fr' | 'en';
export const asLang = (l: unknown): Lang => (l === 'en' ? 'en' : 'fr');
const dot = (lang: Lang, s: string) => (lang === 'en' ? s.replace(',', '.') : s);
/** Lu en moins d'une demi-seconde : lu sans gratter. */
const fast = (s: string) => Number(s.replace(',', '.')) < 0.5;

export const copy = {
  flip: (lang: Lang, name: string) => (lang === 'en' ? `${name} hid a word under a photo. scratch it.` : `${name} t’a caché un mot sous une photo. gratte.`),
  sweetHour: (lang: Lang) => {
    const list =
      lang === 'en'
        ? ['sweet hour. everyone’s posting now.', 'sweet hour: two minutes to send a sweet.']
        : ['sweet hour. tout le monde poste maintenant.', 'sweet hour : deux minutes pour envoyer un sweet.'];
    return list[Math.floor(Math.random() * list.length)];
  },
  streakTitle: (lang: Lang, days: number, name: string) => (lang === 'en' ? `${days}d with ${name}` : `${days}j avec ${name}`),
  streakBody: (lang: Lang) => (lang === 'en' ? 'it melts at midnight. one sweet saves it.' : 'ça fond à minuit. un sweet suffit à la sauver.'),
  streakMilestone: (lang: Lang, days: number, name: string) => (lang === 'en' ? `${days} days in a row with ${name}. don’t stop now.` : `${days} jours d’affilée avec ${name}. lâchez rien.`),
  liveTitle: (lang: Lang) => (lang === 'en' ? 'sweet hour' : 'sweet hour'),
  liveSub: (lang: Lang) => (lang === 'en' ? 'everyone’s posting right now.' : 'tout le monde poste maintenant.'),
  friend: (lang: Lang) => (lang === 'en' ? 'your friend' : 'ton ami'),
  // « lu », pas « gratté » : le pourcentage reste dans l'app ; sans grattage (0 s), on ne donne pas de durée
  linkScratched: (lang: Lang, _p: number, s: string) => (fast(s) ? (lang === 'en' ? 'your link was read. it melted.' : 'ton lien a été lu. il a fondu.') : lang === 'en' ? `your link was read in ${dot(lang, s)} s. it melted.` : `ton lien a été lu en ${s} s. il a fondu.`),
  storyMilestone: (lang: Lang, n: number) => (lang === 'en' ? `${n} people scratched your story` : `${n} personnes ont gratté ta story`),
  screenshot: (lang: Lang, name: string) => (lang === 'en' ? `${name} tried to screenshot your sweet. blocked.` : `${name} a tenté une capture de ton sweet. bloquée.`),
  reacted: (lang: Lang, name: string, r: string) => (lang === 'en' ? `${name} reacted ${r} to your sweet` : `${name} a réagi ${r} à ton sweet`),
  scratched: (lang: Lang, name: string, _p: number, s: string) => (fast(s) ? (lang === 'en' ? `${name} read your word. it melted.` : `${name} a lu ton mot. il a fondu.`) : lang === 'en' ? `${name} read your word in ${dot(lang, s)} s. it melted.` : `${name} a lu ton mot en ${s} s. il a fondu.`),
  linkOpened: (lang: Lang) => (lang === 'en' ? 'someone just opened your private link' : 'quelqu’un vient d’ouvrir ton lien privé'),
  someone: (lang: Lang) => (lang === 'en' ? 'someone' : 'quelqu’un'),
};
