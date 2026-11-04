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
import { saleTotals } from './sale-calculations.util';
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
      return {
        id: s.id,
        status: s.status,
        startDate: s.startDate,
        durationMonths: s.durationMonths,
        downPayment: Number(s.downPayment),
        property: { id: s.property.id, code: s.property.code },
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

    return this.prisma.$transaction(async (tx) => {
      const startDate = new Date(dto.startDate);
      const sale = await tx.sale.create({
        data: {
          propertyId: dto.propertyId,
          buyerId: dto.buyerId,
          totalPrice: dto.totalPrice,
          downPayment: dto.downPayment,
          durationMonths: dto.durationMonths,
          startDate,
          status: 'active',
        },
      });
      if (dto.downPayment > 0) {
        await tx.salePayment.create({
          data: {
            saleId: sale.id,
            amount: dto.downPayment,
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
}
