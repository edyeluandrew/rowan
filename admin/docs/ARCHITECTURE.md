# Admin Panel Architecture Documentation

## Project Overview

The admin panel follows a **feature-oriented architecture** with a shared utilities layer. This document outlines the structure, patterns, and best practices.

## Directory Structure

```
admin/
├── src/
│   ├── shared/              # Shared across all features
│   │   ├── components/      # Reusable UI components
│   │   │   ├── patterns/    # Base component patterns
│   │   │   ├── ui/          # Basic UI elements
│   │   │   ├── layout/      # Layout components
│   │   │   └── boundaries/  # Error boundaries, suspense
│   │   ├── hooks/           # Reusable React hooks
│   │   ├── services/        # API clients and services
│   │   ├── context/         # React context
│   │   ├── utils/           # Utilities and helpers
│   │   └── constants.js     # App constants
│   ├── features/            # Feature modules
│   │   ├── {feature}/       # Feature folder
│   │   │   ├── pages/       # Page components
│   │   │   ├── hooks/       # Feature-specific hooks
│   │   │   ├── components/  # Feature components
│   │   │   └── services/    # Feature services (optional)
│   ├── test/                # Testing utilities
│   └── App.jsx              # Root component
├── jest.config.json         # Jest configuration
└── package.json
```

## Feature Architecture

Each feature is self-contained with pages, hooks, and components:

```
features/transactions/
├── pages/
│   ├── TransactionsPage.jsx      # List view
│   └── TransactionDetailPage.jsx # Detail view
├── hooks/
│   └── useTransactions.js        # Data fetching
├── components/
│   ├── TransactionFilters.jsx    # Feature filters
│   ├── TransactionRow.jsx        # List row item
│   └── TransactionStateTag.jsx   # Status badge
└── __tests__/                    # Feature tests
```

## Component Patterns

### 1. Data Fetching with useDataFetch

```javascript
import { useListData } from '../../../shared/hooks/useDataFetch'
import { getTransactions } from '../../../shared/services/api/transactions'

function useTransactions(filters = {}) {
  return useListData(
    async (params) => getTransactions(params),
    []
  )
}
```

### 2. Form Validation with useForm

```javascript
import { useForm } from '../../../shared/hooks/useForm'
import { traderFormSchema } from '../../../shared/utils/formSchemas'

function TraderForm() {
  const form = useForm({
    initialValues: { name: '', email: '' },
    validationSchema: traderFormSchema,
    onSubmit: async (values) => {
      await createTrader(values)
    }
  })

  return (
    <Form onSubmit={form.handleSubmit} error={form.submitError}>
      <FormField label="Name" error={form.errors.name}>
        <FormInput
          name="name"
          value={form.values.name}
          onChange={form.handleChange}
        />
      </FormField>
    </Form>
  )
}
```

### 3. Table Component

```javascript
import { Table } from '../../../shared/components/patterns/Table'

function TransactionsPage() {
  const { data, loading, error, pagination, setPage } = useTransactions()

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'amount', label: 'Amount', render: (val) => `$${val}` },
    { key: 'status', label: 'Status' }
  ]

  return (
    <Table
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      pagination={pagination}
      onPageChange={setPage}
    />
  )
}
```

### 4. Error Boundaries

```javascript
import { withErrorBoundary } from '../../../shared/components/boundaries'

export default withErrorBoundary(TransactionsPage)
```

## API Service Pattern

All API services follow a consistent pattern:

```javascript
// shared/services/api/transactions.js
import { client } from './client'

export const getTransactions = async (params = {}) => {
  const { data } = await client.get('/transactions', { params })
  return data
}

export const createTransaction = async (payload) => {
  const { data } = await client.post('/transactions', payload)
  return data
}
```

## Hook Standard Return Signature

### Paginated Lists
```javascript
{
  data: Array,
  loading: boolean,
  error: string | null,
  page: number,
  pages: number,
  total: number,
  refresh: Function,
  setPage: Function
}
```

### Simple Data
```javascript
{
  data: any,
  loading: boolean,
  error: string | null,
  refresh: Function
}
```

## Testing

### Running Tests
```bash
npm test                    # Run all tests
npm test -- --coverage     # With coverage report
npm test -- --watch        # Watch mode
```

### Writing Tests
```javascript
// Example: Hook test
import { renderHook, waitFor } from '@testing-library/react'
import useTransactions from '../../hooks/useTransactions'

describe('useTransactions', () => {
  it('should fetch transactions', async () => {
    const { result } = renderHook(() => useTransactions())
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })
  })
})
```

## Best Practices

### 1. Import Paths in Features
- Import shared services: `../../../shared/services/api/{service}`
- Import shared hooks: `../../../shared/hooks/{hook}`
- Import shared utils: `../../../shared/utils/{util}`
- Import feature siblings: `../{component|hooks|pages}/{name}`

### 2. Error Handling
Always use `handleDataError()` from shared hooks for consistent error messages:

```javascript
import { handleDataError } from '../../../shared/hooks/useDataFetch'

try {
  const result = await fetchData()
} catch (err) {
  const message = handleDataError(err)
}
```

### 3. Form Validation
Use predefined schemas from `shared/utils/formSchemas.js`:

```javascript
import { traderFormSchema } from '../../../shared/utils/formSchemas'
```

### 4. Component Composition
Prefer composition over inheritance. Use patterns from `shared/components/patterns/`:

```javascript
import { Card, CardHeader, CardBody } from '../../../shared/components/patterns'

function TransactionCard(props) {
  return (
    <Card>
      <CardHeader>Transaction</CardHeader>
      <CardBody>Content</CardBody>
    </Card>
  )
}
```

## Performance Tips

1. **Code Splitting**: Use React.lazy for heavy features
2. **Memoization**: Use React.memo for list items with expensive renders
3. **Caching**: Use useCache hook for repeated API calls
4. **Auto-refresh**: Use useAutoRefresh for polling data

```javascript
import { useAutoRefresh } from '../../../shared/hooks/useDataUtils'

function Overview() {
  const { refresh } = useOverview()
  useAutoRefresh(refresh, 5000)  // Refresh every 5 seconds
}
```

## Debugging

### Enable Debug Mode
```javascript
// In App.jsx or .env
VITE_DEBUG=true
```

### Common Issues

**Import errors**: Check path depth (most features are 4 levels deep: `../../../shared/`)

**Type mismatches**: Verify hook return types match expected signature

**Hook dependency warnings**: Ensure all dependencies are listed in useEffect/useCallback

## Contributing

When adding new features:

1. Create `features/{featureName}/` folder
2. Add pages, hooks, components in respective folders
3. Follow existing patterns for consistency
4. Write tests in `__tests__/` folders
5. Update this documentation

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for build and deployment procedures.
