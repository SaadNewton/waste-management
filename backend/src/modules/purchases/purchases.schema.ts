import { z } from 'zod';
import { dateString, listQuery, money, optionalText, objectId } from '../../lib/validation';

const weight = z.coerce.number().finite().min(0).max(9_999_999_999);

export const purchaseLabourSchema = z.object({
  labourId: objectId('Select a labourer'),
  wage: z.coerce.number().finite().positive('Wage must be greater than 0'),
  paid: z.boolean().default(false),
  paidMethod: z.enum(['CASH', 'BANK']).default('CASH'),
});

export const purchaseSchema = z
  .object({
    date: dateString,
    partyId: objectId('Party is required'),
    vehicleNo: z.string().trim().min(1, 'Vehicle number is required').max(30).toUpperCase(),
    driverName: optionalText,
    driverPhone: optionalText,
    material: optionalText,
    grossWeight: weight,
    tareWeight: weight,
    rate: money,
    amount: money.optional().nullable(), // defaults to net × rate
    truckRent: money.default(0),
    truckRentPaidBy: z.enum(['ME', 'PARTY', 'DEDUCT']).default('ME'),
    truckRentMethod: z.enum(['CASH', 'BANK']).default('CASH'),
    amountPaid: money.default(0),
    paymentMethod: z.enum(['CASH', 'BANK']).default('CASH'),
    labours: z.array(purchaseLabourSchema).max(50).default([]),
    notes: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.tareWeight >= v.grossWeight) {
      ctx.addIssue({ code: 'custom', path: ['tareWeight'], message: 'Tare weight must be less than gross weight' });
    }
  });

export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const purchaseListQuery = listQuery(['date', 'serialNo', 'netWeight', 'amount', 'createdAt'], 'date').extend({
  partyId: objectId().optional(),
  vehicleNo: z.string().trim().optional(),
});
