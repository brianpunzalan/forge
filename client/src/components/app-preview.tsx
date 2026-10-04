import {
  ArrowDownIcon,
  ArrowUpRightIcon,
  BellIcon,
  ChartLineUpIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  SquaresFourIcon,
  UsersIcon,
} from '@phosphor-icons/react'
import { cn } from 'cn'

const stats = [
  {
    label: 'Revenue',
    value: '$48,120',
    delta: '+12.4%',
    up: true,
    icon: CurrencyDollarIcon,
  },
  {
    label: 'Customers',
    value: '2,340',
    delta: '+5.1%',
    up: true,
    icon: UsersIcon,
  },
  {
    label: 'Orders',
    value: '1,204',
    delta: '-1.8%',
    up: false,
    icon: ShoppingBagIcon,
  },
  {
    label: 'Conversion',
    value: '3.6%',
    delta: '+0.4%',
    up: true,
    icon: ChartLineUpIcon,
  },
]

const bars = [
  { label: 'Jan', value: 38 },
  { label: 'Feb', value: 52 },
  { label: 'Mar', value: 44 },
  { label: 'Apr', value: 66 },
  { label: 'May', value: 58 },
  { label: 'Jun', value: 82 },
  { label: 'Jul', value: 74 },
]

const orders = [
  { id: '#3210', customer: 'Olivia Martin', amount: '$1,999', status: 'Paid' },
  { id: '#3209', customer: 'Jackson Lee', amount: '$39.00', status: 'Paid' },
  {
    id: '#3208',
    customer: 'Isabella Nguyen',
    amount: '$299.00',
    status: 'Pending',
  },
  { id: '#3207', customer: 'William Kim', amount: '$99.00', status: 'Paid' },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

export function AppPreview() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      {/* App navigation */}
      <div className="flex items-center gap-3 border-b bg-background px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SquaresFourIcon className="size-4" weight="fill" />
          </div>
          <span className="text-sm font-semibold">Pulse</span>
        </div>
        <nav className="ml-4 hidden items-center gap-1 text-sm text-muted-foreground @md:flex">
          <span className="rounded-md bg-muted px-2.5 py-1 text-foreground">
            Overview
          </span>
          <span className="px-2.5 py-1">Customers</span>
          <span className="px-2.5 py-1">Products</span>
          <span className="px-2.5 py-1">Reports</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md border text-muted-foreground">
            <MagnifyingGlassIcon className="size-3.5" />
          </span>
          <span className="flex size-7 items-center justify-center rounded-md border text-muted-foreground">
            <BellIcon className="size-3.5" />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
            OM
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
            <p className="text-xs text-muted-foreground">
              Welcome back. Here's what's happening today.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            <ArrowUpRightIcon className="size-3.5" />
            Export report
          </span>
        </div>

        {/* Stats */}
        <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-background p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
                <stat.icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-xl font-semibold tracking-tight">
                {stat.value}
              </p>
              <p
                className={cn(
                  'mt-1 inline-flex items-center gap-1 text-[11px] font-medium',
                  stat.up ? 'text-primary' : 'text-destructive',
                )}
              >
                {stat.up ? (
                  <ArrowUpRightIcon className="size-3" />
                ) : (
                  <ArrowDownIcon className="size-3" />
                )}
                {stat.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Chart + orders */}
        <div className="grid gap-3 @3xl:grid-cols-5">
          <div className="rounded-xl border bg-background p-4 @3xl:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Revenue</p>
                <p className="text-xs text-muted-foreground">Last 7 months</p>
              </div>
              <span className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
                Monthly
              </span>
            </div>
            <div className="mt-4 flex h-40 items-end gap-2">
              {bars.map((bar) => (
                <div
                  key={bar.label}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all"
                      style={{ height: `${bar.value}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4 @3xl:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Recent orders</p>
              <span className="text-[11px] text-muted-foreground">
                View all
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {initials(order.customer)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {order.customer}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {order.id}
                    </p>
                  </div>
                  <span className="text-xs font-medium">{order.amount}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      order.status === 'Paid'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
