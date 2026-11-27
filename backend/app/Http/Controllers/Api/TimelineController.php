<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Timeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** History panel of a record: what happened to it, newest first */
class TimelineController extends Controller
{
    public function show(Request $request, string $type, int $id): JsonResponse
    {
        abort_unless(Timeline::canSee($request->user(), $type), 403, 'You cannot see this history.');

        return response()->json(['data' => Timeline::entries($type, $id)]);
    }
}
