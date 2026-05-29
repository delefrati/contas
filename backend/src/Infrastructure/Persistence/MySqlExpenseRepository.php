<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence;

use App\Domain\Expense;
use App\Domain\ExpenseRepository;
use PDO;
use PDOException;
use RuntimeException;

final class MySqlExpenseRepository implements ExpenseRepository
{
    private ?PDO $connection = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $database,
        private readonly string $user,
        private readonly string $password,
    ) {
    }

    public function list(): array
    {
        $statement = $this->connect()->query('SELECT id, description, amount, created_at FROM expenses ORDER BY created_at DESC');
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        return array_map(
            static fn (array $row): Expense => new Expense(
                id: (int) $row['id'],
                description: $row['description'],
                amount: (float) $row['amount'],
                createdAt: $row['created_at'],
            ),
            $rows,
        );
    }

    public function create(Expense $expense): Expense
    {
        $connection = $this->connect();
        $statement = $connection->prepare(
            'INSERT INTO expenses (description, amount, created_at) VALUES (:description, :amount, :created_at)',
        );
        $statement->execute([
            ':description' => $expense->description,
            ':amount' => $expense->amount,
            ':created_at' => $expense->createdAt,
        ]);

        return new Expense(
            id: (int) $connection->lastInsertId(),
            description: $expense->description,
            amount: $expense->amount,
            createdAt: $expense->createdAt,
        );
    }

    private function connect(): PDO
    {
        if ($this->connection instanceof PDO) {
            return $this->connection;
        }

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $this->host, $this->port, $this->database);

        try {
            $this->connection = new PDO($dsn, $this->user, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $exception) {
            throw new RuntimeException('Database connection failed: ' . $exception->getMessage(), 0, $exception);
        }

        return $this->connection;
    }
}
