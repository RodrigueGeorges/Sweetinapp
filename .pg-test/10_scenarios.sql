-- Scénarios de validation : consentement entre amis + envoi atomique/idempotent.
-- Chaque ligne affiche PASS/FAIL.
set client_min_messages = warning;

-- ---------- comptes de test ----------
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"username":"bob"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"username":"carol"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"username":"dave"}');
update public.profiles set onboarded = true;

create or replace function as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, false), set_config('request.jwt.claim.role', 'authenticated', false)
$$;
create or replace function as_service() returns void language sql as $$
  select set_config('request.jwt.claim.role', 'service_role', false)
$$;
create or replace function ok(label text, cond boolean) returns text language sql as $$
  select case when cond then 'PASS' else 'FAIL' end || ' · ' || label
$$;

-- ---------- demandes d'ami ----------
select as_user('00000000-0000-0000-0000-00000000000a');
select ok('A demande B -> sent', (request_friend('bob')->>'status') = 'sent');
select ok('demande enregistrée', exists (select 1 from friend_requests where from_user='00000000-0000-0000-0000-00000000000a' and to_user='00000000-0000-0000-0000-00000000000b'));
select ok('pas d''amitié unilatérale', not exists (select 1 from friendships where user_id='00000000-0000-0000-0000-00000000000a'));
select ok('redemande -> sent (pas de doublon)', (request_friend('bob')->>'status') = 'sent' and (select count(*) from friend_requests where from_user='00000000-0000-0000-0000-00000000000a' and to_user='00000000-0000-0000-0000-00000000000b') = 1);

select as_user('00000000-0000-0000-0000-00000000000b');
select ok('B voit la demande entrante', (select jsonb_array_length(list_friend_requests()->'incoming')) = 1);
select ok('B demande A -> consentement mutuel', (request_friend('alice')->>'status') = 'friends');
select ok('amitié dans les deux sens', (select count(*) from friendships where (user_id='00000000-0000-0000-0000-00000000000a' and friend_id='00000000-0000-0000-0000-00000000000b') or (user_id='00000000-0000-0000-0000-00000000000b' and friend_id='00000000-0000-0000-0000-00000000000a')) = 2);
select ok('demandes purgées', not exists (select 1 from friend_requests));

select as_user('00000000-0000-0000-0000-00000000000a');
select ok('déjà amis -> friends', (request_friend('bob')->>'status') = 'friends');
select ok('A demande C -> sent', (request_friend('carol')->>'status') = 'sent');

select as_user('00000000-0000-0000-0000-00000000000c');
select ok('C accepte A -> profil retourné', (accept_friend('00000000-0000-0000-0000-00000000000a')).username = 'alice');
select ok('amitié A-C dans les deux sens', (select count(*) from friendships where (user_id='00000000-0000-0000-0000-00000000000a' and friend_id='00000000-0000-0000-0000-00000000000c') or (user_id='00000000-0000-0000-0000-00000000000c' and friend_id='00000000-0000-0000-0000-00000000000a')) = 2);

-- refus : A demande D, D refuse
select as_user('00000000-0000-0000-0000-00000000000a');
select ok('A demande D -> sent', (request_friend('dave')->>'status') = 'sent');
select as_user('00000000-0000-0000-0000-00000000000d');
select decline_friend('00000000-0000-0000-0000-00000000000a');
select ok('demande refusée supprimée', not exists (select 1 from friend_requests));
select ok('pas d''amitié après refus', not exists (select 1 from friendships where friend_id='00000000-0000-0000-0000-00000000000d' or user_id='00000000-0000-0000-0000-00000000000d'));

-- rétrocompatibilité add_friend -> devient une demande
select as_user('00000000-0000-0000-0000-00000000000d');
select ok('add_friend legacy -> profil', (add_friend('alice')).username = 'alice');
select ok('add_friend legacy -> demande créée', exists (select 1 from friend_requests where from_user='00000000-0000-0000-0000-00000000000d' and to_user='00000000-0000-0000-0000-00000000000a'));

-- cas limites
select as_user('00000000-0000-0000-0000-00000000000a');
select ok('soi-même refusé', (select x from (select 1) t left join lateral (select request_friend('alice')::text x) s on false) is null);
select ok('pseudo inconnu refusé', (select x from (select 1) t left join lateral (select request_friend('personne')::text x) s on false) is null);

-- ---------- envoi atomique ----------
select as_user('00000000-0000-0000-0000-00000000000a');
select ok('commit_flip refusé hors service_role', (select x from (select 1) t left join lateral (select commit_flip('00000000-0000-0000-0000-00000000000a','req0','00000000-0000-0000-0000-00000000000a/p.jpg','salut','once','{00000000-0000-0000-0000-00000000000b}',null,null,null,null)::text x) s on false) is null);

select as_service();
select ok('commit_flip -> created', (commit_flip('00000000-0000-0000-0000-00000000000a','req1','00000000-0000-0000-0000-00000000000a/p1.jpg','salut bob','once','{00000000-0000-0000-0000-00000000000b}',null,null,null,null)->>'created')::boolean);
select ok('un flip créé', (select count(*) from flips where sender_id='00000000-0000-0000-0000-00000000000a') = 1);
select ok('destinataire enregistré', (select count(*) from flip_recipients where recipient_id='00000000-0000-0000-0000-00000000000b') = 1);
select ok('reçu enregistré', (select count(*) from send_receipts) = 1);

-- idempotence : même request_id -> même résultat, aucun doublon
select ok('rejoue -> pas de doublon', (commit_flip('00000000-0000-0000-0000-00000000000a','req1','00000000-0000-0000-0000-00000000000a/p1.jpg','salut bob','once','{00000000-0000-0000-0000-00000000000b}',null,null,null,null)->>'created')::boolean = false);
select ok('toujours un seul flip', (select count(*) from flips) = 1);

-- envoi vers un non-ami refusé
select ok('envoi à un non-ami refusé', (select x from (select 1) t left join lateral (select commit_flip('00000000-0000-0000-0000-00000000000a','req2','00000000-0000-0000-0000-00000000000a/p2.jpg','yo','once','{00000000-0000-0000-0000-00000000000d}',null,null,null,null)::text x) s on false) is null);
select ok('aucun flip créé pour le refus', (select count(*) from flips) = 1);

-- blocage : B bloque A -> envoi refusé
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000a');
select ok('envoi vers un bloqueur refusé', (select x from (select 1) t left join lateral (select commit_flip('00000000-0000-0000-0000-00000000000a','req3','00000000-0000-0000-0000-00000000000a/p3.jpg','yo','once','{00000000-0000-0000-0000-00000000000b}',null,null,null,null)::text x) s on false) is null);
delete from public.blocks;

-- validations d'entrée
select ok('message trop long refusé', (select x from (select 1) t left join lateral (select commit_flip('00000000-0000-0000-0000-00000000000a','req4','00000000-0000-0000-0000-00000000000a/p4.jpg',repeat('x',91),'once','{00000000-0000-0000-0000-00000000000b}',null,null,null,null)::text x) s on false) is null);
select ok('photo d''un autre refusée', (select x from (select 1) t left join lateral (select commit_flip('00000000-0000-0000-0000-00000000000a','req5','00000000-0000-0000-0000-00000000000b/p5.jpg','yo','once','{00000000-0000-0000-0000-00000000000b}',null,null,null,null)::text x) s on false) is null);

-- lien privé sans destinataire : autorisé, jeton enregistré
select ok('lien privé sans ami requis', (commit_flip('00000000-0000-0000-0000-00000000000a','req6','00000000-0000-0000-0000-00000000000a/p6.jpg','pour toi','once','{}','single','tok123456789abcdef','prev',null)->>'created')::boolean);
select ok('jeton de lien enregistré', exists (select 1 from flip_links where token='tok123456789abcdef' and kind='single'));

select '=== FIN DES SCÉNARIOS ===' as done;
