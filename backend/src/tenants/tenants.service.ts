import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginated,
  PaginatedResult,
  parsePagination,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

type TenantListItem = {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  status: string;
  propertyHouseNumber: string | null;
  propertyWoreda: string | null;
  propertyKebele: string | null;
  propertyId: string | null;
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    params: PaginationQuery & { q?: string },
  ): Promise<PaginatedResult<TenantListItem>> {
    const { page, pageSize, skip, take } = parsePagination(params);
    const where: Prisma.TenantWhereInput = {};
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { nationalId: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          rentals: {
            where: { status: 'active' },
            take: 1,
            include: { property: true },
          },
          purchases: {
            where: { status: { not: 'cancelled' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { property: true },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const items = tenants.map((t) => {
      const linked = t.rentals[0]?.property ?? t.purchases[0]?.property ?? null;
      return {
        id: t.id,
        fullName: t.fullName,
        phone: t.phone,
        address: t.address,
        status: t.status,
        propertyHouseNumber: linked?.houseNumber ?? null,
        propertyWoreda: linked?.woreda ?? null,
        propertyKebele: linked?.kebele ?? null,
        propertyId: linked?.id ?? null,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        rentals: { include: { property: true } },
        purchases: { include: { property: true } },
      },
    });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }

  async create(dto: CreateTenantDto) {
    try {
      return await this.prisma.tenant.create({
        data: {
          fullName: dto.fullName,
          gender: dto.gender,
          phone: dto.phone,
          nationalId: dto.nationalId,
          address: dto.address ?? null,
          familySize: dto.familySize,
          status: dto.status ?? 'active',
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('National ID already registered');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateTenantDto) {
    const data: Prisma.TenantUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.nationalId !== undefined) data.nationalId = dto.nationalId;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.familySize !== undefined) data.familySize = dto.familySize;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.prisma.tenant.update({
        where: { id },
        data,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Tenant not found');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('National ID already registered');
      }
      throw e;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.tenant.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Tenant not found');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'Cannot delete tenant with related rental or sale records',
        );
      }
      throw e;
    }
  }
}
