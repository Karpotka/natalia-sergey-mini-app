export type ProfileTabId = 'data' | 'wallet' | 'shop';

const TABS: { id: ProfileTabId; label: string }[] = [
  { id: 'data', label: 'Данные' },
  { id: 'wallet', label: 'Кошелёк' },
  { id: 'shop', label: 'Обложки' },
];

type Props = {
  active: ProfileTabId;
  onChange: (id: ProfileTabId) => void;
  profileIncomplete?: boolean;
};

export function ProfileTabBar({ active, onChange, profileIncomplete }: Props) {
  return (
    <nav className="profile-hub-tabs" role="tablist" aria-label="Разделы кабинета">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`profile-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`profile-panel-${tab.id}`}
            className={'profile-hub-tab' + (isActive ? ' profile-hub-tab--active' : '')}
            onClick={() => onChange(tab.id)}
          >
            <span className="profile-hub-tab-label">{tab.label}</span>
            {tab.id === 'data' && profileIncomplete ? (
              <span className="profile-hub-tab-badge" aria-label="Заполните профиль">
                !
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
