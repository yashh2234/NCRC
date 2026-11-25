<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyKnowledge;
use App\Models\Notification;
use App\Services\AttendanceBook;
use App\Services\CompanyKnowledgeBase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/** Company knowledge for the proposal AI. Users suggest facts; full admins approve, edit and delete. */
class CompanyKnowledgeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->admin($request);
        $rows = CompanyKnowledge::query()->with('author')->orderByRaw("status = 'pending' desc")->orderBy('kind')->orderBy('title')->get();

        return response()->json(['data' => $rows->map(fn (CompanyKnowledge $k) => $this->present($k))]);
    }

    /** A fact: used at once when an admin adds it, otherwise after an admin approved it */
    public function store(Request $request): JsonResponse
    {
        $values = $this->values($request);
        $user = $request->user();
        $approved = $user->isFullAdmin();
        $row = CompanyKnowledge::create($values + [
            'kind' => 'fact', 'status' => $approved ? 'approved' : 'pending', 'created_by' => $user->id, 'decided_by' => $approved ? $user->id : null,
        ]);
        if (! $approved) {
            foreach (AttendanceBook::admins() as $admin) {
                Notification::create([
                    'user_id' => $admin->id, 'type' => 'company_knowledge', 'title' => 'Company fact to approve',
                    'message' => mb_strimwidth("{$user->name} · {$values['title']}: {$values['content']}", 0, 400, '…'), 'created_at' => now(),
                ]);
            }
        }

        return response()->json(['data' => $this->present($row)], 201);
    }

    public function update(Request $request, CompanyKnowledge $knowledge): JsonResponse
    {
        $this->admin($request);
        abort_unless($knowledge->kind === 'fact', 422, 'Website pages are changed on the website.');
        $knowledge->update($this->values($request) + ['status' => 'approved', 'decided_by' => $request->user()->id]);

        return response()->json(['data' => $this->present($knowledge)]);
    }

    public function decide(Request $request, CompanyKnowledge $knowledge): JsonResponse
    {
        $this->admin($request);
        // Website pages can be switched off too; a refresh would bring a deleted one back
        $approve = (bool) $request->validate(['approve' => ['required', 'boolean']])['approve'];
        $knowledge->update(['status' => $approve ? 'approved' : 'rejected', 'decided_by' => $request->user()->id]);

        return response()->json(['data' => $this->present($knowledge)]);
    }

    public function destroy(Request $request, CompanyKnowledge $knowledge): JsonResponse
    {
        $this->admin($request);
        abort_unless($knowledge->kind === 'fact', 422, 'Switch a website page off instead.');
        $knowledge->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function refresh(Request $request, CompanyKnowledgeBase $base): JsonResponse
    {
        $this->admin($request);
        @set_time_limit(300);
        try {
            $pages = $base->refresh();
        } catch (ConnectionException) {
            return response()->json(['message' => 'The website did not answer. Please try again later.'], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => "{$pages} pages read from the website."]);
    }

    private function values(Request $request): array
    {
        return $request->validate(['title' => ['required', 'string', 'max:190'], 'content' => ['required', 'string', 'max:3000']]);
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isFullAdmin(), 403, 'Only an administrator can see this.');
    }

    private function present(CompanyKnowledge $k): array
    {
        return [
            'id' => $k->id, 'kind' => $k->kind, 'title' => $k->title, 'content' => $k->content, 'url' => $k->url, 'status' => $k->status,
            'created_by' => $k->created_by ? $k->author?->name : null, 'updated_at' => $k->updated_at?->toIso8601String(),
        ];
    }
}
