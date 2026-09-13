<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentCategory;
use Illuminate\Http\Request;

class DocumentCategoryController extends Controller
{
    public function index()
    {
        $categories = DocumentCategory::with('children')
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->get();

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'parent_id' => 'nullable|integer|exists:document_categories,id',
            'sort_order' => 'integer|min:0',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $validated['created_by'] = $request->user()?->id;
        $validated['slug'] ??= str($validated['name'])->slug();
        $validated['is_active'] ??= true;

        $category = DocumentCategory::create($validated);

        return response()->json($category, 201);
    }

    public function show(DocumentCategory $documentCategory)
    {
        return response()->json($documentCategory->load('children', 'documents'));
    }

    public function update(Request $request, DocumentCategory $documentCategory)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'nullable|string|max:255',
            'parent_id' => 'nullable|integer|exists:document_categories,id',
            'sort_order' => 'integer|min:0',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $documentCategory->update($validated);

        return response()->json($documentCategory->fresh());
    }

    public function destroy(DocumentCategory $documentCategory)
    {
        $documentCategory->delete();
        return response()->json(null, 204);
    }

    public function tree()
    {
        $categories = DocumentCategory::withCount('documents')
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($cat) => $this->buildTree($cat));

        return response()->json($categories);
    }

    private function buildTree(DocumentCategory $category): array
    {
        $children = DocumentCategory::where('parent_id', $category->id)
            ->withCount('documents')
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($child) => $this->buildTree($child));

        return [
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'icon' => $category->icon,
            'description' => $category->description,
            'documents_count' => (int) $category->documents_count + $children->sum('documents_count'),
            'children' => $children,
        ];
    }
}
