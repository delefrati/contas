<?php

declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../src/';

    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

use App\Application\CreateExpenseUseCase;
use App\Application\ListExpensesUseCase;
use App\Infrastructure\Persistence\MySqlExpenseRepository;
use App\Presentation\ExpenseController;
use App\Presentation\HealthController;
use App\Presentation\Router;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$repository = new MySqlExpenseRepository(
    host: getenv('DB_HOST') ?: 'localhost',
    port: (int) (getenv('DB_PORT') ?: 3306),
    database: getenv('DB_NAME') ?: 'contas',
    user: getenv('DB_USER') ?: 'contas',
    password: getenv('DB_PASSWORD') ?: 'contas',
);

$router = new Router(
    new HealthController(),
    new ExpenseController(
        new ListExpensesUseCase($repository),
        new CreateExpenseUseCase($repository),
    ),
);

$router->dispatch($_SERVER['REQUEST_METHOD'], parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
