<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Http\Request;

/**
 * Vendor registration. Anyone can add a vendor; vendors added by non-admins stay
 * "pending" until an admin approves them, and only approved vendors can be chosen
 * for outsource assignments.
 */
class VendorController extends Controller
{
    public function index(Request $request)
    {
        $query = Vendor::withCount('services');
        if ($request->filled('search')) $query->where(function ($q) use ($request) { $q->where('vendor_name', 'like', "%{$request->search}%")->orWhere('mobile', 'like', "%{$request->search}%")->orWhere('email', 'like', "%{$request->search}%"); });
        if ($request->filled('approval_status')) $query->where('approval_status', $request->approval_status);

        $page = $query->orderByDesc('id')->paginate($request->get('per_page', 50))->toArray();
        $page['can_approve'] = $this->isAdmin();

        return response()->json($page);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['vendor_name' => 'required|string|max:222', 'contact_person' => 'nullable|string|max:222', 'mobile' => 'nullable|string|max:50', 'phone' => 'nullable|string|max:50', 'email' => 'nullable|email|max:222', 'website' => 'nullable|string|max:222', 'address' => 'nullable|string', 'city' => 'nullable|string|max:100', 'state' => 'nullable|string|max:100', 'pincode' => 'nullable|string|max:20', 'gst_no' => 'nullable|string|max:50', 'pan_no' => 'nullable|string|max:50', 'services_offered' => 'nullable|string', 'notes' => 'nullable|string',]);
        $validated['created_by'] = auth()->id();

        if ($this->isAdmin()) {
            $validated += ['approval_status' => 'approved', 'approved_by' => auth()->id(), 'approved_at' => now()];
        } else {
            $validated['approval_status'] = 'pending';
        }

        $vendor = Vendor::create($validated);
        if ($vendor->approval_status === 'pending') $this->notifyAdmins($vendor, 'added');

        return response()->json($vendor, 201);
    }

    public function show(Vendor $vendor) { return response()->json($vendor->load(['contacts', 'services'])); }

    public function update(Request $request, Vendor $vendor)
    {
        $validated = $request->validate(['vendor_name' => 'sometimes|string|max:222', 'contact_person' => 'nullable|string|max:222', 'mobile' => 'nullable|string|max:50', 'phone' => 'nullable|string|max:50', 'email' => 'nullable|email|max:222', 'website' => 'nullable|string|max:222', 'address' => 'nullable|string', 'city' => 'nullable|string|max:100', 'state' => 'nullable|string|max:100', 'pincode' => 'nullable|string|max:20', 'gst_no' => 'nullable|string|max:50', 'pan_no' => 'nullable|string|max:50', 'services_offered' => 'nullable|string', 'notes' => 'nullable|string', 'is_active' => 'boolean',]);

        // A non-admin changing an approved vendor's name or number sends it back for approval.
        $changed = ($validated['vendor_name'] ?? $vendor->vendor_name) !== $vendor->vendor_name
            || (array_key_exists('mobile', $validated) && $validated['mobile'] !== $vendor->mobile);
        if (! $this->isAdmin() && $changed && $vendor->approval_status !== 'pending') {
            $validated += ['approval_status' => 'pending', 'approved_by' => null, 'approved_at' => null];
        }

        $vendor->update($validated);
        if (! $this->isAdmin() && $changed) $this->notifyAdmins($vendor, 'updated');

        return response()->json($vendor);
    }

    /** Admin decision on a vendor: approved or rejected. */
    public function approve(Request $request, Vendor $vendor)
    {
        abort_unless($this->isAdmin(), 403, 'Only an administrator can approve vendors.');
        $validated = $request->validate(['status' => 'required|in:approved,rejected']);

        $vendor->update([
            'approval_status' => $validated['status'],
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);

        if ($vendor->created_by && (int) $vendor->created_by !== (int) auth()->id()) {
            Notification::create([
                'user_id' => $vendor->created_by,
                'type' => 'vendor_'.$validated['status'],
                'title' => "Vendor {$validated['status']}: {$vendor->vendor_name}",
                'message' => $validated['status'] === 'approved'
                    ? "{$vendor->vendor_name} can now be selected for outsourcing."
                    : "{$vendor->vendor_name} was not approved for outsourcing.",
                'data' => ['vendor_id' => $vendor->id],
                'created_at' => now(),
            ]);
        }

        return response()->json($vendor);
    }

    public function destroy(Vendor $vendor) { $vendor->delete(); return response()->json(['message' => 'Deleted']); }

    /** Vendors that can be chosen for outsource work: active and approved. */
    public function list() { return response()->json(Vendor::where('is_active', true)->where('approval_status', 'approved')->orderBy('vendor_name')->get(['id', 'vendor_name', 'mobile', 'email'])); }

    private function isAdmin(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->isFullAdmin();
    }

    private function notifyAdmins(Vendor $vendor, string $action): void
    {
        $by = auth()->user()?->name ?: 'A user';
        User::query()->where('is_admin', true)->where('id', '!=', auth()->id())->pluck('id')
            ->each(fn ($adminId) => Notification::create([
                'user_id' => $adminId,
                'type' => 'vendor_pending',
                'title' => "Vendor awaiting approval: {$vendor->vendor_name}",
                'message' => "{$by} {$action} vendor {$vendor->vendor_name}".($vendor->mobile ? " ({$vendor->mobile})" : '').'. Approve it on the Outsource page.',
                'data' => ['vendor_id' => $vendor->id],
                'created_at' => now(),
            ]));
    }
}
