<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\HomeDashboard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The home dashboard of the signed-in user: their cards with data, and their chosen order */
class HomeDashboardController extends Controller
{
    public function show(Request $request, HomeDashboard $dashboard): JsonResponse
    {
        return response()->json(['data' => $dashboard->build($request->user(), $request)]);
    }

    /** cards: the keys in order (on, top to bottom); null = back to all cards the user can see */
    public function saveLayout(Request $request, HomeDashboard $dashboard): JsonResponse
    {
        $values = $request->validate([
            'cards' => ['present', 'nullable', 'array', 'max:30'],
            'cards.*' => ['string', 'distinct', 'in:'.implode(',', array_keys(HomeDashboard::CARDS))],
        ]);
        $user = $request->user();
        $prefs = $user->app_prefs ?? [];
        if ($values['cards'] === null) {
            unset($prefs['dashboard'], $prefs['dashboard_seen']);
        } else {
            $prefs['dashboard'] = array_values(array_intersect($values['cards'], $dashboard->available($user)));
            // The cards the user could pick when saving: a card added later shows up for them
            $prefs['dashboard_seen'] = $dashboard->available($user);
        }
        $user->forceFill(['app_prefs' => $prefs])->save();

        return response()->json(['data' => $dashboard->build($user->fresh(), $request)]);
    }
}
