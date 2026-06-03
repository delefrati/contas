import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context.service';

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
    userId?: number,
  ): Promise<LogDto> {
    const resolvedUserId = userId ?? this.requestContext.getMemberId();
    const log = await this.prisma.log.create({
      data: {
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
        userId: resolvedUserId,
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
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true } } },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? undefined,
      details: log.details ?? undefined,
      createdAt: log.createdAt,
      userId: log.userId ?? undefined,
      userName: log.user?.name ?? undefined,
    }));
  }

  async findByResource(
    resource: string,
    resourceId?: number,
    limit: number = 50,
  ): Promise<LogDto[]> {
    const logs = await this.prisma.log.findMany({
      where: {
        resource,
        ...(resourceId && { resourceId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true } } },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? undefined,
      details: log.details ?? undefined,
      createdAt: log.createdAt,
      userId: log.userId ?? undefined,
      userName: log.user?.name ?? undefined,
    }));
  }

  async findByAction(
    action: string,
    limit: number = 50,
  ): Promise<LogDto[]> {
    const logs = await this.prisma.log.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true } } },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? undefined,
      details: log.details ?? undefined,
      createdAt: log.createdAt,
      userId: log.userId ?? undefined,
      userName: log.user?.name ?? undefined,
    }));
  }
}
