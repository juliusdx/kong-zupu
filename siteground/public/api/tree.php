<?php
/**
 * The whole tree, filtered to what the caller may see.
 *
 * Replaces the front-end's Supabase reads (persons, places, media, contacts) with
 * one request. The shape matches what js/app.js already expects after camel(),
 * so the client change is the fetch, not the rendering.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/repo.php';

$v = viewer();
json_out([
    'viewer'  => [
        'signedIn' => $v->isSignedIn(),
        'admin'    => $v->isAdmin,
        'approved' => $v->isApproved,
    ],
    'persons' => repo_persons($v),
    'places'  => repo_places($v),
    'media'   => repo_media($v),
    'contacts'=> repo_contacts($v),
]);
