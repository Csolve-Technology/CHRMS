import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PropertyCategory, PropertyStatus, PropertyType } from '@prisma/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  paginated,
  parsePagination,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { saleTotals } from '../sales/sale-calculations.util';
import { CreatePropertyDocumentDto } from './dto/create-property-document.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { assertPropertyCategoryType } from './property-category.util';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveRooms(type: PropertyType, rooms?: number | null) {
    if (type === PropertyType.commercial) return null;
    if (rooms == null || Number.isNaN(rooms as number)) return null;
    return rooms;
  }

  async findAll(
    params: PaginationQuery & {
      q?: string;
      status?: PropertyStatus;
      woreda?: string;
      type?: PropertyType;
      category?: PropertyCategory;
    },
  ) {
    const { page, pageSize, skip, take } = parsePagination(params);
    const where: Prisma.PropertyWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.woreda) where.woreda = params.woreda;
    if (params.type) where.type = params.type;
    if (params.category) where.category = params.category;
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { houseNumber: { contains: q, mode: 'insensitive' } },
        { woreda: { contains: q, mode: 'insensitive' } },
        { kebele: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          rentals: {
            where: { status: 'active' },
            take: 1,
            include: { tenant: true },
          },
          sales: {
            where: { status: { not: 'cancelled' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { buyer: true },
          },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const items = rows.map((p) => {
      const activeRental = p.rentals[0];
      const latestSale = p.sales[0];
      let assignee: string | null = null;
      if (activeRental) assignee = activeRental.tenant.fullName;
      else if (latestSale) assignee = latestSale.buyer.fullName;
      const location = `${p.woreda}, Kebele ${p.kebele}, #${p.houseNumber}`;
      return {
        id: p.id,
        code: p.code,
        location,
        type: p.type,
        category: p.category,
        status: p.status,
        assignee,
        woreda: p.woreda,
        kebele: p.kebele,
        houseNumber: p.houseNumber,
        area: Number(p.area),
        rooms: p.rooms,
        latitude: p.latitude != null ? Number(p.latitude) : null,
        longitude: p.longitude != null ? Number(p.longitude) : null,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  static documentsDir() {
    const dir = join(process.cwd(), 'uploads', 'property-documents');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private documentPublicPath(filename: string) {
    return `/uploads/property-documents/${filename}`;
  }

  async findOne(id: string) {
    const p = await this.prisma.property.findUnique({
      where: { id },
      include: {
        rentals: {
          where: { status: 'active' },
          include: { tenant: true, payments: true },
        },
        sales: {
          where: { status: { not: 'cancelled' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { buyer: true, payments: true },
        },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p) throw new NotFoundException('Property not found');

    const activeRental = p.rentals[0];
    const sale = p.sales[0];

    let paymentSummary: {
      context: 'rental' | 'sale' | null;
      total: number;
      paid: number;
      remaining: number;
      completionPercentage: number;
    } = {
      context: null,
      total: 0,
      paid: 0,
      remaining: 0,
      completionPercentage: 0,
    };

    if (sale) {
      const t = saleTotals(sale.totalPrice, sale.payments);
      paymentSummary = {
        context: 'sale',
        total: t.totalPrice,
        paid: t.totalPaid,
        remaining: t.remaining,
        completionPercentage: t.completionPercentage,
      };
    } else if (activeRental) {
      const paid = activeRental.payments.reduce((s, x) => s + Number(x.amount), 0);
      paymentSummary = {
        context: 'rental',
        total: 0,
        paid,
        remaining: 0,
        completionPercentage: 0,
      };
    }

    return {
      property: {
        id: p.id,
        code: p.code,
        type: p.type,
        category: p.category,
        woreda: p.woreda,
        kebele: p.kebele,
        houseNumber: p.houseNumber,
        rooms: p.rooms,
        area: Number(p.area),
        status: p.status,
        latitude: p.latitude != null ? Number(p.latitude) : null,
        longitude: p.longitude != null ? Number(p.longitude) : null,
      },
      tenant: activeRental
        ? {
            id: activeRental.tenant.id,
            fullName: activeRental.tenant.fullName,
            phone: activeRental.tenant.phone,
            nationalId: activeRental.tenant.nationalId,
            address: activeRental.tenant.address,
            rental: {
              id: activeRental.id,
              agreementNumber: activeRental.agreementNumber,
              agreementFile: activeRental.agreementFile,
              startDate: activeRental.startDate,
              endDate: activeRental.endDate,
              monthlyRent: Number(activeRental.monthlyRent),
              deposit: activeRental.deposit ? Number(activeRental.deposit) : null,
              status: activeRental.status,
            },
          }
        : null,
      sale: sale
        ? (() => {
            const m = saleTotals(sale.totalPrice, sale.payments);
            return {
              id: sale.id,
              buyer: {
                id: sale.buyer.id,
                fullName: sale.buyer.fullName,
                phone: sale.buyer.phone,
              },
              totalPrice: m.totalPrice,
              downPayment: Number(sale.downPayment),
              durationMonths: sale.durationMonths,
              startDate: sale.startDate,
              status: sale.status,
              totalPaid: m.totalPaid,
              remaining: m.remaining,
              completionPercentage: m.completionPercentage,
              isCompleted: m.isCompleted,
            };
          })()
        : null,
      paymentSummary,
      documents: p.documents.map((d) => ({
        id: d.id,
        title: d.title,
        filePath: d.filePath,
        fileName: d.fileName,
        createdAt: d.createdAt,
      })),
    };
  }

  async addDocument(
    propertyId: string,
    dto: CreatePropertyDocumentDto,
    file?: Express.Multer.File,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!file) throw new BadRequestException('A document file is required');

    return this.prisma.propertyDocument.create({
      data: {
        propertyId,
        title: dto.title.trim(),
        filePath: this.documentPublicPath(file.filename),
        fileName: file.originalname || file.filename,
      },
    });
  }

  async create(dto: CreatePropertyDto) {
    assertPropertyCategoryType(dto.type, dto.category);
    const rooms = this.resolveRooms(dto.type, dto.rooms);

    try {
      return await this.prisma.property.create({
        data: {
          // Properties are tracked by house number (unique per city + kebele).
          code: null,
          type: dto.type,
          category: dto.category ?? null,
          woreda: dto.woreda,
          kebele: dto.kebele,
          houseNumber: dto.houseNumber.trim(),
          rooms,
          area: dto.area,
          status: dto.status ?? PropertyStatus.available,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'House number already exists for this city and kebele',
        );
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdatePropertyDto) {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Property not found');

    const nextType = dto.type ?? existing.type;
    const nextCategory =
      dto.category !== undefined ? dto.category : existing.category;
    assertPropertyCategoryType(nextType, nextCategory);

    const data: Prisma.PropertyUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.woreda !== undefined) data.woreda = dto.woreda;
    if (dto.kebele !== undefined) data.kebele = dto.kebele;
    if (dto.houseNumber !== undefined) data.houseNumber = dto.houseNumber.trim();
    if (dto.area !== undefined) data.area = dto.area;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

    if (dto.rooms !== undefined || dto.type !== undefined) {
      const roomsInput = dto.rooms !== undefined ? dto.rooms : existing.rooms;
      data.rooms = this.resolveRooms(nextType, roomsInput);
    }

    try {
      return await this.prisma.property.update({
        where: { id },
        data,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Property not found');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'House number already exists for this city and kebele',
        );
      }
      throw e;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.property.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Property not found');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'Cannot delete property with related rental or sale records',
        );
      }
      throw e;
    }
  }
}
