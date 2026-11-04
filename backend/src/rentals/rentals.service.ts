import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  paginated,
  parsePagination,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  RENTAL_STATUSES,
  SECURITY_DEPOSIT_METHOD,
  type RentalStatus,
} from './rental-payment.constants';
import {
  buildRentalPeriodSummary,
  getMonthRentStatus,
  paidInMonth,
} from './rental-overdue.util';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async nextAgreementNumber(
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RA-${year}-`;
    const latest = await tx.rental.findFirst({
      where: { agreementNumber: { startsWith: prefix } },
      orderBy: { agreementNumber: 'desc' },
      select: { agreementNumber: true },
    });
    let seq = 1;
    if (latest?.agreementNumber) {
      const n = parseInt(latest.agreementNumber.slice(prefix.length), 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private filePublicPath(filename: string) {
    return `/uploads/agreements/${filename}`;
  }

  private assertDepositWithinRent(monthlyRent: number, deposit?: number | null) {
    if (deposit == null) return;
    if (deposit < 0) {
      throw new BadRequestException('Deposit cannot be negative');
    }
    if (deposit > monthlyRent) {
      throw new BadRequestException(
        'Deposit cannot be greater than monthly rent',
      );
    }
  }

  private assertValidStatus(status: string): asserts status is RentalStatus {
    if (!RENTAL_STATUSES.includes(status as RentalStatus)) {
      throw new BadRequestException(
        `Invalid status. Use: ${RENTAL_STATUSES.join(', ')}`,
      );
    }
  }

  /** Record / sync the security-deposit payment (held, not rent). */
  private async syncDepositPayment(
    tx: Prisma.TransactionClient,
    rentalId: string,
    deposit: number | null | undefined,
    paidAt: Date,
  ) {
    const existing = await tx.rentalPayment.findFirst({
      where: { rentalId, method: SECURITY_DEPOSIT_METHOD },
      orderBy: { createdAt: 'asc' },
    });

    const amount = deposit != null && deposit > 0 ? deposit : 0;

    if (amount <= 0) {
      if (existing) {
        await tx.rentalPayment.delete({ where: { id: existing.id } });
      }
      return;
    }

    if (existing) {
      await tx.rentalPayment.update({
        where: { id: existing.id },
        data: { amount, paidAt },
      });
      return;
    }

    await tx.rentalPayment.create({
      data: {
        rentalId,
        amount,
        paidAt,
        method: SECURITY_DEPOSIT_METHOD,
        receiptNo: 'SECURITY-DEPOSIT',
      },
    });
  }

  async findAll(params: PaginationQuery = {}) {
    const { page, pageSize, skip, take } = parsePagination(params);
    const [rows, total] = await Promise.all([
      this.prisma.rental.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          tenant: true,
          property: true,
          payments: true,
        },
      }),
      this.prisma.rental.count(),
    ]);

    const { rentalDueDay } = await this.settings.get();
    const now = new Date();
    const items = rows.map((r) => {
      const monthlyRent = Number(r.monthlyRent);
      const paymentStatus =
        r.status === 'active'
          ? getMonthRentStatus(
              r.monthlyRent,
              r.payments,
              rentalDueDay,
              now,
              r.startDate,
            )
          : null;
      const paidThisMonth =
        r.status === 'active'
          ? paidInMonth(r.payments, now.getFullYear(), now.getMonth())
          : null;
      const balanceDue =
        paidThisMonth == null
          ? null
          : Math.max(0, Math.round((monthlyRent - paidThisMonth) * 100) / 100);
      const period = buildRentalPeriodSummary(
        r.monthlyRent,
        r.payments,
        r.startDate,
        r.endDate,
        rentalDueDay,
        now,
      );
      return {
        id: r.id,
        status: r.status,
        agreementNumber: r.agreementNumber,
        agreementFile: r.agreementFile,
        startDate: r.startDate,
        endDate: r.endDate,
        monthlyRent,
        deposit: r.deposit ? Number(r.deposit) : null,
        tenant: {
          id: r.tenant.id,
          fullName: r.tenant.fullName,
          phone: r.tenant.phone,
        },
        property: {
          id: r.property.id,
          code: r.property.code,
          type: r.property.type,
          category: r.property.category,
          woreda: r.property.woreda,
          kebele: r.property.kebele,
          houseNumber: r.property.houseNumber,
        },
        paymentStatus,
        overdue: paymentStatus === 'overdue' || period.monthsOverdue > 0,
        paidThisMonth,
        balanceDue,
        totalExpected: period.totalExpected,
        totalPaid: period.totalPaid,
        outstandingBalance: period.outstandingBalance,
        monthsPaid: period.monthsPaid,
        monthsUnpaid: period.monthsUnpaid,
        monthsOverdue: period.monthsOverdue,
        monthsExpected: period.monthsExpected,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const r = await this.prisma.rental.findUnique({
      where: { id },
      include: {
        tenant: true,
        property: true,
        payments: { orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!r) throw new NotFoundException('Rental not found');
    const { rentalDueDay } = await this.settings.get();
    const now = new Date();
    const paymentStatus =
      r.status === 'active'
        ? getMonthRentStatus(
            r.monthlyRent,
            r.payments,
            rentalDueDay,
            now,
            r.startDate,
          )
        : null;
    const monthlyRent = Number(r.monthlyRent);
    const paidThisMonth =
      r.status === 'active'
        ? paidInMonth(r.payments, now.getFullYear(), now.getMonth())
        : null;
    const balanceDue =
      paidThisMonth == null
        ? null
        : Math.max(0, Math.round((monthlyRent - paidThisMonth) * 100) / 100);
    const period = buildRentalPeriodSummary(
      r.monthlyRent,
      r.payments,
      r.startDate,
      r.endDate,
      rentalDueDay,
      now,
    );
    return {
      ...r,
      monthlyRent,
      deposit: r.deposit ? Number(r.deposit) : null,
      paymentStatus,
      overdue: paymentStatus === 'overdue' || period.monthsOverdue > 0,
      paidThisMonth,
      balanceDue,
      period,
    };
  }

  async create(dto: CreateRentalDto, file?: Express.Multer.File) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { rentals: { where: { status: 'active' } } },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (property.status !== PropertyStatus.available) {
      throw new BadRequestException('Property is not available for rent');
    }
    if (property.rentals.length > 0) {
      throw new BadRequestException('Property already has an active rental');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    this.assertDepositWithinRent(dto.monthlyRent, dto.deposit);

    return this.prisma.$transaction(async (tx) => {
      const agreementNumber = await this.nextAgreementNumber(tx);
      const startDate = new Date(dto.startDate);
      const rental = await tx.rental.create({
        data: {
          propertyId: dto.propertyId,
          tenantId: dto.tenantId,
          agreementNumber,
          agreementFile: file ? this.filePublicPath(file.filename) : null,
          startDate,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          monthlyRent: dto.monthlyRent,
          deposit: dto.deposit ?? null,
          status: 'active',
        },
      });
      await this.syncDepositPayment(
        tx,
        rental.id,
        dto.deposit ?? null,
        startDate,
      );
      await tx.property.update({
        where: { id: dto.propertyId },
        data: { status: PropertyStatus.rented },
      });
      return rental;
    });
  }

  async update(id: string, dto: UpdateRentalDto, file?: Express.Multer.File) {
    if (dto.status !== undefined) this.assertValidStatus(dto.status);

    const data: Prisma.RentalUpdateInput = {};
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.monthlyRent !== undefined) data.monthlyRent = dto.monthlyRent;
    if (dto.deposit !== undefined) data.deposit = dto.deposit;
    if (dto.status !== undefined) data.status = dto.status;
    if (file) data.agreementFile = this.filePublicPath(file.filename);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.rental.findUnique({
          where: { id },
          select: {
            id: true,
            propertyId: true,
            status: true,
            monthlyRent: true,
            deposit: true,
            startDate: true,
            endDate: true,
          },
        });
        if (!existing) throw new NotFoundException('Rental not found');

        const nextRent =
          dto.monthlyRent !== undefined
            ? dto.monthlyRent
            : Number(existing.monthlyRent);
        const nextDeposit =
          dto.deposit !== undefined
            ? dto.deposit
            : existing.deposit != null
              ? Number(existing.deposit)
              : null;
        this.assertDepositWithinRent(nextRent, nextDeposit);

        const nextStatus = (dto.status ?? existing.status) as RentalStatus;
        if (existing.status !== nextStatus) {
          if (nextStatus === 'active') {
            const otherActive = await tx.rental.count({
              where: {
                propertyId: existing.propertyId,
                status: 'active',
                NOT: { id: existing.id },
              },
            });
            if (otherActive > 0) {
              throw new BadRequestException(
                'Property already has another active rental',
              );
            }
            const property = await tx.property.findUnique({
              where: { id: existing.propertyId },
              select: { status: true },
            });
            if (!property) throw new NotFoundException('Property not found');
            if (property.status !== PropertyStatus.available) {
              throw new BadRequestException(
                'Property must be available to reactivate this rental',
              );
            }
          }

          if (nextStatus === 'completed') {
            const end =
              dto.endDate !== undefined
                ? new Date(dto.endDate)
                : existing.endDate;
            if (!end) {
              throw new BadRequestException(
                'Set an end date before marking the rental completed',
              );
            }
            const endDay = new Date(end);
            endDay.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (today < endDay) {
              throw new BadRequestException(
                'Cannot complete before the lease end date. Use cancelled if the lease ended early.',
              );
            }
          }

          // Cancelled can happen any day; stamp end date if missing
          if (
            nextStatus === 'cancelled' &&
            dto.endDate === undefined &&
            !existing.endDate
          ) {
            data.endDate = new Date();
          }
        }

        const rental = await tx.rental.update({
          where: { id },
          data,
        });

        if (dto.deposit !== undefined || dto.startDate !== undefined) {
          await this.syncDepositPayment(
            tx,
            rental.id,
            nextDeposit,
            dto.startDate !== undefined
              ? new Date(dto.startDate)
              : existing.startDate,
          );
        }

        if (existing.status !== nextStatus) {
          await tx.property.update({
            where: { id: existing.propertyId },
            data: {
              status:
                nextStatus === 'active'
                  ? PropertyStatus.rented
                  : PropertyStatus.available,
            },
          });
        }

        return rental;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Rental not found');
      }
      throw e;
    }
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const rental = await tx.rental.findUnique({
        where: { id },
        select: { id: true, propertyId: true },
      });
      if (!rental) throw new NotFoundException('Rental not found');

      const deleted = await tx.rental.delete({ where: { id } });
      await tx.property.update({
        where: { id: rental.propertyId },
        data: { status: PropertyStatus.available },
      });
      return deleted;
    });
  }

  /** Absolute disk directory for multer */
  static agreementsDir() {
    const dir = join(process.cwd(), 'uploads', 'agreements');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }
}
