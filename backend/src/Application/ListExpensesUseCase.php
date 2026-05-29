<?php

declare(strict_types=1);

namespace App\Application;

use App\Domain\ExpenseRepository;

final class ListExpensesUseCase
{
    public function __construct(private readonly ExpenseRepository $repository)
    {
    }

    public function execute(): array
    {
        return $this->repository->list();
    }
}
