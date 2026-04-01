/**
 * Form validation schema and utilities
 * Provides consistent validation across all forms
 */

export const createValidationSchema = (rules) => {
  return (values) => {
    const errors = {}
    Object.keys(rules).forEach((field) => {
      const fieldRules = rules[field]
      const value = values[field]

      if (fieldRules.required && (!value || value.toString().trim() === '')) {
        errors[field] = fieldRules.requiredMessage || `${field} is required`
      }

      if (value && fieldRules.minLength && value.length < fieldRules.minLength) {
        errors[field] = `${field} must be at least ${fieldRules.minLength} characters`
      }

      if (value && fieldRules.maxLength && value.length > fieldRules.maxLength) {
        errors[field] = `${field} must be at most ${fieldRules.maxLength} characters`
      }

      if (value && fieldRules.pattern && !fieldRules.pattern.test(value)) {
        errors[field] = fieldRules.patternMessage || `${field} format is invalid`
      }

      if (fieldRules.custom && value) {
        const customError = fieldRules.custom(value)
        if (customError) errors[field] = customError
      }
    })
    return errors
  }
}

export const validators = {
  email: (value) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(value) ? null : 'Invalid email address'
  },
  phone: (value) => {
    const phonePattern = /^[0-9\-+() \s]+$/
    return phonePattern.test(value) ? null : 'Invalid phone number'
  },
  url: (value) => {
    try {
      new URL(value)
      return null
    } catch {
      return 'Invalid URL'
    }
  },
  number: (value) => {
    return !isNaN(value) && value !== '' ? null : 'Must be a number'
  },
  positiveNumber: (value) => {
    return !isNaN(value) && value > 0 ? null : 'Must be a positive number'
  },
}

export const combineValidators = (...validatorFns) => {
  return (value) => {
    for (const fn of validatorFns) {
      const error = fn(value)
      if (error) return error
    }
    return null
  }
}
