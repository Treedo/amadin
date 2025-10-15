/// <reference types="node" />
import { PrismaClient, Prisma } from './prisma-client/index.js';

import path from 'path';
import dotenv from 'dotenv';

// Завантажити .env з кореня проекту (гарантуємо правильний шлях)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// The generated Prisma client will live in core/prisma-client after `prisma generate`.
// Until migrations are applied, this script simply demonstrates the expected seeding flow.
const prisma = new PrismaClient();

async function seed() {
  const accountingModule = await prisma.module.upsert({
    where: { code: 'accounting' },
    update: {},
    create: {
      code: 'accounting',
      name: 'Accounting',
      entities: {
        create: [
          {
            code: 'company',
            name: 'Company',
            fields: {
              create: [
                { code: 'id', name: 'ID', type: 'GRID', required: true, isPrimary: true },
                { code: 'name', name: 'Name', type: 'STRING', required: true },
                { code: 'taxCode', name: 'Tax code', type: 'STRING' }
              ]
            }
          },
          {
            code: 'invoice',
            name: 'Invoice',
            fields: {
              create: [
                { code: 'id', name: 'ID', type: 'GRID', required: true, isPrimary: true },
                { code: 'number', name: 'Number', type: 'STRING', required: true },
                { code: 'total', name: 'Total', type: 'DECIMAL', required: true }
              ]
            },
            documents: {
              create: {
                sequence: { create: { prefix: 'INV-', padding: 5 } }
              }
            }
          }
        ]
      }
    }
  });

  const invoiceEntity = await prisma.entity.findFirst({
    where: { moduleId: accountingModule.id, code: 'invoice' },
    include: { fields: true }
  });

  if (!invoiceEntity) {
    throw new Error('Invoice entity was not created');
  }

  const numberField = invoiceEntity.fields.find((field: any) => field.code === 'number');
  const totalField = invoiceEntity.fields.find((field: any) => field.code === 'total');

  const existingForm = await prisma.form.findFirst({
    where: { moduleId: accountingModule.id, code: 'invoiceForm' }
  });

  if (!existingForm) {
    const headerFields: Prisma.FormFieldCreateWithoutGroupInput[] = [];

    if (numberField) {
      headerFields.push({
        widget: 'INPUT',
        order: 0,
        field: { connect: { id: numberField.id } }
      });
    }

    if (totalField) {
      headerFields.push({
        widget: 'INPUT',
        order: 1,
        field: { connect: { id: totalField.id } }
      });
    }

    await prisma.form.create({
      data: {
        code: 'invoiceForm',
        name: 'Invoice entry',
        moduleId: accountingModule.id,
        entities: {
          create: [
            {
              entity: { connect: { id: invoiceEntity.id } },
              mode: 'SINGLE'
            }
          ]
        },
        groups: {
          create: [
            {
              title: 'Header',
              order: 0,
              fields: {
                create: headerFields
              }
            }
          ]
        }
      }
    });
  }
}

async function main() {
  console.log('🌱 Seeding Amadin core meta-schema...');
  await seed();
  console.log('✅ Seed complete');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
