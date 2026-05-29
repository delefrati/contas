<?php

declare(strict_types=1);

namespace App\Presentation;

final class HealthController
{
    public function __invoke(): void
    {
        http_response_code(200);
        echo json_encode([
            'status' => 'ok',
            'service' => 'contas-backend',
        ]);
    }
}
