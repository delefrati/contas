<?php

declare(strict_types=1);

namespace App\Domain;

final class Expense
{
    public function __construct(
        public readonly ?int $id,
        public readonly string $description,
        public readonly float $amount,
        public readonly string $createdAt,
    ) {
    }

    /**
     * @return array{id:?int,description:string,amount:float,createdAt:string}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'description' => $this->description,
            'amount' => $this->amount,
            'createdAt' => $this->createdAt,
        ];
    }
}
