<?php
/**
 * Telling a contributor what happened to their submission.
 *
 * This is the PHP counterpart of the `notify-contributor` edge function, which
 * posted to a Make webhook that then sent the mail. Here there is no webhook
 * and no third party: lib/mailer.php already speaks authenticated SMTP as
 * zupu@accme.my, so the message goes straight out from the same mailbox the
 * sign-in links come from — one sender for everything the family receives.
 *
 * The build is separated from the send on purpose. Composing a message is
 * decidable — given a row and a status there is exactly one right answer, and
 * tests can assert it — while sending is IO that must not happen in a test
 * run. So notify_contributor_build() returns a message or null, and the
 * endpoint does the sending, which is the same split public/auth/request.php
 * already uses for the magic link.
 */
declare(strict_types=1);
require_once __DIR__ . '/mailer.php';

const NOTIFY_ACTION_LABEL = [
    'add_child'         => ['en' => 'new family member',        'zh' => '新增家族成員'],
    'add_spouse'        => ['en' => 'new spouse',               'zh' => '新增配偶'],
    'edit'              => ['en' => 'correction',               'zh' => '資料修正'],
    'add_place'         => ['en' => 'new location',             'zh' => '新增地點'],
    'update_place'      => ['en' => 'location update',          'zh' => '地點更新'],
    'fix_transcription' => ['en' => 'transcription correction', 'zh' => '釋文校正'],
];

const NOTIFY_FIELD_LABEL_ZH = [
    'name' => '姓名', 'pinyin' => '拼音', 'ritualName' => '字／號', 'milkName' => '乳名',
    'aka' => '別名', 'gender' => '性別', 'gen' => '世代', 'living' => '在世', 'birth' => '生年',
    'place' => '地點', 'bio' => '生平', 'personPhone' => '電話', 'personWechat' => '微信／WhatsApp',
    'personEmail' => '電郵',
];

/**
 * Who to write to, in the order the edge function resolved it.
 *
 * The order matters and is preserved deliberately: the address the submitter
 * typed beats the account they were signed into, because a relative filling in
 * a form for an elderly parent puts the reachable address in the form.
 *
 * The last resort — the subject's own email out of the payload — is worth
 * naming, because it is not the contributor at all. It writes to the person the
 * contribution is ABOUT. That is the live site's behaviour and is kept so the
 * port does not quietly change what relatives receive, but it means an edit to
 * someone's record can notify them that it happened.
 */
function notify_recipient(array $row, array $payload): ?array
{
    $name = null;

    $email = trim((string)($payload['submitterEmail'] ?? ''));

    // Who to write to and what to call them are separate questions, and the
    // edge function conflated them: it only read the account when the form had
    // supplied no address, so a signed-in relative who typed one was greeted as
    // "Family member" by a system that knew their name. The address rule is
    // unchanged — the typed one still wins — but the name is taken from the
    // account whenever we know which account submitted.
    if ($row['submitted_by'] ?? null) {
        $u = q1('SELECT email, full_name FROM users WHERE id = ?', [$row['submitted_by']]);
        if ($u) {
            if ($email === '') $email = trim((string)($u['email'] ?? ''));
            $name = ($u['full_name'] ?? '') !== '' ? (string)$u['full_name'] : null;
        }
    }
    if ($email === '') {
        $contact = (string)($payload['contributorContact'] ?? '');
        if (preg_match('/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/', $contact, $m)) $email = $m[0];
    }
    if ($email === '') $email = trim((string)($payload['personEmail'] ?? ''));

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return null;

    if ($name === null) {
        $c = trim((string)($payload['contributor'] ?? ''));
        if ($c !== '') $name = $c;
    }
    return ['email' => $email, 'name' => $name];
}

/** The from→to table, shared by both language sections because it is data. */
function notify_changes_table(array $changes, string $fieldHdr, string $fromHdr, string $toHdr): string
{
    if (!$changes) return '';
    $e = fn($s) => htmlspecialchars((string)($s ?? ''), ENT_QUOTES, 'UTF-8');
    $th = 'text-align:left;padding:.3rem .6rem;border-bottom:2px solid #e3d9c2;color:#b08833';
    $td = 'padding:.3rem .6rem;border-bottom:1px solid #efe6d2';

    $out = '<table style="border-collapse:collapse;margin:.6rem 0;font-size:.9rem;width:100%">'
         . "<thead><tr><th style=\"{$th}\">{$e($fieldHdr)}</th><th style=\"{$th}\">{$e($fromHdr)}</th>"
         . "<th style=\"{$th}\">{$e($toHdr)}</th></tr></thead><tbody>";
    foreach ($changes as $c) {
        if (!is_array($c)) continue;
        $zh    = NOTIFY_FIELD_LABEL_ZH[(string)($c['field'] ?? '')] ?? '';
        $label = $e($c['label'] ?? $c['field'] ?? '');
        $cell  = $zh !== '' ? $e($zh) . ' / ' . $label : $label;
        $out .= "<tr><td style=\"{$td}\"><strong>{$cell}</strong></td>"
              . "<td style=\"{$td};color:#9a8a6e\">" . ($e($c['from']) ?: '—') . '</td>'
              . "<td style=\"{$td};color:#2a6035\">" . ($e($c['to']) ?: '—') . '</td></tr>';
    }
    return $out . '</tbody></table>';
}

/**
 * Compose the note for one decided contribution.
 *
 * Returns ['to' => …, 'subject' => …, 'html' => …], or null when there is
 * nobody to write to — which is not a failure. Plenty of contributions arrive
 * with no address at all, and the reviewer should not see an error because a
 * courtesy could not be paid.
 */
function notify_contributor_build(string $contribId, string $status, ?string $reason = null): ?array
{
    $row = q1('SELECT id, payload, submitted_by, created_at FROM contributions WHERE id = ?', [$contribId]);
    if (!$row) return null;

    $payload = json_decode((string)$row['payload'], true) ?: [];
    $to      = notify_recipient($row, $payload);
    if ($to === null) return null;

    $approved = $status === 'approved';
    $action   = (string)($payload['action'] ?? '');
    $labelEn  = NOTIFY_ACTION_LABEL[$action]['en'] ?? 'submission';
    $labelZh  = NOTIFY_ACTION_LABEL[$action]['zh'] ?? '提交';

    $ts          = strtotime((string)$row['created_at']) ?: time();
    $submittedEn = date('D M j Y', $ts);
    $submittedZh = date('Y', $ts) . '年' . date('n', $ts) . '月' . date('j', $ts) . '日';

    $e       = fn($s) => htmlspecialchars((string)($s ?? ''), ENT_QUOTES, 'UTF-8');
    $nameZh  = $e($to['name'] ?? '家人');
    $nameEn  = $e($to['name'] ?? 'Family member');
    $site    = (string)(config()['site_url'] ?? '');
    $changes = is_array($payload['changes'] ?? null) ? $payload['changes'] : [];

    $tableZh = notify_changes_table($changes, '項目', '原', '新');
    $tableEn = notify_changes_table($changes, 'Field', 'From', 'To');

    $note = fn(string $lead, string $text) => $text === '' ? '' :
        '<p style="margin:.8rem 0;padding:.7rem 1rem;background:#fdf6e3;border-left:3px solid #c47a2c;'
        . "font-size:.92rem;\"><strong>{$lead}</strong> " . $e($text) . '</p>';
    $reasonText = (string)($reason ?? '');

    $subject = $approved
        ? "您的{$labelZh}已通過審核 · Your {$labelEn} has been approved — 江氏族譜"
        : "關於您的{$labelZh}的審核結果 · Update on your {$labelEn} — 江氏族譜";

    $zh = $approved
        ? "<p>{$nameZh} 您好：</p><p>您於 {$submittedZh} 提交的<strong>{$labelZh}</strong>已通過審核，"
          . '並已<strong style="color:#2a6035">加入族譜</strong>。</p>'
          . ($tableZh ? '<p style="margin:.6rem 0 .2rem;font-weight:600">修改內容：</p>' . $tableZh : '')
          . '<p>感謝您為江氏族譜貢獻一份心力。</p>'
          . ($site ? '<p><a href="' . $e($site) . '" style="color:#9e2b25">查看族譜 →</a></p>' : '')
        : "<p>{$nameZh} 您好：</p><p>您於 {$submittedZh} 提交的<strong>{$labelZh}</strong>經審核後，"
          . '<strong style="color:#9e2b25">暫未通過</strong>。</p>'
          . ($tableZh ? '<p style="margin:.6rem 0 .2rem;font-weight:600">您提交的內容：</p>' . $tableZh : '')
          . $note('審核備註：', $reasonText)
          . '<p>如有疑問或希望修改後重新提交，歡迎直接回覆此郵件。</p>';

    $en = $approved
        ? "<p>Dear {$nameEn},</p><p>Your <strong>{$labelEn}</strong> submitted on {$submittedEn} has been "
          . '<strong style="color:#2a6035">approved</strong> and added to the family tree.</p>'
          . ($tableEn ? '<p style="margin:.6rem 0 .2rem;font-weight:600">Details of the change:</p>' . $tableEn : '')
          . '<p>Thank you for contributing to the Kong Family Zupu.</p>'
          . ($site ? '<p><a href="' . $e($site) . '" style="color:#9e2b25">View the tree →</a></p>' : '')
        : "<p>Dear {$nameEn},</p><p>Your <strong>{$labelEn}</strong> submitted on {$submittedEn} has been "
          . 'reviewed and could <strong style="color:#9e2b25">not be approved</strong> at this time.</p>'
          . ($tableEn ? '<p style="margin:.6rem 0 .2rem;font-weight:600">What you submitted:</p>' . $tableEn : '')
          . $note("Reviewer's note:", $reasonText)
          . '<p>If you have questions or would like to resubmit with corrections, please reply to this email.</p>';

    $html = '<div style="font-family:Georgia,\'Songti SC\',\'STSong\',serif;max-width:520px;color:#2b2117">'
          . $zh
          . '<hr style="border:none;border-top:1px solid #e3d9c2;margin:1.4rem 0">'
          . $en
          . '<p style="font-size:.8rem;color:#9a8a6e;margin-top:2rem;border-top:1px solid #e3d9c2;'
          . 'padding-top:.8rem">江氏族譜 · Kong Family Zupu</p></div>';

    return ['to' => $to['email'], 'subject' => $subject, 'html' => $html];
}
