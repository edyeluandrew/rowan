/**
 * Common form schemas for consistent validation
 */

import { createValidationSchema, validators } from '../utils/validation'

export const loginFormSchema = createValidationSchema({
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMessage: 'Invalid email address',
  },
  password: {
    required: true,
    minLength: 6,
  },
})

export const traderFormSchema = createValidationSchema({
  name: {
    required: true,
    minLength: 3,
    maxLength: 100,
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMessage: 'Invalid email',
  },
  phone: {
    required: true,
    custom: (value) => (value.length < 10 ? 'Phone number must be at least 10 digits' : null),
  },
  businessName: {
    required: true,
    minLength: 3,
  },
})

export const disputeFormSchema = createValidationSchema({
  transactionId: {
    required: true,
  },
  reason: {
    required: true,
    minLength: 10,
  },
  priority: {
    required: true,
  },
})

export const rateSchema = createValidationSchema({
  currency: {
    required: true,
  },
  rate: {
    required: true,
    custom: (value) => validators.positiveNumber(value),
  },
  spread: {
    required: false,
    custom: (value) => (!value || validators.positiveNumber(value)),
  },
})
