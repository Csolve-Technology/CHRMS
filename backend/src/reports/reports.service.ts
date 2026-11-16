import { Injectable } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  buildRentalPeriodSummary,
  getMonthRentStatus,
  isRentExpectedThisMonth,
  paidInMonth,
} from '../rentals/rental-overdue.util';
import { isSecurityDepositPayment } from '../rentals/rental-payment.constants';
import { SettingsService } from '../settings/settings.service';
import { saleTotals } from '../sales/sale-calculations.util';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly settings: SettingsService,
  ) {}

  /** Reuses dashboard aggregates for a printable / API summary */
  async summary() {
    const dash = await this.dashboard.getSummary();
    return {
      generatedAt: new Date().toISOString(),
      ...dash,
    };
  }

  /** Full housing reports payload: KPIs + chart series from all modules */
  async overview() {
    const now = new Date();
    const [
      dash,
      trends,
      appSettings,
      tenantCounts,
      rentalCounts,
      saleCounts,
      propertiesByType,
      propertiesByWoreda,
      propertiesByStatus,
      rentalPayments,
      salePayments,
      activeRentals,
      openSales,
      recentRentalPays,
      recentSalePays,
    ] = await Promise.all([
      this.dashboard.getSummary(),
      this.dashboard.getTrends(),
      this.settings.get(),
      this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.rental.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.sale.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.property.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.property.groupBy({
        by: ['woreda'],
        _count: { _all: true },
        orderBy: { woreda: 'asc' },
      }),
      this.prisma.property.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.rentalPayment.findMany({
        select: { amount: true, method: true, paidAt: true },
      }),
      this.prisma.salePayment.findMany({
        select: { amount: true, method: true, paidAt: true },
      }),
      this.prisma.rental.findMany({
        where: { status: 'active' },
        include: {
          payments: true,
          tenant: { select: { fullName: true } },
          property: {
            select: { houseNumber: true, woreda: true, kebele: true },
          },
        },
      }),
      this.prisma.sale.findMany({
        where: { status: { not: 'cancelled' } },
        include: {
          payments: true,
          buyer: { select: { fullName: true } },
          property: {
            select: { houseNumber: true, woreda: true, kebele: true },
          },
        },
      }),
      this.prisma.rentalPayment.findMany({
        orderBy: { paidAt: 'desc' },
        take: 8,
        include: {
          rental: {
            include: {
              tenant: { select: { fullName: true } },
              property: { select: { houseNumber: true } },
            },
          },
        },
      }),
      this.prisma.salePayment.findMany({
        orderBy: { paidAt: 'desc' },
        take: 8,
        include: {
          sale: {
            include: {
              buyer: { select: { fullName: true } },
              property: { select: { houseNumber: true } },
            },
          },
        },
      }),
    ]);

    const countMap = (
      rows: { status: string; _count: { _all: number } }[],
    ) => Object.fromEntries(rows.map((r) => [r.status, r._count._all]));

    const tenantsByStatus = countMap(tenantCounts);
    const rentalsByStatus = countMap(rentalCounts);
    const salesByStatus = countMap(saleCounts);

    const totalTenants = tenantCounts.reduce((s, r) => s + r._count._all, 0);
    const totalRentals = rentalCounts.reduce((s, r) => s + r._count._all, 0);
    const totalSales = saleCounts.reduce((s, r) => s + r._count._all, 0);

    let rentalRevenue = 0;
    let depositHeld = 0;
    const rentalMethodMap: Record<string, number> = {};
    for (const p of rentalPayments) {
      const amt = Number(p.amount);
      const method = p.method || 'other';
      rentalMethodMap[method] = (rentalMethodMap[method] ?? 0) + amt;
      if (isSecurityDepositPayment(method)) depositHeld += amt;
      else rentalRevenue += amt;
    }

    let saleRevenue = 0;
    const saleMethodMap: Record<string, number> = {};
    for (const p of salePayments) {
      const amt = Number(p.amount);
      const method = p.method || 'other';
      saleMethodMap[method] = (saleMethodMap[method] ?? 0) + amt;
      saleRevenue += amt;
    }

    const mergeMethods = (
      a: Record<string, number>,
      b: Record<string, number>,
    ) => {
      const out: Record<string, number> = { ...a };
      for (const [k, v] of Object.entries(b)) {
        out[k] = (out[k] ?? 0) + v;
      }
      return Object.entries(out)
        .map(([method, amount]) => ({
          method,
          amount: Math.round(amount * 100) / 100,
        }))
        .sort((x, y) => y.amount - x.amount);
    };

    const y = now.getFullYear();
    const m = now.getMonth();
    let rentPaidThisMonth = 0;
    let rentExpectedThisMonth = 0;
    let rentalsPaid = 0;
    let rentalsPartial = 0;
    let rentalsUnpaid = 0;
    let rentalsOverdue = 0;
    let rentalsNotDue = 0;

    const rentalBalances: {
      id: string;
      houseNumber: string;
      woreda: string;
      kebele: string;
      tenant: string;
      monthlyRent: number;
      outstanding: number;
      monthStatus: string;
    }[] = [];

    for (const r of activeRentals) {
      const monthlyRent = Number(r.monthlyRent);
      const period = buildRentalPeriodSummary(
        r.monthlyRent,
        r.payments,
        r.startDate,
        r.endDate,
        appSettings.rentalDueDay,
        now,
      );
      const status = getMonthRentStatus(
        r.monthlyRent,
        r.payments,
        appSettings.rentalDueDay,
        now,
        r.startDate,
      );

      if (isRentExpectedThisMonth(r.startDate, appSettings.rentalDueDay, now)) {
        rentExpectedThisMonth += monthlyRent;
        rentPaidThisMonth += paidInMonth(r.payments, y, m);
      }

      if (status === 'paid') rentalsPaid += 1;
      else if (status === 'partial') rentalsPartial += 1;
      else if (status === 'overdue') rentalsOverdue += 1;
      else if (status === 'unpaid') rentalsUnpaid += 1;
      else rentalsNotDue += 1;

      if (period.outstandingBalance > 0) {
        rentalBalances.push({
          id: r.id,
          houseNumber: r.property.houseNumber,
          woreda: r.property.woreda,
          kebele: r.property.kebele,
          tenant: r.tenant.fullName,
          monthlyRent,
          outstanding: period.outstandingBalance,
          monthStatus: status,
        });
      }
    }

    rentalBalances.sort((a, b) => b.outstanding - a.outstanding);

    const saleBalances: {
      id: string;
      houseNumber: string;
      woreda: string;
      kebele: string;
      buyer: string;
      totalPrice: number;
      paid: number;
      remaining: number;
      completionPercentage: number;
      status: string;
    }[] = [];

    let salesFullyPaid = 0;
    let salesInProgress = 0;
    for (const s of openSales) {
      const t = saleTotals(s.totalPrice, s.payments);
      if (t.isCompleted) salesFullyPaid += 1;
      else salesInProgress += 1;
      if (t.remaining > 0) {
        saleBalances.push({
          id: s.id,
          houseNumber: s.property.houseNumber,
          woreda: s.property.woreda,
          kebele: s.property.kebele,
          buyer: s.buyer.fullName,
          totalPrice: t.totalPrice,
          paid: t.totalPaid,
          remaining: t.remaining,
          completionPercentage: t.completionPercentage,
          status: s.status,
        });
      }
    }
    saleBalances.sort((a, b) => b.remaining - a.remaining);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        ...dash,
        total_tenants: totalTenants,
        active_tenants: tenantsByStatus['active'] ?? 0,
        inactive_tenants: tenantsByStatus['inactive'] ?? 0,
        total_rentals: totalRentals,
        active_rentals: rentalsByStatus['active'] ?? 0,
        ended_rentals: rentalsByStatus['completed'] ?? 0,
        cancelled_rentals: rentalsByStatus['cancelled'] ?? 0,
        total_sales: totalSales,
        active_sales: salesByStatus['active'] ?? 0,
        completed_sales: salesByStatus['completed'] ?? salesFullyPaid,
        rental_revenue: Math.round(rentalRevenue * 100) / 100,
        sale_revenue: Math.round(saleRevenue * 100) / 100,
        deposit_held: Math.round(depositHeld * 100) / 100,
        rent_expected_this_month:
          Math.round(rentExpectedThisMonth * 100) / 100,
        rent_paid_this_month: Math.round(rentPaidThisMonth * 100) / 100,
        rent_outstanding_this_month:
          Math.round(
            Math.max(0, rentExpectedThisMonth - rentPaidThisMonth) * 100,
          ) / 100,
      },
      charts: {
        properties_by_status: propertiesByStatus.map((r) => ({
          name: r.status,
          value: r._count._all,
        })),
        properties_by_type: propertiesByType.map((r) => ({
          name: r.type,
          value: r._count._all,
        })),
        properties_by_woreda: propertiesByWoreda.map((r) => ({
          name: r.woreda,
          value: r._count._all,
        })),
        rentals_by_status: Object.entries(rentalsByStatus).map(
          ([name, value]) => ({ name, value }),
        ),
        sales_by_status: Object.entries(salesByStatus).map(([name, value]) => ({
          name,
          value,
        })),
        tenants_by_status: Object.entries(tenantsByStatus).map(
          ([name, value]) => ({ name, value }),
        ),
        rent_collection_this_month: [
          { name: 'Paid', value: rentalsPaid },
          { name: 'Partial', value: rentalsPartial },
          { name: 'Unpaid', value: rentalsUnpaid },
          { name: 'Overdue', value: rentalsOverdue },
          { name: 'Not due', value: rentalsNotDue },
        ].filter((x) => x.value > 0),
        monthly_revenue: trends.monthly_revenue,
        payment_methods: mergeMethods(rentalMethodMap, saleMethodMap),
        sales_progress: [
          { name: 'In progress', value: salesInProgress },
          { name: 'Fully paid', value: salesFullyPaid },
        ].filter((x) => x.value > 0),
      },
      tables: {
        top_rental_balances: rentalBalances.slice(0, 10),
        top_sale_balances: saleBalances.slice(0, 10),
        recent_rental_payments: recentRentalPays.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          method: p.method,
          houseNumber: p.rental.property.houseNumber,
          person: p.rental.tenant.fullName,
        })),
        recent_sale_payments: recentSalePays.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          method: p.method,
          houseNumber: p.sale.property.houseNumber,
          person: p.sale.buyer.fullName,
        })),
      },
    };
  }
}
