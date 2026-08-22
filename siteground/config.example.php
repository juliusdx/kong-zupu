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
        'from'      => 'zupu@accme.my',
        'from_name' => '江氏族譜 Kong Family Zupu',

        // Authenticated SMTP (Site Tools → Email → Accounts). When host is
        // set, mail leaves through the real mailbox — better regarded by
        // Outlook/Microsoft junk filters than raw mail(), which junked on
        // first test despite perfect DKIM. Leave host '' to fall back to
        // PHP mail() with an aligned -f envelope (tests, fresh installs).
        // The password lives only in this git-ignored file.
        'smtp_host' => '',           // e.g. mail.accme.my
        'smtp_port' => 465,          // 465 = implicit TLS; 587 = STARTTLS
        'smtp_user' => '',           // zupu@accme.my
        'smtp_pass' => '',
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
