<?php

declare(strict_types=1);

namespace App\Presentation;

use App\Application\CreateExpenseUseCase;
use App\Application\ListExpensesUseCase;
use InvalidArgumentException;
use RuntimeException;

final class ExpenseController
{
    public function __construct(
        private readonly ListExpensesUseCase $listExpenses,
        private readonly CreateExpenseUseCase $createExpense,
    ) {
    }

    public function list(): void
    {
        try {
            $expenses = array_map(
                static fn ($expense): array => $expense->toArray(),
                $this->listExpenses->execute(),
            );

            http_response_code(200);
            echo json_encode(['data' => $expenses]);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage(), 500);
        }
    }

    public function create(): void
    {
        try {
            $payload = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
            $description = (string) ($payload['description'] ?? '');
            $amount = (float) ($payload['amount'] ?? 0);

            $expense = $this->createExpense->execute($description, $amount);

            http_response_code(201);
            echo json_encode(['data' => $expense->toArray()]);
        } catch (InvalidArgumentException $exception) {
            $this->error($exception->getMessage(), 422);
        } catch (\JsonException $exception) {
            $this->error('Invalid JSON payload.', 400);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage(), 500);
        }
    }

    private function error(string $message, int $status): void
    {
        http_response_code($status);
        echo json_encode(['error' => $message]);
    }
}
