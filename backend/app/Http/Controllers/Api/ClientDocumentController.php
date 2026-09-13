<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ClientDocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = ClientDocument::where('client_id', $request->client_id);
        return response()->json($query->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['client_id' => 'required|integer|exists:clients,id', 'document_type' => 'nullable|string|max:100', 'document_name' => 'required|string|max:222', 'file' => 'required|file|max:51200', 'notes' => 'nullable|string',]);

        $file = $request->file('file');
        $path = $file->store('client-documents/'.$validated['client_id'], 'public');

        $doc = ClientDocument::create([
            'client_id' => $validated['client_id'],
            'document_type' => $validated['document_type'] ?? null,
            'document_name' => $validated['document_name'],
            'file_path' => $path,
            'file_size' => $file->getSize(),
            'notes' => $validated['notes'] ?? null,
            'uploaded_by' => auth()->id(),
        ]);

        return response()->json($doc, 201);
    }

    public function destroy(ClientDocument $clientDocument)
    {
        Storage::disk('public')->delete($clientDocument->file_path);
        $clientDocument->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
