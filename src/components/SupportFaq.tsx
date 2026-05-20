/** FAQ для поддержки — согласование: база ответов до автоматизации чата. */
export function SupportFaq() {
  const items = [
    {
      q: 'Не прошла оплата',
      a: 'Проверьте, что оплата прошла. Нет доступа — напишите в поддержку.',
    },
    {
      q: 'Не открылся расклад Таро',
      a: 'Сеть и вход. Повторите через минуту. Ошибка — в поддержку.',
    },
    {
      q: 'Нет ответа эксперта',
      a: 'Эксперты: 9:00–21:00 МСК. Ответ — до часа.',
    },
    {
      q: 'Ошибка в профиле или доступе',
      a: 'Опишите шаги и приложите скрин; модерация и поддержка разберут обращение.',
    },
  ];

  return (
    <details className="support-faq">
      <summary>Поддержка и частые вопросы</summary>
      <div className="support-faq-body">
        {items.map((it) => (
          <div key={it.q} className="support-faq-item">
            <div className="support-faq-q">{it.q}</div>
            <div className="support-faq-a">{it.a}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
