/** Неделя с понедельника (ISO-стиль). */
export const WEEKDAYS_SHORT = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type GridCell = { date: Date; inMonth: boolean; disabled: boolean };

/** Сетка месяца: дни вне месяца + заполнение до целых недель; кликабельность ±rangeHalfDays от today. */
export function buildCalendarGrid(viewDate: Date, today: Date, rangeHalfDays = 30): GridCell[] {
  const firstAllowed = dayStart(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - rangeHalfDays),
  );
  const lastAllowed = dayStart(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + rangeHalfDays),
  );

  const isClickable = (d: Date) => {
    const t = dayStart(d);
    return t >= firstAllowed && t <= lastAllowed;
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  /** Сколько ячеек заполнить из предыдущего месяца, если неделя начинается с понедельника. */
  const leadDays = (start.getDay() + 6) % 7;
  const daysInMonth = end.getDate();
  const cells: GridCell[] = [];
  const prevMonth = new Date(year, month, 0);
  const prevCount = prevMonth.getDate();
  for (let i = 0; i < leadDays; i++) {
    const dayNum = prevCount - leadDays + i + 1;
    const date = new Date(year, month - 1, dayNum);
    cells.push({ date, inMonth: false, disabled: !isClickable(date) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, inMonth: true, disabled: !isClickable(date) });
  }
  const totalCells = Math.ceil(cells.length / 7) * 7;
  const filledBeforeTail = cells.length;
  for (let i = filledBeforeTail; i < totalCells; i++) {
    const dayInNextMonth = i - filledBeforeTail + 1;
    const date = new Date(year, month + 1, dayInNextMonth);
    cells.push({ date, inMonth: false, disabled: !isClickable(date) });
  }
  return cells;
}

/**
 * Навигация по месяцам в пределах окна ±`rangeHalfDays` от `today`
 * (иначе нельзя открыть месяц, где лежит 30-й день вперёд/назад от сегодня).
 */
export function monthNavLimits(
  today: Date,
  viewDate: Date,
  rangeHalfDays = 30,
): { canGoPrev: boolean; canGoNext: boolean } {
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - rangeHalfDays);
  const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + rangeHalfDays);
  const viewMonthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getTime();
  const firstMonthStart = new Date(first.getFullYear(), first.getMonth(), 1).getTime();
  const lastMonthStart = new Date(last.getFullYear(), last.getMonth(), 1).getTime();
  return {
    canGoPrev: viewMonthStart > firstMonthStart,
    canGoNext: viewMonthStart < lastMonthStart,
  };
}

export function formatDateRuLong(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}
