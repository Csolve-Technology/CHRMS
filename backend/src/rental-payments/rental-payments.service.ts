import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  paginated,
  parsePagination,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  SECURITY_DEPOSIT_METHOD,
  isSecurityDepositPayment,
} from '../rentals/rental-payment.constants';
import {
  allocatedPaidForMonth,
  coverageForExistingPayment,
  describePaymentCoverage,
  getMonthRentStatus,
} from '../rentals/rental-overdue.util';
import { SettingsService } from '../settings/settings.service';
import { CreateRentalPaymentDto } from './dto/create-rental-payment.dto';

const RENT_METHODS = new Set(['cash', 'bank', 'mobile', 'other']);

@Injectable()
export class RentalPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  static receiptsDir() {
    const dir = join(process.cwd(), 'uploads', 'payment-receipts');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private receiptPublicPath(filename: string) {
    return `/uploads/payment-receipts/${filename}`;
  }

  async findAll(
    filters: PaginationQuery & { from?: string; to?: string; rentalId?: string },
  ) {
    const { page, pageSize, skip, take } = parsePagination(filters);
    const where: Prisma.RentalPaymentWhereInput = {};
    if (filters.rentalId) where.rentalId = filters.rentalId;
    if (filters.from || filters.to) {
      where.paidAt = {};
      if (filters.from) where.paidAt.gte = new Date(filters.from);
      if (filters.to) where.paidAt.lte = new Date(filters.to);
    }

    const { rentalDueDay } = await this.settings.get();
    const now = new Date();

    const [rows, total] = await Promise.all([
      this.prisma.rentalPayment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: {
          rental: {
            include: {
              property: {
                select: { houseNumber: true, woreda: true, kebele: true },
              },
              tenant: { select: { fullName: true } },
              payments: {
                orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      }),
      this.prisma.rentalPayment.count({ where }),
    ]);

    const items = rows.map((p) => {
      const isDeposit = isSecurityDepositPayment(p.method);
      const monthlyRent = Number(p.rental.monthlyRent);
      const coverage = isDeposit
        ? null
        : coverageForExistingPayment(
            monthlyRent,
            p.rental.payments,
            p,
            p.rental.startDate,
            p.rental.endDate,
            rentalDueDay,
            now,
          );
      const y = now.getFullYear();
      const m = now.getMonth();
      const paidThisMonth = allocatedPaidForMonth(
        monthlyRent,
        p.rental.payments,
        p.rental.startDate,
        p.rental.endDate,
        rentalDueDay,
        y,
        m,
        now,
      );
      const balanceDue = Math.max(
        0,
        Math.round((monthlyRent - paidThisMonth) * 100) / 100,
      );
      return {
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt,
        method: p.method,
        receiptNo: p.receiptNo,
        receiptFile: p.receiptFile,
        createdAt: p.createdAt,
        kind: isDeposit ? ('deposit' as const) : ('rent' as const),
        coverage,
        coverageLabel: coverage?.coverageLabel ?? null,
        monthsCovered: coverage?.months ?? [],
        monthStatus: isDeposit
          ? null
          : getMonthRentStatus(
              monthlyRent,
              p.rental.payments,
              rentalDueDay,
              now,
              p.rental.startDate,
              p.rental.endDate,
            ),
        balanceDue,
        rental: {
          id: p.rental.id,
          monthlyRent,
          property: p.rental.property,
          tenant: p.rental.tenant,
        },
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async create(dto: CreateRentalPaymentDto, file?: Express.Multer.File) {
    const rental = await this.prisma.rental.findUnique({
      where: { id: dto.rentalId },
      include: {
        payments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!rental) throw new NotFoundException('Rental not found');
    if (rental.status !== 'active') {
      throw new BadRequestException(
        'Can only record rent payments on active rentals',
      );
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    if (dto.method === SECURITY_DEPOSIT_METHOD) {
      throw new BadRequestException(
        'Security deposit is set on the rental, not as a rent payment',
      );
    }
    if (!RENT_METHODS.has(dto.method)) {
      throw new BadRequestException(
        'Invalid payment method. Use: cash, bank, mobile, or other',
      );
    }

    const { rentalDueDay } = await this.settings.get();
    const paidAt = new Date(dto.paidAt);
    const monthlyRent = Number(rental.monthlyRent);
    const preview = describePaymentCoverage(
      monthlyRent,
      rental.payments,
      dto.amount,
      rental.startDate,
      rental.endDate,
      rentalDueDay,
      paidAt,
    );

    if (preview.maxPayable <= 0) {
      throw new BadRequestException(
        'This rental has no outstanding rent balance to apply',
      );
    }
    if (dto.amount > preview.maxPayable + 0.009) {
      throw new BadRequestException(
        `Amount exceeds remaining rent balance (ETB ${preview.maxPayable.toLocaleString()} left across unpaid months)`,
      );
    }

    const created = await this.prisma.rentalPayment.create({
      data: {
        rentalId: dto.rentalId,
        amount: dto.amount,
        paidAt,
        method: dto.method,
        receiptNo: dto.receiptNo,
        receiptFile: file ? this.receiptPublicPath(file.filename) : null,
      },
    });

    const coverage = describePaymentCoverage(
      monthlyRent,
      rental.payments,
      dto.amount,
      rental.startDate,
      rental.endDate,
      rentalDueDay,
      paidAt,
    );

    return {
      ...created,
      amount: Number(created.amount),
      kind: 'rent' as const,
      coverage,
      coverageLabel: coverage.coverageLabel,
      monthsCovered: coverage.months,
      monthsFullyCovered: coverage.monthsFullyCovered,
      hasPartial: coverage.hasPartial,
    };
  }
}
