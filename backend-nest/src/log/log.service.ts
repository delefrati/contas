import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Identity, RequestContextService } from '../common/request-context.service';

export interface LogDto {
  id: number;
  action: string;
  resource: string;
  resourceId?: number;
  details?: string;
  createdAt: Date;
  userId?: number;
  userName?: string;
}

const LOG_AUTHORS = {
  user: { select: { name: true } },
  superAdmin: { select: { name: true } },
} satisfies Prisma.LogInclude;

function toLogDto(log: Prisma.LogGetPayload<{ include: typeof LOG_AUTHORS }>): LogDto {
  return {
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId ?? undefined,
    details: log.details ?? undefined,
    createdAt: log.createdAt,
    userId: log.userId ?? undefined,
    userName: log.user?.name ?? log.superAdmin?.name ?? undefined,
  };
}

@Injectable()
export class LogService {
  constructor(
    private prisma: PrismaService,
    private requestContext: RequestContextService,
  ) {}

  async log(
    action: string,
    resource: string,
    resourceId?: number,
    details?: any,
    // Defaults to whoever is authenticated on the current request
    actor?: Identity,
  ): Promise<LogDto> {
    const { memberId, superAdminId } = actor ?? this.requestContext.getIdentity();
    const log = await this.prisma.log.create({
      data: {
        bandId: this.requestContext.requireBandId(),
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
        userId: memberId,
        superAdminId,
      },
    });

    return {
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? undefined,
      details: log.details ?? undefined,
      createdAt: log.createdAt,
      userId: log.userId ?? undefined,
    };
  }

  async findAll(limit: number = 100): Promise<LogDto[]> {
    const logs = await this.prisma.log.findMany({
      where: { bandId: this.requestContext.requireBandId() },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: LOG_AUTHORS,
    });

    return logs.map(toLogDto);
  }

  async findByResource(
    resource: string,
    resourceId?: number,
    limit: number = 50,
  ): Promise<LogDto[]> {
    const logs = await this.prisma.log.findMany({
      where: {
        bandId: this.requestContext.requireBandId(),
        resource,
        ...(resourceId && { resourceId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: LOG_AUTHORS,
    });

    return logs.map(toLogDto);
  }

  async findByAction(
    action: string,
    limit: number = 50,
  ): Promise<LogDto[]> {
    const logs = await this.prisma.log.findMany({
      where: { bandId: this.requestContext.requireBandId(), action },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: LOG_AUTHORS,
    });

    return logs.map(toLogDto);
  }
}
