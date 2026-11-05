import {
  PrismaClient,
  PropertyCategory,
  PropertyStatus,
  PropertyType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@chiro.gov.et' },
    update: {},
    create: {
      email: 'admin@chiro.gov.et',
      passwordHash,
      fullName: 'System Administrator',
      role: UserRole.ADMIN,
      roleNames: [UserRole.ADMIN],
    },
  });

  await prisma.user.upsert({
    where: { email: 'housing@chiro.gov.et' },
    update: {},
    create: {
      email: 'housing@chiro.gov.et',
      passwordHash,
      fullName: 'Housing Officer',
      role: UserRole.HOUSING_OFFICER,
      roleNames: [UserRole.HOUSING_OFFICER],
    },
  });

  const tenantIds = [
    'tnt-seed-01',
    'tnt-seed-02',
    'tnt-seed-03',
    'tnt-seed-04',
    'tnt-seed-05',
  ];

  const tenantsData = [
    { id: tenantIds[0], fullName: 'Abebe Bikila', gender: 'male', phone: '+251911000001', nationalId: 'CHI-10001', address: 'Woreda 01, Kebele 03', familySize: 4 },
    { id: tenantIds[1], fullName: 'Tirunesh Dibaba', gender: 'female', phone: '+251911000002', nationalId: 'CHI-10002', address: 'Woreda 01, Kebele 03', familySize: 3 },
    { id: tenantIds[2], fullName: 'Haile Gebrselassie', gender: 'male', phone: '+251911000003', nationalId: 'CHI-10003', address: 'Woreda 02, Kebele 01', familySize: 5 },
    { id: tenantIds[3], fullName: 'Derartu Tulu', gender: 'female', phone: '+251911000004', nationalId: 'CHI-10004', address: 'Woreda 02, Kebele 05', familySize: 2 },
    { id: tenantIds[4], fullName: 'Kenenisa Bekele', gender: 'male', phone: '+251911000005', nationalId: 'CHI-10005', address: 'Woreda 03, Kebele 02', familySize: 6 },
  ];

  for (const t of tenantsData) {
    await prisma.tenant.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }

  const propertySpecs: Array<{
    id: string;
    code: string;
    type: PropertyType;
    category: PropertyCategory | null;
    woreda: string;
    kebele: string;
    houseNumber: string;
    rooms: number | null;
    area: string;
    status: PropertyStatus;
    latitude?: string;
    longitude?: string;
  }> = [
    { id: 'prp-seed-01', code: 'PROP-001', type: PropertyType.residential, category: PropertyCategory.kebele, woreda: '01', kebele: '03', houseNumber: '12A', rooms: 3, area: '85.5', status: PropertyStatus.rented, latitude: '9.0891000', longitude: '40.8671000' },
    { id: 'prp-seed-02', code: 'PROP-002', type: PropertyType.residential, category: PropertyCategory.saving, woreda: '01', kebele: '03', houseNumber: '12B', rooms: 2, area: '62.0', status: PropertyStatus.rented, latitude: '9.0894000', longitude: '40.8675000' },
    { id: 'prp-seed-03', code: 'PROP-003', type: PropertyType.commercial, category: PropertyCategory.condominium, woreda: '02', kebele: '01', houseNumber: 'C-5', rooms: null, area: '45.0', status: PropertyStatus.rented, latitude: '9.0910000', longitude: '40.8700000' },
    { id: 'prp-seed-04', code: 'PROP-004', type: PropertyType.residential, category: PropertyCategory.condominium, woreda: '02', kebele: '05', houseNumber: '8', rooms: 4, area: '110.0', status: PropertyStatus.sold },
    { id: 'prp-seed-05', code: 'PROP-005', type: PropertyType.residential, category: PropertyCategory.kebele, woreda: '03', kebele: '02', houseNumber: '22', rooms: 3, area: '78.0', status: PropertyStatus.sold },
    { id: 'prp-seed-06', code: 'PROP-006', type: PropertyType.residential, category: PropertyCategory.saving, woreda: '01', kebele: '07', houseNumber: '3', rooms: 2, area: '55.0', status: PropertyStatus.available },
    { id: 'prp-seed-07', code: 'PROP-007', type: PropertyType.commercial, category: null, woreda: '04', kebele: '01', houseNumber: 'Shop-2', rooms: null, area: '30.0', status: PropertyStatus.available },
    { id: 'prp-seed-08', code: 'PROP-008', type: PropertyType.residential, category: PropertyCategory.kebele, woreda: '03', kebele: '04', houseNumber: '15', rooms: 3, area: '90.0', status: PropertyStatus.maintenance },
    { id: 'prp-seed-09', code: 'PROP-009', type: PropertyType.residential, category: PropertyCategory.condominium, woreda: '02', kebele: '02', houseNumber: '7', rooms: 2, area: '60.0', status: PropertyStatus.available },
    { id: 'prp-seed-10', code: 'PROP-010', type: PropertyType.residential, category: PropertyCategory.saving, woreda: '01', kebele: '01', houseNumber: '1', rooms: 5, area: '140.0', status: PropertyStatus.available },
  ];

  for (const p of propertySpecs) {
    await prisma.property.upsert({
      where: { id: p.id },
      update: {
        category: p.category,
        rooms: p.rooms,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      },
      create: {
        id: p.id,
        code: p.code,
        type: p.type,
        category: p.category,
        woreda: p.woreda,
        kebele: p.kebele,
        houseNumber: p.houseNumber,
        rooms: p.rooms,
        area: p.area,
        status: p.status,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      },
    });
  }

  const r1 = 'rnt-seed-01';
  const r2 = 'rnt-seed-02';
  const r3 = 'rnt-seed-03';

  await prisma.rental.upsert({
    where: { id: r1 },
    update: {},
    create: {
      id: r1,
      propertyId: 'prp-seed-01',
      tenantId: tenantIds[0],
      agreementNumber: 'RA-2024-0001',
      startDate: new Date('2024-01-01'),
      monthlyRent: '4500',
      deposit: '9000',
      status: 'active',
    },
  });

  await prisma.rental.upsert({
    where: { id: r2 },
    update: {},
    create: {
      id: r2,
      propertyId: 'prp-seed-02',
      tenantId: tenantIds[1],
      agreementNumber: 'RA-2024-0002',
      startDate: new Date('2024-03-15'),
      monthlyRent: '3200',
      deposit: '6400',
      status: 'active',
    },
  });

  await prisma.rental.upsert({
    where: { id: r3 },
    update: {},
    create: {
      id: r3,
      propertyId: 'prp-seed-03',
      tenantId: tenantIds[2],
      agreementNumber: 'RA-2023-0001',
      startDate: new Date('2023-11-01'),
      monthlyRent: '8000',
      deposit: '16000',
      status: 'active',
    },
  });

  await prisma.rentalPayment.deleteMany({ where: { rentalId: { in: [r1, r2, r3] } } });
  await prisma.rentalPayment.createMany({
    data: [
      { rentalId: r1, amount: '4500', paidAt: new Date('2026-02-05'), method: 'bank', receiptNo: 'R-2026-0205-001' },
      { rentalId: r1, amount: '4500', paidAt: new Date('2026-03-05'), method: 'cash', receiptNo: 'R-2026-0305-001' },
      { rentalId: r2, amount: '3200', paidAt: new Date('2026-03-10'), method: 'mobile', receiptNo: 'R-2026-0310-002' },
    ],
  });

  const s1 = 'sle-seed-01';
  const s2 = 'sle-seed-02';

  await prisma.sale.deleteMany({ where: { id: { in: [s1, s2] } } });
  await prisma.sale.create({
    data: {
      id: s1,
      propertyId: 'prp-seed-04',
      buyerId: tenantIds[3],
      totalPrice: '850000',
      downPayment: '150000',
      durationMonths: 24,
      startDate: new Date('2025-06-01'),
      status: 'active',
      payments: {
        create: [
          { amount: '150000', paidAt: new Date('2025-06-01'), method: 'bank' },
          { amount: '30000', paidAt: new Date('2025-07-01'), method: 'bank' },
          { amount: '30000', paidAt: new Date('2025-08-01'), method: 'cash' },
        ],
      },
    },
  });

  await prisma.sale.create({
    data: {
      id: s2,
      propertyId: 'prp-seed-05',
      buyerId: tenantIds[4],
      totalPrice: '620000',
      downPayment: '120000',
      durationMonths: 18,
      startDate: new Date('2025-09-01'),
      status: 'active',
      payments: {
        create: [
          { amount: '120000', paidAt: new Date('2025-09-01'), method: 'bank' },
          { amount: '28000', paidAt: new Date('2025-10-01'), method: 'mobile' },
        ],
      },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
