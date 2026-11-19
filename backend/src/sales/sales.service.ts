import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import {
  paginated,
  parsePagination,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSalePaymentSchedule,
  saleTotals,
} from './sale-calculations.util';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: PaginationQuery = {}) {
    const { page, pageSize, skip, take } = parsePagination(params);
    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          buyer: true,
          property: true,
          payments: true,
        },
      }),
      this.prisma.sale.count(),
    ]);

    const items = sales.map((s) => {
      const m = saleTotals(s.totalPrice, s.payments);
      const downPayment = Number(s.downPayment);
      const plan = buildSalePaymentSchedule({
        totalPrice: m.totalPrice,
        downPayment,
        durationMonths: s.durationMonths,
        startDate: s.startDate,
      });
      return {
        id: s.id,
        status: s.status,
        startDate: s.startDate,
        durationMonths: s.durationMonths,
        downPayment,
        paymentMode: plan.paymentMode,
        monthlyInstallment: plan.monthlyPayment,
        property: {
          id: s.property.id,
          houseNumber: s.property.houseNumber,
          woreda: s.property.woreda,
          kebele: s.property.kebele,
        },
        buyer: { id: s.buyer.id, fullName: s.buyer.fullName },
        totalPrice: m.totalPrice,
        totalPaid: m.totalPaid,
        remaining: m.remaining,
        completionPercentage: m.completionPercentage,
        isCompleted: m.isCompleted,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const s = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        buyer: true,
        property: true,
        payments: { orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!s) throw new NotFoundException('Sale not found');
    const m = saleTotals(s.totalPrice, s.payments);
    const downPayment = Number(s.downPayment);
    const plan = buildSalePaymentSchedule({
      totalPrice: m.totalPrice,
      downPayment,
      durationMonths: s.durationMonths,
      startDate: s.startDate,
    });
    const installmentsPaid = Math.max(
      0,
      Math.round((m.totalPaid - Math.min(m.totalPaid, downPayment)) * 100) / 100,
    );
    return {
      id: s.id,
      status: s.status,
      startDate: s.startDate,
      durationMonths: s.durationMonths,
      downPayment,
      paymentMode: plan.paymentMode,
      monthlyInstallment: plan.monthlyPayment,
      plannedRemaining: plan.remainingBalance,
      paymentSchedule: plan.schedule,
      property: s.property,
      buyer: s.buyer,
      payments: s.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      totalPrice: m.totalPrice,
      totalPaid: m.totalPaid,
      installmentsPaid,
      remaining: m.remaining,
      outstandingBalance: m.remaining,
      completionPercentage: m.completionPercentage,
      isCompleted: m.isCompleted,
    };
  }

  async create(dto: CreateSaleDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { rentals: { where: { status: 'active' } } },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (property.status !== PropertyStatus.available) {
      throw new BadRequestException('Property must be available to record a sale');
    }
    if (property.rentals.length > 0) {
      throw new BadRequestException('End active rental before selling this property');
    }

    const buyer = await this.prisma.tenant.findUnique({ where: { id: dto.buyerId } });
    if (!buyer) throw new NotFoundException('Buyer (tenant record) not found');

    if (dto.downPayment > dto.totalPrice) {
      throw new BadRequestException(
        'Initial paid amount cannot exceed the total price',
      );
    }

    const remaining =
      Math.round((dto.totalPrice - dto.downPayment) * 100) / 100;
    const fullyPaid = remaining <= 0;
    if (!fullyPaid && dto.durationMonths < 1) {
      throw new BadRequestException(
        'Specify the number of months to pay the remaining balance',
      );
    }
    const downPayment = fullyPaid ? dto.totalPrice : dto.downPayment;
    const durationMonths = fullyPaid ? 0 : dto.durationMonths;

    return this.prisma.$transaction(async (tx) => {
      const startDate = new Date(dto.startDate);
      const sale = await tx.sale.create({
        data: {
          propertyId: dto.propertyId,
          buyerId: dto.buyerId,
          totalPrice: dto.totalPrice,
          downPayment,
          durationMonths,
          startDate,
          status: fullyPaid ? 'completed' : 'active',
        },
      });
      if (downPayment > 0) {
        await tx.salePayment.create({
          data: {
            saleId: sale.id,
            amount: downPayment,
            paidAt: startDate,
            method: 'bank',
          },
        });
      }
      await tx.property.update({
        where: { id: dto.propertyId },
        data: { status: PropertyStatus.sold },
      });
      return sale;
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        select: { id: true, propertyId: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');

      const deleted = await tx.sale.delete({ where: { id } });
      const otherOpen = await tx.sale.count({
        where: {
          propertyId: sale.propertyId,
          status: { not: 'cancelled' },
        },
      });
      if (otherOpen === 0) {
        const activeRental = await tx.rental.count({
          where: { propertyId: sale.propertyId, status: 'active' },
        });
        await tx.property.update({
          where: { id: sale.propertyId },
          data: {
            status: activeRental
              ? PropertyStatus.rented
              : PropertyStatus.available,
          },
        });
      }
      return deleted;
    });
  }
}
