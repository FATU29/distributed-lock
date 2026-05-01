import { PrismaClient, TechnicalConfigScope } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const GLOBAL_SCOPE_ID = '00000000-0000-0000-0000-000000000000';

async function upsertServiceBay(dealershipId: string, label: string) {
  const existing = await prisma.serviceBay.findFirst({
    where: { dealershipId, label },
  });
  if (existing) {
    return prisma.serviceBay.update({
      where: { id: existing.id },
      data: { label },
    });
  }
  return prisma.serviceBay.create({
    data: { id: uuidv4(), dealershipId, label },
  });
}

async function upsertTechnician(dealershipId: string, name: string) {
  const existing = await prisma.technician.findFirst({
    where: { dealershipId, name },
  });
  if (existing) {
    return prisma.technician.update({
      where: { id: existing.id },
      data: { name },
    });
  }
  return prisma.technician.create({
    data: { id: uuidv4(), dealershipId, name },
  });
}

const OPEN_8_AM = 8 * 60;
const CLOSE_6_PM = 18 * 60;

async function upsertWorkingHours(
  dealershipId: string,
  dayOfWeek: number,
  openMinutes: number,
  closeMinutes: number,
  isClosed: boolean,
) {
  return prisma.workingHours.upsert({
    where: {
      dealershipId_dayOfWeek: { dealershipId, dayOfWeek },
    },
    create: {
      id: uuidv4(),
      dealershipId,
      dayOfWeek,
      openMinutes,
      closeMinutes,
      isClosed,
    },
    update: { openMinutes, closeMinutes, isClosed },
  });
}

async function upsertHoliday(
  dealershipId: string,
  date: Date,
  name: string,
  isRecurring: boolean,
) {
  return prisma.holiday.upsert({
    where: {
      dealershipId_date_isRecurring: { dealershipId, date, isRecurring },
    },
    create: { id: uuidv4(), dealershipId, date, name, isRecurring },
    update: { name },
  });
}

async function main() {
  const dealership = await prisma.dealership.upsert({
    where: { code: 'DEMO-01' },
    create: {
      id: uuidv4(),
      code: 'DEMO-01',
      name: 'Demo Dealership',
    },
    update: { name: 'Demo Dealership' },
  });

  const svcOil = await prisma.serviceType.upsert({
    where: { code: 'OIL_CHANGE' },
    create: {
      id: uuidv4(),
      code: 'OIL_CHANGE',
      name: 'Oil change',
      durationMinutes: 30,
      requiredSkillTag: 'lube',
    },
    update: {
      name: 'Oil change',
      durationMinutes: 30,
      requiredSkillTag: 'lube',
    },
  });

  const svcBrake = await prisma.serviceType.upsert({
    where: { code: 'BRAKE_SERVICE' },
    create: {
      id: uuidv4(),
      code: 'BRAKE_SERVICE',
      name: 'Brake service',
      durationMinutes: 60,
      requiredSkillTag: 'brake',
    },
    update: {
      name: 'Brake service',
      durationMinutes: 60,
      requiredSkillTag: 'brake',
    },
  });

  await upsertServiceBay(dealership.id, 'Bay A');
  await upsertServiceBay(dealership.id, 'Bay B');

  // Mon–Fri 08:00–18:00; Sat & Sun closed.
  for (const dow of [1, 2, 3, 4, 5]) {
    await upsertWorkingHours(dealership.id, dow, OPEN_8_AM, CLOSE_6_PM, false);
  }
  for (const dow of [0, 6]) {
    await upsertWorkingHours(dealership.id, dow, 0, 0, true);
  }

  // A few annually recurring Vietnamese public holidays. Year is a
  // placeholder when isRecurring=true — only month/day match.
  await upsertHoliday(
    dealership.id,
    new Date(Date.UTC(2000, 0, 1)),
    "New Year's Day",
    true,
  );
  await upsertHoliday(
    dealership.id,
    new Date(Date.UTC(2000, 3, 30)),
    'Reunification Day',
    true,
  );
  await upsertHoliday(
    dealership.id,
    new Date(Date.UTC(2000, 4, 1)),
    'Labour Day',
    true,
  );
  await upsertHoliday(
    dealership.id,
    new Date(Date.UTC(2000, 8, 2)),
    'National Day',
    true,
  );

  const alice = await upsertTechnician(dealership.id, 'Alice Tech');
  const bob = await upsertTechnician(dealership.id, 'Bob Tech');

  await prisma.technicianQualifiedService.upsert({
    where: {
      technicianId_serviceTypeId: {
        technicianId: alice.id,
        serviceTypeId: svcOil.id,
      },
    },
    create: { technicianId: alice.id, serviceTypeId: svcOil.id },
    update: {},
  });

  await prisma.technicianQualifiedService.upsert({
    where: {
      technicianId_serviceTypeId: {
        technicianId: alice.id,
        serviceTypeId: svcBrake.id,
      },
    },
    create: { technicianId: alice.id, serviceTypeId: svcBrake.id },
    update: {},
  });

  await prisma.technicianQualifiedService.upsert({
    where: {
      technicianId_serviceTypeId: {
        technicianId: bob.id,
        serviceTypeId: svcOil.id,
      },
    },
    create: { technicianId: bob.id, serviceTypeId: svcOil.id },
    update: {},
  });

  const aliceOk = {
    OIL_CHANGE: true,
    BRAKE_SERVICE: true,
    notes:
      'Dynamic OK map; junction table remains source for hard qualifications.',
  };

  const bobOk = {
    OIL_CHANGE: true,
    BRAKE_SERVICE: false,
  };

  await prisma.technicalConfig.upsert({
    where: {
      scope_scopeId_configKey: {
        scope: TechnicalConfigScope.GLOBAL,
        scopeId: GLOBAL_SCOPE_ID,
        configKey: 'booking.slot_granularity_minutes',
      },
    },
    create: {
      scope: TechnicalConfigScope.GLOBAL,
      scopeId: GLOBAL_SCOPE_ID,
      configKey: 'booking.slot_granularity_minutes',
      value: 15,
    },
    update: { value: 15 },
  });

  await prisma.technicalConfig.upsert({
    where: {
      scope_scopeId_configKey: {
        scope: TechnicalConfigScope.TECHNICIAN,
        scopeId: alice.id,
        configKey: 'specialization.ok',
      },
    },
    create: {
      scope: TechnicalConfigScope.TECHNICIAN,
      scopeId: alice.id,
      configKey: 'specialization.ok',
      value: aliceOk,
    },
    update: { value: aliceOk },
  });

  await prisma.technicalConfig.upsert({
    where: {
      scope_scopeId_configKey: {
        scope: TechnicalConfigScope.TECHNICIAN,
        scopeId: bob.id,
        configKey: 'specialization.ok',
      },
    },
    create: {
      scope: TechnicalConfigScope.TECHNICIAN,
      scopeId: bob.id,
      configKey: 'specialization.ok',
      value: bobOk,
    },
    update: { value: bobOk },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
