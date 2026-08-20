<?php
/** Who am I? The front-end asks this on load to decide what to render. */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/bootstrap.php';

$v = viewer();
json_out([
    'signedIn' => $v->isSignedIn(),
    'admin'    => $v->isAdmin,
    'approved' => $v->isApproved,
    'personId' => $v->personId,
]);
