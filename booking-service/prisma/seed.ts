import { PrismaClient, TechnicalConfigScope } from '@prisma/client';

const prisma = new PrismaClient();

const GLOBAL_SCOPE_ID = '00000000-0000-0000-0000-000000000000';

const DEALERSHIP_ID = 'd1000000-0000-4000-8000-000000000001';
const BAY_A_ID = 'b1000000-0000-4000-8000-000000000001';
const BAY_B_ID = 'b1000000-0000-4000-8000-000000000002';
const TECH_ALICE_ID = 'a1000000-0000-4000-8000-000000000001';
const TECH_BOB_ID = 'a1000000-0000-4000-8000-000000000002';
const SVC_OIL_ID = 'c1000000-0000-4000-8000-000000000001';
const SVC_BRAKE_ID = 'c1000000-0000-4000-8000-000000000002';

async function main() {
  await prisma.dealership.upsert({
    where: { id: DEALERSHIP_ID },
    create: {
      id: DEALERSHIP_ID,
      code: 'DEMO-01',
      name: 'Demo Dealership',
    },
    update: { name: 'Demo Dealership' },
  });

  await prisma.serviceType.upsert({
    where: { id: SVC_OIL_ID },
    create: {
      id: SVC_OIL_ID,
      code: 'OIL_CHANGE',
      name: 'Oil change',
      durationMinutes: 30,
      requiredSkillTag: 'lube',
    },
    update: { name: 'Oil change', durationMinutes: 30, requiredSkillTag: 'lube' },
  });

  await prisma.serviceType.upsert({
    where: { id: SVC_BRAKE_ID },
    create: {
      id: SVC_BRAKE_ID,
      code: 'BRAKE_SERVICE',
      name: 'Brake service',
      durationMinutes: 60,
      requiredSkillTag: 'brake',
    },
    update: { name: 'Brake service', durationMinutes: 60, requiredSkillTag: 'brake' },
  });

  await prisma.serviceBay.upsert({
    where: { id: BAY_A_ID },
    create: { id: BAY_A_ID, dealershipId: DEALERSHIP_ID, label: 'Bay A' },
    update: { label: 'Bay A' },
  });

  await prisma.serviceBay.upsert({
    where: { id: BAY_B_ID },
    create: { id: BAY_B_ID, dealershipId: DEALERSHIP_ID, label: 'Bay B' },
    update: { label: 'Bay B' },
  });

  await prisma.technician.upsert({
    where: { id: TECH_ALICE_ID },
    create: { id: TECH_ALICE_ID, dealershipId: DEALERSHIP_ID, name: 'Alice Tech' },
    update: { name: 'Alice Tech' },
  });

  await prisma.technician.upsert({
    where: { id: TECH_BOB_ID },
    create: { id: TECH_BOB_ID, dealershipId: DEALERSHIP_ID, name: 'Bob Tech' },
    update: { name: 'Bob Tech' },
  });

  await prisma.technicianQualifiedService.upsert({
    where: {
      technicianId_serviceTypeId: {
        technicianId: TECH_ALICE_ID,
        serviceTypeId: SVC_OIL_ID,
      },
    },
    create: { technicianId: TECH_ALICE_ID, serviceTypeId: SVC_OIL_ID },
    update: { technicianId: TECH_ALICE_ID, serviceTypeId: SVC_OIL_ID },
  });

  await prisma.technicianQualifiedService.upsert({
    where: {
      technicianId_serviceTypeId: {
        technicianId: TECH_ALICE_ID,
        serviceTypeId: SVC_BRAKE_ID,
      },
    },
    create: { technicianId: TECH_ALICE_ID, serviceTypeId: SVC_BRAKE_ID },
    update: { technicianId: TECH_ALICE_ID, serviceTypeId: SVC_BRAKE_ID },
  });

  await prisma.technicianQualifiedService.upsert({
    where: {
      technicianId_serviceTypeId: {
        technicianId: TECH_BOB_ID,
        serviceTypeId: SVC_OIL_ID,
      },
    },
    create: { technicianId: TECH_BOB_ID, serviceTypeId: SVC_OIL_ID },
    update: { technicianId: TECH_BOB_ID, serviceTypeId: SVC_OIL_ID },
  });

  const aliceOk = {
    OIL_CHANGE: true,
    BRAKE_SERVICE: true,
    notes: 'Dynamic OK map; junction table remains source for hard qualifications.',
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
        scopeId: TECH_ALICE_ID,
        configKey: 'specialization.ok',
      },
    },
    create: {
      scope: TechnicalConfigScope.TECHNICIAN,
      scopeId: TECH_ALICE_ID,
      configKey: 'specialization.ok',
      value: aliceOk,
    },
    update: { value: aliceOk },
  });

  await prisma.technicalConfig.upsert({
    where: {
      scope_scopeId_configKey: {
        scope: TechnicalConfigScope.TECHNICIAN,
        scopeId: TECH_BOB_ID,
        configKey: 'specialization.ok',
      },
    },
    create: {
      scope: TechnicalConfigScope.TECHNICIAN,
      scopeId: TECH_BOB_ID,
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
