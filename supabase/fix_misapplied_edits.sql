-- ============================================================================
--  Kong Zupu — repair mis-applied "edit" contributions + realign generations
--  Written 2026-08-11. REVIEW BEFORE RUNNING. Run in the SQL editor as one block.
--
--  WHY
--  The Contribute form's "Relative this connects to" picker meant the PARENT for
--  "add a child" but the PERSON BEING OVERWRITTEN for "correct an existing person".
--  Two corrections submitted on 2026-08-10 were filled in as if adding a child and
--  approved, so they overwrote the wrong ancestor:
--    • a01     江八郎 (始祖, gen 1)  →  became 江萬里 gen 2   (his son's details)
--    • k_daxin 大信   (gen 21)      →  became 永宏 gen 22    (his son's details)
--  That is why 永宏 shows up three times on the tree and why the breadcrumb roots
--  at 江萬里. js/contribute.js has been fixed so this shape of mistake can't recur.
--
--  Section 3 realigns the live rows with data/lineage.js, whose generations were
--  shifted −1 (the book heads p.66 承續公 as 二十世祖, not 二十一世).
-- ============================================================================

begin;

-- 1. Drop the two rows that only exist because of the mis-applied edits. Both people
--    are fully described in the static seed (data/lineage.js), so deleting the live
--    override restores them; there is nothing else on these rows worth keeping.
delete from persons where id in ('a01', 'k_daxin');

-- 2. 江萬戴 (a02c) was also written live by the same batch. The seed already carries
--    him with the same name and father, so drop the override for consistency.
delete from persons where id = 'a02c';

-- 3. Generations −1 for the Sabah / MyHeritage branch, to match data/lineage.js.
--    (mh_yonghong 24→23, Yu Chong 25→24, their children 26→25, and so on.)
update persons set gen = gen - 1 where id like 'mh\_%' and gen is not null;

-- 4. The two contributed rows carry the old numbering too.
--    c_bed10d60 = 有章 (You Zhang), c_e704564f = 义一 (Xander).
-- 有章 hangs under 俊華 (k_junhua, now gen 23), so he stays at 24 — the −1 shift
-- does NOT apply to him; his old 24 was already one short of his father.
update persons set gen = 24 where id = 'c_bed10d60';
update persons set gen = 27 where id = 'c_e704564f';   -- was 28

-- Check before committing: every child should sit exactly one generation below its
-- father. Expect ZERO rows (ignoring c_f1311d21, whose gen is deliberately null).
select c.id, c.name, c.gen, f.id as father, f.gen as father_gen
from persons c join persons f on f.id = c.father_id
where c.gen is not null and f.gen is not null and c.gen - f.gen <> 1;

commit;

-- ============================================================================
--  NOT DONE HERE — needs a family decision first
--
--  Yu Chong appears TWICE in the tree:
--    • mh_yuchong   "Yu Chong Kong" b.1912, son of the MyHeritage root 永宏 Kong
--    • c_bed10d60   "有章 / You Zhang" b.1912, entered as a son of 俊華 (k_junhua)
--  They are the same man. Merging them decides where the whole Sabah branch grafts
--  onto the book line, so it is left for the family (see Corin / Corrinne) to confirm.
--
--  Also pending: several 2026-08-10 corrections in `contributions` still carry a
--  relatedTo pointing at the subject's PARENT rather than the subject. Approving
--  them as-is would overwrite that parent. Check each one's "Editing <name>" line in
--  the admin panel before approving, or reject and ask for a resubmit on the fixed
--  form.
-- ============================================================================
