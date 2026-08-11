-- ============================================================================
--  Kong Zupu — graft the Sabah branch onto the book spine
--  Written and APPLIED to prod 2026-08-11. Kept as the record of what changed.
--
--  江學禮 (Corin) settled the open graft question: 永宏 → Zhun Fah → Yu Chong,
--  i.e. Yu Chong is Zhun Fah's SON, not his brother as the MyHeritage tree had it.
--  That identifies three MyHeritage people as book people already in the tree:
--    永宏 Kong    = 永宏公        k_yonghong (gen 22)
--    En Zhao Kong = 黎氏 禮名恩照  k_lishi    — "En Zhao" is 恩照, "née Lei" is 黎
--    Zhun Fah Kong= 俊華 b.1875   k_junhua   (gen 23)
--  So Yu Chong 有章 (b.1912) hangs off k_junhua at gen 24, the same generation and
--  the same years as his cousin 其昌 (有喬) b.1913. Corrinne Kong had independently
--  entered him under 俊華 as 有章 (c_bed10d60), which is the same conclusion.
--
--  data/lineage.js was edited to match; these live rows would otherwise resurrect
--  the duplicates, since live `persons` rows override the static seed by id.
-- ============================================================================

begin;

-- 有章 IS Yu Chong, so the child Corrinne attached to the duplicate keeps its parent.
-- (Still "(unnamed)" — worth asking Corrinne who this is.)
update persons set father_id = 'mh_yuchong' where father_id = 'c_bed10d60';

-- Drop the duplicates, dependants first. Every one of these people survives:
-- c_bed10d60 → mh_yuchong, mh_zhunfah → k_junhua, mh_enzhao → k_lishi, mh_yonghong → k_yonghong.
delete from persons where id in ('c_bed10d60', 'mh_zhunfah', 'mh_enzhao');
delete from persons where id = 'mh_yonghong';

-- Expect ZERO rows: every child exactly one generation below its father.
select c.id, c.name, c.gen, f.name as father, f.gen as father_gen
from persons c join persons f on f.id = c.father_id
where c.gen is not null and f.gen is not null and c.gen - f.gen <> 1;

commit;

-- Result: one unbroken line from the 始祖 to the living branch —
--   江八郎 (1) … 承續 (20) → 大信 (21) → 永宏 (22) → 俊華 (23) → 有章 (24) → …
