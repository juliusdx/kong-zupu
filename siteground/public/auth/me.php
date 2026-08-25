<?php
/** Who am I? The front-end asks this on load to decide what to render. */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/bootstrap.php';

$v = viewer();

// The sign-in button shows a name, so the identity has to come back with the
// permissions. Viewer deliberately carries only what the privacy model needs —
// it is passed to every gate in visibility.php and should not grow display
// fields — so the label is fetched here, where it is actually used.
$email = null;
$name  = null;
if ($v->isSignedIn()) {
    $u = q1('SELECT email, full_name FROM users WHERE id = ?', [$v->userId]);
    if ($u) { $email = (string)$u['email']; $name = $u['full_name'] !== null ? (string)$u['full_name'] : null; }
}

json_out([
    'signedIn' => $v->isSignedIn(),
    'admin'    => $v->isAdmin,
    'approved' => $v->isApproved,
    'personId' => $v->personId,
    'userId'   => $v->userId,
    'email'    => $email,
    'fullName' => $name,
]);
