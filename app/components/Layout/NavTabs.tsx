'use client';

interface NavTab {
  id: string;
  label: string;
  icon: string;
}

interface NavTabsProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function NavTabs({ tabs, activeTab, onTabChange }: NavTabsProps) {
  return (
    <nav className="flex gap-1 bg-slate-900 border-b border-slate-700 px-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`text-xs py-2.5 px-4 border-b-2 transition-all ${
            activeTab === tab.id
              ? 'text-indigo-400 border-indigo-500'
              : 'text-slate-500 border-transparent hover:text-slate-400'
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </nav>
  );
}
