// Textes des notifications, écrits dans chaque langue (pas traduits mot à mot). Sobres, sans emoji.
export type Lang = 'fr' | 'en';
export const asLang = (l: unknown): Lang => (l === 'en' ? 'en' : 'fr');
const dot = (lang: Lang, s: string) => (lang === 'en' ? s.replace(',', '.') : s);

export const copy = {
  flip: (lang: Lang, name: string) => (lang === 'en' ? `${name} hid a secret for you. Scratch to read it.` : `${name} t’a caché un secret. Gratte pour le lire.`),
  sweetHour: (lang: Lang) => {
    const list =
      lang === 'en'
        ? ['It’s sweet hour. Everyone’s posting now.', 'Sweet hour: two minutes to send a flip.']
        : ['C’est le sweet hour. Tout le monde poste maintenant.', 'Sweet hour : deux minutes pour envoyer un flip.'];
    return list[Math.floor(Math.random() * list.length)];
  },
  streakTitle: (lang: Lang, days: number, name: string) => (lang === 'en' ? `${days}-day streak with ${name}` : `Série de ${days} jours avec ${name}`),
  streakBody: (lang: Lang) => (lang === 'en' ? 'It melts at midnight. One flip keeps it going.' : 'Elle fond à minuit. Un flip suffit pour la garder.'),
  streakMilestone: (lang: Lang, days: number, name: string) => (lang === 'en' ? `${days} days in a row with ${name}. Keep it going.` : `${days} jours d’affilée avec ${name}. Continuez.`),
  liveTitle: (lang: Lang) => (lang === 'en' ? 'sweet hour' : 'sweet hour'),
  liveSub: (lang: Lang) => (lang === 'en' ? 'Everyone posts right now.' : 'Tout le monde poste maintenant.'),
  liveCta: (lang: Lang) => (lang === 'en' ? 'send →' : 'envoyer →'),
  friend: (lang: Lang) => (lang === 'en' ? 'your friend' : 'ton ami'),
  linkScratched: (lang: Lang, p: number, s: string) => (lang === 'en' ? `Your link was scratched · ${p}% in ${dot(lang, s)} s` : `Ton lien a été gratté · ${p} % en ${s} s`),
  storyMilestone: (lang: Lang, n: number) => (lang === 'en' ? `${n} people scratched your story` : `${n} personnes ont gratté ta story`),
  screenshot: (lang: Lang, name: string) => (lang === 'en' ? `${name} tried to screenshot your flip. It was blocked.` : `${name} a tenté une capture de ton flip. Elle a été bloquée.`),
  reacted: (lang: Lang, name: string, r: string) => (lang === 'en' ? `${name} reacted ${r} to your flip` : `${name} a réagi ${r} à ton flip`),
  scratched: (lang: Lang, name: string, p: number, s: string) => (lang === 'en' ? `${name} scratched your flip · ${p}% in ${dot(lang, s)} s` : `${name} a gratté ton flip · ${p} % en ${s} s`),
  linkOpened: (lang: Lang) => (lang === 'en' ? 'Your private link was just opened' : 'Ton lien privé vient d’être ouvert'),
  someone: (lang: Lang) => (lang === 'en' ? 'Someone' : 'Quelqu’un'),
};
