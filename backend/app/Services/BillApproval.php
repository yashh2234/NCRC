<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Notification;
use App\Models\PerformaInvoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Invoices, credit notes and performa invoices of users who are not approvers wait for approval; until then
 * they cannot be printed or mailed. What an approver saves is approved by that.
 * A credit note lives on its invoice, with its own approval in the cn_* columns (prefix 'cn_').
 */
class BillApproval
{
    /** Everything of the document that prints, as it reads back from the database */
    public static function content(Model $doc, string $prefix = ''): array
    {
        $data = $doc instanceof Bill && $prefix === 'cn_' ? $doc->creditNoteContent() : $doc->printedContent();

        return json_decode((string) json_encode($data), true);
    }

    public static function hash(Model $doc, string $prefix = ''): string
    {
        return md5((string) json_encode(self::content($doc, $prefix)));
    }

    /** Fields for the screens */
    public static function api(Model $doc, string $prefix = ''): array
    {
        $approval = $doc->{$prefix.'approval'} ?: 'approved';
        $waiting = $approval !== 'approved';

        return [
            $prefix.'approval' => $approval,
            $prefix.'approval_remark' => $doc->{$prefix.'approval_remark'},
            $prefix.'approval_requested_by_name' => $waiting ? self::userName($doc->{$prefix.'approval_requested_by'}) : null,
            $prefix.'approval_requested_at' => $waiting ? $doc->{$prefix.'approval_requested_at'}?->toIso8601String() : null,
            // Only needed to decide
            $prefix.'approved_content' => $waiting ? $doc->{$prefix.'approved_content'} : null,
            $prefix.'content' => $waiting ? self::content($doc, $prefix) : null,
            $prefix.'content_hash' => $waiting ? self::hash($doc, $prefix) : null,
        ];
    }

    /** After it was made or changed; `before` = its content before, null for a new one. */
    public function saved(Model $doc, ?array $before, User $user, string $prefix = ''): void
    {
        $doc = $doc->fresh();
        $approval = $doc->{$prefix.'approval'} ?: 'approved';

        if ($user->canApproveBills()) {
            // Recording a payment on a bill that waits is not an approval of it
            if ($before !== null && $approval === 'approved') {
                return;
            }
            if ($before !== null && $before === self::content($doc, $prefix)) {
                return;
            }
            $waitedFor = $approval === 'approved' ? null : $doc->{$prefix.'approval_requested_by'};
            $this->markApproved($doc, $user, $prefix);
            if ($waitedFor && (int) $waitedFor !== (int) $user->id) {
                $this->notify((int) $waitedFor, $doc, $prefix, 'approved', $user->name.' checked it, saved it and approved it.');
            }

            return;
        }

        // Saved without a change in what prints (payment, remark): nothing to approve
        if ($before !== null && $approval !== 'returned' && $before === self::content($doc, $prefix)) {
            return;
        }

        $wasWaiting = $before !== null && $approval === 'pending';
        $doc->forceFill([
            $prefix.'approval' => 'pending',
            $prefix.'approval_remark' => null,
            $prefix.'approval_requested_by' => $user->id,
            $prefix.'approval_requested_at' => now(),
            $prefix.'approved_content' => $before !== null && $approval === 'approved' ? $before : $doc->{$prefix.'approved_content'},
        ])->save();

        if (! $wasWaiting) {
            foreach (self::approvers() as $approver) {
                $this->notify((int) $approver->id, $doc, $prefix, $before === null ? 'to approve (new)' : 'to approve (changed)', 'By '.$user->name);
            }
        }
    }

    /** Approve or send back, only for what the approver has seen (hash). */
    public function decide(Model $doc, User $user, string $action, string $hash, string $remark = '', string $prefix = ''): void
    {
        abort_unless($user->canApproveBills(), 403, 'You cannot approve invoices.');

        DB::transaction(function () use ($doc, $user, $action, $hash, $remark, $prefix): void {
            $row = $doc->newQuery()->lockForUpdate()->findOrFail($doc->getKey());
            abort_if(($row->{$prefix.'approval'} ?: 'approved') === 'approved', 422, 'It is already approved.');
            abort_unless(hash_equals(self::hash($row, $prefix), $hash), 409, 'It was changed meanwhile. Close this and open it again.');

            $requestedBy = (int) $row->{$prefix.'approval_requested_by'};
            if ($action === 'approve') {
                $this->markApproved($row, $user, $prefix);
            } else {
                $row->forceFill([
                    $prefix.'approval' => 'returned', $prefix.'approval_remark' => $remark,
                    $prefix.'approval_by' => $user->id, $prefix.'approval_at' => now(),
                ])->save();
            }
            if ($requestedBy && $requestedBy !== (int) $user->id) {
                $action === 'approve'
                    ? $this->notify($requestedBy, $row, $prefix, 'approved', 'By '.$user->name.'. It can be printed and mailed now.')
                    : $this->notify($requestedBy, $row, $prefix, 'sent back', $user->name.': '.$remark);
            }
        });
    }

    /** A removed credit note leaves no approval behind */
    public static function cleared(string $prefix): array
    {
        return [
            $prefix.'approval' => 'approved', $prefix.'approval_remark' => null, $prefix.'approval_by' => null, $prefix.'approval_at' => null,
            $prefix.'approval_requested_by' => null, $prefix.'approval_requested_at' => null, $prefix.'approved_content' => null,
        ];
    }

    private function markApproved(Model $doc, User $user, string $prefix): void
    {
        $doc->forceFill([$prefix.'approval' => 'approved', $prefix.'approval_by' => $user->id, $prefix.'approval_at' => now()]
            + [$prefix.'approval_remark' => null, $prefix.'approved_content' => null])->save();
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private static function approvers()
    {
        return User::query()->get()->filter(fn (User $u) => $u->is_active !== false && $u->canApproveBills());
    }

    private static function userName(mixed $id): ?string
    {
        static $names = [];
        if (! $id) {
            return null;
        }

        return $names[$id] ??= User::query()->find($id)?->name;
    }

    private function notify(int $userId, Model $doc, string $prefix, string $what, string $message): void
    {
        [$kind, $type, $no] = match (true) {
            $doc instanceof PerformaInvoice => ['Performa invoice', 'performa_approval', $doc->invoice_no],
            $prefix === 'cn_' => ['Credit note', 'credit_note_approval', $doc->credit_note_no],
            default => ['Invoice', 'bill_approval', $doc->invoice_no],
        };
        Notification::create([
            'user_id' => $userId, 'type' => $type, 'title' => "{$kind} {$what}",
            'message' => mb_strimwidth("{$no} · {$doc->client_name} · {$message}", 0, 400, '…'),
            'data' => ['id' => $doc->getKey()], 'created_at' => now(),
        ]);
    }
}
