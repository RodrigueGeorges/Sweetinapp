// Patch temporaire du typegen expo-router pour inclure /mine/[token] tant que le typegen n'a pas tourné.
const fs = require('fs');
const p = '.expo/types/router.d.ts';
let s = fs.readFileSync(p, 'utf8');

const inP = '{ pathname: `/u/[username]`, params: Router.UnknownInputParams & { username: string | number; } }';
const inMine = '{ pathname: `/mine/[token]`, params: Router.UnknownInputParams & { token: string | number; } }';
s = s.split(inP).join(inP + ' | ' + inMine);

const outP = '{ pathname: `/u/[username]`, params: Router.UnknownOutputParams & { username: string; } }';
const outMine = '{ pathname: `/mine/[token]`, params: Router.UnknownOutputParams & { token: string; } }';
s = s.split(outP).join(outP + ' | ' + outMine);

const dyn = '`/u/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | \'\'}`';
const dynMine = '`/mine/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | \'\'}`';
s = s.split(dyn).join(dyn + ' | ' + dynMine);

fs.writeFileSync(p, s);
console.log('mine entries:', (s.match(/mine\/\[token\]/g) || []).length, '| dyn:', (s.match(/\/mine\/\$\{/g) || []).length);
