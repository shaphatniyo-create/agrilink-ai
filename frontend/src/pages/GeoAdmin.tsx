import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

interface AreaNode {
  id: string;
  name: string;
  level: string;
  isActive: boolean;
}

/** Recursive drill-down: Rwanda -> Province -> District -> Sector -> Cell -> Village. */
function AreaBranch({ node, depth }: { node: AreaNode; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<AreaNode[] | null>(null);
  const [active, setActive] = useState(node.isActive);
  const [busy, setBusy] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && children === null) {
      const { data } = await api.get('/geo/children', { params: { parentId: node.id } });
      setChildren(data);
    }
    setExpanded((e) => !e);
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/geo/${node.id}/active`, { active: !active });
      setActive(data.isActive);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginLeft: depth * 16 }} className="border-l border-gray-100 pl-3">
      <div className="flex items-center gap-2 py-1">
        <button onClick={toggleExpand} className="w-5 text-xs text-gray-400">
          {expanded ? '▾' : '▸'}
        </button>
        <span className="w-20 shrink-0 text-[10px] uppercase text-gray-400">{node.level}</span>
        <span className="flex-1 text-sm">{node.name}</span>
        <button
          onClick={toggleActive}
          disabled={busy}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            active ? 'bg-agrigreen-100 text-agrigreen-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {active ? 'ACTIVE' : 'inactive'}
        </button>
      </div>
      {expanded && children && (
        <div>
          {children.map((c) => (
            <AreaBranch key={c.id} node={c} depth={depth + 1} />
          ))}
          {children.length === 0 && <p className="ml-7 text-xs text-gray-400">No sub-areas loaded yet.</p>}
        </div>
      )}
    </div>
  );
}

export default function GeoAdmin() {
  const { t } = useTranslation();
  const [roots, setRoots] = useState<AreaNode[]>([]);

  useEffect(() => {
    api.get('/geo/children').then((r) => setRoots(r.data));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('geo.title')}</h1>
      <p className="max-w-2xl text-sm text-gray-500">
        The full Rwanda administrative hierarchy (province → district → sector → cell → village) lives in the
        database regardless of pilot status. Toggle a node to activate/deactivate it for live operations without
        any code or schema change.
      </p>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {roots.map((r) => (
          <AreaBranch key={r.id} node={r} depth={0} />
        ))}
      </div>
    </div>
  );
}
