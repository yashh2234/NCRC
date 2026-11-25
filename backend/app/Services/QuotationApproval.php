<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Quotation;
use App\Models\User;

/**
 * Quotations of users who are not approvers wait for approval; until then they cannot be printed or mailed.
 * What an approver saves is approved by that.
 */
class QuotationApproval
{
    /** After a quotation was made or changed; `before` = its content before, null for a new one. */
    public function saved(Quotation $quotation, ?array $before, User $user): void
    {
        if ($user->canApproveQuotations()) {
            $waitedFor = $quotation->approval === 'approved' ? null : $quotation->approval_requested_by;
            $this->markApproved($quotation, $user);
            if ($waitedFor && $waitedFor !== $user->id) {
                $this->notify($waitedFor, $quotation, 'Quotation approved', $user->name.' checked it, saved it and approved it.');
            }

            return;
        }

        // Saved without a change: an approved one stays approved, one waiting keeps waiting
        if ($before !== null && $quotation->approval !== 'returned' && $before === $quotation->content()) {
            return;
        }

        $wasWaiting = $before !== null && $quotation->approval === 'pending';
        $quotation->forceFill([
            'approval' => 'pending',
            'approval_remark' => null,
            'approval_requested_by' => $user->id,
            'approval_requested_at' => now(),
            'approved_content' => $before !== null && $quotation->approval === 'approved' ? $before : $quotation->approved_content,
        ])->save();

        if (! $wasWaiting) {
            foreach ($this->approvers() as $approver) {
                $this->notify($approver->id, $quotation, $before === null ? 'New quotation to approve' : 'Changed quotation to approve', 'By '.$user->name);
            }
        }
    }

    public function approve(Quotation $quotation, User $user): void
    {
        $requestedBy = $quotation->approval_requested_by;
        $this->markApproved($quotation, $user);
        if ($requestedBy && $requestedBy !== $user->id) {
            $this->notify($requestedBy, $quotation, 'Quotation approved', 'By '.$user->name.'. It can be printed and mailed now.');
        }
    }

    public function sendBack(Quotation $quotation, User $user, string $remark): void
    {
        $quotation->forceFill(['approval' => 'returned', 'approval_remark' => $remark, 'approval_by' => $user->id, 'approval_at' => now()])->save();
        if ($quotation->approval_requested_by && $quotation->approval_requested_by !== $user->id) {
            $this->notify($quotation->approval_requested_by, $quotation, 'Quotation sent back', $user->name.': '.$remark);
        }
    }

    private function markApproved(Quotation $quotation, User $user): void
    {
        $quotation->forceFill([
            'approval' => 'approved', 'approval_remark' => null, 'approval_by' => $user->id, 'approval_at' => now(),
            'approved_content' => null,
        ])->save();
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private function approvers()
    {
        return User::query()->get()->filter(fn (User $u) => $u->is_active !== false && $u->canApproveQuotations());
    }

    private function notify(int $userId, Quotation $quotation, string $title, string $message): void
    {
        Notification::create([
            'user_id' => $userId, 'type' => 'quotation_approval', 'title' => $title,
            'message' => mb_strimwidth("{$quotation->quotation_no} · {$quotation->client_name} · {$message}", 0, 400, '…'),
            'data' => ['quotation_id' => $quotation->id], 'created_at' => now(),
        ]);
    }
}
