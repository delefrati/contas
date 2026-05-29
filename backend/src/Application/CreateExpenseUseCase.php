<?php

declare(strict_types=1);

namespace App\Application;

use App\Domain\Expense;
use App\Domain\ExpenseRepository;
use InvalidArgumentException;

final class CreateExpenseUseCase
{
    public function __construct(private readonly ExpenseRepository $repository)
    {
    }

    public function execute(string $description, float $amount): Expense
    {
        $normalizedDescription = trim($description);

        if ($normalizedDescription === '') {
            throw new InvalidArgumentException('Description is required.');
        }

        if ($amount <= 0) {
            throw new InvalidArgumentException('Amount must be greater than zero.');
        }

        return $this->repository->create(
            new Expense(
                id: null,
                description: $normalizedDescription,
                amount: $amount,
                createdAt: date('c'),
            ),
        );
    }
}
