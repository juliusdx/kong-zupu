<?php
/**
 * Every read of a gated table lives here. Nothing else may SELECT from persons,
 * places, media or contacts — that single rule is what keeps the privacy model
 * in one place instead of scattered across endpoints.
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

/** Columns safe for anyone who may see the row at all. No birth year, no bio. */
const PERSON_BASIC = 'id, gen, name, pinyin, ritual_name, formal_name, hao, milk_name, aka,
                      gender, father_id, spouse_of, relation, living, confidence, visibility,
                      birth_place, residence_place, burial_place, lat, lng';

/**
 * What a SIGNED-OUT visitor may see of a living adult: their name and where they
 * sit in the tree, and nothing else. The redacted columns are selected as NULL
 * rather than omitted, so every row comes back the same shape as PERSON_BASIC
 * and the redaction is visible in the query instead of implied by its absence.
 */
const PERSON_SEARCH = "id, gen, name, pinyin, ritual_name, formal_name, hao, milk_name, aka,
                       gender, father_id, spouse_of, NULL AS relation, living, confidence, visibility,
                       NULL AS birth_place, NULL AS residence_place, NULL AS burial_place,
                       NULL AS lat, NULL AS lng";

function repo_persons(Viewer $v): array
{
    [$gate] = Visibility::rowGate($v, 'p');
    $rows = q("SELECT " . PERSON_BASIC . " FROM persons p WHERE {$gate} ORDER BY gen, name")->fetchAll();

    // The family decided that living ADULTS stay findable by name and tree
    // position without signing in — relatives use the tree to find each other.
    // Supabase encoded that in the persons_public_search view; it is carried
    // over here so that changing hosts does not quietly change what the family
    // chose. Everything that makes a person locatable or knowable — dates,
    // places, bio, photos, contacts — still needs a sign-in, and minors are
    // never included. The is_minor and archived guards are spelled out again
    // rather than inherited, so neither can be lost by editing the tier logic.
    if (!$v->isSignedIn()) {
        $rows = array_merge($rows, q(
            "SELECT " . PERSON_SEARCH . " FROM persons
              WHERE visibility = 'member' AND living = 1
                AND is_minor = 0 AND archived = 0"
        )->fetchAll());
        usort($rows, fn($a, $b) => [$a['gen'], $a['name']] <=> [$b['gen'], $b['name']]);
    }

    // Detail is a second decision, not part of the row gate: a signed-in member
    // sees WHO their relatives are; an APPROVED member sees their details.
    $enforce = (bool)(config()['enforce_approval'] ?? true);
    $mayDetail = Visibility::maySeeDetail($v);
    if (!$mayDetail && !$enforce && $v->isSignedIn()) {
        // Deploy-day grace: log what would have been refused, then allow it.
        access_log($v->userId, 'would_refuse', 'person_details', 'unapproved member');
        $mayDetail = true;
    }
    if (!$mayDetail) return $rows;

    $detail = [];
    foreach (q('SELECT person_id, birth_year, death_year, lifespan, religion, bio FROM person_details')->fetchAll() as $d) {
        $detail[$d['person_id']] = $d;
    }
    foreach ($rows as &$r) {
        // A deceased ancestor's dates are part of the public record and live on
        // the person row; person_details holds the LIVING members' detail.
        $d = $detail[$r['id']] ?? null;
        if ($d) foreach (['birth_year','death_year','lifespan','religion','bio'] as $k) {
            if ($d[$k] !== null && $d[$k] !== '') $r[$k] = $d[$k];
        }
    }
    return $rows;
}

function repo_places(Viewer $v): array
{
    [$gate] = Visibility::rowGate($v, 'pl', hasMinor: false, hasArchived: false);
    return q("SELECT id, type, name, name_en, lat, lng, approximate, note
                FROM places pl WHERE {$gate} ORDER BY name")->fetchAll();
}

/**
 * Photo METADATA. Never a URL — just the id the front-end turns into
 * photo.php?id=…, which checks again when the bytes are actually asked for.
 */
function repo_media(Viewer $v): array
{
    [$gate] = Visibility::rowGate($v, 'p');
    $sql = "SELECT m.id, m.person_id, m.place_id, m.caption, m.cover, m.approved, m.visibility
              FROM media m
              LEFT JOIN persons p ON p.id = m.person_id
             WHERE (m.person_id IS NULL OR {$gate})";
    if (!$v->isAdmin) {
        $sql .= " AND m.approved = 1 AND m.visibility IN ('public','member')";
        if (!$v->isSignedIn()) $sql .= " AND m.visibility = 'public'";
    }
    return q($sql . ' ORDER BY m.created_at')->fetchAll();
}

function repo_contact(Viewer $v, string $personId): ?array
{
    if (!Visibility::maySeeContact($v, $personId)) {
        access_log($v->userId, 'refused', 'contact:' . $personId);
        return null;
    }
    return q1('SELECT person_id, email, phone, wechat, address FROM contacts WHERE person_id = ?', [$personId]);
}
