<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\ClientCommunication;
use App\Models\Registration;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $query = Client::withCount(['contacts', 'registrations']);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('company_name', 'like', "%{$s}%")
                  ->orWhere('contact_person', 'like', "%{$s}%")
                  ->orWhere('mobile', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('gst_no', 'like', "%{$s}%")
                  ->orWhere('uid', 'like', "%{$s}%");
            });
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('city')) {
            $query->where('city', $request->city);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = $request->input('per_page', 20);
        return response()->json($query->orderBy('company_name')->paginate($perPage));
    }

    public function list()
    {
        return response()->json(
            Client::where('is_active', true)->orderBy('company_name')->get(['id', 'company_name', 'mobile', 'email'])
        );
    }

    public function show(Client $client)
    {
        return response()->json(
            $client->load([
                'contacts',
                'communications.user',
                'registrations',
                'primaryContact',
            ])
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'company_name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'mobile' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'website' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:20',
            'gst_no' => 'nullable|string|max:50',
            'pan_no' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $validated['created_by'] = $request->user()?->id;

        // Auto-generate client UID
        $validated['uid'] ??= 'CLT-' . strtoupper(substr(md5(uniqid()), 0, 8));

        $client = Client::create($validated);

        return response()->json($client, 201);
    }

    public function update(Request $request, Client $client)
    {
        $validated = $request->validate([
            'company_name' => 'sometimes|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'mobile' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'website' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:20',
            'gst_no' => 'nullable|string|max:50',
            'pan_no' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $validated['updated_by'] = $request->user()?->id;
        $client->update($validated);

        return response()->json($client->fresh());
    }

    public function destroy(Client $client)
    {
        $client->delete();
        return response()->json(null, 204);
    }

    /**
     * Search clients for autocomplete (returns minimal fields).
     */
    public function search(Request $request)
    {
        $validated = $request->validate(['q' => 'required|string|min:1']);

        $q = $validated['q'];
        $clients = Client::where('is_active', true)
            ->where(function ($query) use ($q) {
                $query->where('company_name', 'like', "%{$q}%")
                      ->orWhere('mobile', 'like', "%{$q}%")
                      ->orWhere('phone', 'like', "%{$q}%")
                      ->orWhere('email', 'like', "%{$q}%")
                      ->orWhere('uid', 'like', "%{$q}%");
            })
            ->limit(15)
            ->get(['id', 'uid', 'company_name', 'mobile', 'city', 'contact_person']);

        return response()->json($clients);
    }

    // === Contacts ===

    public function storeContact(Request $request, Client $client)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'designation' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'mobile' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'is_primary' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        if ($validated['is_primary'] ?? false) {
            $client->contacts()->where('is_primary', true)->update(['is_primary' => false]);
        }

        $contact = $client->contacts()->create($validated);
        return response()->json($contact, 201);
    }

    public function updateContact(Request $request, Client $client, ClientContact $contact)
    {
        if ($contact->client_id !== $client->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'designation' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'mobile' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'is_primary' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        if ($validated['is_primary'] ?? false) {
            $client->contacts()->where('is_primary', true)->where('id', '!=', $contact->id)->update(['is_primary' => false]);
        }

        $contact->update($validated);
        return response()->json($contact->fresh());
    }

    public function destroyContact(Client $client, ClientContact $contact)
    {
        if ($contact->client_id !== $client->id) abort(404);
        $contact->delete();
        return response()->json(null, 204);
    }

    // === Communications ===

    public function storeCommunication(Request $request, Client $client)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:call,email,meeting,note',
            'subject' => 'nullable|string|max:255',
            'body' => 'nullable|string',
            'contact_id' => 'nullable|integer|exists:client_contacts,id',
            'communication_date' => 'nullable|date',
        ]);

        $validated['user_id'] = $request->user()?->id;
        $validated['communication_date'] ??= now();

        $comm = $client->communications()->create($validated);
        return response()->json($comm->load('user'), 201);
    }

    public function communications(Client $client)
    {
        return response()->json(
            $client->communications()->with('user')->latest('communication_date')->limit(50)->get()
        );
    }

    // === Analytics ===

    public function analytics()
    {
        $totalClients = Client::count();
        $activeClients = Client::where('is_active', true)->count();
        $withRegistrations = Client::has('registrations')->count();

        $categoryBreakdown = Client::selectRaw('category, count(*) as total')
            ->whereNotNull('category')
            ->groupBy('category')
            ->pluck('total', 'category');

        $topClients = Client::withCount('registrations')
            ->orderBy('registrations_count', 'desc')
            ->limit(10)
            ->get(['id', 'company_name', 'mobile', 'registrations_count']);

        $recentClients = Client::latest()->limit(5)->get(['id', 'company_name', 'mobile', 'created_at']);

        return response()->json([
            'total' => $totalClients,
            'active' => $activeClients,
            'with_registrations' => $withRegistrations,
            'category_breakdown' => $categoryBreakdown,
            'top_clients' => $topClients,
            'recent_clients' => $recentClients,
        ]);
    }

    /**
     * Migrate unique agencies from client_registration into clients table.
     */
    public function migrateFromRegistrations()
    {
        $registrations = Registration::selectRaw('DISTINCT agency_name, reporting_address, mobile_no, gst_no')
            ->whereNotNull('agency_name')
            ->where('agency_name', '!=', '')
            ->get();

        $created = 0;
        $skipped = 0;

        foreach ($registrations as $reg) {
            $exists = Client::where('company_name', $reg->agency_name)->exists();
            if ($exists) {
                $skipped++;
                continue;
            }

            $client = Client::create([
                'company_name' => $reg->agency_name,
                'address' => $reg->reporting_address,
                'mobile' => $reg->mobile_no,
                'gst_no' => $reg->gst_no,
                'uid' => 'CLT-' . strtoupper(substr(md5($reg->agency_name), 0, 8)),
            ]);

            // Link existing registrations to this client
            Registration::where('agency_name', $reg->agency_name)
                ->whereNull('client_id')
                ->update(['client_id' => $client->id]);

            $created++;
        }

        return response()->json([
            'message' => "Migration complete. Created {$created} clients, skipped {$skipped} duplicates.",
            'created' => $created,
            'skipped' => $skipped,
        ]);
    }
}
