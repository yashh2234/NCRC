<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Store::all()]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate(['name' => 'required|string|max:255']);
        Store::create($v);
        return response()->json(['message' => 'Store created'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $v = $request->validate([
            'name' => 'required|string|max:255',
            'active' => 'nullable|integer',
        ]);
        Store::findOrFail($id)->update($v);
        return response()->json(['message' => 'Store updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        Store::findOrFail($id)->delete();
        return response()->json(['message' => 'Store deleted']);
    }
}
