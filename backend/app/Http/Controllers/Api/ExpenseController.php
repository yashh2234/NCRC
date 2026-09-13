<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyExpense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $expenses = DailyExpense::query()
            ->when($startDate && $endDate, function ($q) use ($startDate, $endDate): void {
                $q->whereDate('date', '>=', $startDate)->whereDate('date', '<=', $endDate);
            })
            ->orderByDesc('date')
            ->orderByDesc('iExpensesId')
            ->limit(100)
            ->get()
            ->map(fn (DailyExpense $e): array => [
                'id' => $e->iExpensesId,
                'date' => optional($e->date)->format('d/m/Y'),
                'opening_balance' => (float) ($e->opening_balance ?: 0),
                'total_income' => (float) ($e->total_income ?: 0),
                'total_expenses' => (float) ($e->total_expenses ?: 0),
                'closing_balance' => (float) ($e->closing_balance ?: 0),
                'category' => $e->expenses_category,
                'remark' => $e->expenses_remark,
                'payment_mode' => $e->payment_mode,
                'person_name' => $e->person_name,
            ]);

        $summary = [
            'total_income' => (float) DailyExpense::query()->sum(DB::raw('CAST(total_income AS DECIMAL(12,2))')),
            'total_expenses' => (float) DailyExpense::query()->sum(DB::raw('CAST(total_expenses AS DECIMAL(12,2))')),
        ];

        return response()->json(['data' => $expenses, 'summary' => $summary]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:255'],
            'total_income' => ['nullable', 'numeric'],
            'total_expenses' => ['nullable', 'numeric'],
            'payment_mode' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string', 'max:255'],
            'person_name' => ['nullable', 'string', 'max:255'],
        ]);

        $nextId = ((int) (DailyExpense::query()->max('iExpensesId') ?? 0)) + 1;

        DB::table('daily_expenses')->insert([
            'id' => $nextId,
            'iExpensesId' => $nextId,
            'date' => $validated['date'],
            'opening_balance' => '0',
            'total_income' => (string) ($validated['total_income'] ?? '0'),
            'total_expenses' => (string) ($validated['total_expenses'] ?? '0'),
            'closing_balance' => '0',
            'expenses_category' => $validated['category'],
            'expenses_remark' => $validated['remark'] ?? '',
            'payment_mode' => $validated['payment_mode'] ?? '',
            'remark' => '',
            'person_name' => $validated['person_name'] ?? '',
            'created_date' => now(),
        ]);

        return response()->json(['message' => 'Expense recorded'], 201);
    }

    public function monthlySummary(): JsonResponse
    {
        $expenses = DB::table('daily_expenses')
            ->select(
                'expenses_category',
                DB::raw('SUM(CAST(total_expenses AS DECIMAL(12,2))) as total')
            )
            ->whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->where('total_expenses', '>', '0')
            ->groupBy('expenses_category')
            ->orderByDesc('total')
            ->get();

        return response()->json(['data' => $expenses]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $expense = DailyExpense::where('iExpensesId', $id)->firstOrFail();

        $validated = $request->validate([
            'date' => ['sometimes', 'date'],
            'category' => ['sometimes', 'string', 'max:255'],
            'total_income' => ['nullable', 'numeric'],
            'total_expenses' => ['nullable', 'numeric'],
            'opening_balance' => ['nullable', 'numeric'],
            'closing_balance' => ['nullable', 'numeric'],
            'payment_mode' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string', 'max:255'],
            'person_name' => ['nullable', 'string', 'max:255'],
        ]);

        $updateData = [];
        if (isset($validated['date'])) $updateData['date'] = $validated['date'];
        if (isset($validated['category'])) $updateData['expenses_category'] = $validated['category'];
        if (array_key_exists('total_income', $validated)) $updateData['total_income'] = (string) ($validated['total_income'] ?? '0');
        if (array_key_exists('total_expenses', $validated)) $updateData['total_expenses'] = (string) ($validated['total_expenses'] ?? '0');
        if (array_key_exists('opening_balance', $validated)) $updateData['opening_balance'] = (string) ($validated['opening_balance'] ?? '0');
        if (array_key_exists('closing_balance', $validated)) $updateData['closing_balance'] = (string) ($validated['closing_balance'] ?? '0');
        if (array_key_exists('payment_mode', $validated)) $updateData['payment_mode'] = $validated['payment_mode'] ?? '';
        if (array_key_exists('remark', $validated)) $updateData['expenses_remark'] = $validated['remark'] ?? '';
        if (array_key_exists('person_name', $validated)) $updateData['person_name'] = $validated['person_name'] ?? '';

        $expense->update($updateData);

        return response()->json(['message' => 'Expense updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        $expense = DailyExpense::where('iExpensesId', $id)->firstOrFail();
        $expense->delete();

        return response()->json(['message' => 'Expense deleted']);
    }

    public function export(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $expenses = DailyExpense::query()
            ->when($startDate && $endDate, function ($q) use ($startDate, $endDate): void {
                $q->whereDate('date', '>=', $startDate)->whereDate('date', '<=', $endDate);
            })
            ->orderByDesc('date')
            ->orderByDesc('iExpensesId')
            ->limit(5000)
            ->get()
            ->map(fn (DailyExpense $e): array => [
                'id' => $e->iExpensesId,
                'date' => optional($e->date)->format('d/m/Y'),
                'opening_balance' => (float) ($e->opening_balance ?: 0),
                'total_income' => (float) ($e->total_income ?: 0),
                'total_expenses' => (float) ($e->total_expenses ?: 0),
                'closing_balance' => (float) ($e->closing_balance ?: 0),
                'category' => $e->expenses_category,
                'remark' => $e->expenses_remark,
                'payment_mode' => $e->payment_mode,
                'person_name' => $e->person_name,
            ]);

        return response()->json(['data' => $expenses]);
    }
}
