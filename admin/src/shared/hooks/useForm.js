/**
 * Advanced form state hook with validation
 * Provides complete form lifecycle management
 */

import { useState, useCallback } from 'react'

export const useForm = ({ initialValues = {}, validationSchema = null, onSubmit = null }) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, isSetSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(null)

  const validate = useCallback(() => {
    if (!validationSchema) return {}
    return validationSchema(values)
  }, [values, validationSchema])

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }, [])

  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    const fieldErrors = validate()
    if (fieldErrors[name]) {
      setErrors((prev) => ({ ...prev, [name]: fieldErrors[name] }))
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }, [validate])

  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault()
      isSetSubmitting(true)
      setSubmitError(null)
      setSubmitSuccess(null)

      try {
        const formErrors = validate()
        if (Object.keys(formErrors).length > 0) {
          setErrors(formErrors)
          setTouched(
            Object.keys(initialValues).reduce((acc, key) => {
              acc[key] = true
              return acc
            }, {})
          )
          throw new Error('Form validation failed')
        }

        if (onSubmit) {
          await onSubmit(values)
          setSubmitSuccess('Form submitted successfully')
        }
      } catch (error) {
        setSubmitError(error.message || 'Submission failed')
        throw error
      } finally {
        isSetSubmitting(false)
      }
    },
    [values, validate, onSubmit, initialValues]
  )

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
    setSubmitError(null)
    setSubmitSuccess(null)
  }, [initialValues])

  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const setFieldError = useCallback((name, error) => {
    setErrors((prev) => ({ ...prev, [name]: error }))
  }, [])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    submitSuccess,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    validate,
  }
}

export default useForm
