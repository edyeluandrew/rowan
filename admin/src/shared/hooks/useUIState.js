import { useState, useCallback, useEffect } from 'react'

/**
 * Standardized filter management hook
 * Provides consistent filter state and update logic
 */
export const useFilters = (initialFilters = {}) => {
  const [filters, setFilters] = useState(initialFilters)
  const [applied, setApplied] = useState(initialFilters)

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === undefined || value === '' ? undefined : value,
    }))
  }, [])

  const applyFilters = useCallback(() => {
    setApplied(filters)
  }, [filters])

  const clearFilters = useCallback(() => {
    const empty = Object.keys(initialFilters).reduce((acc, key) => ({ ...acc, [key]: undefined }), {})
    setFilters(empty)
    setApplied(empty)
  }, [initialFilters])

  const hasActiveFilters = useCallback(
    () => Object.values(filters).some((v) => v !== undefined && v !== ''),
    [filters]
  )

  return { filters, applied, updateFilter, applyFilters, clearFilters, hasActiveFilters }
}

/**
 * Hook for managing search state with debounce
 */
export const useSearch = (onSearch, debounceMs = 500) => {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      if (onSearch) onSearch(search)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [search, debounceMs, onSearch])

  return { search, setSearch, debouncedSearch }
}

/**
 * Hook for tab/toggle state management
 */
export const useTabState = (initialTab = 'overview') => {
  const [activeTab, setActiveTab] = useState(initialTab)

  return { activeTab, setActiveTab }
}

/**
 * Hook for managing modal/dialog visibility
 */
export const useModal = (initialOpen = false) => {
  const [open, setOpen] = useState(initialOpen)

  const openModal = useCallback(() => setOpen(true), [])
  const closeModal = useCallback(() => setOpen(false), [])
  const toggleModal = useCallback(() => setOpen((prev) => !prev), [])

  return { open, openModal, closeModal, toggleModal, setOpen }
}

/**
 * Hook for managing form state with validation
 */
export const useFormState = (initialValues = {}, onValidate = null) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

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
    if (onValidate) {
      const error = onValidate(name, values[name])
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }))
      } else {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    }
  }, [values, onValidate])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  return { values, errors, touched, handleChange, handleBlur, resetForm, setFieldValue }
}
