import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  allocatedPaidForMonth,
  dueDateForMonth,
  isRentExpectedThisMonth,
  isRentalOverdue,
} from '../rentals/rental-overdue.util';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Create due-soon / overdue alerts for unpaid active rentals (idempotent). */
  async syncRentDueAlerts(asOf: Date = new Date()) {
    const { rentalDueDay, reminderDaysBefore } = await this.settings.get();
    const y = asOf.getFullYear();
    const m = asOf.getMonth();
    const period = `${y}-${String(m + 1).padStart(2, '0')}`;
    const due = dueDateForMonth(y, m, rentalDueDay);
    const reminderStart = new Date(due);
    reminderStart.setDate(reminderStart.getDate() - reminderDaysBefore);
    reminderStart.setHours(0, 0, 0, 0);

    const today = new Date(asOf);
    today.setHours(0, 0, 0, 0);

    const rentals = await this.prisma.rental.findMany({
      where: { status: 'active' },
      include: {
        payments: true,
        tenant: { select: { fullName: true } },
        property: { select: { houseNumber: true } },
      },
    });

    for (const r of rentals) {
      if (!isRentExpectedThisMonth(r.startDate, rentalDueDay, asOf)) continue;

      const paid = allocatedPaidForMonth(
        r.monthlyRent,
        r.payments,
        r.startDate,
        r.endDate,
        rentalDueDay,
        y,
        m,
        asOf,
      );
      const rent = Number(r.monthlyRent);
      if (paid >= rent) continue;

      const label = r.property.houseNumber
        ? `#${r.property.houseNumber}`
        : r.agreementNumber;
      const shortfall = Math.round((rent - paid) * 100) / 100;

      if (
        isRentalOverdue(
          r.monthlyRent,
          r.payments,
          rentalDueDay,
          asOf,
          r.startDate,
          r.endDate,
        )
      ) {
        await this.upsert({
          type: 'rent_overdue',
          title: 'Rent overdue',
          message: `${r.tenant.fullName} · ${label}: ETB ${shortfall.toLocaleString()} unpaid for ${period} (due day ${rentalDueDay}).`,
          entityType: 'rental',
          entityId: r.id,
          dedupeKey: `rent_overdue:${r.id}:${period}`,
        });
        continue;
      }

      if (today >= reminderStart && today <= due) {
        await this.upsert({
          type: 'rent_due_reminder',
          title: 'Rent due soon',
          message: `${r.tenant.fullName} · ${label}: rent due on day ${rentalDueDay} (${period}). Balance ETB ${shortfall.toLocaleString()}.`,
          entityType: 'rental',
          entityId: r.id,
          dedupeKey: `rent_due_reminder:${r.id}:${period}`,
        });
      }
    }
  }

  private async upsert(data: {
    type: string;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
    dedupeKey: string;
  }) {
    await this.prisma.notification.upsert({
      where: { dedupeKey: data.dedupeKey },
      update: {
        title: data.title,
        message: data.message,
      },
      create: data,
    });
  }

  async list() {
    await this.syncRentDueAlerts();
    const items = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: items.filter((n) => !n.read).length,
    };
  }

  async markRead(id: string) {
    try {
      return await this.prisma.notification.update({
        where: { id },
        data: { read: true },
      });
    } catch {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead() {
    await this.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { ok: true };
  }
}
