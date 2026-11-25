import { INestApplication, ValidationPipe } from '@nestjs/common';

// Every request body is checked against its DTO class before a controller sees it: a wrong
// type, or a field the DTO doesn't list, is a 400. So a client can't set bandId, id or another
// column an endpoint doesn't mean to take. The services keep their own checks on what the
// values mean (a trimmed name, a date's format, a known type).
//
// Bodies typed as an interface or a plain object type aren't checked, so every body is a class.
export function validateRequests(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      // A body that isn't an object of the DTO's shape, such as a JSON array
      forbidUnknownValues: true,
    }),
  );
}

// TEXT columns hold 65,535 bytes, and an accented letter takes more than one
export const TEXT_COLUMN_BYTES = 65_535;
