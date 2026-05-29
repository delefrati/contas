<?php

declare(strict_types=1);

namespace App\Presentation;

final class Router
{
    public function __construct(
        private readonly HealthController $healthController,
        private readonly ExpenseController $expenseController,
    ) {
    }

    public function dispatch(string $method, string $path): void
    {
        if ($method === 'GET' && $path === '/api/health') {
            ($this->healthController)();
            return;
        }

        if ($method === 'GET' && $path === '/api/expenses') {
            $this->expenseController->list();
            return;
        }

        if ($method === 'POST' && $path === '/api/expenses') {
            $this->expenseController->create();
            return;
        }

        http_response_code(404);
        echo json_encode(['error' => 'Route not found.']);
    }
}
