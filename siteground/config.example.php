<?php
/**
 * Copy to config.php and fill in. config.php is git-ignored — it holds the
 * database password and the mail credentials, and this repo is PUBLIC.
 */
return [
    'db' => [
        'driver' => 'mysql',
        'host'   => 'localhost',
        'port'   => 3306,
        'name'   => 'kong_zupu',
        'user'   => 'kong_zupu',
        'pass'   => '',
    ],

    // Where uploaded photos live. MUST be outside the web root: nothing may be
    // reachable by URL. photo.php is the only thing that opens these files.
    // On SiteGround, something like /home/<account>/zupu-media (NOT public_html).
    'media_root' => '/home/CHANGEME/zupu-media',

    'site_url' => 'https://zupu.example.com',

    'mail' => [
        'from'      => 'zupu@example.com',
        'from_name' => '江氏族譜 Kong Family Zupu',
    ],

    // Cookies are only sent over HTTPS. Leave true in production; set false only
    // for a local http:// test.
    'secure_cookies' => true,

    // Deploy-day switch. false = permissive: a signed-in member who is not yet
    // APPROVED still sees detail, and every such case is written to access_log
    // as "would_refuse". Turn it on once the log is quiet and everyone who
    // should be approved has been.
    //
    // Note what this does NOT do: it never lets a signed-OUT visitor see
    // member content, and never reveals a minor. Those refusals are absolute in
    // both modes. The switch only softens the approved-member step, which is the
    // one that would lock relatives out on day one.
    'enforce_approval' => false,
];
