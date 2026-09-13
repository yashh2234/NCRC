<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\DocumentDownload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = Document::with(['category', 'createdBy', 'latestVersion']);

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('title', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%")
                  ->orWhere('tags', 'like', "%{$s}%")
                  ->orWhere('file_name', 'like', "%{$s}%");
            });
        }
        if ($request->filled('file_type')) {
            $query->where('file_type', 'like', $request->file_type . '%');
        }
        if ($request->filled('tags')) {
            $tags = explode(',', $request->tags);
            $query->where(function ($q) use ($tags) {
                foreach ($tags as $tag) {
                    $q->where('tags', 'like', "%{$tag}%");
                }
            });
        }
        if ($request->filled('linked_job_id')) {
            $query->where('linked_job_id', $request->linked_job_id);
        }

        $perPage = $request->input('per_page', 30);
        return response()->json($query->orderBy('created_at', 'desc')->paginate($perPage));
    }

    public function show(Document $document)
    {
        return response()->json(
            $document->load(['category', 'createdBy', 'versions.createdBy', 'latestVersion'])
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => 'nullable|integer|exists:document_categories,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'tags' => 'nullable|string|max:500',
            'file' => 'required|file|max:51200',
            'linked_job_id' => 'nullable|integer|exists:jobs,id',
            'linked_model_type' => 'nullable|string|max:255',
            'linked_model_id' => 'nullable|integer',
        ]);

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $mimeType = $file->getMimeType();
        $size = $file->getSize();

        $storagePath = 'documents/' . date('Y/m');
        $storedPath = $file->store($storagePath, 'public');

        $document = Document::create([
            'category_id' => $validated['category_id'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'file_name' => $originalName,
            'file_path' => $storedPath,
            'file_type' => $mimeType,
            'file_extension' => $extension,
            'file_size' => $size,
            'tags' => $validated['tags'] ?? null,
            'linked_job_id' => $validated['linked_job_id'] ?? null,
            'linked_model_type' => $validated['linked_model_type'] ?? null,
            'linked_model_id' => $validated['linked_model_id'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        // Create initial version
        DocumentVersion::create([
            'document_id' => $document->id,
            'version_number' => 1,
            'file_name' => $originalName,
            'file_path' => $storedPath,
            'file_type' => $mimeType,
            'file_size' => $size,
            'change_notes' => 'Initial upload',
            'created_by' => $request->user()?->id,
        ]);

        return response()->json(
            $document->load(['category', 'createdBy']),
            201
        );
    }

    /** Upload several documents in one multipart request. */
    public function bulkStore(Request $request)
    {
        $request->validate([
            'files' => 'required|array|min:1|max:20',
            'files.*' => 'required|file|max:51200|mimetypes:application/pdf,image/jpeg,image/png,image/tiff,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'category_id' => 'nullable|integer|exists:document_categories,id',
            'linked_job_id' => 'nullable|integer|exists:jobs,id',
        ]);

        $created = [];
        foreach ($request->file('files', []) as $file) {
            $storedPath = $file->store('documents/' . date('Y/m'), 'public');
            $document = Document::create([
                'category_id' => $request->input('category_id'),
                'title' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $storedPath,
                'file_type' => $file->getMimeType(),
                'file_extension' => $file->getClientOriginalExtension(),
                'file_size' => $file->getSize(),
                'linked_job_id' => $request->input('linked_job_id'),
                'created_by' => $request->user()?->id,
            ]);
            DocumentVersion::create([
                'document_id' => $document->id,
                'version_number' => 1,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $storedPath,
                'file_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'change_notes' => 'Initial upload',
                'created_by' => $request->user()?->id,
            ]);
            $created[] = $document;
        }

        return response()->json(['data' => $created], 201);
    }

    public function update(Request $request, Document $document)
    {
        $validated = $request->validate([
            'category_id' => 'nullable|integer|exists:document_categories,id',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'tags' => 'nullable|string|max:500',
        ]);

        $validated['updated_by'] = $request->user()?->id;
        $document->update($validated);

        return response()->json($document->fresh()->load(['category', 'createdBy']));
    }

    public function destroy(Document $document)
    {
        // Delete file from storage
        Storage::disk('public')->delete($document->file_path);
        foreach ($document->versions as $version) {
            Storage::disk('public')->delete($version->file_path);
        }
        $document->delete();

        return response()->json(null, 204);
    }

    /**
     * Upload a new version of an existing document.
     */
    public function uploadVersion(Request $request, Document $document)
    {
        $validated = $request->validate([
            'file' => 'required|file|max:51200',
            'change_notes' => 'nullable|string|max:1000',
        ]);

        $file = $request->file('file');
        $latestVersion = $document->versions()->max('version_number') ?? 0;
        $newVersion = $latestVersion + 1;

        $storagePath = 'documents/' . date('Y/m');
        $storedPath = $file->store($storagePath, 'public');

        $version = DocumentVersion::create([
            'document_id' => $document->id,
            'version_number' => $newVersion,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'change_notes' => $validated['change_notes'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        // Update main document
        $document->update([
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'file_type' => $file->getMimeType(),
            'file_extension' => $file->getClientOriginalExtension(),
            'file_size' => $file->getSize(),
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json($version, 201);
    }

    /**
     * Download a document (or specific version) and log the download.
     */
    public function download(Request $request, Document $document, ?int $versionId = null)
    {
        $filePath = $document->file_path;

        if ($versionId) {
            $version = DocumentVersion::where('document_id', $document->id)
                ->where('id', $versionId)
                ->firstOrFail();
            $filePath = $version->file_path;
            $displayName = "v{$version->version_number}_{$version->file_name}";
        } else {
            $displayName = $document->file_name;
        }

        if (!Storage::disk('public')->exists($filePath)) {
            return response()->json(['message' => 'File not found on storage.'], 404);
        }

        // Log download
        DocumentDownload::create([
            'document_id' => $document->id,
            'user_id' => $request->user()?->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return Storage::disk('public')->download($filePath, $displayName);
    }

    /**
     * Preview a document (return file contents for browser display).
     */
    public function preview(Document $document)
    {
        if (!Storage::disk('public')->exists($document->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $mime = $document->file_type;
        $content = Storage::disk('public')->get($document->file_path);

        return response($content, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . $document->file_name . '"',
        ]);
    }

    /**
     * Search documents across title, description, tags.
     */
    public function search(Request $request)
    {
        $validated = $request->validate([
            'q' => 'required|string|min:2|max:255',
        ]);

        $q = $validated['q'];
        $documents = Document::with(['category', 'createdBy'])
            ->where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                      ->orWhere('description', 'like', "%{$q}%")
                      ->orWhere('tags', 'like', "%{$q}%")
                      ->orWhere('file_name', 'like', "%{$q}%");
            })
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json($documents);
    }

    /**
     * Get download history for a document.
     */
    public function downloadHistory(Document $document)
    {
        return response()->json(
            $document->downloads()->with('user')->latest()->limit(50)->get()
        );
    }
}
