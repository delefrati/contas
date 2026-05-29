<?php

declare(strict_types=1);

namespace App\Domain;

interface ExpenseRepository
{
    /**
     * @return Expense[]
     */
    public function list(): array;

    public function create(Expense $expense): Expense;
}
